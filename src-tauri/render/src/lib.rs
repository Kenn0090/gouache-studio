//! Gouache Studio's native 3D viewer (the first step of the new renderer).
//!
//! It runs in its own window on its own thread, through wgpu: Vulkan or DirectX 12 on a real graphics
//! card, and (when there is none that works) the system's software adapter, so it opens on any machine.
//! This version shows a model with physically based materials (base colour, normal, roughness / metal / occlusion,
//! emissive; one material per texture set) lit by an environment picture and one sun, with an orbit camera.
//! Ray tracing, the Gouache shaders and painting come in the next steps.

use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;

use glam::{Mat4, Vec3};
use wgpu::util::DeviceExt;
use winit::application::ApplicationHandler;
use winit::dpi::PhysicalSize;
use winit::event::{ElementState, MouseButton, MouseScrollDelta, WindowEvent};
use winit::event_loop::{ActiveEventLoop, EventLoop, EventLoopProxy};
use winit::window::{Window, WindowId};

mod wire;
pub use wire::scene_from_bytes;

use half::f16;

/// A model: positions, normals and UVs (flat lists). Triangles come with each group.
pub struct MeshData {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
}

/// A picture, 8 bits per channel RGBA, top row first.
#[derive(Clone)]
pub struct Tex8 {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// One material (a texture set): the maps it has, and what to use where it has none.
#[derive(Clone, Default)]
pub struct Material {
    pub base: Option<Tex8>,
    pub orm: Option<Tex8>,
    pub normal: Option<Tex8>,
    pub emissive: Option<Tex8>,
    pub rough: f32,
    pub metal: f32,
}

/// The triangles that use one material.
pub struct Group {
    pub name: String,
    pub indices: Vec<u32>,
    pub material: Material,
}

/// The environment picture: equirectangular, linear RGB floats, top row first.
pub struct EnvData {
    pub width: u32,
    pub height: u32,
    pub rgb: Vec<f32>,
}

#[derive(Clone, Copy)]
pub struct Settings {
    /// 0 soft, 1 filmic, 5 none (the numbers the 3D view's Tone mapping uses)
    pub tone: i32,
    pub exposure: f32,
    /// the environment turned by this many turns (0 to 1)
    pub env_turn: f32,
    pub env_strength: f32,
    pub show_background: bool,
    pub sun_azimuth: f32,
    pub sun_elevation: f32,
    pub sun_intensity: f32,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { tone: 1, exposure: 1.0, env_turn: 0.0, env_strength: 1.0, show_background: true, sun_azimuth: 40.0, sun_elevation: 45.0, sun_intensity: 1.0 }
    }
}

/// Everything the viewer shows.
pub struct Scene {
    pub mesh: MeshData,
    pub groups: Vec<Group>,
    pub env: Option<EnvData>,
    pub settings: Settings,
}

/// Reads a PNG (8 or 16 bits; grey, grey + alpha, RGB or RGBA) into RGBA8.
pub fn decode_png(bytes: &[u8]) -> Result<Tex8, String> {
    let mut dec = png::Decoder::new(std::io::Cursor::new(bytes));
    dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = dec.read_info().map_err(|e| format!("not a PNG: {e}"))?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).map_err(|e| format!("PNG could not be read: {e}"))?;
    let (w, h) = (info.width, info.height);
    let n = (w * h) as usize;
    let mut rgba = vec![255u8; n * 4];
    match info.color_type {
        png::ColorType::Rgba => rgba.copy_from_slice(&buf[..n * 4]),
        png::ColorType::Rgb => {
            for i in 0..n {
                rgba[i * 4..i * 4 + 3].copy_from_slice(&buf[i * 3..i * 3 + 3]);
            }
        }
        png::ColorType::Grayscale => {
            for i in 0..n {
                let g = buf[i];
                rgba[i * 4..i * 4 + 3].copy_from_slice(&[g, g, g]);
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for i in 0..n {
                let (g, a) = (buf[i * 2], buf[i * 2 + 1]);
                rgba[i * 4..i * 4 + 4].copy_from_slice(&[g, g, g, a]);
            }
        }
        png::ColorType::Indexed => return Err("indexed PNG".into()),
    }
    Ok(Tex8 { width: w, height: h, rgba })
}

enum Cmd {
    Scene(Box<Scene>),
    Close,
}

