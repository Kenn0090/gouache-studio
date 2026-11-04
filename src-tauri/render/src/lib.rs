//! Gouache Studio's native 3D viewer (the first step of the new renderer).
//!
//! It runs in its own window on its own thread, through wgpu: Vulkan or DirectX 12 on a real graphics
//! card, and (when there is none that works) the system's software adapter, so it opens on any machine.
//! This version shows a model with physically based materials (base colour, normal, roughness / metal / occlusion,
//! emissive; one material per texture set) lit by an environment picture and one sun, with an orbit camera.
//! Ray tracing, the Gouache shaders and painting come in the next steps.

use std::sync::mpsc;
use std::sync::Arc;
use std::time::{Duration, Instant};

use glam::{Mat4, Vec3};
use wgpu::util::DeviceExt;
use winit::application::ApplicationHandler;
use winit::dpi::PhysicalSize;
use winit::event::{ElementState, MouseButton, MouseScrollDelta, WindowEvent};
use winit::keyboard::{Key, NamedKey};
use winit::event_loop::{ActiveEventLoop, EventLoop, EventLoopProxy};
use winit::window::{Window, WindowId};

mod bvh;
mod rt;
mod wire;
pub use wire::{scene_from_bytes, textures_from_bytes, update_from_bytes};

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

/// The 3D view's shader of a texture set and its settings, as the 3D view keeps them (kind: 0 standard, 1 skin,
/// 2 brushed metal, 3 velvet, 4 toon, 5 cel, 6 spec/gloss, 7 panner, 8 retro).
#[derive(Clone, Copy, Default)]
pub struct ShaderParams {
    pub kind: i32,
    pub p: [f32; 4],
    pub q: [f32; 4],
    pub c: [f32; 3],
    pub d: [f32; 3],
    pub skin: [f32; 4],
    /// four more settings (Ink toon)
    pub e: [f32; 4],
}

/// One material (a texture set): the maps it has, and what to use where it has none.
#[derive(Clone, Default)]
pub struct Material {
    pub shader: ShaderParams,
    pub base: Option<Tex8>,
    pub orm: Option<Tex8>,
    pub normal: Option<Tex8>,
    pub emissive: Option<Tex8>,
    /// a height map (its red channel); it travels in the alpha of the normal map so the vertex shader can read it
    pub height: Option<Tex8>,
    /// a thickness map (skin): it travels in the alpha of the emissive map
    pub thick: Option<Tex8>,
    /// a UDIM tile (u, v): only the part of the model whose UVs fall in that tile shows this material
    pub udim: Option<[u32; 2]>,
    /// the Bake tab's Unfold: where this material's piece sits along x when the model is laid flat
    pub fold_off: f32,
    pub rough: f32,
    pub metal: f32,
    /// when new pictures arrive for an existing material: maps left out (None) keep what they had
    pub partial: bool,
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
    /// how blurred the environment is behind the model (0 sharp to 1 very soft), as the 3D view's Background blur
    pub env_blur: f32,
    pub sun_azimuth: f32,
    pub sun_elevation: f32,
    pub sun_intensity: f32,
    /// vertical field of view in degrees (the 3D view's)
    pub fov: f32,
    /// painting is on: a plain left-drag paints (events go to the page), Alt + drag moves the camera
    pub paint: bool,
    /// brush size as a fraction of the view's height (0 hides the outline)
    pub brush: f32,
    /// ray-traced shadows and ambient occlusion
    pub rt: bool,
    /// how strong the ray-traced shadows, corner darkening and reflections show (0 to 1), how soft the sun's shadows are, and how many rounds of rays are added
    pub rt_shadow: f32,
    pub rt_ao: f32,
    pub rt_refl: f32,
    pub rt_soft: f32,
    pub rt_samples: u32,
    /// when the page moves its own camera: eye and target, to follow it (applied once, not kept)
    pub cam: Option<[f32; 6]>,
    /// the colour behind the model when the environment is not shown (as it should look on screen, like the 3D view's background)
    pub bg: [f32; 3],
    /// smooth the jagged edges (the window is not drawn with multisampling)
    pub smooth: bool,
    /// no depth shrinking (the 3D view's Orthographic)
    pub ortho: bool,
    /// the 3D view's studio fill and rim lights (strength, 0 = off), the albedo-only view, and the polished-metal view (its roughness, 0 = off)
    pub studio_fill: f32,
    pub studio_rim: f32,
    pub wire: u8,
    /// mirror guides: planes (x, y, z: NaN = off, else the offset), radial (count, axis 0..2), centre of the radial axis, guide size
    pub mir: [f32; 3],
    pub mir_radial: [f32; 2],
    pub mir_off: [f32; 3],
    pub mir_r: f32,
    /// height depth (displacement), in model units for a full-white height (0 = off)
    pub disp: f32,
    /// the Bake tab's Unfold slider (0 = the model, 1 = laid flat on its UV layout)
    pub fold: f32,
    /// the page wants to know where the camera is (the Bevel preview is made for the window's own view)
    pub track: bool,
    /// the high-poly of the Bake tab: 0 off, 1 see-through over the model, 2 on its own (the model hidden)
    pub hv: u8,
    /// the mirror copies of the brush ring: how many (1 = none) and their matrices (column-major, the first is the identity)
    pub mirc_n: u32,
    pub mirc: [[f32; 16]; 32],
    /// the shadow floor: on, height (world Y), half size, opacity, colour
    pub floor: [f32; 4],
    pub floor_col: [f32; 3],
    /// cut out parts with less than half opacity (the 3D view's "Cut out transparent areas")
    pub clip: bool,
    /// post processing on the finished picture: on, and seven groups of four numbers (see post.wgsl)
    pub post_on: bool,
    pub post: [[f32; 4]; 7],
    /// the stencil laid over the view: shown, [centre x, centre y, half width, half height (in pixels of the page's 3D view), turn (radians), show, flags (1 invert, 2 tile), 0], that view's size
    pub st_on: bool,
    pub st: [f32; 8],
    pub st_view: [f32; 2],
    pub wire_col: [f32; 3],
    pub unlit: bool,
    pub metal_view: f32,
    /// your own lights from the light rig (up to 4): each is type (0 sun, 1 point, 2 spot) + position, direction + cone, colour × strength + reach
    pub light_n: u32,
    pub light_a: [[f32; 4]; 4],
    pub light_b: [[f32; 4]; 4],
    pub light_c: [[f32; 4]; 4],
}

impl Default for Settings {
    fn default() -> Self {
        Settings { tone: 1, exposure: 1.0, env_turn: 0.0, env_strength: 1.0, show_background: true, env_blur: 0.35, sun_azimuth: 40.0, sun_elevation: 45.0, sun_intensity: 1.0, fov: 45.0, paint: false, brush: 0.0, rt: false, rt_shadow: 0.9, rt_ao: 0.85, rt_refl: 0.7, rt_soft: 0.02, rt_samples: 96, cam: None, bg: [0.09, 0.1, 0.115], smooth: true, ortho: false, studio_fill: 0.12, studio_rim: 0.08, wire: 0, mir: [f32::NAN; 3], mir_radial: [0.0, 0.0], mir_off: [0.0; 3], mir_r: 0.0, disp: 0.0, fold: 0.0, track: false, hv: 0, mirc_n: 0, mirc: [[0.0; 16]; 32], floor: [0.0, 0.0, 1.0, 0.5], floor_col: [0.0; 3], clip: true, post_on: false, post: [[0.0; 4]; 7], st_on: false, st: [0.0; 8], st_view: [1.0, 1.0], wire_col: [0.95, 0.7, 0.35], unlit: false, metal_view: 0.0, light_n: 0, light_a: [[0.0; 4]; 4], light_b: [[0.0; 4]; 4], light_c: [[0.0; 4]; 4] }
    }
}

/// Everything the viewer shows.
pub struct Scene {
    pub mesh: MeshData,
    pub groups: Vec<Group>,
    pub env: Option<EnvData>,
    pub settings: Settings,
    /// where the window was last time: x, y, width, height (None = let the system place it)
    pub window: Option<[i32; 4]>,
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

/// What to do with the environment picture when settings change.
pub enum EnvChange {
    Keep,
    Clear,
    Set(EnvData),
}

/// Where the viewer reports what the pointer does while painting (JSON text), so the page can paint with its own brush.
pub type EventSink = Arc<dyn Fn(String) + Send + Sync>;

/// How a picture is taken: turned a little from the window's view, with the sky or sun turned, and how many rounds of rays to add (0 = until settled).
#[derive(Clone, Copy, Default)]
pub struct CaptureOpts {
    pub yaw_add: f32,
    pub env_turn: Option<f32>,
    pub sun_az: Option<f32>,
    pub rounds: u32,
}

enum Cmd {
    Capture(u32, u32, CaptureOpts, mpsc::Sender<Result<Vec<u8>, String>>),
    Textures(String, Box<Material>),
    Scene(Box<Scene>),
    Update(Settings, EnvChange),
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
    pub fn set_scene(&self, s: Scene) -> bool {
        self.proxy.send_event(Cmd::Scene(Box::new(s))).is_ok()
    }
    /// Changes the lighting settings (and the environment picture if asked) without sending the model again.
    pub fn update(&self, settings: Settings, env: EnvChange) -> bool {
        self.proxy.send_event(Cmd::Update(settings, env)).is_ok()
    }
    /// Gives one material (by the name of its group) new pictures, for example after painting.
    pub fn set_textures(&self, group: String, material: Material) -> bool {
        self.proxy.send_event(Cmd::Textures(group, Box::new(material))).is_ok()
    }
    /// A PNG picture of what the viewer shows, at the size asked for (waits for the ray tracing to settle). Takes a while at large sizes.
    pub fn capture_rgba(&self, w: u32, h: u32, o: CaptureOpts) -> Result<Vec<u8>, String> {
        let (tx, rx) = mpsc::channel();
        self.proxy.send_event(Cmd::Capture(w, h, o, tx)).map_err(|_| "the viewer window is closed".to_string())?;
        rx.recv_timeout(Duration::from_secs(300)).map_err(|_| "the picture took too long".to_string())?
    }
    /// The same as a PNG file.
    pub fn capture(&self, w: u32, h: u32) -> Result<Vec<u8>, String> {
        let (w2, h2) = (w.clamp(16, 8192), h.clamp(16, 8192));
        let rgba = self.capture_rgba(w, h, CaptureOpts::default())?;
        let mut out = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut out, w2, h2);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            let mut wr = enc.write_header().map_err(|e| e.to_string())?;
            wr.write_image_data(&rgba).map_err(|e| e.to_string())?;
        }
        Ok(out)
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
    dn: [f32; 3], // the normal averaged over vertices at the same place (so a displaced surface does not tear at seams)
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
    extra: [f32; 4],
    cursor: [f32; 4], // x, y (pixels), radius (pixels), 1 when shown
    res: [f32; 4],    // width, height
    bgc: [f32; 4],    // background colour
    light_a: [[f32; 4]; 4],
    light_b: [[f32; 4]; 4],
    light_c: [[f32; 4]; 4],
    light_n: [f32; 4],
    cam_dir: [f32; 4],
    wire: [f32; 4], // colour, w = 1 overlay / 2 only
    st_a: [f32; 4],
    st_b: [f32; 4],
    st_c: [f32; 4],
    fl_a: [f32; 4], // floor: height, half size, opacity, on
    bv: [f32; 4],   // rounded normals: on, width, height
}

