//! The wire format the page uses to hand a scene over (see the Tauri side's viewer.rs for how it arrives).
//! A 4-byte length, that many bytes of JSON, then the data: positions, normals and UVs as 32-bit floats; for each
//! material its triangle indices (32-bit) and its maps as PNG files; then the environment as 32-bit floats.

use serde::Deserialize;

use crate::{decode_png, EnvChange, EnvData, Group, Material, MeshData, Scene, Settings, ShaderParams, Tex8};

#[derive(Deserialize)]
struct MapLens {
    base: usize,
    orm: usize,
    normal: usize,
    emissive: usize,
    #[serde(default)]
    height: usize,
}

#[derive(Deserialize, Default)]
struct ShaderMeta {
    #[serde(default)]
    k: i32,
    #[serde(default)]
    p: [f32; 4],
    #[serde(default)]
    q: [f32; 4],
    #[serde(default)]
    c: [f32; 3],
    #[serde(default)]
    d: [f32; 3],
    #[serde(default)]
    skin: [f32; 4],
}

#[derive(Deserialize)]
struct GroupMeta {
    #[serde(default)]
    sh: ShaderMeta,
    name: String,
    idx: usize,
    rough: f32,
    metal: f32,
    tex: MapLens,
    /// the base map is plain RGBA bytes of this size, not a PNG
    #[serde(default)]
    raw: Option<[u32; 2]>,
    /// a texture update that only brings some maps
    #[serde(default)]
    partial: bool,
}

#[derive(Deserialize)]
struct EnvMeta {
    w: u32,
    h: u32,
}

#[derive(Deserialize)]
struct SettingsMeta {
    tone: i32,
    expo: f32,
    env_turn: f32,
    env_strength: f32,
    show_bg: bool,
    #[serde(default = "blur_default")]
    env_blur: f32,
    sun_az: f32,
    sun_el: f32,
    sun_i: f32,
    #[serde(default = "fov_default")]
    fov: f32,
    #[serde(default)]
    paint: bool,
    #[serde(default)]
    brush: f32,
    #[serde(default)]
    rt: bool,
    #[serde(default = "d09")]
    rt_shadow: f32,
    #[serde(default = "d085")]
    rt_ao: f32,
    #[serde(default = "d07")]
    rt_refl: f32,
    #[serde(default = "d002")]
    rt_soft: f32,
    #[serde(default = "d96")]
    rt_samples: u32,
    #[serde(default)]
    cam: Option<[f32; 6]>,
    #[serde(default)]
    bg: Option<[f32; 3]>,
    #[serde(default = "dtrue")]
    smooth: bool,
    #[serde(default)]
    lights: Vec<[f32; 12]>,
    #[serde(default)]
    ortho: bool,
    #[serde(default = "d012")]
    studio_fill: f32,
    #[serde(default = "d008")]
    studio_rim: f32,
    #[serde(default)]
    wire: u8,
    #[serde(default)]
    disp: f32,
    #[serde(default)]
    mir: Option<[Option<f32>; 3]>,
    #[serde(default)]
    mir_radial: Option<[f32; 2]>,
    #[serde(default)]
    mir_off: Option<[f32; 3]>,
    #[serde(default)]
    mir_r: f32,
    #[serde(default)]
    st_on: bool,
    #[serde(default)]
    st: Option<[f32; 8]>,
    #[serde(default)]
    st_view: Option<[f32; 2]>,
    #[serde(default)]
    wire_col: Option<[f32; 3]>,
    #[serde(default)]
    unlit: bool,
    #[serde(default)]
    metal_view: f32,
}

fn d012() -> f32 {
    0.12
}
fn d008() -> f32 {
    0.08
}

fn dtrue() -> bool {
    true
}

fn d09() -> f32 {
    0.9
}
fn d085() -> f32 {
    0.85
}
fn d07() -> f32 {
    0.7
}
fn d002() -> f32 {
    0.02
}
fn d96() -> u32 {
    96
}

fn fov_default() -> f32 {
    45.0
}

fn blur_default() -> f32 {
    0.35
}