/// What the viewer found to work with, shown to the user.
#[derive(Clone, Debug)]
pub struct AdapterReport {
    pub name: String,
    pub backend: String,
    pub kind: String,
    pub software: bool,
}

/// A running viewer. Dropping it does not close the window; call `close`.
pub struct Viewer {
    proxy: EventLoopProxy<Cmd>,
    pub report: AdapterReport,
}

impl Viewer {
    /// Replaces everything on show (model, materials, environment, settings).
    pub fn set_scene(&self, s: Scene) {
        let _ = self.proxy.send_event(Cmd::Scene(Box::new(s)));
    }
    pub fn close(&self) {
        let _ = self.proxy.send_event(Cmd::Close);
    }
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Vertex {
    pos: [f32; 3],
    nrm: [f32; 3],
    uv: [f32; 2],
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct FrameUniform {
    view_proj: [[f32; 4]; 4],
    inv_view_proj: [[f32; 4]; 4],
    cam_pos: [f32; 4],
    sun_dir: [f32; 4],
    sun_col: [f32; 4],
    params: [f32; 4],
    info: [f32; 4],
    sh: [[f32; 4]; 9],
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct MatUniform {
    flags: [f32; 4],
    tint: [f32; 4],
}

struct GpuGroup {
    ib: wgpu::Buffer,
    count: u32,
    bind: wgpu::BindGroup,
}

struct Gpu {
    window: Arc<Window>,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    bg_pipeline: wgpu::RenderPipeline,
    frame_buf: wgpu::Buffer,
    frame_layout: wgpu::BindGroupLayout,
    frame_bg: wgpu::BindGroup,
    mat_layout: wgpu::BindGroupLayout,
    tex_sampler: wgpu::Sampler,
    env_sampler: wgpu::Sampler,
    depth: wgpu::TextureView,
    vb: Option<wgpu::Buffer>,
    groups: Vec<GpuGroup>,
    settings: Settings,
    env_mips: f32,
    has_env: bool,
    sh: [[f32; 4]; 9],
}

struct Camera {
    yaw: f32,
    pitch: f32,
    dist: f32,
    target: Vec3,
    radius: f32,
}

struct App {
    gpu: Option<Gpu>,
    cam: Camera,
    drag: Option<MouseButton>,
    last: (f64, f64),
    init: Option<mpsc::Sender<Result<AdapterReport, String>>>,
    pending: Option<Scene>,
}

const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;

fn make_depth(device: &wgpu::Device, w: u32, h: u32) -> wgpu::TextureView {
    device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some("depth"),
            size: wgpu::Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: DEPTH_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        })
        .create_view(&wgpu::TextureViewDescriptor::default())
}

fn box_down(src: &[u8], w: u32, h: u32) -> (Vec<u8>, u32, u32) {
    let (nw, nh) = ((w / 2).max(1), (h / 2).max(1));
    let mut out = vec![0u8; (nw * nh * 4) as usize];
    for y in 0..nh {
        for x in 0..nw {
            for c in 0..4usize {
                let at = |xx: u32, yy: u32| src[(((yy.min(h - 1)) * w + xx.min(w - 1)) * 4) as usize + c] as u32;
                let s = at(x * 2, y * 2) + at(x * 2 + 1, y * 2) + at(x * 2, y * 2 + 1) + at(x * 2 + 1, y * 2 + 1);
                out[((y * nw + x) * 4) as usize + c] = (s / 4) as u8;
            }
        }
    }
    (out, nw, nh)
}

/// A texture with all its smaller levels, from a picture (or a single colour when there is none).
fn make_tex8(device: &wgpu::Device, queue: &wgpu::Queue, t: Option<&Tex8>, fallback: [u8; 4], format: wgpu::TextureFormat) -> wgpu::TextureView {
    let one = Tex8 { width: 1, height: 1, rgba: fallback.to_vec() };
    let t = t.filter(|t| t.width > 0 && t.height > 0 && t.rgba.len() >= (t.width * t.height * 4) as usize).unwrap_or(&one);
    let size = wgpu::Extent3d { width: t.width, height: t.height, depth_or_array_layers: 1 };
    let mips = (32 - size.width.max(size.height).leading_zeros()).max(1);
    let tex = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("map"),
        size,
        mip_level_count: mips,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    let mut level = t.rgba.clone();
    let (mut w, mut h) = (size.width, size.height);
    for m in 0..mips {
        queue.write_texture(
            wgpu::TexelCopyTextureInfo { texture: &tex, mip_level: m, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            &level,
            wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(4 * w), rows_per_image: Some(h) },
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );
        if m + 1 < mips {
            let (n, nw, nh) = box_down(&level, w, h);
            level = n;
            w = nw;
            h = nh;
        }
    }
    tex.create_view(&wgpu::TextureViewDescriptor::default())
}

/// The environment: a half-float picture with its smaller levels (blurrier ones stand in for rough reflections),
/// and the diffuse lighting it gives, as nine spherical-harmonic colours.
fn build_env(device: &wgpu::Device, queue: &wgpu::Queue, env: &EnvData) -> (wgpu::TextureView, f32, [[f32; 4]; 9]) {
    let (mut w, mut h) = (env.width.max(2), env.height.max(1));
    let mut level: Vec<f32> = env.rgb.clone();
    if level.len() < (w * h * 3) as usize {
        level.resize((w * h * 3) as usize, 0.0);
    }
    let mips = (32 - w.max(h).leading_zeros()).max(1).min(10);
    let tex = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("environment"),
        size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        mip_level_count: mips,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba16Float,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    let mut sh_src: Option<(Vec<f32>, u32, u32)> = None;
    for m in 0..mips {
        let mut px = Vec::with_capacity((w * h * 4) as usize);
        for i in 0..(w * h) as usize {
            for c in 0..3 {
                px.push(f16::from_f32(level[i * 3 + c].clamp(0.0, 6e4)));
            }
            px.push(f16::from_f32(1.0));
        }
        queue.write_texture(
            wgpu::TexelCopyTextureInfo { texture: &tex, mip_level: m, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            bytemuck::cast_slice(&px),
            wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(8 * w), rows_per_image: Some(h) },
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );
        if sh_src.is_none() && w <= 128 {
            sh_src = Some((level.clone(), w, h));
        }
        if m + 1 < mips {
            let (nw, nh) = ((w / 2).max(1), (h / 2).max(1));
            let mut next = vec![0f32; (nw * nh * 3) as usize];
            for y in 0..nh {
                for x in 0..nw {
                    for c in 0..3usize {
                        let at = |xx: u32, yy: u32| level[(((yy.min(h - 1)) * w + xx.min(w - 1)) * 3) as usize + c];
                        next[((y * nw + x) * 3) as usize + c] = (at(x * 2, y * 2) + at(x * 2 + 1, y * 2) + at(x * 2, y * 2 + 1) + at(x * 2 + 1, y * 2 + 1)) * 0.25;
                    }
                }
            }
            level = next;
            w = nw;
            h = nh;
        }
    }
    let (src, sw, sh_h) = sh_src.unwrap_or((level, w, h));
    (tex.create_view(&wgpu::TextureViewDescriptor::default()), mips as f32, compute_sh(&src, sw, sh_h))
}

/// Nine spherical-harmonic colours for the diffuse light of an equirectangular picture (already scaled for a Lambert surface).
fn compute_sh(rgb: &[f32], w: u32, h: u32) -> [[f32; 4]; 9] {
    let mut c = [[0f64; 3]; 9];
    let pi = std::f64::consts::PI;
    for y in 0..h {
        let th = (y as f64 + 0.5) / h as f64 * pi;
        let dw = th.sin() * (pi / h as f64) * (2.0 * pi / w as f64);
        for x in 0..w {
            let ph = ((x as f64 + 0.5) / w as f64 - 0.5) * 2.0 * pi;
            let (dx, dy, dz) = (th.sin() * ph.sin(), th.cos(), -th.sin() * ph.cos());
            let b = [
                0.282095,
                0.488603 * dy,
                0.488603 * dz,
                0.488603 * dx,
                1.092548 * dx * dy,
                1.092548 * dy * dz,
                0.315392 * (3.0 * dz * dz - 1.0),
                1.092548 * dx * dz,
                0.546274 * (dx * dx - dy * dy),
            ];
            let i = ((y * w + x) * 3) as usize;
            for k in 0..9 {
                for ch in 0..3 {
                    c[k][ch] += rgb[i + ch] as f64 * b[k] * dw;
                }
            }
        }
    }
    let a = [1.0, 2.0 / 3.0, 2.0 / 3.0, 2.0 / 3.0, 0.25, 0.25, 0.25, 0.25, 0.25];
    let mut out = [[0f32; 4]; 9];
    for k in 0..9 {
        for ch in 0..3 {
            out[k][ch] = (c[k][ch] * a[k]) as f32;
        }
    }
    out
}

impl Gpu {
    fn new(event_loop: &ActiveEventLoop) -> Result<(Gpu, AdapterReport), String> {
        let window = Arc::new(
            event_loop
                .create_window(
                    Window::default_attributes()
                        .with_title("Gouache Studio · new viewer (test)")
                        .with_inner_size(PhysicalSize::new(1100u32, 760u32)),
                )
                .map_err(|e| format!("could not open the window: {e}"))?,
        );
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor::default());
        let surface = instance.create_surface(window.clone()).map_err(|e| format!("no drawing surface: {e}"))?;
        // a real graphics card first; if none works, the software adapter (so it still opens)
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        }))
        .or_else(|_| {
            pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::LowPower,
                compatible_surface: Some(&surface),
                force_fallback_adapter: true,
            }))
        })
        .map_err(|e| format!("no graphics adapter could be used: {e}"))?;
        let ai = adapter.get_info();
        let report = AdapterReport {
            name: ai.name.clone(),
            backend: format!("{:?}", ai.backend),
            kind: format!("{:?}", ai.device_type),
            software: matches!(ai.device_type, wgpu::DeviceType::Cpu),
        };
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("gouache viewer"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::downlevel_defaults().using_resolution(adapter.limits()),
            memory_hints: wgpu::MemoryHints::default(),
            trace: wgpu::Trace::Off,
        }))
        .map_err(|e| format!("the graphics device could not start: {e}"))?;

        let caps = surface.get_capabilities(&adapter);
        let format = caps.formats.iter().copied().find(|f| f.is_srgb()).unwrap_or(caps.formats[0]);
        let size = window.inner_size();
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: size.width.max(1),
            height: size.height.max(1),
            present_mode: wgpu::PresentMode::AutoVsync,
            desired_maximum_frame_latency: 2,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
        };
        surface.configure(&device, &config);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("viewer shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
        });
        let tex_entry = |binding: u32| wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::FRAGMENT,
            ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false },
            count: None,
        };
        let frame_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("frame layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None },
                    count: None,
                },
                tex_entry(1),
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
            ],
        });
        let mat_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("material layout"),
            entries: &[
                tex_entry(0),
                tex_entry(1),
                tex_entry(2),
                tex_entry(3),
                wgpu::BindGroupLayoutEntry { binding: 4, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None },
                    count: None,
                },
            ],
        });
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("viewer layout"),
            bind_group_layouts: &[&frame_layout, &mat_layout],
            push_constant_ranges: &[],
        });
        let bg_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("background layout"),
            bind_group_layouts: &[&frame_layout],
            push_constant_ranges: &[],
        });
        let target = [Some(wgpu::ColorTargetState { format, blend: None, write_mask: wgpu::ColorWrites::ALL })];
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("viewer pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<Vertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2],
                }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: true, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let bg_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("background pipeline"),
            layout: Some(&bg_layout),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_bg"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_bg"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: false, depth_compare: wgpu::CompareFunction::Always, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let frame_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("frame"),
            size: std::mem::size_of::<FrameUniform>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let tex_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            anisotropy_clamp: 8,
            ..Default::default()
        });
        let env_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let depth = make_depth(&device, config.width, config.height);
        let black = EnvData { width: 2, height: 1, rgb: vec![0.0; 6] };
        let (env_view, env_mips, env_sh) = build_env(&device, &queue, &black);
        let frame_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("frame group"),
            layout: &frame_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: frame_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&env_view) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&env_sampler) },
            ],
        });
        let gpu = Gpu {
            window,
            surface,
            device,
            queue,
            config,
            pipeline,
            bg_pipeline,
            frame_buf,
            frame_bg,
            frame_layout,
            mat_layout,
            tex_sampler,
            env_sampler,
            depth,
            vb: None,
            groups: Vec::new(),
            settings: Settings::default(),
            env_mips,
            has_env: false,
            sh: env_sh,
        };
        Ok((gpu, report))
    }

    fn set_env(&mut self, env: Option<&EnvData>) {
        let (view, mips, sh, has) = match env {
            Some(e) => {
                let (v, m, s) = build_env(&self.device, &self.queue, e);
                (v, m, s, true)
            }
            None => {
                let black = EnvData { width: 2, height: 1, rgb: vec![0.0; 6] };
                let (v, m, s) = build_env(&self.device, &self.queue, &black);
                (v, m, s, false)
            }
        };
        self.env_mips = mips;
        self.sh = sh;
        self.has_env = has;
        self.frame_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("frame group"),
            layout: &self.frame_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: self.frame_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&view) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&self.env_sampler) },
            ],
        });
    }

    /// Puts a whole scene on the graphics card. Returns the centre and radius of the model.
    fn set_scene(&mut self, s: &Scene) -> (Vec3, f32) {
        self.settings = s.settings;
        self.set_env(s.env.as_ref());
        let m = &s.mesh;
        let n = m.positions.len() / 3;
        let mut verts = Vec::with_capacity(n);
        let (mut mn, mut mx) = (Vec3::splat(f32::MAX), Vec3::splat(f32::MIN));
        for i in 0..n {
            let p = Vec3::new(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
            mn = mn.min(p);
            mx = mx.max(p);
            let nr = if m.normals.len() >= (i + 1) * 3 { [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]] } else { [0.0, 1.0, 0.0] };
            let uv = if m.uvs.len() >= (i + 1) * 2 { [m.uvs[i * 2], 1.0 - m.uvs[i * 2 + 1]] } else { [0.0, 0.0] };
            verts.push(Vertex { pos: [p.x, p.y, p.z], nrm: nr, uv });
        }
        self.vb = Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("vertices"), contents: bytemuck::cast_slice(&verts), usage: wgpu::BufferUsages::VERTEX }));
        self.groups.clear();
        for g in &s.groups {
            if g.indices.is_empty() {
                continue;
            }
            let mat = &g.material;
            let view = |t: Option<&Tex8>, fb: [u8; 4], f: wgpu::TextureFormat| make_tex8(&self.device, &self.queue, t, fb, f);
            let base = view(mat.base.as_ref(), [255, 255, 255, 255], wgpu::TextureFormat::Rgba8UnormSrgb);
            let orm = view(mat.orm.as_ref(), [255, 255, 255, 255], wgpu::TextureFormat::Rgba8Unorm);
            let nrm = view(mat.normal.as_ref(), [128, 128, 255, 255], wgpu::TextureFormat::Rgba8Unorm);
            let emi = view(mat.emissive.as_ref(), [0, 0, 0, 255], wgpu::TextureFormat::Rgba8UnormSrgb);
            let mu = MatUniform { flags: [if mat.orm.is_some() { 1.0 } else { 0.0 }, if mat.rough > 0.0 { mat.rough } else { 0.6 }, mat.metal, 0.0], tint: [1.0, 1.0, 1.0, 1.0] };
            let mb = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("material"), contents: bytemuck::bytes_of(&mu), usage: wgpu::BufferUsages::UNIFORM });
            let bind = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("material group"),
                layout: &self.mat_layout,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&base) },
                    wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&orm) },
                    wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(&nrm) },
                    wgpu::BindGroupEntry { binding: 3, resource: wgpu::BindingResource::TextureView(&emi) },
                    wgpu::BindGroupEntry { binding: 4, resource: wgpu::BindingResource::Sampler(&self.tex_sampler) },
                    wgpu::BindGroupEntry { binding: 5, resource: mb.as_entire_binding() },
                ],
            });
            let ib = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("indices"), contents: bytemuck::cast_slice(&g.indices), usage: wgpu::BufferUsages::INDEX });
            self.groups.push(GpuGroup { ib, count: g.indices.len() as u32, bind });
        }
        let c = (mn + mx) * 0.5;
        (c, ((mx - mn).length() * 0.5).max(1e-4))
    }

    fn resize(&mut self, w: u32, h: u32) {
        if w == 0 || h == 0 {
            return;
        }
        self.config.width = w;
        self.config.height = h;
        self.surface.configure(&self.device, &self.config);
        self.depth = make_depth(&self.device, w, h);
    }

    fn draw(&mut self, cam: &Camera) {
        let frame = match self.surface.get_current_texture() {
            Ok(f) => f,
            Err(_) => {
                self.surface.configure(&self.device, &self.config);
                return;
            }
        };
        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());
        let aspect = self.config.width as f32 / self.config.height as f32;
        let dir = Vec3::new(cam.yaw.cos() * cam.pitch.cos(), cam.pitch.sin(), cam.yaw.sin() * cam.pitch.cos());
        let eye = cam.target + dir * cam.dist;
        let proj = Mat4::perspective_rh(45f32.to_radians(), aspect, (cam.dist * 0.01).max(1e-4), cam.dist * 20.0 + cam.radius * 4.0);
        let vp = proj * Mat4::look_at_rh(eye, cam.target, Vec3::Y);
        let st = self.settings;
        let (az, el) = (st.sun_azimuth.to_radians(), st.sun_elevation.to_radians());
        let sun = Vec3::new(el.cos() * az.sin(), el.sin(), el.cos() * az.cos());
        let u = FrameUniform {
            view_proj: vp.to_cols_array_2d(),
            inv_view_proj: vp.inverse().to_cols_array_2d(),
            cam_pos: [eye.x, eye.y, eye.z, 1.0],
            sun_dir: [sun.x, sun.y, sun.z, 0.0],
            sun_col: [3.0 * st.sun_intensity, 2.9 * st.sun_intensity, 2.7 * st.sun_intensity, 0.0],
            params: [st.exposure, st.env_turn, st.env_strength, st.tone as f32],
            info: [self.env_mips, if self.has_env { 1.0 } else { 0.0 }, if st.show_background { 1.0 } else { 0.0 }, 0.0],
            sh: self.sh,
        };
        self.queue.write_buffer(&self.frame_buf, 0, bytemuck::bytes_of(&u));
        let mut enc = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("frame") });
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("viewer"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color { r: 0.035, g: 0.04, b: 0.05, a: 1.0 }), store: wgpu::StoreOp::Store },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth,
                    depth_ops: Some(wgpu::Operations { load: wgpu::LoadOp::Clear(1.0), store: wgpu::StoreOp::Store }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&self.bg_pipeline);
            pass.set_bind_group(0, &self.frame_bg, &[]);
            pass.draw(0..3, 0..1);
            if let Some(vb) = &self.vb {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.frame_bg, &[]);
                pass.set_vertex_buffer(0, vb.slice(..));
                for g in &self.groups {
                    pass.set_bind_group(1, &g.bind, &[]);
                    pass.set_index_buffer(g.ib.slice(..), wgpu::IndexFormat::Uint32);
                    pass.draw_indexed(0..g.count, 0, 0..1);
                }
            }
        }
        self.queue.submit(Some(enc.finish()));
        self.window.pre_present_notify();
        frame.present();
    }
}