/// does this shader move by itself (so the window keeps drawing)?
fn shader_moves(kind: i32, mu: &MatUniform) -> bool {
    kind == 7 || (kind == 9 && (mu.shq[0] > 0.0 || mu.shp[1] > 0.0 || mu.shq[2] > 0.0 || mu.shq[3] > 0.0 || mu.shd[0] > 0.0)) || (kind == 11 && mu.shp[3] > 0.0 && mu.shq[0] > 0.0)
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct MatUniform {
    flags: [f32; 4],
    tint: [f32; 4],
    shk: [f32; 4],
    shp: [f32; 4],
    shq: [f32; 4],
    shc: [f32; 4],
    shd: [f32; 4],
    skin: [f32; 4],
    she: [f32; 4],
}

/// The pictures the post processing works in (made again when the size changes).
/// What the ray tracing needs to be built again (when the height depth changes).
struct RtKeep {
    pos0: Vec<f32>,
    all: Vec<u32>,
    tri_group: Vec<u32>,
    cols: Vec<[f32; 4]>,
    uvs: Vec<f32>,
    layers: Vec<Vec<u8>>,
    radius: f32,
    dn: Vec<[f32; 3]>,
    vgroup: Vec<i32>,
    heights: Vec<Option<Tex8>>,
}

struct PostGpu {
    w: u32,
    h: u32,
    src: wgpu::TextureView,
    a: wgpu::TextureView,
    b: wgpu::TextureView,
}

struct GpuGroup {
    name: String,
    ib: wgpu::Buffer,
    count: u32,
    bind: wgpu::BindGroup,
    mat_buf: wgpu::Buffer,
    mu: MatUniform,
    views: [wgpu::TextureView; 4],
    outline: bool,
    /// the shader's number (9 hologram and 10 glass are blended over the solid parts, 11 fur is grown in shells)
    kind: i32,
    tris: Vec<u32>,
    wire: Option<(wgpu::Buffer, u32)>,
}

struct Gpu {
    window: Arc<Window>,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    alpha_pipeline: wgpu::RenderPipeline,
    fur_pipeline: wgpu::RenderPipeline,
    bg_pipeline: wgpu::RenderPipeline,
    ring_pipeline: wgpu::RenderPipeline,
    cursor: Option<(f32, f32)>,
    out_pipeline: wgpu::RenderPipeline,
    wire_pipeline: wgpu::RenderPipeline,
    guide_pipeline: wgpu::RenderPipeline,
    floor_pipeline: wgpu::RenderPipeline,
    hl_pipeline: wgpu::RenderPipeline,
    mc_pipeline: wgpu::RenderPipeline,
    mc_layout: wgpu::BindGroupLayout,
    mc_buf: wgpu::Buffer,
    hl: Option<(wgpu::Buffer, u32)>,
    ind: Option<(wgpu::Buffer, u32)>,
    hv: Option<(wgpu::Buffer, wgpu::Buffer, u32)>,
    hv_see: wgpu::RenderPipeline,
    hv_only: wgpu::RenderPipeline,
    st_pipeline: wgpu::RenderPipeline,
    post_layout: wgpu::BindGroupLayout,
    post_bright: wgpu::RenderPipeline,
    post_blur: wgpu::RenderPipeline,
    post_final: wgpu::RenderPipeline,
    post_bufs: [wgpu::Buffer; 3],
    post_smp: wgpu::Sampler,
    post: Option<PostGpu>,
    rt_keep: Option<RtKeep>,
    st_layout: wgpu::BindGroupLayout,
    st_smp: wgpu::Sampler,
    st_bind: Option<wgpu::BindGroup>,
    guide_buf: Option<(wgpu::Buffer, u32)>,
    guide_key: Vec<u32>,
    pre_pipeline: wgpu::RenderPipeline,
    pre_layout: wgpu::BindGroupLayout,
    started: std::time::Instant,
    frame_buf: wgpu::Buffer,
    frame_layout: wgpu::BindGroupLayout,
    frame_bg: wgpu::BindGroup,
    env_v: wgpu::TextureView,
    spec_v: wgpu::TextureView,
    bev: wgpu::TextureView,
    bev_info: Option<(u32, u32, [f32; 3], [f32; 3])>,
    mat_layout: wgpu::BindGroupLayout,
    tex_sampler: wgpu::Sampler,
    env_sampler: wgpu::Sampler,
    depth: wgpu::TextureView,
    scene_color: wgpu::TextureView,
    scene_normal: wgpu::TextureView,
    scene_mat: wgpu::TextureView,
    rt: rt::Rt,
    vb: Option<wgpu::Buffer>,
    groups: Vec<GpuGroup>,
    settings: Settings,
    animated: bool,
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
    shift: bool,
    ctrl: bool,
    alt: bool,
    /// a stroke is going on (the left button was pressed to paint)
    painting: bool,
    /// the model's centre and size, for the F key
    home: (Vec3, f32),
    last_sent: Instant,
    sink: Option<EventSink>,
    last: (f64, f64),
    init: Option<mpsc::Sender<Result<AdapterReport, String>>>,
    pending: Option<Scene>,
}

const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;

fn make_post(device: &wgpu::Device, w: u32, h: u32, format: wgpu::TextureFormat) -> PostGpu {
    let mk = |w: u32, h: u32, f: wgpu::TextureFormat| {
        device
            .create_texture(&wgpu::TextureDescriptor {
                label: Some("post picture"),
                size: wgpu::Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: f,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
                view_formats: &[],
            })
            .create_view(&wgpu::TextureViewDescriptor::default())
    };
    PostGpu { w, h, src: mk(w, h, format), a: mk(w / 2, h / 2, wgpu::TextureFormat::Rgba8Unorm), b: mk(w / 2, h / 2, wgpu::TextureFormat::Rgba8Unorm) }
}

fn make_depth(device: &wgpu::Device, w: u32, h: u32) -> wgpu::TextureView {
    device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some("depth"),
            size: wgpu::Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: DEPTH_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        })
        .create_view(&wgpu::TextureViewDescriptor::default())
}

/// The picture the model is drawn into first (colour, and each pixel's surface direction), before the ray results are put on it.
fn make_scene(device: &wgpu::Device, w: u32, h: u32, format: wgpu::TextureFormat) -> (wgpu::TextureView, wgpu::TextureView, wgpu::TextureView) {
    let mk = |label: &str, f: wgpu::TextureFormat| {
        device
            .create_texture(&wgpu::TextureDescriptor {
                label: Some(label),
                size: wgpu::Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: f,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
                view_formats: &[],
            })
            .create_view(&wgpu::TextureViewDescriptor::default())
    };
    (mk("scene colour", format), mk("scene normals", rt::NORMAL_FORMAT), mk("scene material", rt::NORMAL_FORMAT))
}

/// The average colour of a material's base picture, in linear light (grey when it has none).
fn average_colour(t: Option<&Tex8>) -> [f32; 4] {
    let Some(t) = t.filter(|t| t.width > 0 && t.height > 0 && t.rgba.len() >= (t.width * t.height * 4) as usize) else { return [0.5, 0.5, 0.5, 1.0] };
    let n = (t.width * t.height) as usize;
    let step = (n / 4096).max(1);
    let (mut s, mut cnt) = ([0f64; 3], 0f64);
    let mut i = 0;
    while i < n {
        for c in 0..3 {
            s[c] += (t.rgba[i * 4 + c] as f64 / 255.0).powf(2.2);
        }
        cnt += 1.0;
        i += step;
    }
    [(s[0] / cnt) as f32, (s[1] / cnt) as f32, (s[2] / cnt) as f32, 1.0]
}

