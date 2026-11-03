//! Ray-traced shadows and ambient occlusion (step one of ray tracing in the viewer).
//! The model is drawn as usual into a picture with its surface directions; a compute shader then sends a few rays per
//! pixel through a bounding-volume tree (so it runs on any graphics card), the answers are added up over frames, and the
//! result darkens the picture where the sun is blocked and where corners are crowded.

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

use crate::bvh;

/// Samples added up per pixel before it stops drawing new frames.
pub const RT_SAMPLES: u32 = 96;
pub const NORMAL_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba16Float;
const RT_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba16Float;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct RtUniform {
    inv_view_proj: [[f32; 4]; 4],
    cam_pos: [f32; 4],
    sun_dir: [f32; 4],
    p: [f32; 4],
    res: [f32; 4],
}

pub struct Rt {
    cs: wgpu::ComputePipeline,
    cs_layout: wgpu::BindGroupLayout,
    comp: wgpu::RenderPipeline,
    comp_layout: wgpu::BindGroupLayout,
    uniform: wgpu::Buffer,
    comp_uniform: wgpu::Buffer,
    nodes: wgpu::Buffer,
    tris: wgpu::Buffer,
    has_tree: bool,
    tex: Vec<(wgpu::Texture, wgpu::TextureView)>,
    size: (u32, u32),
    /// which of the two accumulation pictures holds the latest result
    cur: usize,
    pub samples: u32,
    key: Vec<f32>,
    /// the model, kept until the tree is built
    pub src: Option<(Vec<f32>, Vec<u32>)>,
    pub radius: f32,
}

fn storage_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry { binding, visibility: wgpu::ShaderStages::COMPUTE, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Storage { read_only: true }, has_dynamic_offset: false, min_binding_size: None }, count: None }
}
fn tex_entry(binding: u32, vis: wgpu::ShaderStages, depth: bool) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: vis,
        ty: wgpu::BindingType::Texture {
            sample_type: if depth { wgpu::TextureSampleType::Depth } else { wgpu::TextureSampleType::Float { filterable: false } },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}
fn uniform_entry(binding: u32, vis: wgpu::ShaderStages) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry { binding, visibility: vis, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }, count: None }
}