impl App {
    fn frame_model(&mut self, c: Vec3, r: f32) {
        self.cam.target = c;
        self.cam.radius = r;
        self.cam.dist = r * 2.6;
    }
}

impl ApplicationHandler<Cmd> for App {
    fn resumed(&mut self, el: &ActiveEventLoop) {
        if self.gpu.is_some() {
            return;
        }
        match Gpu::new(el) {
            Ok((mut gpu, report)) => {
                if let Some(s) = self.pending.take() {
                    let (c, r) = gpu.set_scene(&s);
                    self.frame_model(c, r);
                }
                gpu.window.request_redraw();
                self.gpu = Some(gpu);
                if let Some(tx) = self.init.take() {
                    let _ = tx.send(Ok(report));
                }
            }
            Err(e) => {
                if let Some(tx) = self.init.take() {
                    let _ = tx.send(Err(e));
                }
                el.exit();
            }
        }
    }

    fn user_event(&mut self, el: &ActiveEventLoop, cmd: Cmd) {
        match cmd {
            Cmd::Close => el.exit(),
            Cmd::Scene(s) => {
                if let Some(g) = self.gpu.as_mut() {
                    let (c, r) = g.set_scene(&s);
                    self.frame_model(c, r);
                    if let Some(g) = self.gpu.as_ref() {
                        g.window.request_redraw();
                    }
                } else {
                    self.pending = Some(*s);
                }
            }
        }
    }