/// A group's base picture shrunk to the small square the reflections look up (white when it has none).
fn shrink_layer(t: Option<&Tex8>) -> Vec<u8> {
    let n = rt::LAYER as usize;
    let Some(t) = t.filter(|t| t.width > 0 && t.height > 0 && t.rgba.len() >= (t.width * t.height * 4) as usize) else { return vec![255u8; n * n * 4] };
    let (w, h) = (t.width as usize, t.height as usize);
    let mut out = vec![0u8; n * n * 4];
    for y in 0..n {
        let (y0, y1) = (y * h / n, ((y + 1) * h / n).max(y * h / n + 1).min(h));
        for x in 0..n {
            let (x0, x1) = (x * w / n, ((x + 1) * w / n).max(x * w / n + 1).min(w));
            let mut s = [0u32; 4];
            let mut c = 0u32;
            for yy in y0..y1 {
                for xx in x0..x1 {
                    for k in 0..4 {
                        s[k] += t.rgba[(yy * w + xx) * 4 + k] as u32;
                    }
                    c += 1;
                }
            }
            for k in 0..4 {
                out[(y * n + x) * 4 + k] = (s[k] / c.max(1)) as u8;
            }
        }
    }
    out
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
/// The normal map with the height map's red channel written into its alpha (a flat normal where there is no normal map).
fn merge_height(n: Option<&Tex8>, h: &Tex8, fallback: [u8; 3]) -> Tex8 {
    let ok = |t: &Tex8| t.width > 0 && t.height > 0 && t.rgba.len() >= (t.width * t.height * 4) as usize;
    let n = n.filter(|t| ok(t));
    let (w, hh) = match n {
        Some(t) => (t.width, t.height),
        None => (h.width.max(1), h.height.max(1)),
    };
    let mut out = vec![0u8; (w * hh * 4) as usize];
    for y in 0..hh {
        for x in 0..w {
            let o = ((y * w + x) * 4) as usize;
            match n {
                Some(t) => out[o..o + 3].copy_from_slice(&t.rgba[o..o + 3]),
                None => out[o..o + 3].copy_from_slice(&fallback),
            }
            out[o + 3] = if ok(h) {
                let hx = (x as u64 * h.width as u64 / w as u64).min(h.width as u64 - 1) as u32;
                let hy = (y as u64 * h.height as u64 / hh as u64).min(h.height as u64 - 1) as u32;
                h.rgba[((hy * h.width + hx) * 4) as usize]
            } else {
                128
            };
        }
    }
    Tex8 { width: w, height: hh, rgba: out }
}

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

/// The environment blurred for six roughnesses (0, 0.2 ... 1): each is the picture as a surface of that roughness
/// reflects it (GGX importance sampling), drawn once into a layer of a texture array.
fn build_spec(device: &wgpu::Device, queue: &wgpu::Queue, pipeline: &wgpu::RenderPipeline, layout: &wgpu::BindGroupLayout, sampler: &wgpu::Sampler, env: &wgpu::TextureView, src_w: f32, size: (u32, u32)) -> wgpu::TextureView {
    let tex = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("blurred environment"),
        size: wgpu::Extent3d { width: size.0, height: size.1, depth_or_array_layers: 6 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba16Float,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    });
    let mut enc = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("blur") });
    for i in 0..6u32 {
        let samples = if i == 0 { 1.0 } else if i < 2 { 64.0 } else { 128.0 };
        let u: [f32; 8] = [i as f32 / 5.0, samples, src_w, 0.0, size.0 as f32, size.1 as f32, 0.0, 0.0];
        let ub = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("blur settings"), contents: bytemuck::cast_slice(&u), usage: wgpu::BufferUsages::UNIFORM });
        let bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("blur group"),
            layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(env) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(sampler) },
                wgpu::BindGroupEntry { binding: 2, resource: ub.as_entire_binding() },
            ],
        });
        let target = tex.create_view(&wgpu::TextureViewDescriptor { dimension: Some(wgpu::TextureViewDimension::D2), base_array_layer: i, array_layer_count: Some(1), ..Default::default() });
        let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("blur pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: &target, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store } })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        pass.set_pipeline(pipeline);
        pass.set_bind_group(0, &bind, &[]);
        pass.draw(0..3, 0..1);
    }
    queue.submit(Some(enc.finish()));
    tex.create_view(&wgpu::TextureViewDescriptor { dimension: Some(wgpu::TextureViewDimension::D2Array), ..Default::default() })
}