#[derive(Deserialize)]
struct Meta {
    /// for a lighting update: "keep" the environment picture on show, "clear" it, or "set" the one that follows
    #[serde(default)]
    env_mode: Option<String>,
    pos: usize,
    nrm: usize,
    uv: usize,
    groups: Vec<GroupMeta>,
    env: Option<EnvMeta>,
    settings: SettingsMeta,
    #[serde(default)]
    win: Option<[i32; 4]>,
}

fn floats(b: &[u8]) -> Vec<f32> {
    b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
}

/// Reads the body into a scene. Every size is checked, so a wrong body is an error, never a crash.
/// A lighting update: the same body as a scene, with no model. Returns the settings and what to do with the environment.
pub fn update_from_bytes(bytes: &[u8]) -> Result<(Settings, EnvChange), String> {
    let (scene, mode) = parse(bytes)?;
    let change = match (mode.as_deref(), scene.env) {
        (Some("keep"), _) => EnvChange::Keep,
        (_, Some(e)) if e.width > 0 => EnvChange::Set(e),
        _ => EnvChange::Clear,
    };
    Ok((scene.settings, change))
}

/// New pictures for one material: the same body as a scene with one group and no triangles. Returns the group's name and its material.
pub fn textures_from_bytes(bytes: &[u8]) -> Result<(String, Material), String> {
    let (mut scene, _) = parse(bytes)?;
    let g = scene.groups.pop().ok_or_else(|| "no material in the data".to_string())?;
    Ok((g.name, g.material))
}

pub fn scene_from_bytes(bytes: &[u8]) -> Result<Scene, String> {
    parse(bytes).map(|(s, _)| s)
}

fn parse(bytes: &[u8]) -> Result<(Scene, Option<String>), String> {
    if bytes.len() < 4 {
        return Err("the model data is empty".into());
    }
    let jl = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
    if bytes.len() < 4 + jl {
        return Err("the model data is cut short".into());
    }
    let meta: Meta = serde_json::from_slice(&bytes[4..4 + jl]).map_err(|e| format!("bad model description: {e}"))?;
    let mut rd = Reader { bytes, at: 4 + jl };
    let positions = floats(rd.take(meta.pos * 4)?);
    let normals = floats(rd.take(meta.nrm * 4)?);
    let uvs = floats(rd.take(meta.uv * 4)?);
    let mut groups = Vec::new();
    for g in &meta.groups {
        let indices: Vec<u32> = rd.take(g.idx * 4)?.chunks_exact(4).map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        let map = |rd: &mut Reader, n: usize| -> Result<Option<Tex8>, String> {
            if n == 0 {
                return Ok(None);
            }
            Ok(Some(decode_png(rd.take(n)?)?))
        };
        let base = match g.raw {
            Some([rw, rh]) if g.tex.base > 0 => {
                let bytes = rd.take(g.tex.base)?;
                if bytes.len() != (rw as usize) * (rh as usize) * 4 {
                    return Err("a raw picture has the wrong size".into());
                }
                Some(Tex8 { width: rw, height: rh, rgba: bytes.to_vec() })
            }
            _ => map(&mut rd, g.tex.base)?,
        };
        let orm = map(&mut rd, g.tex.orm)?;
        let normal = map(&mut rd, g.tex.normal)?;
        let emissive = map(&mut rd, g.tex.emissive)?;
        let height = map(&mut rd, g.tex.height)?;
        let shader = ShaderParams { kind: g.sh.k, p: g.sh.p, q: g.sh.q, c: g.sh.c, d: g.sh.d, skin: g.sh.skin };
        let material = Material { shader, base, orm, normal, emissive, height, rough: g.rough, metal: g.metal, partial: g.partial };
        groups.push(Group { name: g.name.clone(), indices, material });
    }
    let env = match &meta.env {
        Some(e) => Some(EnvData { width: e.w, height: e.h, rgb: floats(rd.take((e.w as usize) * (e.h as usize) * 3 * 4)?) }),
        None => None,
    };
    let s = &meta.settings;
    let settings = Settings {
        tone: s.tone,
        exposure: s.expo,
        env_turn: s.env_turn,
        env_strength: s.env_strength,
        show_background: s.show_bg,
        env_blur: s.env_blur,
        sun_azimuth: s.sun_az,
        sun_elevation: s.sun_el,
        sun_intensity: s.sun_i,
        fov: s.fov,
        paint: s.paint,
        brush: s.brush,
        rt: s.rt,
        rt_shadow: s.rt_shadow,
        rt_ao: s.rt_ao,
        rt_refl: s.rt_refl,
        rt_soft: s.rt_soft,
        rt_samples: s.rt_samples,
        cam: s.cam,
        bg: s.bg.unwrap_or([0.09, 0.1, 0.115]),
        smooth: s.smooth,
        ortho: s.ortho,
        studio_fill: s.studio_fill,
        studio_rim: s.studio_rim,
        wire: s.wire,
        disp: s.disp,
        mir: { let m = s.mir.unwrap_or([None; 3]); [m[0].unwrap_or(f32::NAN), m[1].unwrap_or(f32::NAN), m[2].unwrap_or(f32::NAN)] },
        mir_radial: s.mir_radial.unwrap_or([0.0, 0.0]),
        mir_off: s.mir_off.unwrap_or([0.0; 3]),
        mir_r: s.mir_r,
        st_on: s.st_on,
        st: s.st.unwrap_or([0.0; 8]),
        st_view: s.st_view.unwrap_or([1.0, 1.0]),
        wire_col: s.wire_col.unwrap_or([0.95, 0.7, 0.35]),
        unlit: s.unlit,
        metal_view: s.metal_view,
        light_n: s.lights.len().min(4) as u32,
        light_a: {
            let mut a = [[0.0f32; 4]; 4];
            for (i, l) in s.lights.iter().take(4).enumerate() {
                a[i] = [l[0], l[1], l[2], l[3]];
            }
            a
        },
        light_b: {
            let mut a = [[0.0f32; 4]; 4];
            for (i, l) in s.lights.iter().take(4).enumerate() {
                a[i] = [l[4], l[5], l[6], l[7]];
            }
            a
        },
        light_c: {
            let mut a = [[0.0f32; 4]; 4];
            for (i, l) in s.lights.iter().take(4).enumerate() {
                a[i] = [l[8], l[9], l[10], l[11]];
            }
            a
        },
    };
    Ok((Scene { mesh: MeshData { positions, normals, uvs }, groups, env, settings, window: meta.win }, meta.env_mode.clone()))
}


struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.at.checked_add(n).map_or(true, |e| e > self.bytes.len()) {
            return Err("the model data is cut short".into());
        }
        let s = &self.bytes[self.at..self.at + n];
        self.at += n;
        Ok(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn le(v: &[f32]) -> Vec<u8> {
        v.iter().flat_map(|f| f.to_le_bytes()).collect()
    }

    #[test]
    fn a_scene_comes_through() {
        let json = br#"{"pos":9,"nrm":9,"uv":6,"groups":[{"name":"A","idx":3,"rough":0.5,"metal":0.0,"tex":{"base":0,"orm":0,"normal":0,"emissive":0}}],"env":{"w":2,"h":1},"settings":{"tone":1,"expo":1.0,"env_turn":0.0,"env_strength":1.0,"show_bg":true,"sun_az":40.0,"sun_el":45.0,"sun_i":1.0}}"#;
        let mut body = (json.len() as u32).to_le_bytes().to_vec();
        body.extend(json);
        body.extend(le(&[0., 0., 0., 1., 0., 0., 0., 1., 0.]));
        body.extend(le(&[0., 0., 1., 0., 0., 1., 0., 0., 1.]));
        body.extend(le(&[0., 0., 1., 0., 0., 1.]));
        body.extend([0u32, 1, 2].iter().flat_map(|i| i.to_le_bytes()));
        body.extend(le(&[1., 2., 3., 4., 5., 6.]));
        let s = scene_from_bytes(&body).unwrap();
        assert_eq!(s.mesh.positions.len(), 9);
        assert_eq!(s.groups[0].indices, vec![0, 1, 2]);
        assert_eq!(s.env.as_ref().unwrap().rgb[5], 6.0);
        assert!(scene_from_bytes(&body[..body.len() - 1]).is_err());
        assert!(scene_from_bytes(&[1, 2]).is_err());
    }
}