    fn window_event(&mut self, el: &ActiveEventLoop, _id: WindowId, ev: WindowEvent) {
        match ev {
            WindowEvent::CloseRequested => el.exit(),
            WindowEvent::Resized(s) => {
                if let Some(g) = self.gpu.as_mut() {
                    g.resize(s.width, s.height);
                    g.window.request_redraw();
                }
            }
            WindowEvent::RedrawRequested => {
                if let Some(g) = self.gpu.as_mut() {
                    g.draw(&self.cam);
                }
            }
            WindowEvent::MouseInput { state, button, .. } => {
                self.drag = if state == ElementState::Pressed { Some(button) } else { None };
            }
            WindowEvent::CursorMoved { position, .. } => {
                let (dx, dy) = ((position.x - self.last.0) as f32, (position.y - self.last.1) as f32);
                self.last = (position.x, position.y);
                match self.drag {
                    Some(MouseButton::Left) => {
                        self.cam.yaw -= dx * 0.008;
                        self.cam.pitch = (self.cam.pitch + dy * 0.008).clamp(-1.5, 1.5);
                    }
                    Some(MouseButton::Right) => {
                        self.cam.dist = (self.cam.dist * (1.0 + dy * 0.01)).max(self.cam.radius * 0.05);
                    }
                    Some(MouseButton::Middle) => {
                        let dir = Vec3::new(self.cam.yaw.cos() * self.cam.pitch.cos(), self.cam.pitch.sin(), self.cam.yaw.sin() * self.cam.pitch.cos());
                        let right = dir.cross(Vec3::Y).normalize_or_zero();
                        let up = right.cross(dir).normalize_or_zero();
                        let k = self.cam.dist * 0.0016;
                        self.cam.target += (-right * dx + up * dy) * k;
                    }
                    _ => {}
                }
                if self.drag.is_some() {
                    if let Some(g) = self.gpu.as_ref() {
                        g.window.request_redraw();
                    }
                }
            }
            WindowEvent::MouseWheel { delta, .. } => {
                let s = match delta {
                    MouseScrollDelta::LineDelta(_, y) => y,
                    MouseScrollDelta::PixelDelta(p) => p.y as f32 / 40.0,
                };
                self.cam.dist = (self.cam.dist * (1.0 - s * 0.1)).max(self.cam.radius * 0.05);
                if let Some(g) = self.gpu.as_ref() {
                    g.window.request_redraw();
                }
            }
            _ => {}
        }
    }
}