impl Gpu {
    fn new(event_loop: &ActiveEventLoop, hint: Option<[i32; 4]>) -> Result<(Gpu, AdapterReport), String> {
        let mut attrs = Window::default_attributes().with_title("Gouache Studio · new viewer (test)").with_inner_size(PhysicalSize::new(1100u32, 760u32));
        if let Some([x, y, w, h]) = hint {
            if w >= 300 && h >= 200 && w <= 16000 && h <= 16000 {
                attrs = attrs.with_inner_size(PhysicalSize::new(w as u32, h as u32));
                if x > -16000 && y > -16000 && x < 32000 && y < 32000 {
                    attrs = attrs.with_position(winit::dpi::PhysicalPosition::new(x, y));
                }
            }
        }
        let window = Arc::new(event_loop.create_window(attrs).map_err(|e| format!("could not open the window: {e}"))?);
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
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2Array, multisampled: false },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry { binding: 4, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: false }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
            ],
        });
        let mat_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("material layout"),
            entries: &[
                tex_entry(0),
                tex_entry(1),
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::VERTEX_FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                tex_entry(3),
                wgpu::BindGroupLayoutEntry { binding: 4, visibility: wgpu::ShaderStages::VERTEX_FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
                wgpu::BindGroupLayoutEntry {
                    binding: 5,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
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
        let target = [Some(wgpu::ColorTargetState { format, blend: None, write_mask: wgpu::ColorWrites::ALL }), Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::ALL }), Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::ALL })];
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
                    attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3],
                }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: true, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        // hologram and glass: blended over what is already drawn (the normal and material pictures are left alone)
        let alpha_target = [
            Some(wgpu::ColorTargetState { format, blend: Some(wgpu::BlendState::ALPHA_BLENDING), write_mask: wgpu::ColorWrites::ALL }),
            Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::empty() }),
            Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::empty() }),
        ];
        let alpha_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("blended pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout { array_stride: std::mem::size_of::<Vertex>() as u64, step_mode: wgpu::VertexStepMode::Vertex, attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3] }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs"), compilation_options: Default::default(), targets: &alpha_target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: false, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        // fur: the surface drawn again and again, a little further out each time
        let fur_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("fur pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_fur"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout { array_stride: std::mem::size_of::<Vertex>() as u64, step_mode: wgpu::VertexStepMode::Vertex, attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3] }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_fur"), compilation_options: Default::default(), targets: &target }),
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
        let ring_target = [Some(wgpu::ColorTargetState { format, blend: Some(wgpu::BlendState::ALPHA_BLENDING), write_mask: wgpu::ColorWrites::ALL })];
        let ring_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("brush outline pipeline"),
            layout: Some(&bg_layout),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_bg"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_ring"), compilation_options: Default::default(), targets: &ring_target }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let st_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("stencil layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry { binding: 8, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 9, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
            ],
        });
        let st_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("stencil pipeline layout"), bind_group_layouts: &[&frame_layout, &st_layout], push_constant_ranges: &[] });
        let st_smp = device.create_sampler(&wgpu::SamplerDescriptor { address_mode_u: wgpu::AddressMode::Repeat, address_mode_v: wgpu::AddressMode::Repeat, mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear, ..Default::default() });
        let st_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("stencil pipeline"),
            layout: Some(&st_pl),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_bg"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_stencil"), compilation_options: Default::default(), targets: &ring_target }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let post_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("post"), source: wgpu::ShaderSource::Wgsl(include_str!("post.wgsl").into()) });
        let post_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("post layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry { binding: 0, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 1, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 3, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Depth, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 4, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
            ],
        });
        let post_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("post pipeline layout"), bind_group_layouts: &[&post_layout], push_constant_ranges: &[] });
        let post_pipe = |entry: &str, fmt: wgpu::TextureFormat| {
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("post pipeline"),
                layout: Some(&post_pl),
                vertex: wgpu::VertexState { module: &post_shader, entry_point: Some("vs"), compilation_options: Default::default(), buffers: &[] },
                fragment: Some(wgpu::FragmentState { module: &post_shader, entry_point: Some(entry), compilation_options: Default::default(), targets: &[Some(wgpu::ColorTargetState { format: fmt, blend: None, write_mask: wgpu::ColorWrites::ALL })] }),
                primitive: wgpu::PrimitiveState::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview: None,
                cache: None,
            })
        };
        let post_bright = post_pipe("fs_bright", wgpu::TextureFormat::Rgba8Unorm);
        let post_blur = post_pipe("fs_blur", wgpu::TextureFormat::Rgba8Unorm);
        let post_final = post_pipe("fs_post", format);
        let post_buf = || device.create_buffer(&wgpu::BufferDescriptor { label: Some("post uniform"), size: 144, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let post_bufs = [post_buf(), post_buf(), post_buf()];
        let post_smp = device.create_sampler(&wgpu::SamplerDescriptor { address_mode_u: wgpu::AddressMode::ClampToEdge, address_mode_v: wgpu::AddressMode::ClampToEdge, mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear, ..Default::default() });
        let floor_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("floor pipeline"),
            layout: Some(&bg_layout),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_floor"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_floor"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: true, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let hl_target = [
            Some(wgpu::ColorTargetState { format, blend: Some(wgpu::BlendState::ALPHA_BLENDING), write_mask: wgpu::ColorWrites::ALL }),
            Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::empty() }),
            Some(wgpu::ColorTargetState { format: rt::NORMAL_FORMAT, blend: None, write_mask: wgpu::ColorWrites::empty() }),
        ];
        let hl_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("highlight pipeline"),
            layout: Some(&bg_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_hl"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<Vertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3],
                }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_hl"), compilation_options: Default::default(), targets: &hl_target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: false, depth_compare: wgpu::CompareFunction::LessEqual, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let mc_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("mirror cursor layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry { binding: 0, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 1, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Depth, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: false }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
            ],
        });
        let mc_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("mirror cursor pipeline layout"), bind_group_layouts: &[&frame_layout, &mc_layout], push_constant_ranges: &[] });
        let mc_buf = device.create_buffer(&wgpu::BufferDescriptor { label: Some("mirror cursor"), size: 32 * 64, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let mc_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("mirror cursor pipeline"),
            layout: Some(&mc_pl),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_bg"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_mirc"), compilation_options: Default::default(), targets: &ring_target }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let hv_pipe = |see: bool| {
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("high-poly pipeline"),
                layout: Some(&bg_layout),
                vertex: wgpu::VertexState {
                    module: &shader,
                    entry_point: Some("vs_hv"),
                    compilation_options: Default::default(),
                    buffers: &[wgpu::VertexBufferLayout { array_stride: 24, step_mode: wgpu::VertexStepMode::Vertex, attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3] }],
                },
                fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_hv"), compilation_options: Default::default(), targets: if see { &hl_target } else { &target } }),
                primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
                depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: !see, depth_compare: if see { wgpu::CompareFunction::LessEqual } else { wgpu::CompareFunction::Less }, stencil: Default::default(), bias: Default::default() }),
                multisample: wgpu::MultisampleState::default(),
                multiview: None,
                cache: None,
            })
        };
        let hv_see = hv_pipe(true);
        let hv_only = hv_pipe(false);
        let out_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("outline pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_out"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<Vertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3],
                }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_out"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: true, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let wire_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("wire pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_wire"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<Vertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2, 3 => Float32x3],
                }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_wire"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { topology: wgpu::PrimitiveTopology::LineList, cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: false, depth_compare: wgpu::CompareFunction::LessEqual, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let guide_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("guide pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_guide"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout { array_stride: 12, step_mode: wgpu::VertexStepMode::Vertex, attributes: &wgpu::vertex_attr_array![0 => Float32x3] }],
            },
            fragment: Some(wgpu::FragmentState { module: &shader, entry_point: Some("fs_guide"), compilation_options: Default::default(), targets: &target }),
            primitive: wgpu::PrimitiveState { topology: wgpu::PrimitiveTopology::LineList, cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: false, depth_compare: wgpu::CompareFunction::LessEqual, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let pre_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("blur layout"),
            entries: &[
                tex_entry(0),
                wgpu::BindGroupLayoutEntry { binding: 1, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None },
                    count: None,
                },
            ],
        });
        let pre_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("blur pipeline layout"), bind_group_layouts: &[&pre_layout], push_constant_ranges: &[] });
        let pre_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("blur pipeline"),
            layout: Some(&pre_pl),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_pre"), compilation_options: Default::default(), buffers: &[] },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_pre"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState { format: wgpu::TextureFormat::Rgba16Float, blend: None, write_mask: wgpu::ColorWrites::ALL })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
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
        let (scene_color, scene_normal, scene_mat) = make_scene(&device, config.width, config.height, format);
        let rt = rt::Rt::new(&device, format);
        let black = EnvData { width: 2, height: 1, rgb: vec![0.0; 6] };
        let (env_view, env_mips, env_sh) = build_env(&device, &queue, &black);
        let spec_view = build_spec(&device, &queue, &pre_pipeline, &pre_layout, &env_sampler, &env_view, 2.0, (16, 8));
        let bev0 = make_tex8(&device, &queue, None, [0, 0, 0, 0], wgpu::TextureFormat::Rgba8Unorm);
        let frame_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("frame group"),
            layout: &frame_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: frame_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&env_view) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&env_sampler) },
                wgpu::BindGroupEntry { binding: 3, resource: wgpu::BindingResource::TextureView(&spec_view) },
                wgpu::BindGroupEntry { binding: 4, resource: wgpu::BindingResource::TextureView(&bev0) },
            ],
        });
        let (env_v, spec_v, bev) = (env_view.clone(), spec_view.clone(), bev0);
        let gpu = Gpu {
            window,
            surface,
            device,
            queue,
            config,
            pipeline,
            alpha_pipeline,
            fur_pipeline,
            bg_pipeline,
            ring_pipeline,
            cursor: std::env::var_os("GOUACHE_RING_TEST").map(|_| std::env::var("GOUACHE_RING_AT").ok().and_then(|v| { let mut it = v.split(',').filter_map(|x| x.parse::<f32>().ok()); Some((it.next()?, it.next()?)) }).unwrap_or((300.0, 250.0))), // debug: shows the outline without a mouse (GOUACHE_RING_AT=x,y moves it)
            out_pipeline,
            wire_pipeline,
            guide_pipeline,
            floor_pipeline,
            hl_pipeline,
            mc_pipeline,
            mc_layout,
            mc_buf,
            hl: None,
            ind: None,
            hv: None,
            hv_see,
            hv_only,
            st_pipeline,
            post_layout,
            post_bright,
            post_blur,
            post_final,
            post_bufs,
            post_smp,
            post: None,
            rt_keep: None,
            st_layout,
            st_smp,
            st_bind: None,
            guide_buf: None,
            guide_key: Vec::new(),
            pre_pipeline,
            pre_layout,
            started: std::time::Instant::now(),
            frame_buf,
            frame_bg,
            env_v,
            spec_v,
            bev,
            bev_info: None,
            frame_layout,
            mat_layout,
            tex_sampler,
            env_sampler,
            depth,
            scene_color,
            scene_normal,
            scene_mat,
            rt,
            vb: None,
            groups: Vec::new(),
            settings: Settings::default(),
            animated: false,
            env_mips,
            has_env: false,
            sh: env_sh,
        };
        Ok((gpu, report))
    }

    fn set_env(&mut self, env: Option<&EnvData>) {
        let (view, mips, sh, has, src_w, size) = match env {
            Some(e) => {
                let (v, m, s) = build_env(&self.device, &self.queue, e);
                (v, m, s, true, e.width as f32, (512u32, 256u32))
            }
            None => {
                let black = EnvData { width: 2, height: 1, rgb: vec![0.0; 6] };
                let (v, m, s) = build_env(&self.device, &self.queue, &black);
                (v, m, s, false, 2.0, (16u32, 8u32))
            }
        };
        let spec_view = build_spec(&self.device, &self.queue, &self.pre_pipeline, &self.pre_layout, &self.env_sampler, &view, src_w, size);
        self.env_mips = mips;
        self.sh = sh;
        self.has_env = has;
        self.env_v = view;
        self.spec_v = spec_view;
        self.rebuild_frame_bg();
    }

    fn rebuild_frame_bg(&mut self) {
        self.frame_bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("frame group"),
            layout: &self.frame_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: self.frame_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&self.env_v) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&self.env_sampler) },
                wgpu::BindGroupEntry { binding: 3, resource: wgpu::BindingResource::TextureView(&self.spec_v) },
                wgpu::BindGroupEntry { binding: 4, resource: wgpu::BindingResource::TextureView(&self.bev) },
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
            verts.push(Vertex { pos: [p.x, p.y, p.z], nrm: nr, uv, dn: nr });
        }
        {
            let size = (mx - mn).max_element().max(1e-6);
            let q = 1.0 / (size * 1e-5);
            let mut sums: std::collections::HashMap<[i64; 3], Vec3> = std::collections::HashMap::new();
            for v in &verts {
                let key = [(v.pos[0] * q).round() as i64, (v.pos[1] * q).round() as i64, (v.pos[2] * q).round() as i64];
                *sums.entry(key).or_insert(Vec3::ZERO) += Vec3::from(v.nrm);
            }
            for v in verts.iter_mut() {
                let key = [(v.pos[0] * q).round() as i64, (v.pos[1] * q).round() as i64, (v.pos[2] * q).round() as i64];
                if let Some(s) = sums.get(&key) {
                    let n = s.normalize_or_zero();
                    if n != Vec3::ZERO {
                        v.dn = n.to_array();
                    }
                }
            }
        }
        self.vb = Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("vertices"), contents: bytemuck::cast_slice(&verts), usage: wgpu::BufferUsages::VERTEX }));
        self.groups.clear();
        self.animated = s.groups.iter().any(|g| g.material.shader.kind == 7 || (g.material.shader.kind == 9 && (g.material.shader.q[0] > 0.0 || g.material.shader.p[1] > 0.0 || g.material.shader.q[2] > 0.0 || g.material.shader.q[3] > 0.0 || g.material.shader.d[0] > 0.0)) || (g.material.shader.kind == 11 && g.material.shader.p[3] > 0.0 && g.material.shader.q[0] > 0.0));
        for g in &s.groups {
            if g.indices.is_empty() {
                continue;
            }
            let mat = &g.material;
            let (bind, mat_buf, mu, views) = self.material_bind(mat, None);
            let sp = mat.shader;
            let ib = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("indices"), contents: bytemuck::cast_slice(&g.indices), usage: wgpu::BufferUsages::INDEX });
            self.groups.push(GpuGroup { name: g.name.clone(), ib, mat_buf, mu, views, count: g.indices.len() as u32, bind, outline: (sp.kind == 4 || sp.kind == 5 || sp.kind == 16 || sp.kind == 17) && sp.q[0] > 0.0, kind: sp.kind as i32, tris: g.indices.clone(), wire: None });
        }
        let c = (mn + mx) * 0.5;
        let radius = ((mx - mn).length() * 0.5).max(1e-4);
        let all: Vec<u32> = s.groups.iter().flat_map(|g| g.indices.iter().copied()).collect();
        let mut tri_group = Vec::new();
        let mut cols = Vec::new();
        for (gi, g) in s.groups.iter().enumerate() {
            tri_group.extend(std::iter::repeat(gi as u32).take(g.indices.len() / 3));
            cols.push(average_colour(g.material.base.as_ref()));
        }
        let layers: Vec<Vec<u8>> = s.groups.iter().map(|g| shrink_layer(g.material.base.as_ref())).collect();
        let mut vgroup = vec![-1i32; n];
        for (gi, g) in s.groups.iter().enumerate() {
            for &i in &g.indices {
                if let Some(v) = vgroup.get_mut(i as usize) {
                    if *v < 0 {
                        *v = gi as i32;
                    }
                }
            }
        }
        self.rt_keep = Some(RtKeep {
            pos0: s.mesh.positions.clone(),
            all,
            tri_group,
            cols,
            uvs: s.mesh.uvs.clone(),
            layers,
            radius,
            dn: verts.iter().map(|v| v.dn).collect(),
            vgroup,
            heights: s.groups.iter().map(|g| g.material.height.clone()).collect(),
        });
        self.apply_rt_model();
        (c, radius)
    }

    /// Gives the ray tracing the model as it is drawn, moved by the height map when there is height depth.
    fn apply_rt_model(&mut self) {
        let Some(k) = &self.rt_keep else { return };
        let disp = self.settings.disp;
        let mut pos = k.pos0.clone();
        if disp != 0.0 {
            for i in 0..k.vgroup.len() {
                let Some(Some(h)) = (if k.vgroup[i] >= 0 { k.heights.get(k.vgroup[i] as usize) } else { None }) else { continue };
                if h.width == 0 || h.height == 0 || k.uvs.len() < (i + 1) * 2 || h.rgba.len() < (h.width * h.height * 4) as usize {
                    continue;
                }
                // the same lookup the vertex shader does (repeat, the picture's first row is the top)
                let (u, v) = (k.uvs[i * 2], 1.0 - k.uvs[i * 2 + 1]);
                let (fu, fv) = (u - u.floor(), v - v.floor());
                let (x, y) = (((fu * h.width as f32) as u32).min(h.width - 1), ((fv * h.height as f32) as u32).min(h.height - 1));
                let hv = h.rgba[((y * h.width + x) * 4) as usize] as f32 / 255.0 - 0.5;
                for a in 0..3 {
                    pos[i * 3 + a] += k.dn[i][a] * hv * disp;
                }
            }
        }
        let (all, tg, cols, uvs, layers, radius) = (k.all.clone(), k.tri_group.clone(), k.cols.clone(), k.uvs.clone(), k.layers.clone(), k.radius);
        self.rt.new_model(pos, all, (tg, cols), uvs, layers, radius);
    }

    /// Makes the bind group (pictures + settings) of one material.
    fn material_bind(&self, mat: &Material, keep: Option<(&[wgpu::TextureView; 4], MatUniform)>) -> (wgpu::BindGroup, wgpu::Buffer, MatUniform, [wgpu::TextureView; 4]) {
        let view = |t: Option<&Tex8>, fb: [u8; 4], f: wgpu::TextureFormat, i: usize| match (t, keep) {
            (None, Some((old, _))) => old[i].clone(),
            _ => make_tex8(&self.device, &self.queue, t, fb, f),
        };
        let base = view(mat.base.as_ref(), [255, 255, 255, 255], wgpu::TextureFormat::Rgba8UnormSrgb, 0);
        let orm = view(mat.orm.as_ref(), [255, 255, 255, 255], wgpu::TextureFormat::Rgba8Unorm, 1);
        let merged = mat.height.as_ref().map(|h| merge_height(mat.normal.as_ref(), h, [128, 128, 255]));
        let merged_e = mat.thick.as_ref().map(|h| merge_height(mat.emissive.as_ref(), h, [0, 0, 0]));
        let nrm = view(if merged.is_some() { merged.as_ref() } else { mat.normal.as_ref() }, [128, 128, 255, 255], wgpu::TextureFormat::Rgba8Unorm, 2);
        let emi = view(if merged_e.is_some() { merged_e.as_ref() } else { mat.emissive.as_ref() }, [0, 0, 0, 255], wgpu::TextureFormat::Rgba8UnormSrgb, 3);
        let sp = mat.shader;
        let mut mu = MatUniform {
            flags: [if mat.orm.is_some() { 1.0 } else { 0.0 }, if mat.rough > 0.0 { mat.rough } else { 0.6 }, mat.metal, if mat.height.is_some() { 1.0 } else { 0.0 }],
            tint: [1.0, 1.0, 1.0, match mat.udim { Some(t) => 2.0 + t[0] as f32 + 10.0 * t[1] as f32, None => 1.0 }],
            shk: [sp.kind as f32, 0.0, 0.0, 0.0],
            shp: sp.p,
            shq: sp.q,
            shc: [sp.c[0], sp.c[1], sp.c[2], 0.0],
            shd: [sp.d[0], sp.d[1], sp.d[2], mat.fold_off],
            skin: [sp.skin[0], sp.skin[1], sp.skin[2], if mat.thick.is_some() { 1.0 } else { 0.0 }],
            she: sp.e,
        };
        if let Some((_, old)) = keep {
            mu.flags = old.flags; // a kept map keeps its flag too
            mu.skin[3] = old.skin[3];
            mu.tint = old.tint;
            mu.shd[3] = old.shd[3];
        }
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
        (bind, mb, mu, [base, orm, nrm, emi])
    }

    /// Swaps the pictures of the material of one group (the triangles stay).
    fn set_textures(&mut self, name: &str, mat: &Material) {
        if name == "__bev" {
            // rounded normals for the current view (the 3D view's Bevel preview): [width, height] and the eye and target they were made for, then the pixels (top row first)
            if let Some(t) = &mat.base {
                if t.rgba.len() >= 32 {
                    let u = |i: usize| u32::from_le_bytes([t.rgba[i], t.rgba[i + 1], t.rgba[i + 2], t.rgba[i + 3]]);
                    let f = |i: usize| f32::from_le_bytes([t.rgba[i], t.rgba[i + 1], t.rgba[i + 2], t.rgba[i + 3]]);
                    let (w, h) = (u(0), u(4));
                    if w > 0 && h > 0 && t.rgba.len() >= 32 + (w * h * 4) as usize {
                        let px = Tex8 { width: w, height: h, rgba: t.rgba[32..32 + (w * h * 4) as usize].to_vec() };
                        self.bev = make_tex8(&self.device, &self.queue, Some(&px), [0, 0, 0, 0], wgpu::TextureFormat::Rgba8Unorm);
                        self.bev_info = Some((w, h, [f(8), f(12), f(16)], [f(20), f(24), f(28)]));
                    } else {
                        self.bev_info = None;
                    }
                } else {
                    self.bev_info = None;
                }
            } else {
                self.bev_info = None;
            }
            self.rebuild_frame_bg();
            return;
        }
        if name == "__hv" {
            // the high-poly: [vertex count, index count] then x y z nx ny nz per vertex, then the indices (all 4-byte numbers)
            self.hv = match &mat.base {
                Some(t) if t.rgba.len() >= 8 => {
                    let w: Vec<u32> = t.rgba.chunks_exact(4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]])).take(2).collect();
                    let (vn, inn) = (w[0] as usize, w[1] as usize);
                    let (vs, ve) = (8usize, 8 + vn * 24);
                    if vn > 0 && inn >= 3 && t.rgba.len() >= ve + inn * 4 {
                        let vb = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("high vertices"), contents: &t.rgba[vs..ve], usage: wgpu::BufferUsages::VERTEX });
                        let ib = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("high indices"), contents: &t.rgba[ve..ve + inn * 4], usage: wgpu::BufferUsages::INDEX });
                        Some((vb, ib, (inn / 3 * 3) as u32))
                    } else {
                        None
                    }
                }
                _ => None,
            };
            return;
        }
        if name == "__ind" {
            // line segments in the model's space (x y z per point, two points per segment): where a decal will land
            self.ind = match &mat.base {
                Some(t) if t.rgba.len() >= 24 => {
                    let f: Vec<f32> = t.rgba.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect();
                    let n = (f.len() / 6 * 6) as u32;
                    Some((self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("indicator"), contents: bytemuck::cast_slice(&f[..n as usize]), usage: wgpu::BufferUsages::VERTEX }), n / 3))
                }
                _ => None,
            };
            return;
        }
        if name == "__hl" {
            // triangles to light up (corner indices of the page's model), sent as the bytes of a raw picture
            self.hl = match &mat.base {
                Some(t) if t.rgba.len() >= 12 => {
                    let ids: Vec<u32> = t.rgba.chunks_exact(4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect();
                    let n = (ids.len() / 3 * 3) as u32;
                    Some((self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("highlight"), contents: bytemuck::cast_slice(&ids[..n as usize]), usage: wgpu::BufferUsages::INDEX }), n))
                }
                _ => None,
            };
            return;
        }
        if name == "__stencil" {
            if let Some(t) = &mat.base {
                let tex = self.device.create_texture_with_data(
                    &self.queue,
                    &wgpu::TextureDescriptor { label: Some("stencil"), size: wgpu::Extent3d { width: t.width, height: t.height, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] },
                    wgpu::util::TextureDataOrder::LayerMajor,
                    &t.rgba,
                );
                let view = tex.create_view(&Default::default());
                self.st_bind = Some(self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("stencil bind"),
                    layout: &self.st_layout,
                    entries: &[wgpu::BindGroupEntry { binding: 8, resource: wgpu::BindingResource::TextureView(&view) }, wgpu::BindGroupEntry { binding: 9, resource: wgpu::BindingResource::Sampler(&self.st_smp) }],
                }));
            }
            return;
        }
        let outline = (mat.shader.kind == 4 || mat.shader.kind == 5 || mat.shader.kind == 16 || mat.shader.kind == 17) && mat.shader.q[0] > 0.0;
        let Some(i) = self.groups.iter().position(|g| g.name == name) else { return };
        let (bind, mat_buf, mu, views) = {
            let g = &self.groups[i];
            let keep = if mat.partial { Some((&g.views, g.mu)) } else { None };
            self.material_bind(mat, keep)
        };
        let g = &mut self.groups[i];
        g.bind = bind;
        g.mat_buf = mat_buf;
        g.mu = mu;
        g.views = views;
        g.outline = outline;
        g.kind = mat.shader.kind as i32;
        self.animated = self.groups.iter().any(|g| shader_moves(g.kind, &g.mu));
    }

    /// Light from the sky on a surface (an average), for colouring what reflections see.
    fn rt_amb(&self) -> [f32; 3] {
        if self.has_env {
            let k = self.settings.env_strength;
            [(self.sh[0][0] * 0.9 + 0.05) * k, (self.sh[0][1] * 0.9 + 0.05) * k, (self.sh[0][2] * 0.9 + 0.05) * k]
        } else {
            [0.45, 0.5, 0.6]
        }
    }

    fn resize(&mut self, w: u32, h: u32) {
        if w == 0 || h == 0 {
            return;
        }
        self.config.width = w;
        self.config.height = h;
        self.surface.configure(&self.device, &self.config);
        self.depth = make_depth(&self.device, w, h);
        let (c, n, m) = make_scene(&self.device, w, h, self.config.format);
        self.scene_color = c;
        self.scene_normal = n;
        self.scene_mat = m;
    }

    fn draw(&mut self, cam: &Camera) {
        self.draw_to(cam, None);
    }

    /// Draws one frame, on the window or (when `target` is given) into a picture of the same format.
    fn draw_to(&mut self, cam: &Camera, target: Option<&wgpu::TextureView>) {
        let mut frame = None;
        let view = match target {
            Some(t) => t.clone(),
            None => {
                let f = match self.surface.get_current_texture() {
                    Ok(f) => f,
                    Err(_) => {
                        self.surface.configure(&self.device, &self.config);
                        return;
                    }
                };
                let v = f.texture.create_view(&wgpu::TextureViewDescriptor::default());
                frame = Some(f);
                v
            }
        };
        let aspect = self.config.width as f32 / self.config.height as f32;
        let dir = Vec3::new(cam.yaw.cos() * cam.pitch.cos(), cam.pitch.sin(), cam.yaw.sin() * cam.pitch.cos());
        let eye = cam.target + dir * cam.dist;
        let (near, far) = ((cam.dist * 0.01).max(1e-4), cam.dist * 20.0 + cam.radius * 4.0);
        let proj = if self.settings.ortho {
            let hh = cam.dist * (self.settings.fov.to_radians() * 0.5).tan();
            Mat4::orthographic_rh(-hh * aspect, hh * aspect, -hh, hh, near, far)
        } else {
            Mat4::perspective_rh(self.settings.fov.to_radians(), aspect, near, far)
        };
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
            info: [self.env_mips, if self.has_env { 1.0 } else { 0.0 }, if st.show_background { 1.0 } else { 0.0 }, if st.unlit { 1.0 } else { 0.0 }],
            sh: self.sh,
            extra: [self.started.elapsed().as_secs_f32(), 2.0 * cam.dist * (self.settings.fov.to_radians() * 0.5).tan() / self.config.height as f32, st.env_blur, st.disp],
            cursor: match self.cursor {
                Some((x, y)) if st.paint && st.brush > 0.0 => [x, y, (st.brush * self.config.height as f32 * 0.5).max(2.0), 1.0],
                _ => [0.0; 4],
            },
            res: [self.config.width as f32, self.config.height as f32, 0.0, 0.0],
            bgc: [st.bg[0], st.bg[1], st.bg[2], st.metal_view],
            light_a: st.light_a,
            light_b: st.light_b,
            light_c: st.light_c,
            light_n: [st.light_n as f32, st.studio_fill, st.studio_rim, if st.clip { 1.0 } else { 0.0 }],
            cam_dir: [dir.x, dir.y, dir.z, if st.ortho { 1.0 } else { 0.0 }],
            wire: [st.wire_col[0], st.wire_col[1], st.wire_col[2], st.wire as f32],
            st_a: [st.st[0], st.st[1], st.st[2], st.st[3]],
            st_b: [st.st[4], st.st[5], st.st[6], 0.0],
            st_c: [st.st_view[0], st.st_view[1], st.mirc_n as f32, st.hv as f32],
            fl_a: st.floor,
            bv: match self.bev_info {
                Some((w, h, e, t)) if w == self.config.width && h == self.config.height => {
                    let tol = cam.dist * 2e-3;
                    let (de, dt) = ((Vec3::from(e) - eye).length(), (Vec3::from(t) - cam.target).length());
                    [if (de < tol && dt < tol) || e[0].is_nan() { 1.0 } else { 0.0 }, w as f32, h as f32, st.fold] // (a NaN eye is how the demo forces it on)
                }
                _ => [0.0, 0.0, 0.0, st.fold],
            },
        };
        self.queue.write_buffer(&self.frame_buf, 0, bytemuck::bytes_of(&u));
        if st.wire > 0 {
            for g in self.groups.iter_mut().filter(|g| g.wire.is_none()) {
                let mut e: Vec<u64> = Vec::with_capacity(g.tris.len());
                for t in g.tris.chunks_exact(3) {
                    for (a, b) in [(t[0], t[1]), (t[1], t[2]), (t[2], t[0])] {
                        e.push(((a.min(b) as u64) << 32) | a.max(b) as u64);
                    }
                }
                e.sort_unstable();
                e.dedup();
                let flat: Vec<u32> = e.iter().flat_map(|k| [(k >> 32) as u32, (k & 0xffff_ffff) as u32]).collect();
                let buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("edges"), contents: bytemuck::cast_slice(&flat), usage: wgpu::BufferUsages::INDEX });
                g.wire = Some((buf, flat.len() as u32));
            }
        }
        {
            let key: Vec<u32> = [st.mir[0], st.mir[1], st.mir[2], st.mir_radial[0], st.mir_radial[1], st.mir_off[0], st.mir_off[1], st.mir_off[2], st.mir_r].iter().map(|v| v.to_bits()).collect();
            if key != self.guide_key {
                self.guide_key = key;
                let pts = mirror_guide(&st);
                self.guide_buf = if pts.is_empty() { None } else { Some((self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("guides"), contents: bytemuck::cast_slice(&pts), usage: wgpu::BufferUsages::VERTEX }), (pts.len() / 3) as u32)) };
            }
        }
        let mut enc = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("frame") });
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("viewer"),
                color_attachments: &[
                    Some(wgpu::RenderPassColorAttachment {
                        view: &self.scene_color,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color { r: 0.035, g: 0.04, b: 0.05, a: 1.0 }), store: wgpu::StoreOp::Store },
                    }),
                    Some(wgpu::RenderPassColorAttachment {
                        view: &self.scene_normal,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT), store: wgpu::StoreOp::Store },
                    }),
                    Some(wgpu::RenderPassColorAttachment {
                        view: &self.scene_mat,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT), store: wgpu::StoreOp::Store },
                    }),
                ],
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
                for g in self.groups.iter().filter(|g| st.hv != 2 && g.kind != 9 && g.kind != 10) {
                    pass.set_bind_group(1, &g.bind, &[]);
                    pass.set_index_buffer(g.ib.slice(..), wgpu::IndexFormat::Uint32);
                    pass.draw_indexed(0..g.count, 0, 0..1);
                }
                if st.hv != 2 && st.wire != 2 {
                    if self.groups.iter().any(|g| g.kind == 11) {
                        pass.set_pipeline(&self.fur_pipeline);
                        for g in self.groups.iter().filter(|g| g.kind == 11) {
                            pass.set_bind_group(1, &g.bind, &[]);
                            pass.set_index_buffer(g.ib.slice(..), wgpu::IndexFormat::Uint32);
                            pass.draw_indexed(0..g.count, 0, 0..24);
                        }
                    }
                    if self.groups.iter().any(|g| g.kind == 9 || g.kind == 10) {
                        pass.set_pipeline(&self.alpha_pipeline);
                        for g in self.groups.iter().filter(|g| g.kind == 9 || g.kind == 10) {
                            pass.set_bind_group(1, &g.bind, &[]);
                            pass.set_index_buffer(g.ib.slice(..), wgpu::IndexFormat::Uint32);
                            pass.draw_indexed(0..g.count, 0, 0..1);
                        }
                    }
                }
                if let (true, Some((hvb, hib, hn))) = (st.hv > 0, &self.hv) {
                    pass.set_pipeline(if st.hv == 1 { &self.hv_see } else { &self.hv_only });
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.set_vertex_buffer(0, hvb.slice(..));
                    pass.set_index_buffer(hib.slice(..), wgpu::IndexFormat::Uint32);
                    pass.draw_indexed(0..*hn, 0, 0..1);
                }
                if let Some((hb, n)) = &self.hl {
                    pass.set_pipeline(&self.hl_pipeline);
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.set_vertex_buffer(0, vb.slice(..));
                    pass.set_index_buffer(hb.slice(..), wgpu::IndexFormat::Uint32);
                    pass.draw_indexed(0..*n, 0, 0..1);
                }
                if st.floor[3] > 0.5 && st.wire != 2 {
                    pass.set_pipeline(&self.floor_pipeline);
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.draw(0..6, 0..1);
                }
                if st.wire > 0 {
                    pass.set_pipeline(&self.wire_pipeline);
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.set_vertex_buffer(0, vb.slice(..));
                    for g in &self.groups {
                        if let Some((eb, n)) = &g.wire {
                            pass.set_bind_group(1, &g.bind, &[]);
                            pass.set_index_buffer(eb.slice(..), wgpu::IndexFormat::Uint32);
                            pass.draw_indexed(0..*n, 0, 0..1);
                        }
                    }
                }
                if let (Some((ib, n)), Some(g0)) = (&self.ind, self.groups.first()) {
                    pass.set_pipeline(&self.guide_pipeline);
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.set_bind_group(1, &g0.bind, &[]);
                    pass.set_vertex_buffer(0, ib.slice(..));
                    pass.draw(0..*n, 0..1);
                }
                if let (Some((gb, n)), Some(g0)) = (&self.guide_buf, self.groups.first()) {
                    pass.set_pipeline(&self.guide_pipeline);
                    pass.set_bind_group(0, &self.frame_bg, &[]);
                    pass.set_bind_group(1, &g0.bind, &[]);
                    pass.set_vertex_buffer(0, gb.slice(..));
                    pass.draw(0..*n, 0..1);
                }
                pass.set_pipeline(&self.out_pipeline);
                for g in self.groups.iter().filter(|g| g.outline && st.wire != 2) {
                    pass.set_bind_group(1, &g.bind, &[]);
                    pass.set_index_buffer(g.ib.slice(..), wgpu::IndexFormat::Uint32);
                    pass.draw_indexed(0..g.count, 0, 0..1);
                }
            }
        }
        if st.mirc_n > 1 && st.paint && st.brush > 0.0 && u.cursor[3] > 0.5 {
            let n = (st.mirc_n as usize).min(32);
            self.queue.write_buffer(&self.mc_buf, 0, bytemuck::cast_slice(&st.mirc[..n]));
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("mirror cursor group"),
                layout: &self.mc_layout,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: self.mc_buf.as_entire_binding() },
                    wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&self.depth) },
                    wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(&self.scene_normal) },
                ],
            });
            let mut p = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("mirror cursors"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: &self.scene_color, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store } })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            p.set_pipeline(&self.mc_pipeline);
            p.set_bind_group(0, &self.frame_bg, &[]);
            p.set_bind_group(1, &bg, &[]);
            p.draw(0..3, 0..1);
        }
        if st.rt {
            let sd = [sun.x, sun.y, sun.z];
            self.rt.trace(&self.device, &self.queue, &mut enc, &self.depth, &self.scene_normal, &self.scene_mat, vp.inverse().to_cols_array_2d(), [eye.x, eye.y, eye.z], sd, st.rt_soft.clamp(0.0, 0.2), st.rt_samples.clamp(8, 1024), self.rt_amb(), [3.0 * st.sun_intensity, 2.9 * st.sun_intensity, 2.7 * st.sun_intensity], self.config.width, self.config.height);
        }
        let post_on = st.post_on;
        if post_on && self.post.as_ref().map(|p| (p.w, p.h)) != Some((self.config.width, self.config.height)) {
            self.post = Some(make_post(&self.device, self.config.width, self.config.height, self.config.format));
        }
        {
            let first = match (&self.post, post_on) {
                (Some(p), true) => &p.src,
                _ => &view,
            };
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("on screen"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: first, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store } })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            self.rt.composite(&self.device, &self.queue, &mut pass, &self.scene_color, &self.scene_normal, &self.scene_mat, st.rt, st.tone, st.exposure, [st.rt_shadow, st.rt_ao, st.rt_refl], st.smooth, st.floor_col);
            if let (true, Some(sb)) = (st.st_on, &self.st_bind) {
                pass.set_pipeline(&self.st_pipeline);
                pass.set_bind_group(0, &self.frame_bg, &[]);
                pass.set_bind_group(1, sb, &[]);
                pass.draw(0..3, 0..1);
            }
            if u.cursor[3] > 0.5 && !post_on {
                pass.set_pipeline(&self.ring_pipeline);
                pass.set_bind_group(0, &self.frame_bg, &[]);
                pass.draw(0..3, 0..1);
            }
        }
        if let (true, Some(pg)) = (post_on, &self.post) {
            let (w, h) = (self.config.width as f32, self.config.height as f32);
            let pst = st.post;
            let (near, far) = ((cam.dist * 0.01).max(1e-4), cam.dist * 20.0 + cam.radius * 4.0);
            let seed = if pst[5][1] < 0.0 { 7.13 + (self.started.elapsed().as_secs_f32() * -pst[5][1]).floor() * 3.17 } else { pst[5][1] };
            let step = 1.0 + pst[0][1] * 5.0;
            let mk = |dir: [f32; 2]| -> [[f32; 4]; 9] {
                [
                    [pst[0][0], pst[0][1], near, far],
                    [pst[1][0], pst[1][1], cam.dist * (1.0 + pst[1][2]), if st.ortho { 1.0 } else { 0.0 }],
                    pst[2],
                    pst[3],
                    pst[4],
                    [pst[5][0], seed, pst[5][2], pst[5][3] * (h / 1080.0).max(1.0)],
                    pst[6],
                    [1.0 / w, 1.0 / h, w / h, 0.0],
                    [dir[0], dir[1], 0.0, 0.0],
                ]
            };
            self.queue.write_buffer(&self.post_bufs[0], 0, bytemuck::cast_slice(&mk([0.0, 0.0])));
            self.queue.write_buffer(&self.post_bufs[1], 0, bytemuck::cast_slice(&mk([step / (w / 2.0).max(1.0), 0.0])));
            self.queue.write_buffer(&self.post_bufs[2], 0, bytemuck::cast_slice(&mk([0.0, step / (h / 2.0).max(1.0)])));
            let bg = |buf: usize, bloom: &wgpu::TextureView| {
                self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("post group"),
                    layout: &self.post_layout,
                    entries: &[
                        wgpu::BindGroupEntry { binding: 0, resource: self.post_bufs[buf].as_entire_binding() },
                        wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&pg.src) },
                        wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(bloom) },
                        wgpu::BindGroupEntry { binding: 3, resource: wgpu::BindingResource::TextureView(&self.depth) },
                        wgpu::BindGroupEntry { binding: 4, resource: wgpu::BindingResource::Sampler(&self.post_smp) },
                    ],
                })
            };
            let run = |enc: &mut wgpu::CommandEncoder, pipe: &wgpu::RenderPipeline, group: &wgpu::BindGroup, target: &wgpu::TextureView, load: wgpu::LoadOp<wgpu::Color>| {
                let mut p = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("post"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: target, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load, store: wgpu::StoreOp::Store } })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                });
                p.set_pipeline(pipe);
                p.set_bind_group(0, group, &[]);
                p.draw(0..3, 0..1);
            };
            if pst[2][0] > 0.5 {
                let g0 = bg(0, &pg.b);
                run(&mut enc, &self.post_bright, &g0, &pg.a, wgpu::LoadOp::Clear(wgpu::Color::BLACK));
                for _ in 0..2 {
                    let gh = bg(1, &pg.a);
                    run(&mut enc, &self.post_blur, &gh, &pg.b, wgpu::LoadOp::Clear(wgpu::Color::BLACK));
                    let gv = bg(2, &pg.b);
                    run(&mut enc, &self.post_blur, &gv, &pg.a, wgpu::LoadOp::Clear(wgpu::Color::BLACK));
                }
            }
            let gf = bg(0, &pg.a);
            run(&mut enc, &self.post_final, &gf, &view, wgpu::LoadOp::Clear(wgpu::Color::BLACK));
            if u.cursor[3] > 0.5 {
                let mut p = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("ring"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: &view, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store } })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                });
                p.set_pipeline(&self.ring_pipeline);
                p.set_bind_group(0, &self.frame_bg, &[]);
                p.draw(0..3, 0..1);
            }
        }
        self.queue.submit(Some(enc.finish()));
        if let Some(f) = frame {
            self.window.pre_present_notify();
            f.present();
        }
    }

    /// A finished picture at any size (waiting for the ray tracing to settle first), as PNG bytes.
    fn capture(&mut self, cam: &Camera, w: u32, h: u32, o: &CaptureOpts) -> Result<Vec<u8>, String> {
        let (w, h) = (w.clamp(16, 8192), h.clamp(16, 8192));
        let cam = &Camera { yaw: cam.yaw + o.yaw_add, pitch: cam.pitch, dist: cam.dist, target: cam.target, radius: cam.radius };
        let saved = self.settings;
        if let Some(t) = o.env_turn {
            self.settings.env_turn = t;
        }
        if let Some(a) = o.sun_az {
            self.settings.sun_azimuth = a;
        }
        let old = (self.config.width, self.config.height);
        self.config.width = w;
        self.config.height = h;
        self.depth = make_depth(&self.device, w, h);
        let (c, n, m) = make_scene(&self.device, w, h, self.config.format);
        self.scene_color = c;
        self.scene_normal = n;
        self.scene_mat = m;
        let format = self.config.format;
        let tex = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("capture"),
            size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = tex.create_view(&wgpu::TextureViewDescriptor::default());
        if self.settings.rt {
            self.rt.wait_tree(&self.device, &self.queue);
        }
        let rounds = if !self.settings.rt { 1 } else if o.rounds > 0 { o.rounds } else { self.settings.rt_samples.clamp(8, 1024) + 2 };
        for _ in 0..rounds {
            self.draw_to(cam, Some(&view));
            // keep the queue from running far ahead of the card
            let _ = self.device.poll(wgpu::PollType::Wait);
        }
        let row = (w * 4).div_ceil(256) * 256;
        let buf = self.device.create_buffer(&wgpu::BufferDescriptor { label: Some("capture read"), size: (row * h) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
        let mut enc = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("capture copy") });
        enc.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo { texture: &tex, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            wgpu::TexelCopyBufferInfo { buffer: &buf, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(row), rows_per_image: Some(h) } },
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );
        self.queue.submit(Some(enc.finish()));
        let (tx, rx) = mpsc::channel();
        buf.slice(..).map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        let _ = self.device.poll(wgpu::PollType::Wait);
        let ok = rx.recv().map_err(|e| e.to_string())?.map_err(|e| e.to_string());
        let mut rgba = vec![0u8; (w * h * 4) as usize];
        if ok.is_ok() {
            let data = buf.slice(..).get_mapped_range();
            let bgr = matches!(format, wgpu::TextureFormat::Bgra8Unorm | wgpu::TextureFormat::Bgra8UnormSrgb);
            for y in 0..h as usize {
                for x in 0..w as usize {
                    let s = y * row as usize + x * 4;
                    let d = (y * w as usize + x) * 4;
                    let p = [data[s], data[s + 1], data[s + 2], 255];
                    rgba[d..d + 4].copy_from_slice(&if bgr { [p[2], p[1], p[0], 255] } else { p });
                }
            }
            drop(data);
            buf.unmap();
        }
        // back to the window's size
        self.config.width = old.0;
        self.config.height = old.1;
        self.depth = make_depth(&self.device, old.0, old.1);
        let (c, n, m) = make_scene(&self.device, old.0, old.1, format);
        self.scene_color = c;
        self.scene_normal = n;
        self.scene_mat = m;
        self.settings = saved;
        self.window.request_redraw();
        ok?;
        Ok(rgba)
    }
}

