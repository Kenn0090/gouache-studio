//! Gouache Studio's native 3D viewer (the first step of the new renderer).
//!
//! It runs in its own window on its own thread, through wgpu: Vulkan or DirectX 12 on a real graphics
//! card, and (when there is none that works) the system's software adapter, so it opens on any machine.
//! This first version shows a model with its base colour picture, lit by a sky and one light, with an
//! orbit camera. Ray tracing, the Gouache shaders and painting come in the next steps.

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

/// A model: positions, normals and UVs (flat lists) and triangle indices.
pub struct MeshData {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
    pub indices: Vec<u32>,
}

/// A picture, 8 bits per channel RGBA, top row first.
pub struct TexData {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

enum Cmd {
    Mesh(MeshData),
    Texture(TexData),
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
    pub fn set_mesh(&self, m: MeshData) {
        let _ = self.proxy.send_event(Cmd::Mesh(m));
    }
    pub fn set_texture(&self, t: TexData) {
        let _ = self.proxy.send_event(Cmd::Texture(t));
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
    cam_pos: [f32; 4],
    light_dir: [f32; 4],
    sky: [f32; 4],
    ground: [f32; 4],
}

struct Gpu {
    window: Arc<Window>,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    frame_buf: wgpu::Buffer,
    frame_bg: wgpu::BindGroup,
    tex_layout: wgpu::BindGroupLayout,
    tex_bg: wgpu::BindGroup,
    sampler: wgpu::Sampler,
    depth: wgpu::TextureView,
    vb: Option<wgpu::Buffer>,
    ib: Option<wgpu::Buffer>,
    index_count: u32,
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
    pending_mesh: Option<MeshData>,
    pending_tex: Option<TexData>,
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

fn make_texture_bg(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    layout: &wgpu::BindGroupLayout,
    sampler: &wgpu::Sampler,
    t: &TexData,
) -> wgpu::BindGroup {
    let size = wgpu::Extent3d { width: t.width.max(1), height: t.height.max(1), depth_or_array_layers: 1 };
    let mips = (32 - size.width.max(size.height).leading_zeros()).max(1);
    let tex = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("base colour"),
        size,
        mip_level_count: mips,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8UnormSrgb,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    // level 0 as given; the smaller levels are boxes of 2 × 2 made here on the CPU
    let mut level = t.rgba.clone();
    let (mut w, mut h) = (size.width, size.height);
    for m in 0..mips {
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &tex,
                mip_level: m,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &level,
            wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(4 * w), rows_per_image: Some(h) },
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );
        let (nw, nh) = ((w / 2).max(1), (h / 2).max(1));
        let mut next = vec![0u8; (nw * nh * 4) as usize];
        for y in 0..nh {
            for x in 0..nw {
                for c in 0..4usize {
                    let at = |xx: u32, yy: u32| level[(((yy.min(h - 1)) * w + xx.min(w - 1)) * 4) as usize + c] as u32;
                    let s = at(x * 2, y * 2) + at(x * 2 + 1, y * 2) + at(x * 2, y * 2 + 1) + at(x * 2 + 1, y * 2 + 1);
                    next[((y * nw + x) * 4) as usize + c] = (s / 4) as u8;
                }
            }
        }
        level = next;
        w = nw;
        h = nh;
    }
    let view = tex.create_view(&wgpu::TextureViewDescriptor::default());
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("base colour group"),
        layout,
        entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(sampler) },
        ],
    })
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
        let frame_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("frame layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None },
                count: None,
            }],
        });
        let tex_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("texture layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("viewer layout"),
            bind_group_layouts: &[&frame_layout, &tex_layout],
            push_constant_ranges: &[],
        });
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
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState { format, blend: None, write_mask: wgpu::ColorWrites::ALL })],
            }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: DEPTH_FORMAT,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: Default::default(),
                bias: Default::default(),
            }),
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
        let frame_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("frame group"),
            layout: &frame_layout,
            entries: &[wgpu::BindGroupEntry { binding: 0, resource: frame_buf.as_entire_binding() }],
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            anisotropy_clamp: 1,
            ..Default::default()
        });
        let grey = TexData { width: 1, height: 1, rgba: vec![190, 190, 190, 255] };
        let tex_bg = make_texture_bg(&device, &queue, &tex_layout, &sampler, &grey);
        let depth = make_depth(&device, config.width, config.height);
        Ok((
            Gpu {
                window,
                surface,
                device,
                queue,
                config,
                pipeline,
                frame_buf,
                frame_bg,
                tex_layout,
                tex_bg,
                sampler,
                depth,
                vb: None,
                ib: None,
                index_count: 0,
            },
            report,
        ))
    }

    fn set_mesh(&mut self, m: &MeshData) -> (Vec3, f32) {
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
        self.vb = Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("vertices"),
            contents: bytemuck::cast_slice(&verts),
            usage: wgpu::BufferUsages::VERTEX,
        }));
        self.ib = Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("indices"),
            contents: bytemuck::cast_slice(&m.indices),
            usage: wgpu::BufferUsages::INDEX,
        }));
        self.index_count = m.indices.len() as u32;
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
        let u = FrameUniform {
            view_proj: vp.to_cols_array_2d(),
            cam_pos: [eye.x, eye.y, eye.z, 1.0],
            light_dir: [0.4, 0.8, 0.5, 0.0],
            sky: [0.62, 0.72, 0.88, 1.0],
            ground: [0.30, 0.28, 0.26, 1.0],
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
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color { r: 0.035, g: 0.04, b: 0.05, a: 1.0 }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth,
                    depth_ops: Some(wgpu::Operations { load: wgpu::LoadOp::Clear(1.0), store: wgpu::StoreOp::Store }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            if let (Some(vb), Some(ib)) = (&self.vb, &self.ib) {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.frame_bg, &[]);
                pass.set_bind_group(1, &self.tex_bg, &[]);
                pass.set_vertex_buffer(0, vb.slice(..));
                pass.set_index_buffer(ib.slice(..), wgpu::IndexFormat::Uint32);
                pass.draw_indexed(0..self.index_count, 0, 0..1);
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
                if let Some(m) = self.pending_mesh.take() {
                    let (c, r) = gpu.set_mesh(&m);
                    self.frame_model(c, r);
                }
                if let Some(t) = self.pending_tex.take() {
                    gpu.tex_bg = make_texture_bg(&gpu.device, &gpu.queue, &gpu.tex_layout, &gpu.sampler, &t);
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
            Cmd::Mesh(m) => {
                if let Some(g) = self.gpu.as_mut() {
                    let (c, r) = g.set_mesh(&m);
                    self.frame_model(c, r);
                    if let Some(g) = self.gpu.as_ref() {
                        g.window.request_redraw();
                    }
                } else {
                    self.pending_mesh = Some(m);
                }
            }
            Cmd::Texture(t) => {
                if let Some(g) = self.gpu.as_mut() {
                    g.tex_bg = make_texture_bg(&g.device, &g.queue, &g.tex_layout, &g.sampler, &t);
                    g.window.request_redraw();
                } else {
                    self.pending_tex = Some(t);
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
pub fn open(mesh: MeshData, texture: Option<TexData>) -> Result<Viewer, String> {
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
                pending_mesh: Some(mesh),
                pending_tex: texture,
            };
            let _ = event_loop.run_app(&mut app);
        })
        .map_err(|e| format!("could not start the viewer thread: {e}"))?;
    let proxy = proxy_rx.recv_timeout(Duration::from_secs(5)).map_err(|_| "the viewer did not start".to_string())?;
    let report = init_rx.recv_timeout(Duration::from_secs(15)).map_err(|_| "the viewer took too long to start".to_string())??;
    Ok(Viewer { proxy, report })
}