/// Opens the viewer window on its own thread and waits (up to 15 seconds) for it to say what it is
/// running on. Errors come back as plain sentences.
pub fn open(scene: Scene) -> Result<Viewer, String> {
    let (proxy_tx, proxy_rx) = mpsc::channel::<EventLoopProxy<Cmd>>();
    let (init_tx, init_rx) = mpsc::channel::<Result<AdapterReport, String>>();
    std::thread::Builder::new()
        .name("gouache-viewer".into())
        .spawn(move || {
            let mut builder = EventLoop::<Cmd>::with_user_event();
            #[cfg(target_os = "windows")]
            {
                use winit::platform::windows::EventLoopBuilderExtWindows;
                builder.with_any_thread(true);
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                use winit::platform::x11::EventLoopBuilderExtX11;
                builder.with_any_thread(true);
            }
            let event_loop = match builder.build() {
                Ok(e) => e,
                Err(e) => {
                    let _ = init_tx.send(Err(format!("the window system would not start: {e}")));
                    return;
                }
            };
            let _ = proxy_tx.send(event_loop.create_proxy());
            let mut app = App {
                gpu: None,
                cam: Camera { yaw: 0.9, pitch: 0.35, dist: 3.0, target: Vec3::ZERO, radius: 1.0 },
                drag: None,
                last: (0.0, 0.0),
                init: Some(init_tx),
                pending: Some(scene),
            };
            let _ = event_loop.run_app(&mut app);
        })
        .map_err(|e| format!("could not start the viewer thread: {e}"))?;
    let proxy = proxy_rx.recv_timeout(Duration::from_secs(5)).map_err(|_| "the viewer did not start".to_string())?;
    let report = init_rx.recv_timeout(Duration::from_secs(15)).map_err(|_| "the viewer took too long to start".to_string())??;
    Ok(Viewer { proxy, report })
}