impl App {
    /// Puts the camera where the page's camera is (eye and target).
    fn set_cam(&mut self, c: [f32; 6]) {
        let (eye, tgt) = (Vec3::new(c[0], c[1], c[2]), Vec3::new(c[3], c[4], c[5]));
        let d = eye - tgt;
        let dist = d.length();
        if dist > 1e-6 {
            self.cam.target = tgt;
            self.cam.dist = dist;
            self.cam.pitch = (d.y / dist).clamp(-1.0, 1.0).asin();
            self.cam.yaw = d.z.atan2(d.x);
        }
    }

    fn frame_model(&mut self, c: Vec3, r: f32) {
        self.home = (c, r);
        self.cam.target = c;
        self.cam.radius = r;
        self.cam.dist = r * 2.6;
    }
}

impl App {
    fn paint_on(&self) -> bool {
        self.gpu.as_ref().map_or(false, |g| g.settings.paint || g.settings.track)
    }

    /// Tells the page what the pointer did (position in pixels, the camera, the modifier keys).
    fn emit(&mut self, kind: &str) {
        let (Some(sink), Some(g)) = (self.sink.as_ref(), self.gpu.as_ref()) else { return };
        self.last_sent = Instant::now();
        let c = &self.cam;
        let eye = c.target + Vec3::new(c.yaw.cos() * c.pitch.cos(), c.pitch.sin(), c.yaw.sin() * c.pitch.cos()) * c.dist;
        let (w, h) = (g.config.width, g.config.height);
        let (pos, sz) = (g.window.outer_position().map(|p| (p.x, p.y)).unwrap_or((0, 0)), g.window.inner_size());
        sink(format!(
            "{{\"win\":[{},{},{},{}],\"t\":\"{}\",\"x\":{:.1},\"y\":{:.1},\"w\":{},\"h\":{},\"eye\":[{},{},{}],\"tgt\":[{},{},{}],\"fov\":{},\"shift\":{},\"ctrl\":{},\"alt\":{}}}",
            pos.0, pos.1, sz.width, sz.height, kind, self.last.0, self.last.1, w, h, eye.x, eye.y, eye.z, c.target.x, c.target.y, c.target.z, g.settings.fov, self.shift, self.ctrl, self.alt
        ));
    }
}