impl Rt {
    pub fn new(device: &wgpu::Device, surface_format: wgpu::TextureFormat) -> Rt {
        let c = wgpu::ShaderStages::COMPUTE;
        let cs_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("rt layout"),
            entries: &[
                uniform_entry(0, c),
                tex_entry(1, c, true),
                tex_entry(2, c, false),
                storage_entry(3),
                storage_entry(4),
                tex_entry(5, c, false),
                tex_entry(7, c, false),
                wgpu::BindGroupLayoutEntry { binding: 6, visibility: c, ty: wgpu::BindingType::StorageTexture { access: wgpu::StorageTextureAccess::WriteOnly, format: RT_FORMAT, view_dimension: wgpu::TextureViewDimension::D2 }, count: None },
            ],
        });
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("rt"), source: wgpu::ShaderSource::Wgsl(include_str!("rt.wgsl").into()) });
        let cs = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("rt pipeline"),
            layout: Some(&device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("rt pl"), bind_group_layouts: &[&cs_layout], push_constant_ranges: &[] })),
            module: &module,
            entry_point: Some("cs"),
            compilation_options: Default::default(),
            cache: None,
        });
        let f = wgpu::ShaderStages::FRAGMENT;
        let comp_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("composite layout"),
            entries: &[uniform_entry(0, f), tex_entry(1, f, false), tex_entry(2, f, false), tex_entry(3, f, false), tex_entry(4, f, false)],
        });
        let cmod = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("composite"), source: wgpu::ShaderSource::Wgsl(include_str!("comp.wgsl").into()) });
        let comp = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("composite pipeline"),
            layout: Some(&device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("comp pl"), bind_group_layouts: &[&comp_layout], push_constant_ranges: &[] })),
            vertex: wgpu::VertexState { module: &cmod, entry_point: Some("vs_comp"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &cmod, entry_point: Some("fs_comp"), compilation_options: Default::default(), targets: &[Some(wgpu::ColorTargetState { format: surface_format, blend: None, write_mask: wgpu::ColorWrites::ALL })] }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let uniform = device.create_buffer(&wgpu::BufferDescriptor { label: Some("rt uniform"), size: std::mem::size_of::<RtUniform>() as u64, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let comp_uniform = device.create_buffer(&wgpu::BufferDescriptor { label: Some("composite uniform"), size: 16, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let one = |label| device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some(label), contents: &[0u8; 64], usage: wgpu::BufferUsages::STORAGE });
        Rt { cs, cs_layout, comp, comp_layout, uniform, comp_uniform, nodes: one("no nodes"), tris: one("no triangles"), has_tree: false, tex: Vec::new(), size: (0, 0), cur: 0, samples: 0, key: Vec::new(), src: None, radius: 1.0 }
    }

    /// Builds the tree from the model kept in `src` (once).
    pub fn ensure_tree(&mut self, device: &wgpu::Device) {
        if self.has_tree {
            return;
        }
        let Some((pos, idx)) = self.src.take() else { return };
        if idx.len() < 3 {
            return;
        }
        let tree = bvh::build(&pos, &idx);
        self.nodes = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("tree nodes"), contents: bytemuck::cast_slice(&tree.nodes), usage: wgpu::BufferUsages::STORAGE });
        self.tris = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("tree triangles"), contents: bytemuck::cast_slice(&tree.tris), usage: wgpu::BufferUsages::STORAGE });
        self.has_tree = true;
        self.samples = 0;
    }

    /// A new model: the old tree is gone.
    pub fn new_model(&mut self, pos: Vec<f32>, idx: Vec<u32>, radius: f32) {
        self.has_tree = false;
        self.src = Some((pos, idx));
        self.radius = radius;
        self.samples = 0;
    }

    fn ensure_textures(&mut self, device: &wgpu::Device, w: u32, h: u32) {
        if self.size == (w, h) && !self.tex.is_empty() {
            return;
        }
        self.tex.clear();
        for _ in 0..2 {
            let t = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("rt accumulation"),
                size: wgpu::Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: RT_FORMAT,
                usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            });
            let v = t.create_view(&wgpu::TextureViewDescriptor::default());
            self.tex.push((t, v));
        }
        self.size = (w, h);
        self.samples = 0;
    }

    /// Adds one more round of rays (starting over when the view, the sun or the size changed).
    #[allow(clippy::too_many_arguments)]
    pub fn trace(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, enc: &mut wgpu::CommandEncoder, depth: &wgpu::TextureView, normal: &wgpu::TextureView, mat: &wgpu::TextureView, inv_vp: [[f32; 4]; 4], eye: [f32; 3], sun: [f32; 3], sun_soft: f32, w: u32, h: u32) {
        self.ensure_tree(device);
        self.ensure_textures(device, w, h);
        let mut key: Vec<f32> = inv_vp.iter().flatten().copied().collect();
        key.extend_from_slice(&[sun[0], sun[1], sun[2], sun_soft, w as f32, h as f32]);
        if key != self.key {
            self.key = key;
            self.samples = 0;
        }
        if self.samples >= RT_SAMPLES {
            return;
        }
        let u = RtUniform {
            inv_view_proj: inv_vp,
            cam_pos: [eye[0], eye[1], eye[2], 1.0],
            sun_dir: [sun[0], sun[1], sun[2], sun_soft],
            p: [self.samples as f32, self.radius * 0.25, self.radius * 0.002, if self.has_tree { 1.0 } else { 0.0 }],
            res: [w as f32, h as f32, 0.0, 0.0],
        };
        queue.write_buffer(&self.uniform, 0, bytemuck::bytes_of(&u));
        // the first round starts from nothing: read from the other picture, which holds a count of zero
        if self.samples == 0 {
            let zeros = vec![0u8; (w as usize) * (h as usize) * 8];
            queue.write_texture(
                wgpu::TexelCopyTextureInfo { texture: &self.tex[1 - self.cur].0, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
                &zeros,
                wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(w * 8), rows_per_image: Some(h) },
                wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            );
            self.cur = 1 - self.cur;
        }
        let (prev, out) = (&self.tex[self.cur].1, &self.tex[1 - self.cur].1);
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("rt group"),
            layout: &self.cs_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: self.uniform.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(depth) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(normal) },
                wgpu::BindGroupEntry { binding: 3, resource: self.nodes.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 4, resource: self.tris.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 5, resource: wgpu::BindingResource::TextureView(prev) },
                wgpu::BindGroupEntry { binding: 6, resource: wgpu::BindingResource::TextureView(out) },
                wgpu::BindGroupEntry { binding: 7, resource: wgpu::BindingResource::TextureView(mat) },
            ],
        });
        {
            let mut pass = enc.begin_compute_pass(&wgpu::ComputePassDescriptor { label: Some("rays"), timestamp_writes: None });
            pass.set_pipeline(&self.cs);
            pass.set_bind_group(0, &bg, &[]);
            pass.dispatch_workgroups(w.div_ceil(8), h.div_ceil(8), 1);
        }
        self.cur = 1 - self.cur;
        self.samples += 1;
    }

    /// True while more rounds of rays are still to come.
    pub fn busy(&self) -> bool {
        self.samples < RT_SAMPLES
    }

    /// Draws the finished picture: the scene, darkened by what the rays found (when `on`).
    pub fn composite<'a>(&'a self, device: &wgpu::Device, queue: &wgpu::Queue, pass: &mut wgpu::RenderPass<'a>, scene: &wgpu::TextureView, normal: &wgpu::TextureView, mat: &wgpu::TextureView, on: bool) {
        let use_rt = on && self.has_tree && !self.tex.is_empty();
        queue.write_buffer(&self.comp_uniform, 0, bytemuck::cast_slice(&[if use_rt { 1.0f32 } else { 0.0 }, 0.9, 0.85, 0.7]));
        let rt_view = if self.tex.is_empty() { scene } else { &self.tex[self.cur].1 };
        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("composite group"),
            layout: &self.comp_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: self.comp_uniform.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(scene) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(normal) },
                wgpu::BindGroupEntry { binding: 3, resource: wgpu::BindingResource::TextureView(rt_view) },
                wgpu::BindGroupEntry { binding: 4, resource: wgpu::BindingResource::TextureView(mat) },
            ],
        });
        pass.set_pipeline(&self.comp);
        pass.set_bind_group(0, &bg, &[]);
        pass.draw(0..3, 0..1);
    }
}