impl ApplicationHandler<Cmd> for App {
    fn resumed(&mut self, el: &ActiveEventLoop) {
        if self.gpu.is_some() {
            return;
        }
        let hint = self.pending.as_ref().and_then(|s| s.window);
        match Gpu::new(el, hint) {
            Ok((mut gpu, report)) => {
                if let Some(s) = self.pending.take() {
                    let (c, r) = gpu.set_scene(&s);
                    self.frame_model(c, r);
                    if let Some(c) = s.settings.cam {
                        self.set_cam(c);
                    }
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

    fn about_to_wait(&mut self, _el: &ActiveEventLoop) {
        if let Some(g) = self.gpu.as_ref() {
            if g.animated || (g.settings.post_on && g.settings.post[5][1] < 0.0) || (g.settings.rt && g.rt.busy()) {
                g.window.request_redraw();
            }
        }
    }

    fn user_event(&mut self, el: &ActiveEventLoop, cmd: Cmd) {
        match cmd {
            Cmd::Close => {
                self.emit("closed");
                el.exit();
            }
            Cmd::Capture(w, h, o, tx) => {
                let r = match self.gpu.as_mut() {
                    Some(g) => g.capture(&self.cam, w, h, &o),
                    None => Err("the viewer is not ready".into()),
                };
                let _ = tx.send(r);
            }
            Cmd::Textures(name, m) => {
                if let Some(g) = self.gpu.as_mut() {
                    g.set_textures(&name, &m);
                    g.window.request_redraw();
                }
            }
            Cmd::Update(mut settings, env) => {
                if let Some(c) = settings.cam.take() {
                    self.set_cam(c);
                }
                if let Some(g) = self.gpu.as_mut() {
                    let disp_changed = (g.settings.disp - settings.disp).abs() > 1e-6;
                    g.settings = settings;
                    if disp_changed {
                        g.apply_rt_model();
                    }
                    match env {
                        EnvChange::Keep => {}
                        EnvChange::Clear => g.set_env(None),
                        EnvChange::Set(e) => g.set_env(Some(&e)),
                    }
                    g.window.request_redraw();
                }
            }
            Cmd::Scene(s) => {
                if let Some(g) = self.gpu.as_mut() {
                    let (c, r) = g.set_scene(&s);
                    self.frame_model(c, r);
                    if let Some(c) = s.settings.cam {
                        self.set_cam(c);
                    }
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
            WindowEvent::CloseRequested => {
                self.emit("closed"); // so the page knows the window is gone
                el.exit();
            }
            WindowEvent::Resized(s) => {
                if let Some(g) = self.gpu.as_mut() {
                    g.resize(s.width, s.height);
                    g.window.request_redraw();
                }
                if self.paint_on() {
                    self.emit("cam");
                }
            }
            WindowEvent::RedrawRequested => {
                if let Some(g) = self.gpu.as_mut() {
                    g.draw(&self.cam);
                }
            }
            WindowEvent::ModifiersChanged(m) => {
                self.shift = m.state().shift_key();
                self.ctrl = m.state().control_key();
                self.alt = m.state().alt_key();
            }
            WindowEvent::MouseInput { state, button, .. } => {
                let paints = button == MouseButton::Left && self.gpu.as_ref().map_or(false, |g| g.settings.paint) && !self.alt;
                if paints {
                    self.emit(if state == ElementState::Pressed { "down" } else { "up" });
                    self.painting = state == ElementState::Pressed;
                    self.drag = None;
                } else {
                    self.drag = if state == ElementState::Pressed { Some(button) } else { None };
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                let (dx, dy) = ((position.x - self.last.0) as f32, (position.y - self.last.1) as f32);
                self.last = (position.x, position.y);
                if let Some(g) = self.gpu.as_mut() {
                    g.cursor = Some((position.x as f32, position.y as f32));
                    if g.settings.paint && g.settings.brush > 0.0 && self.drag.is_none() {
                        g.window.request_redraw();
                    }
                }
                if self.painting {
                    if self.last_sent.elapsed() >= Duration::from_millis(16) {
                        self.emit("move");
                    }
                    if let Some(g) = self.gpu.as_ref() {
                        g.window.request_redraw(); // the brush outline follows the pointer
                    }
                    return;
                }
                if self.drag.is_none() && self.gpu.as_ref().map(|g| g.settings.paint).unwrap_or(false) && self.last_sent.elapsed() >= Duration::from_millis(40) {
                    self.emit("hover");
                }
                match self.drag {
                    Some(MouseButton::Left) => {
                        self.cam.yaw -= dx * 0.008;
                        self.cam.pitch = (self.cam.pitch + dy * 0.008).clamp(-1.5, 1.5);
                    }
                    Some(MouseButton::Right) if self.shift => {
                        // Shift + right-drag turns the sky (the light when there is no environment), as in the 3D view
                        if let Some(g) = self.gpu.as_mut() {
                            if g.has_env {
                                g.settings.env_turn = (g.settings.env_turn + dx * 0.5 / 360.0).rem_euclid(1.0);
                            } else {
                                g.settings.sun_azimuth = (g.settings.sun_azimuth + dx * 0.5).rem_euclid(360.0);
                            }
                        }
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
                    if self.paint_on() && self.last_sent.elapsed() >= Duration::from_millis(30) {
                        self.emit("cam"); // the page follows the camera
                    }
                    if let Some(g) = self.gpu.as_ref() {
                        g.window.request_redraw();
                    }
                }
            }
            WindowEvent::CursorLeft { .. } => {
                if let Some(g) = self.gpu.as_mut() {
                    g.cursor = None;
                    g.window.request_redraw();
                }
            }
            WindowEvent::KeyboardInput { event, .. } => {
                // F: bring the whole model back into view
                if event.state == ElementState::Pressed && !event.repeat {
                    if let Key::Character(c) = &event.logical_key {
                        if c.eq_ignore_ascii_case("p") || c.eq_ignore_ascii_case("r") {
                            // P: take a picture, R: ray tracing on or off (the page does both)
                            self.emit(if c.eq_ignore_ascii_case("p") { "key-p" } else { "key-r" });
                        }
                        if c.eq_ignore_ascii_case("f") {
                            let (c0, r0) = self.home;
                            self.frame_model(c0, r0);
                            if self.paint_on() {
                                self.emit("cam");
                            }
                            if let Some(g) = self.gpu.as_ref() {
                                g.window.request_redraw();
                            }
                        }
                    } else if matches!(event.logical_key, Key::Named(NamedKey::Escape)) {
                        self.drag = None;
                    }
                }
            }
            WindowEvent::MouseWheel { delta, .. } => {
                let s = match delta {
                    MouseScrollDelta::LineDelta(_, y) => y,
                    MouseScrollDelta::PixelDelta(p) => p.y as f32 / 40.0,
                };
                self.cam.dist = (self.cam.dist * (1.0 - s * 0.1)).max(self.cam.radius * 0.05);
                if self.paint_on() {
                    self.emit("cam");
                }
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
pub fn open(scene: Scene, sink: Option<EventSink>) -> Result<Viewer, String> {
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
                shift: false,
                ctrl: false,
                alt: false,
                painting: false,
                home: (Vec3::ZERO, 1.0),
                last_sent: Instant::now(),
                sink,
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

/// The mirror planes and radial rays of the 3D view, as line segments (pairs of points).
fn mirror_guide(st: &Settings) -> Vec<f32> {
    let r = st.mir_r;
    let o = st.mir_off;
    let mut pts: Vec<f32> = Vec::new();
    if r <= 0.0 {
        return pts;
    }
    for i in 0..3usize {
        if st.mir[i].is_nan() {
            continue;
        }
        let (u, v) = ((i + 1) % 3, (i + 2) % 3);
        let c = [[-r, -r], [r, -r], [r, r], [-r, r]];
        let mut add = |a: [f32; 2]| {
            let mut p = [0.0f32; 3];
            p[i] = o[i];
            p[u] = a[0];
            p[v] = a[1];
            pts.extend_from_slice(&p);
        };
        for k in 0..4 {
            add(c[k]);
            add(c[(k + 1) % 4]);
        }
        for a in [[0.0, -r], [0.0, r], [-r, 0.0], [r, 0.0]] {
            add(a);
        }
    }
    let n = st.mir_radial[0] as usize;
    if n > 1 {
        let ax = st.mir_radial[1] as usize % 3;
        let (u, v) = ((ax + 1) % 3, (ax + 2) % 3);
        let point = |a: f32| {
            let mut p = o;
            p[u] += a.cos() * r;
            p[v] += a.sin() * r;
            p
        };
        let mut lo = o;
        let mut hi = o;
        lo[ax] -= r;
        hi[ax] += r;
        pts.extend_from_slice(&lo);
        pts.extend_from_slice(&hi);
        for k in 0..n {
            pts.extend_from_slice(&o);
            pts.extend_from_slice(&point(k as f32 * std::f32::consts::TAU / n as f32));
        }
        for k in 0..64 {
            pts.extend_from_slice(&point(k as f32 * std::f32::consts::TAU / 64.0));
            pts.extend_from_slice(&point((k + 1) as f32 * std::f32::consts::TAU / 64.0));
        }
    }
    pts
}
