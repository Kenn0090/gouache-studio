/* ================= Gouache shaders for Unity and Godot (0.93.4) =================
   Kenn: when you export to a game engine, bring the viewer shader over too (Standard, Skin, Brushed metal, Velvet,
   Toon, Cel, Spec/Gloss, Panner, Retro), so the model looks about the same there. Each texture set gets a material
   that uses its shader and its textures (base colour, ORM = AO/roughness/metal, normal, emissive):
   - Godot 4: <Set>.gdshader + <Set>.tres (a ShaderMaterial with the textures hooked up); Toon and Cel also get an
     outline material chained on (next pass).
   - Unity (URP): one shader, GouacheShaded.shader, plus <Set>.mat for each set and .meta files, so the textures are
     found (normal maps get the Normal map type). Built-in and HDRP projects: the shader is URP only.
   - Unreal: gouache_unreal.gdata (JSON inside; not .json, because Unreal offers to import .json files as data tables) + gouache_unreal_setup.py. Run the script in the editor (Tools > Execute Python Script):
     it imports the textures and builds one material per set (Lit; Cloth for Velvet, Subsurface for Skin, Unlit with
     the banding worked out in a Custom node for Toon, Cel and Retro; Toon and Cel also draw their outline in the same
     material and follow the Directional Light through a parameter collection).
   The look is a close match, not identical: each engine lights differently. */
/* bump this when a look's shader changes in a way that matters: Gouache then offers to update the master shaders already in a game */
const ESH_MASTER_VER=2;
const ESH_KIND_NAMES=['Standard','Skin','Brushed metal','Velvet','Toon','Cel','Spec/Gloss','Panner','Retro','Hologram','Glass','Fur','Iridescent','Car paint','Cloth sheen','Wax / marble glow'];
const ESH_SHADER_GUID='47a0c5e1b2d34f6a8c91e0f3d5b7a901';
function eshGuid(s){let a=0x811c9dc5,b=0x1b873593,c=0x9e3779b1,d=0x85ebca6b;for(let i=0;i<s.length;i++){const k=s.charCodeAt(i);a=Math.imul(a^k,16777619);b=Math.imul(b^k,2246822519);c=Math.imul(c^(k<<1),3266489917);d=Math.imul(d^(k+i),668265263);}
  return [a,b,c,d].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');}
const eshF=n=>{const t=String(+(+n).toFixed(4));return /[.e]/.test(t)?t:t+'.0';};
const eshSafe=s=>String(s||'Material').replace(/[\\/:*?"<>|\s]+/g,'_');
/* the size of the model (for the outline width, which the viewer measures in screen pixels) */
function eshModelSize(m){if(!m||!m.pos)return 1;const mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];for(let i=0;i<m.pos.length;i+=3)for(let j=0;j<3;j++){const v=m.pos[i+j];if(v<mn[j])mn[j]=v;if(v>mx[j])mx[j]=v;}
  return Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1;}

/* ---------------- Godot 4 ----------------
   One shared shader per look (res://gouache/_shaders/<Look>.gdshader, and <Look>_alpha for see-through materials), made once.
   Each texture set is a small ShaderMaterial (.tres) that only holds that set's textures and settings. */
const ESH_LOOKS={std:'Standard',skin:'Skin',aniso:'BrushedMetal',velvet:'Velvet',toon:'Toon',cel:'Cel',specgloss:'Standard',panner:'Panner',retro:'Retro',hologram:'Hologram',glass:'Glass',fur:'Fur',iridescent:'Iridescent',car:'CarPaint',cloth:'ClothSheen',wax:'Wax'};
const eshLook=k=>ESH_LOOKS[k]||'Standard';
/* the looks added in 0.94.1: Godot and Unity (URP) have them; Unity Built-in and Unreal send them as Standard */
const ESH_NEW=['hologram','glass','fur','iridescent','car','cloth','wax'];
const ESH_FUR_SHELLS=10;
const eshSafeShade=sh=>{if(!sh||!sh.kind)return sh;if(!ESH_LOOKS[sh.kind])return {kind:'std',p:{}};if(ESH_NEW.includes(sh.kind)&&(es.to==='unreal'||(es.to==='unity'&&texCfg.unityRP==='builtin')))return {kind:'std',p:{}};return sh;};
const eshV3=a=>'vec3('+(a||[1,1,1]).map(eshF).join(', ')+')';
/* a look's own settings: [uniform name, GLSL type, value text] taken from a shader's parameters */
function eshGodotParams(sh){const k=sh.kind,P=shParams(sh),L=[];
  if(k==='panner')L.push(['scroll_speed','vec2','vec2('+eshF(P.sx)+', '+eshF(P.sy)+')']);
  if(k==='retro')L.push(['texels','float',eshF(P.res)],['dither_amount','float',eshF(P.dither)],['colour_levels','vec3','vec3('+[(1<<P.br)-1,(1<<P.bg)-1,(1<<P.bb)-1].map(eshF).join(', ')+')'],['ambient_amount','float',eshF(P.amb==null?.35:P.amb)],['brightness','float',eshF(P.bright==null?1:P.bright)],['fog_amount','float',eshF(P.fog||0)],['fog_colour','vec3',eshV3(P.fogc)],['snap_grid','float',eshF(P.wobble>0?320-280*P.wobble:0)]);
  if(k==='aniso')L.push(['stretch','float',eshF(Math.min(1,Math.abs(P.amount)))],['direction_turns','float',eshF(P.dir)]);
  if(k==='velvet')L.push(['sheen_colour','vec3',eshV3(P.col)],['sheen','float',eshF(P.sheen)],['sheen_softness','float',eshF(P.srough)],['rim_power','float',eshF(P.rim)]);
  if(k==='skin')L.push(['blood_colour','vec3',eshV3(P.col)],['scatter_strength','float',eshF(P.scatter*P.strength)],['scatter_depth','float',eshF(P.depth*.1)],['transmission','float',eshF(P.transmission)],['oiliness','float',eshF(P.oil)]);
  if(k==='toon'||k==='cel'){L.push(['shadow_colour','vec3',eshV3(P.col)],['highlight','float',eshF(P.spec)],['rim_light','float',eshF(P.rim)]);
    if(k==='toon')L.push(['bands','float',eshF(P.steps)],['band_shift','float',eshF(P.offset)]);else L.push(['shadow_line','float',eshF(P.thresh)],['edge_softness','float',eshF(P.soft)]);}
  if(k==='hologram')L.push(['holo_colour','vec3',eshV3(P.col)],['see_through','float',eshF(P.opacity)],['edge_glow','float',eshF(P.glow)],['scan_lines','float',eshF(P.lines)],['scan_speed','float',eshF(P.speed)],['flicker','float',eshF(P.flicker)],['glitch','float',eshF(P.glitch)],['edge_pulse','float',eshF(P.pulse)],['sweep','float',eshF(P.sweep)],['body_glow','float',eshF(P.fill)]);
  if(k==='glass')L.push(['glass_colour','vec3',eshV3(P.col)],['bending','float',eshF(P.refr)],['frost','float',eshF(P.frost)],['thickness','float',eshF(P.thick)],['edge_reflect','float',eshF(P.edge)],['cloudiness','float',eshF(P.cloud)],['split_amount','float',eshF(P.disp)]);
  if(k==='fur')L.push(['tip_colour','vec3',eshV3(P.col)],['fur_length','float',eshF(P.length)],['strands','float',eshF(P.density)],['strand_width','float',eshF(P.width)],['clumping','float',eshF(P.clump)],['dark_roots','float',eshF(P.root)],['tip_amount','float',eshF(P.tipMix)],['wind','float',eshF(P.wind)],['wind_speed','float',eshF(P.windSpeed)],['droop','float',eshF(P.gravity)]);
  if(k==='iridescent')L.push(['iri_strength','float',eshF(P.strength)],['iri_range','float',eshF(P.range)],['iri_shift','float',eshF(P.shift)],['iri_angle','float',eshF(P.angle)]);
  if(k==='car')L.push(['coat','float',eshF(P.coat)],['coat_roughness','float',eshF(P.coatRough)],['orange_peel','float',eshF(P.peel)],['flake_amount','float',eshF(P.flakes)],['flake_size','float',eshF(P.size)],['flake_sparkle','float',eshF(P.sparkle)],['flake_colour','vec3',eshV3(P.col)]);
  if(k==='cloth')L.push(['cloth_colour','vec3',eshV3(P.col)],['cloth_sheen','float',eshF(P.sheen)],['softness','float',eshF(P.soft)],['satin_streak','float',eshF(P.aniso)],['fibre_turns','float',eshF(P.fibre)],['weave','float',eshF(P.weave)]);
  if(k==='wax')L.push(['glow_colour','vec3',eshV3(P.col)],['glow','float',eshF(P.glow)],['travel','float',eshF(P.depth)],['wax_softness','float',eshF(P.soft)],['wax_thickness','float',eshF(P.thick)]);
  return L;}
/* the shared shader of one look; its settings start at the look's usual values */
function eshGodotShader(kind,alpha){const L=eshGodotParams({kind,p:{}}),k=kind,defP=shParams({kind:k,p:{}}),
  U=[],F=[],Lt=[],V=[],RM=[];
  U.push('uniform sampler2D albedo_tex : source_color, '+(k==='retro'&&defP.filt===0?'filter_nearest':'filter_linear_mipmap')+', repeat_enable, hint_default_white;','uniform sampler2D orm_tex : filter_linear_mipmap, repeat_enable, hint_default_white;','uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;','uniform sampler2D emission_tex : source_color, filter_linear_mipmap, repeat_enable, hint_default_black;',
    'uniform bool has_orm = false;','uniform vec3 tint : source_color = vec3(1.0);','uniform float roughness_value : hint_range(0.0, 1.0) = 0.6;','uniform float metallic_value : hint_range(0.0, 1.0) = 0.0;','uniform float rough_scale : hint_range(0.0, 2.0) = 1.0;','uniform float metal_scale : hint_range(0.0, 2.0) = 1.0;','uniform float normal_strength : hint_range(0.0, 4.0) = 1.0;','uniform vec2 uv_scale = vec2(1.0, 1.0);','uniform vec2 uv_offset = vec2(0.0, 0.0);');
  for(const [n,t,v] of L)U.push('uniform '+t+' '+n+(t==='vec3'&&/colour|colour_|blood|sheen_colour|shadow/.test(n)&&n!=='colour_levels'?' : source_color':'')+' = '+v+';');
  let uvLine='vec2 uv = UV * uv_scale + uv_offset;';
  if(k==='panner')uvLine='vec2 uv = UV * uv_scale + uv_offset + TIME * scroll_speed;';
  if(k==='retro'){RM.push('diffuse_lambert','specular_disabled','vertex_lighting');uvLine='vec2 uv = (floor((UV * uv_scale + uv_offset) * texels) + 0.5) / texels;';
    V.push('void vertex() {','\tif (snap_grid > 0.5) {','\t\tvec4 p = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);','\t\tp.xy = floor(p.xy / p.w * snap_grid + 0.5) / snap_grid * p.w;','\t\tPOSITION = p;','\t}','}');}
  F.push('void fragment() {','\t'+uvLine,'\tvec4 a = texture(albedo_tex, uv);','\tALBEDO = a.rgb * tint;');
  if(alpha)F.push('\tALPHA = a.a;');
  F.push('\tif (has_orm) {','\t\tvec3 orm = texture(orm_tex, uv).rgb;','\t\tAO = orm.r;','\t\tROUGHNESS = clamp(orm.g * rough_scale, 0.0, 1.0);','\t\tMETALLIC = clamp(orm.b * metal_scale, 0.0, 1.0);','\t} else {','\t\tROUGHNESS = roughness_value;','\t\tMETALLIC = metallic_value;','\t}',
    '\tNORMAL_MAP = texture(normal_tex, uv).rgb;','\tNORMAL_MAP_DEPTH = normal_strength;','\tEMISSION = texture(emission_tex, uv).rgb;');
  if(k==='aniso')F.push('\tANISOTROPY = stretch;','\tANISOTROPY_FLOW = vec2(cos(direction_turns * TAU), sin(direction_turns * TAU));');
  if(k==='velvet')F.push('\tfloat fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), max(rim_power, 0.5) * 3.0 + 1.0);','\tEMISSION += sheen_colour * sheen * fr * mix(1.0, 0.5, sheen_softness);','\tROUGHNESS = max(ROUGHNESS, 0.55);');
  if(k==='skin')F.push('\tSSS_STRENGTH = scatter_strength;','\tSSS_TRANSMITTANCE_COLOR = vec4(blood_colour, 1.0);','\tSSS_TRANSMITTANCE_DEPTH = scatter_depth;','\tSSS_TRANSMITTANCE_BOOST = transmission;','\tSPECULAR = 0.5 + oiliness * 0.4;');
  if(k==='toon'||k==='cel'){
    F.push('\tfloat fresnel = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);','\tEMISSION += ALBEDO * smoothstep(1.0 - rim_light, 1.0, fresnel) * rim_light;');
    Lt.push('void light() {','\tfloat l = dot(NORMAL, LIGHT) * 0.5 + 0.5;');
    if(k==='toon')Lt.push('\tfloat st = max(bands, 1.0);','\tfloat band = floor(l * st + 0.5 * band_shift) / st;');else Lt.push('\tfloat band = smoothstep(shadow_line - edge_softness * 0.5, shadow_line + edge_softness * 0.5 + 0.0001, l);');
    Lt.push('\tvec3 lit = mix(shadow_colour, vec3(1.0), clamp(band, 0.0, 1.0));','\tDIFFUSE_LIGHT += lit * LIGHT_COLOR * ATTENUATION;','\tvec3 h = normalize(LIGHT + VIEW);','\tfloat sp = step(1.0 - highlight * 0.05, dot(NORMAL, h)) * (1.0 - ROUGHNESS * 0.5) * step(0.01, highlight);','\tSPECULAR_LIGHT += sp * LIGHT_COLOR * ATTENUATION;','}');}
  if(k==='retro')F.push('\tfloat bx = float((int(FRAGCOORD.x) & 3) * 4 + (int(FRAGCOORD.y) & 3)) / 16.0;','\tvec3 c = pow(clamp(ALBEDO, 0.0, 1.0), vec3(1.0 / 2.2));','\tc = floor(c * colour_levels + 0.5 + (bx - 0.5) * dither_amount) / colour_levels;','\tALBEDO = pow(clamp(c, 0.0, 1.0), vec3(2.2)) * brightness;','\tROUGHNESS = 1.0;','\tMETALLIC = 0.0;','\tFOG = vec4(fog_colour, clamp(1.0 - exp(-length(VERTEX) * fog_amount * 0.35), 0.0, 1.0));');
  /* ---- (0.94.1) hologram, glass, fur, iridescent, car paint, cloth, wax ---- */
  if(k==='hologram'){RM.push('unshaded','cull_disabled','depth_draw_never');U.push('varying vec3 wpos;');V.push('void vertex() {','\twpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;','}');
    F.length=0;F.push('void fragment() {','\tvec2 uv = UV * uv_scale + uv_offset;','\tvec3 alb = texture(albedo_tex, uv).rgb * tint;','\tfloat t = TIME;','\tfloat nv = clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0);',
      '\tfloat ln = smoothstep(0.35, 0.65, sin((wpos.y * scan_lines - t * scan_speed * 3.0) * 1.5708) * 0.5 + 0.5);',
      '\tfloat fl = max(1.0 - flicker * (0.35 * fract(sin(floor(t * 24.0) * 127.1 + 311.7) * 43758.5453) + 0.15 * sin(t * 60.0)), 0.0);',
      '\tfloat edge = pow(1.0 - nv, 2.5) * edge_glow * (1.0 + edge_pulse * 0.6 * sin(t * 3.0));','\tfloat body = body_glow * (0.35 + 0.65 * dot(alb, vec3(0.3333)));',
      '\tfloat sw = exp(-pow((fract(wpos.y * 0.35 - t * 0.25) - 0.5) * 7.0, 2.0)) * sweep;',
      '\tfloat gl = step(0.965 - glitch * 0.06, fract(sin(floor(wpos.y * 18.0) * 127.1 + floor(t * 7.0) * 311.7) * 43758.5453)) * glitch;','\tln = clamp(ln + gl * 0.8, 0.0, 1.0);',
      '\tvec3 c = holo_colour * (edge + ln * 0.55 + body * (0.4 + 0.6 * ln) + sw * 0.9 + gl * 1.2) * fl * 2.0 + texture(emission_tex, uv).rgb * 2.0;',
      '\tALBEDO = c;','\tALPHA = clamp(see_through * (0.15 + 0.5 * ln + 0.9 * edge + body * 0.6 + sw * 0.5 + gl * 0.6), 0.0, 1.0) * fl;');}
  if(k==='glass'){RM.push('cull_disabled');U.push('uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;');
    F.length=0;F.push('void fragment() {','\tvec2 uv = UV * uv_scale + uv_offset;','\tvec3 alb = texture(albedo_tex, uv).rgb * tint;','\tfloat nv = max(dot(NORMAL, VIEW), 0.001);',
      '\tvec3 tn = texture(normal_tex, uv).rgb * 2.0 - 1.0;','\tvec3 nm = normalize(NORMAL + vec3(tn.xy, 0.0) * normal_strength);',
      '\tvec2 off = nm.xy * bending * 0.08 * (1.0 + thickness * 0.3);','\tfloat lod = frost * 5.0;',
      '\tvec3 refr = vec3(textureLod(screen_tex, SCREEN_UV + off * (1.0 + split_amount * 0.25), lod).r, textureLod(screen_tex, SCREEN_UV + off, lod).g, textureLod(screen_tex, SCREEN_UV + off * (1.0 - split_amount * 0.25), lod).b);',
      '\tvec3 ab = exp(-(vec3(1.0) - glass_colour) * thickness * 1.6 / nv) * mix(vec3(1.0), alb, 0.85);',
      '\tALBEDO = vec3(0.0);','\tEMISSION = refr * ab * (1.0 - cloudiness) + glass_colour * cloudiness * 0.6 + texture(emission_tex, uv).rgb * 2.0;',
      '\tROUGHNESS = clamp(frost * 0.6 + 0.02, 0.0, 1.0);','\tMETALLIC = 0.0;','\tSPECULAR = clamp(0.5 * edge_reflect, 0.0, 1.0);','\tNORMAL_MAP = texture(normal_tex, uv).rgb;','\tNORMAL_MAP_DEPTH = normal_strength;','\tALPHA = 1.0;');}
  if(k==='fur'){RM.push('cull_disabled');U.push('uniform float shell_k = 0.0;');
    V.push('void vertex() {','\tfloat k = shell_k;','\tvec3 wd = vec3(wind * 0.054 * k * k, -droop * 0.09 * k * k, wind * 0.0225 * k * k);','\tVERTEX += NORMAL * fur_length * 0.09 * k + wd * (0.45 + 0.55 * sin(dot(VERTEX, vec3(3.1, 1.7, 2.3)) + TIME * wind_speed * 2.0));','}');
    F.length=0;F.push('void fragment() {','\tvec2 uv = UV * uv_scale + uv_offset;','\tvec3 alb = texture(albedo_tex, uv).rgb * tint;','\tfloat k = shell_k;','\tvec2 gp = uv * strands;','\tvec2 cell = floor(gp);','\tvec2 fq = fract(gp) - 0.5;',
      '\tvec2 cc = floor(gp / (1.0 + clumping * 3.0));','\tfq += (vec2(fract(sin(dot(cc, vec2(127.1, 311.7))) * 43758.5453), fract(sin(dot(cc + 7.3, vec2(127.1, 311.7))) * 43758.5453)) - 0.5) * clumping * k * 0.9;',
      '\tfloat len = 0.6 + 0.4 * fract(sin(dot(cell + 3.1, vec2(127.1, 311.7))) * 43758.5453);','\tfloat keep = 1.0;','\tif (k > 0.0 && (k > len || length(fq) * 2.0 > strand_width * (1.0 - k * 0.85))) keep = 0.0;',
      '\tvec3 root = alb * (1.0 - dark_roots * 0.85);','\tvec3 tip = mix(alb, tip_colour, tip_amount);','\tALBEDO = mix(root, tip, k) * mix(1.0 - dark_roots * 0.6, 1.0, k);','\tROUGHNESS = 0.85;','\tMETALLIC = 0.0;','\tSPECULAR = 0.25;','\tRIM = 0.2 * k;','\tRIM_TINT = 0.5;',
      '\tALPHA = keep;','\tALPHA_SCISSOR_THRESHOLD = 0.5;');}
  if(k==='iridescent')F.push('\tfloat nvi = clamp(dot(NORMAL, VIEW), 0.0, 1.0);','\tfloat ti = iri_shift + iri_range * (0.3 + iri_angle * (1.0 - nvi));','\tvec3 film = 0.5 + 0.5 * cos(6.2832 * (vec3(ti) + vec3(0.0, 0.33, 0.67)));','\tALBEDO = mix(ALBEDO, mix(film, vec3(1.0), 0.15), iri_strength * 0.85);','\tMETALLIC = mix(METALLIC, 1.0, 0.6 * iri_strength);');
  if(k==='car')F.push('\tCLEARCOAT = coat;','\tCLEARCOAT_ROUGHNESS = max(coat_roughness, 0.02);',
      '\t// flakes: tiny mirrors at their own angles, in cells of the model; they glint when the light and your eye line up',
      '\tvec3 q = mat3(vec3(0.36, 0.48, -0.8), vec3(-0.8, 0.6, 0.0), vec3(0.48, 0.64, 0.6)) * lpos * flake_size * 0.85;','\tvec3 ci = floor(q);','\tvec3 fr = fract(q) - 0.5;','\tfloat fw = length(fwidth(q));',
      '\tfloat h1 = fract(sin(dot(ci, vec3(127.1, 311.7, 74.7))) * 43758.5453);','\tfloat h2 = fract(sin(dot(ci + 17.1, vec3(127.1, 311.7, 74.7))) * 43758.5453);','\tfloat h3 = fract(sin(dot(ci + 43.7, vec3(127.1, 311.7, 74.7))) * 43758.5453);','\tfloat h4 = fract(sin(dot(ci + 91.3, vec3(127.1, 311.7, 74.7))) * 43758.5453);',
      '\tfloat rad = 0.22 + 0.28 * h4;','\tfloat fm = step(h1, flake_amount * 0.8) * smoothstep(rad, rad * 0.55, length(fr)) * (1.0 - smoothstep(0.5, 1.0, fw));',
      '\tvec3 np = normalize(vec3((h2 - 0.5) * 1.6, (h3 - 0.5) * 1.6, 1.0));','\tvec3 nt = texture(normal_tex, uv).rgb * 2.0 - 1.0;','\tNORMAL_MAP = normalize(mix(nt, normalize(nt + vec3(np.xy, 0.0) * 1.5), fm * flake_sparkle)) * 0.5 + 0.5;',
      '\tROUGHNESS = mix(ROUGHNESS, 0.12, fm);','\tMETALLIC = mix(METALLIC, 1.0, fm);','\tALBEDO = mix(ALBEDO, mix(flake_colour, ALBEDO, 0.2) * (0.6 + 0.8 * h4), fm * 0.7);');
  if(k==='cloth')F.push('\tfloat wv = mix(1.0, 0.55 + 0.45 * sin(uv.x * 200.0) * sin(uv.y * 200.0), weave);','\tALBEDO *= wv;','\tfloat frc = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);','\tEMISSION += cloth_colour * cloth_sheen * frc * mix(1.0, 0.5, softness) * 0.5;','\tROUGHNESS = max(ROUGHNESS, mix(0.3, 0.7, softness));','\tANISOTROPY = satin_streak;','\tANISOTROPY_FLOW = vec2(cos(fibre_turns * TAU), sin(fibre_turns * TAU));','\tRIM = cloth_sheen * 0.3;','\tRIM_TINT = 0.6;');
  if(k==='wax')F.push('\tROUGHNESS = mix(ROUGHNESS, max(ROUGHNESS, 0.5), wax_softness);','\tBACKLIGHT = glow_colour * glow * 0.6;','\tSSS_STRENGTH = clamp(glow * 0.4, 0.0, 1.0);','\tSSS_TRANSMITTANCE_COLOR = vec4(glow_colour, 1.0);','\tSSS_TRANSMITTANCE_DEPTH = travel * 0.2 + wax_thickness * 0.05;');
  if(k==='car'){U.push('varying vec3 lpos;');V.push('void vertex() {','\tlpos = VERTEX;','}');}
  F.push('}');
  const head=['// gouache-master '+ESH_MASTER_VER,'// Gouache Studio · '+eshLook(k)+' look for Godot 4 (shared: every material of this look uses this one file)','// A close match to the 3D view’s shader: Godot lights it its own way, so it will not be identical.','shader_type spatial;'];
  if(RM.length)head.push('render_mode '+RM.join(', ')+';');
  return [...head,'',...U,'',...V,...(V.length?['']:[]),...F,...(Lt.length?['']:[]),...Lt,''].join('\n');}
/* the shared outline shader (the back faces pushed out); each material that has an outline sets its colour and width */
function eshGodotOutline(){return ['// Gouache Studio · outline for Toon and Cel (inverted hull), shared','shader_type spatial;','render_mode cull_front, unshaded;','uniform vec3 outline_colour : source_color = vec3(0.0);','uniform float outline_width = 0.01;','void vertex() {','\tVERTEX += NORMAL * outline_width;','}','void fragment() {','\tALBEDO = outline_colour;','}',''].join('\n');}
/* the .tres of a ShaderMaterial: its shared shader, this set's textures and settings */
function eshGodotMaterial(shaderPath,texs,params,nextPass){const ext=[],set=[];let id=1;const add=(type,path)=>{ext.push('[ext_resource type="'+type+'" path="'+path+'" id="'+id+'"]');return id++;};
  const s=add('Shader',shaderPath);for(const [param,path] of texs){const t=add('Texture2D',path);set.push('shader_parameter/'+param+' = ExtResource("'+t+'")');}
  for(const [n,t,v] of params)set.push('shader_parameter/'+n+' = '+(t==='vec3'&&/colour|blood|sheen_colour|shadow/.test(n)&&n!=='colour_levels'?'Color('+v.slice(5,-1)+', 1)':v));
  let np=null;if(nextPass)np=add('Material',nextPass);
  return ['[gd_resource type="ShaderMaterial" load_steps='+(ext.length+1)+' format=3]','',...ext,'','[resource]','shader = ExtResource("'+s+'")',...set,...(np?['next_pass = ExtResource("'+np+'")']:[]),''].join('\n');}

/* ---------------- Unity (URP) ---------------- */
const ESH_UNITY_SHADER=`// gouache-master ${ESH_MASTER_VER}
// Gouache Studio — one shader for every look of the 3D view (Universal Render Pipeline).
// _Kind: 0 Standard, 1 Skin, 2 Brushed metal, 3 Velvet, 4 Toon, 5 Cel, 6 Spec/Gloss, 7 Panner, 8 Retro.
// A close match to the viewer: Unity lights it its own way, so it will not be identical.
Shader "Gouache/Shaded"
{
    Properties
    {
        [MainTexture] _BaseMap("Base colour", 2D) = "white" {}
        _OrmMap("ORM (R = AO, G = roughness, B = metallic)", 2D) = "white" {}
        [Normal] _BumpMap("Normal", 2D) = "bump" {}
        _EmissionMap("Emission", 2D) = "black" {}
        _BaseColor("Base colour tint", Color) = (1,1,1,1)
        _HasOrm("Has ORM", Float) = 1
        _HasNormal("Has normal", Float) = 1
        _HasEmis("Has emission", Float) = 0
        _Roughness("Roughness (no ORM)", Range(0,1)) = 0.6
        _Metallic("Metallic (no ORM)", Range(0,1)) = 0
        _RoughScale("Roughness strength", Range(0,2)) = 1
        _MetalScale("Metal strength", Range(0,2)) = 1
        _NormalScale("Normal strength", Range(0,3)) = 1
        _Kind("Kind", Float) = 0
        _ShP("Shader P", Vector) = (0,0,0,0.5)
        _ShQ("Shader Q", Vector) = (0,0,0,0)
        _ShC("Shader colour", Color) = (1,1,1,1)
        _ShD("Outline / fog colour", Color) = (0,0,0,1)
        _Skin("Skin", Vector) = (0.45,1,0.5,0)
        _Pan("Panner speed", Vector) = (0,0,0,0)
        _OutW("Outline width", Float) = 0
        _Cutoff("Alpha cutoff", Range(0,1)) = 0.5
        [HideInInspector] _SrcBlend("Src", Float) = 1
        [HideInInspector] _DstBlend("Dst", Float) = 0
        [HideInInspector] _ZWrite("ZWrite", Float) = 1
        [HideInInspector] _UseAlpha("Alpha", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap); SAMPLER(sampler_point_repeat);
        TEXTURE2D(_OrmMap); SAMPLER(sampler_OrmMap);
        TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
        TEXTURE2D(_EmissionMap); SAMPLER(sampler_EmissionMap);
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST; float4 _BaseColor;
            float _HasOrm, _HasNormal, _HasEmis, _Roughness, _Metallic, _Kind, _OutW, _Cutoff, _UseAlpha, _RoughScale, _MetalScale, _NormalScale;
            float4 _ShP, _ShQ, _ShC, _ShD, _Skin, _Pan;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attr { float4 pos : POSITION; float3 nrm : NORMAL; float4 tan : TANGENT; float2 uv : TEXCOORD0; };
            struct Vary { float4 posCS : SV_POSITION; float2 uv : TEXCOORD0; float3 posWS : TEXCOORD1; float3 nWS : TEXCOORD2; float4 tWS : TEXCOORD3; };

            Vary Vert(Attr i)
            {
                Vary o;
                VertexPositionInputs vp = GetVertexPositionInputs(i.pos.xyz);
                VertexNormalInputs vn = GetVertexNormalInputs(i.nrm, i.tan);
                o.posCS = vp.positionCS;
                if (_Kind > 7.5 && _ShP.w > 0.5) { o.posCS.xy = floor(o.posCS.xy / o.posCS.w * _ShP.w + 0.5) / _ShP.w * o.posCS.w; }
                o.posWS = vp.positionWS;
                o.nWS = vn.normalWS;
                o.tWS = float4(vn.tangentWS, i.tan.w * GetOddNegativeScale());
                o.uv = TRANSFORM_TEX(i.uv, _BaseMap);
                return o;
            }

            float Bayer4(float2 p) { int x = (int)p.x & 3, y = (int)p.y & 3; return (x * 4 + y) / 16.0; }

            half4 Frag(Vary i) : SV_Target
            {
                float2 uv = i.uv;
                bool retro = _Kind > 7.5;
                if (_Kind > 6.5 && _Kind < 7.5) uv += _Time.y * _Pan.xy;
                if (retro) { float R = max(_ShP.x, 1.0); uv = (floor(uv * R) + 0.5) / R; }

                half4 b = retro ? SAMPLE_TEXTURE2D(_BaseMap, sampler_point_repeat, uv) : SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv);
                half3 alb = b.rgb * _BaseColor.rgb;
                float rough = _Roughness, metal = _Metallic, ao = 1;
                if (_HasOrm > 0.5) { half3 orm = SAMPLE_TEXTURE2D(_OrmMap, sampler_OrmMap, uv).rgb; ao = orm.r; rough = orm.g; metal = orm.b; }
                rough = saturate(rough * _RoughScale); metal = saturate(metal * _MetalScale);
                float3 N = normalize(i.nWS);
                float3 T = normalize(i.tWS.xyz);
                float3 B = cross(N, T) * i.tWS.w;
                if (_HasNormal > 0.5) { float3 tn = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uv), _NormalScale); N = normalize(tn.x * T + tn.y * B + tn.z * N); }
                float3 V = GetWorldSpaceNormalizeViewDir(i.posWS);
                float NdV = saturate(dot(N, V));
                half3 emis = _HasEmis > 0.5 ? SAMPLE_TEXTURE2D(_EmissionMap, sampler_EmissionMap, uv).rgb : 0;
                float4 sc = TransformWorldToShadowCoord(i.posWS);
                Light ml = GetMainLight(sc);
                half3 bakedGI = SampleSH(N);
                half alpha = _UseAlpha > 0.5 ? b.a * _BaseColor.a : 1;

                // ---- Toon and Cel: flat bands, highlight, rim ----
                if (_Kind > 3.5 && _Kind < 5.5)
                {
                    float l = dot(N, ml.direction) * 0.5 + 0.5, band;
                    if (_Kind < 4.5) { float st = max(_ShP.x, 1.0); band = floor(l * st + 0.5 * _ShQ.y) / st; }
                    else band = smoothstep(_ShP.x - _ShP.y * 0.5, _ShP.x + _ShP.y * 0.5 + 1e-4, l);
                    half3 baseC = lerp(alb * _ShC.rgb, alb, saturate(band));
                    float3 H = normalize(ml.direction + V);
                    float sp = step(1.0 - _ShP.z * 0.05, saturate(dot(N, H))) * (1.0 - rough * 0.5) * step(0.01, _ShP.z);
                    float rim = smoothstep(1.0 - _ShP.w, 1.0, 1.0 - NdV) * _ShP.w;
                    half3 col = baseC * ml.color * ml.shadowAttenuation + baseC * bakedGI * 0.35 * ao + sp * ml.color + alb * rim + emis;
                    return half4(col, alpha);
                }

                // ---- Retro: plain light, banded, dithered, few colours, fog ----
                if (retro)
                {
                    float l = saturate(dot(N, ml.direction)) * ml.shadowAttenuation;
                    if (_ShQ.x > 0.5) l = floor(l * _ShQ.x + 0.5) / _ShQ.x;
                    float amb = _ShQ.z;
                    float3 c = alb * (amb + (1.0 - amb) * l) * _ShQ.w * ml.color + emis;
                    float fg = 1.0 - exp(-length(_WorldSpaceCameraPos - i.posWS) * _ShQ.y * 0.35);
                    c = lerp(c, _ShD.rgb, saturate(fg));
                    c = pow(saturate(c), 1.0 / 2.2);
                    c = floor(c * _ShC.rgb + 0.5 + (Bayer4(i.posCS.xy) - 0.5) * _ShP.z) / _ShC.rgb;
                    return half4(pow(saturate(c), 2.2), alpha);
                }

                // ---- Brushed metal: bend the normal along the stretch direction ----
                if (_Kind > 1.5 && _Kind < 2.5)
                {
                    float ang = _ShP.y * 6.2831853;
                    float3 Ts = normalize(T * cos(ang) + B * sin(ang)); Ts = normalize(Ts - N * dot(N, Ts));
                    float3 Bs = cross(N, Ts);
                    float3 at = cross(Bs, V), an2 = normalize(cross(at, Bs));
                    N = normalize(lerp(N, an2, abs(_ShP.x) * saturate(1.0 - rough * 0.5)));
                }
                if (_Kind > 0.5 && _Kind < 1.5) rough = lerp(rough, _Skin.x, 0.75);   // skin: softer surface

                InputData inp = (InputData)0;
                inp.positionWS = i.posWS; inp.normalWS = N; inp.viewDirectionWS = V;
                inp.shadowCoord = sc; inp.bakedGI = bakedGI;
                inp.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.posCS);
                SurfaceData sd = (SurfaceData)0;
                sd.albedo = alb; sd.metallic = metal; sd.smoothness = 1.0 - rough; sd.occlusion = ao; sd.emission = emis; sd.alpha = alpha; sd.specular = 0;
                sd.normalTS = float3(0, 0, 1);
                half4 c = UniversalFragmentPBR(inp, sd);

                // ---- Velvet: sheen at grazing angles ----
                if (_Kind > 2.5 && _Kind < 3.5)
                    c.rgb += _ShC.rgb * _ShP.x * pow(1.0 - NdV, max(_ShP.z, 0.5) * 3.0 + 1.0) * (ml.color * 0.5 + bakedGI) * 0.5;

                // ---- Skin: light wraps round, and shines through thin parts ----
                if (_Kind > 0.5 && _Kind < 1.5)
                {
                    float nl = dot(N, ml.direction);
                    float wrap = _ShP.x * 0.6;
                    c.rgb += alb * ml.color * ml.shadowAttenuation * (max((nl + wrap) / (1.0 + wrap), 0.0) - max(nl, 0.0)) * 0.6;
                    float back = max(dot(-N, ml.direction), 0.0);
                    c.rgb += alb * _ShC.rgb * back * _Skin.z * _ShP.y * ml.color * ml.shadowAttenuation * 0.5;
                }
                return c;
            }
            ENDHLSL
        }

        // the outline of Toon and Cel: the back faces, pushed out along the normals
        Pass
        {
            Name "Outline"
            Tags { "LightMode"="SRPDefaultUnlit" }
            Cull Front
            HLSLPROGRAM
            #pragma vertex OVert
            #pragma fragment OFrag
            struct OAttr { float4 pos : POSITION; float3 nrm : NORMAL; };
            struct OVary { float4 posCS : SV_POSITION; };
            OVary OVert(OAttr i)
            {
                OVary o;
                bool on = (_Kind > 3.5 && _Kind < 5.5) && _OutW > 0;
                float3 p = i.pos.xyz + i.nrm * (on ? _OutW : 0);
                o.posCS = on ? TransformObjectToHClip(p) : float4(0, 0, 0, 0);
                return o;
            }
            half4 OFrag(OVary i) : SV_Target { return half4(_ShD.rgb, 1); }
            ENDHLSL
        }

        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
    FallBack "Universal Render Pipeline/Lit"
}
`;

/* the same looks for Unity's Built-in Render Pipeline (a surface shader; opaque only) */
const ESH_BUILTIN_GUID='5b1d8c3a7e0f4a29b6d4c8e1f2a30b17';
const ESH_BUILTIN_SHADER=`// gouache-master ${ESH_MASTER_VER}
// Gouache Studio — one shader for every look of the 3D view (Built-in Render Pipeline).
// _Kind: 0 Standard, 1 Skin, 2 Brushed metal (Standard here), 3 Velvet, 4 Toon, 5 Cel, 6 Spec/Gloss, 7 Panner, 8 Retro.
// A close match to the viewer: Unity lights it its own way, so it will not be identical. Opaque only.
Shader "Gouache/Shaded (Built-in)"
{
    Properties
    {
        [MainTexture] _BaseMap("Base colour", 2D) = "white" {}
        _OrmMap("ORM (R = AO, G = roughness, B = metallic)", 2D) = "white" {}
        [Normal] _BumpMap("Normal", 2D) = "bump" {}
        _EmissionMap("Emission", 2D) = "black" {}
        _BaseColor("Base colour tint", Color) = (1,1,1,1)
        _HasOrm("Has ORM", Float) = 1
        _HasNormal("Has normal", Float) = 1
        _HasEmis("Has emission", Float) = 0
        _Roughness("Roughness (no ORM)", Range(0,1)) = 0.6
        _Metallic("Metallic (no ORM)", Range(0,1)) = 0
        _RoughScale("Roughness strength", Range(0,2)) = 1
        _MetalScale("Metal strength", Range(0,2)) = 1
        _NormalScale("Normal strength", Range(0,3)) = 1
        _Kind("Kind", Float) = 0
        _ShP("Shader P", Vector) = (0,0,0,0.5)
        _ShQ("Shader Q", Vector) = (0,0,0,0)
        _ShC("Shader colour", Color) = (1,1,1,1)
        _ShD("Outline / fog colour", Color) = (0,0,0,1)
        _Skin("Skin", Vector) = (0.45,1,0.5,0)
        _Pan("Panner speed", Vector) = (0,0,0,0)
        _OutW("Outline width", Float) = 0
        _Cutoff("Alpha cutoff", Range(0,1)) = 0.5
        [HideInInspector] _SrcBlend("Src", Float) = 1
        [HideInInspector] _DstBlend("Dst", Float) = 0
        [HideInInspector] _ZWrite("ZWrite", Float) = 1
        [HideInInspector] _UseAlpha("Alpha", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        // the outline of Toon and Cel: the back faces, pushed out along the normals
        Pass
        {
            Name "OUTLINE"
            Cull Front
            CGPROGRAM
            #pragma vertex overt
            #pragma fragment ofrag
            #include "UnityCG.cginc"
            float _Kind, _OutW; fixed4 _ShD;
            struct oa { float4 v : POSITION; float3 n : NORMAL; };
            struct ov { float4 p : SV_POSITION; };
            ov overt(oa i)
            {
                ov o;
                bool on = (_Kind > 3.5 && _Kind < 5.5) && _OutW > 0;
                o.p = on ? UnityObjectToClipPos(float4(i.v.xyz + i.n * _OutW, 1)) : float4(0, 0, 0, 0);
                return o;
            }
            fixed4 ofrag(ov i) : SV_Target { return fixed4(_ShD.rgb, 1); }
            ENDCG
        }

        CGPROGRAM
        #pragma surface surf Gouache fullforwardshadows finalcolor:fin exclude_path:deferred exclude_path:prepass
        #pragma target 3.0
        #include "UnityPBSLighting.cginc"

        sampler2D _BaseMap, _OrmMap, _BumpMap, _EmissionMap;
        float4 _BaseColor;
        float _HasOrm, _HasNormal, _HasEmis, _Roughness, _Metallic, _Kind, _RoughScale, _MetalScale, _NormalScale;
        float4 _ShP, _ShQ, _ShC, _ShD, _Skin, _Pan;

        struct Input { float2 uv_BaseMap; float3 viewDir; float3 worldPos; float4 screenPos; };

        float Bayer4(float2 p) { int x = (int)p.x & 3, y = (int)p.y & 3; return (x * 4 + y) / 16.0; }

        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            float2 uv = IN.uv_BaseMap;
            bool retro = _Kind > 7.5;
            if (_Kind > 6.5 && _Kind < 7.5) uv += _Time.y * _Pan.xy;
            if (retro) { float R = max(_ShP.x, 1.0); uv = (floor(uv * R) + 0.5) / R; }
            fixed4 b = tex2D(_BaseMap, uv);
            o.Albedo = b.rgb * _BaseColor.rgb;
            o.Alpha = 1;
            float rough = _Roughness, metal = _Metallic, ao = 1;
            if (_HasOrm > 0.5) { fixed3 orm = tex2D(_OrmMap, uv).rgb; ao = orm.r; rough = orm.g; metal = orm.b; }
                rough = saturate(rough * _RoughScale); metal = saturate(metal * _MetalScale);
            if (_Kind > 0.5 && _Kind < 1.5) rough = lerp(rough, _Skin.x, 0.75);
            o.Metallic = metal; o.Smoothness = 1.0 - rough; o.Occlusion = ao;
            o.Normal = _HasNormal > 0.5 ? UnpackScaleNormal(tex2D(_BumpMap, uv), _NormalScale) : float3(0, 0, 1);
            float3 em = _HasEmis > 0.5 ? tex2D(_EmissionMap, uv).rgb : 0;
            float NdV = saturate(dot(normalize(IN.viewDir), o.Normal));
            if (_Kind > 2.5 && _Kind < 3.5) em += _ShC.rgb * _ShP.x * pow(1.0 - NdV, max(_ShP.z, 0.5) * 3.0 + 1.0) * 0.4;
            o.Emission = em;
            if (retro) { o.Metallic = 0; o.Smoothness = 0; }
        }

        half4 LightingGouache(SurfaceOutputStandard s, half3 viewDir, UnityGI gi)
        {
            float3 N = s.Normal; float3 Ld = gi.light.dir;
            if (_Kind > 3.5 && _Kind < 5.5)   // Toon and Cel
            {
                float l = dot(N, Ld) * 0.5 + 0.5, band;
                if (_Kind < 4.5) { float st = max(_ShP.x, 1.0); band = floor(l * st + 0.5 * _ShQ.y) / st; }
                else band = smoothstep(_ShP.x - _ShP.y * 0.5, _ShP.x + _ShP.y * 0.5 + 1e-4, l);
                half3 baseC = lerp(s.Albedo * _ShC.rgb, s.Albedo, saturate(band));
                float3 H = normalize(Ld + viewDir);
                float sp = step(1.0 - _ShP.z * 0.05, saturate(dot(N, H))) * (0.5 + s.Smoothness * 0.5) * step(0.01, _ShP.z);
                float rim = smoothstep(1.0 - _ShP.w, 1.0, 1.0 - saturate(dot(N, viewDir))) * _ShP.w;
                return half4(baseC * gi.light.color + baseC * gi.indirect.diffuse * 0.35 * s.Occlusion + sp * gi.light.color + s.Albedo * rim, 1);
            }
            if (_Kind > 7.5)                  // Retro
            {
                float l = saturate(dot(N, Ld));
                if (_ShQ.x > 0.5) l = floor(l * _ShQ.x + 0.5) / _ShQ.x;
                float amb = _ShQ.z;
                return half4(s.Albedo * (amb + (1.0 - amb) * l) * _ShQ.w * gi.light.color, 1);
            }
            half4 c = LightingStandard(s, viewDir, gi);
            if (_Kind > 0.5 && _Kind < 1.5)   // Skin: light wraps round, and shines through thin parts
            {
                float nl = dot(N, Ld), wrap = _ShP.x * 0.6;
                c.rgb += s.Albedo * gi.light.color * (max((nl + wrap) / (1.0 + wrap), 0.0) - max(nl, 0.0)) * 0.6;
                c.rgb += s.Albedo * _ShC.rgb * max(dot(-N, Ld), 0.0) * _Skin.z * _ShP.y * gi.light.color * 0.5;
            }
            return c;
        }
        void LightingGouache_GI(SurfaceOutputStandard s, UnityGIInput data, inout UnityGI gi) { LightingStandard_GI(s, data, gi); }

        void fin(Input IN, SurfaceOutputStandard o, inout fixed4 color)
        {
            if (_Kind > 7.5)   // Retro: fog, few colours, dither
            {
                float fg = 1.0 - exp(-length(_WorldSpaceCameraPos - IN.worldPos) * _ShQ.y * 0.35);
                float3 c = lerp(color.rgb, _ShD.rgb, saturate(fg));
                c = pow(saturate(c), 1.0 / 2.2);
                float2 sp = IN.screenPos.xy / IN.screenPos.w * _ScreenParams.xy;
                c = floor(c * _ShC.rgb + 0.5 + (Bayer4(sp) - 0.5) * _ShP.z) / _ShC.rgb;
                color.rgb = pow(saturate(c), 2.2);
            }
        }
        ENDCG
    }
    FallBack "Standard"
}
`;

/* Unity: models under Assets/Gouache get the materials Gouache exported for them, by name */
const ESH_UNITY_ASSIGN=`// Gouache Studio: gives a model imported under Assets/Gouache the materials Gouache exported next to it.
// A material on the model is matched by name to a .mat file in the model's folder (spaces become underscores).
#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

public class GouacheAssign : AssetPostprocessor
{
    Material OnAssignMaterialModel(Material previous, Renderer renderer)
    {
        if (!assetPath.Contains("/Gouache/")) return null;
        string dir = Path.GetDirectoryName(assetPath).Replace('\\', '/');
        string[] names = { previous.name, previous.name.Replace(' ', '_') };
        foreach (string n in names)
        {
            Material m = AssetDatabase.LoadAssetAtPath<Material>(dir + "/" + n + ".mat");
            if (m != null) return m;
        }
        return null;
    }
}
#endif
`;
const ESH_ASSIGN_GUID='c3e19a5d8b7f4e60a2d4f1b9076c58e3';
const eshYV=a=>'{r: '+eshF(a[0])+', g: '+eshF(a[1])+', b: '+eshF(a[2])+', a: '+eshF(a[3]==null?1:a[3])+'}';
function eshUnityMaterial(name,sh,texGuids,flags,width,shaderGuid){const u=shadeUniforms(sh),k=sh.kind,P=shParams(sh),kind=Math.max(0,SHADERS.findIndex(x=>x[0]===k)),
    kk=kind===6?0:kind;/* Spec/Gloss: the textures are already metal/rough */
  const tex=[['_BaseMap',texGuids.base],['_OrmMap',texGuids.orm],['_BumpMap',texGuids.normal],['_EmissionMap',texGuids.emis]].filter(x=>x[1]);
  const te=tex.map(([n,g])=>'    - '+n+':\n        m_Texture: {fileID: 2800000, guid: '+g+', type: 3}\n        m_Scale: {x: 1, y: 1}\n        m_Offset: {x: 0, y: 0}').join('\n');
  const shp=u.uShP.slice(),shq=u.uShQ.slice(),skin=u.uSkin.slice();if(k==='retro')shp[3]=u.uSnap||0;
  const floats=[['_Kind',kk],['_HasOrm',texGuids.orm?1:0],['_HasNormal',texGuids.normal?1:0],['_HasEmis',texGuids.emis?1:0],['_OutW',width||0],['_UseAlpha',flags.alpha?1:0],['_SrcBlend',flags.alpha?5:1],['_DstBlend',flags.alpha?10:0],['_ZWrite',flags.alpha?0:1],['_Cutoff',.5],['_Roughness',.6],['_Metallic',0],['_RoughScale',1],['_MetalScale',1],['_NormalScale',1]];
  const colors=[['_BaseColor',[1,1,1,1]],['_ShP',shp],['_ShQ',shq],['_ShC',[...(u.uShC||[1,1,1]),1]],['_ShD',[...(u.uShD||[0,0,0]),1]],['_Skin',skin],['_Pan',k==='panner'?[P.sx,P.sy,0,0]:[0,0,0,0]]];
  return ['%YAML 1.1','%TAG !u! tag:unity3d.com,2011:','--- !u!21 &2100000','Material:','  serializedVersion: 8','  m_ObjectHideFlags: 0','  m_CorrespondingSourceObject: {fileID: 0}','  m_PrefabInstance: {fileID: 0}','  m_PrefabAsset: {fileID: 0}',
    '  m_Name: '+name,'  m_Shader: {fileID: 4800000, guid: '+(shaderGuid||ESH_SHADER_GUID)+', type: 3}','  m_ValidKeywords: []','  m_InvalidKeywords: []','  m_LightmapFlags: 4','  m_EnableInstancingVariants: 0','  m_DoubleSidedGI: 0','  m_CustomRenderQueue: '+(flags.alpha?3000:-1),'  stringTagMap: {}','  disabledShaderPasses: []',
    '  m_LockedProperties: ','  m_SavedProperties:','    serializedVersion: 3','    m_TexEnvs:',te||'    []','    m_Ints: []','    m_Floats:',floats.map(([n,v])=>'    - '+n+': '+eshF(v)).join('\n'),'    m_Colors:',colors.map(([n,v])=>'    - '+n+': '+eshYV(v)).join('\n'),'  m_BuildTextureStacks: []',''].join('\n');}
function eshUnityMeta(kind,guid,extra){const head='fileFormatVersion: 2\nguid: '+guid+'\n';
  if(kind==='shader')return head+'ShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n  preprocessorOverride: 0\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
  if(kind==='mat')return head+'NativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: 2100000\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
  if(kind==='mono')return head+'MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
  /* a texture: colour maps are sRGB; normal maps get the Normal map type; ORM and other data maps are linear */
  const normal=extra==='normal',linear=extra!=='color';
  return head+'TextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 12\n  mipmaps:\n    mipMapMode: 0\n    enableMipMap: 1\n    sRGBTexture: '+(linear?0:1)+'\n    linearTexture: 0\n    fadeOut: 0\n    borderMipMap: 0\n    mipMapsPreserveCoverage: 0\n    alphaTestReferenceValue: 0.5\n    mipMapFadeDistanceStart: 1\n    mipMapFadeDistanceEnd: 3\n'+
    '  bumpmap:\n    convertToNormalMap: 0\n    externalNormalMap: 0\n    heightScale: 0.25\n    normalMapFilter: 0\n  isReadable: 0\n  streamingMipmaps: 0\n  streamingMipmapsPriority: 0\n  grayScaleToAlpha: 0\n  generateCubemap: 6\n  cubemapConvolution: 0\n  seamlessCubemap: 0\n  textureFormat: 1\n  maxTextureSize: 8192\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 1\n    aniso: 4\n    mipBias: 0\n    wrapU: 0\n    wrapV: 0\n    wrapW: 0\n  nPOTScale: 1\n  lightmap: 0\n  compressionQuality: 50\n  spriteMode: 0\n  alphaUsage: 1\n  alphaIsTransparency: 0\n  spriteTessellationDetail: -1\n  textureType: '+(normal?1:0)+'\n  textureShape: 1\n  singleChannelComponent: 0\n  maxTextureSizeSet: 0\n  compressionQualitySet: 0\n  textureFormatSet: 0\n  applyGammaDecoding: 0\n  platformSettings:\n  - serializedVersion: 3\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: 8192\n    resizeAlgorithm: 0\n    textureFormat: -1\n    textureCompression: 1\n    compressionQuality: 50\n    crunchedCompression: 0\n    allowsAlphaSplitting: 0\n    overridden: 0\n    ignorePlatformSupport: 0\n    androidETC2FallbackOverride: 0\n    forceMaximumCompressionQuality_BC6H_BC7: 0\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';}

/* Unreal: the settings of one asset's Material Instance (names match the parameters of the master material) */
function eshUnrealParams(sh,size,hasOrm){const k=sh.kind,P=shParams(sh),lin=c=>(c||[1,1,1]).map(v=>Math.pow(Math.max(0,v),2.2)),rgba=c=>[...lin(c),1];
  const sc={HasORM:hasOrm?1:0,RoughnessValue:.6,MetallicValue:0,RoughScale:1,MetalScale:1,NormalStrength:1},vc={Tint:[1,1,1,1],UVScale:[1,1,0,1],UVOffset:[0,0,0,1]};
  if(k==='panner')vc.PanSpeed=[P.sx,P.sy,0,1];
  if(k==='retro'){sc.Texels=P.res;sc.DitherAmount=P.dither;sc.LightBands=P.steps||0;sc.Ambient=P.amb==null?.35:P.amb;sc.Brightness=P.bright==null?1:P.bright;vc.ColourLevels=[(1<<P.br)-1,(1<<P.bg)-1,(1<<P.bb)-1,1];}
  if(k==='aniso'){sc.Stretch=Math.min(1,Math.abs(P.amount));sc.DirectionTurns=P.dir;}
  if(k==='velvet'){vc.SheenColour=rgba(P.col);sc.Sheen=Math.min(1,P.sheen*.6);}
  if(k==='skin'){vc.BloodColour=rgba(P.col);sc.ScatterStrength=Math.min(1,P.scatter*P.strength+.2);}
  if(k==='toon'||k==='cel'){vc.ShadowColour=rgba(P.col);sc.Highlight=P.spec;sc.RimLight=P.rim;sc.OutlineWidth=(P.outline||0)*size*0.0014;vc.OutlineColour=rgba(P.ocol||[0,0,0]);
    if(k==='toon'){sc.Bands=P.steps;sc.BandShift=P.offset;}else{sc.ShadowLine=P.thresh;sc.EdgeSoftness=P.soft;}}
  const common=new Set(['HasORM','RoughnessValue','MetallicValue','RoughScale','MetalScale','NormalStrength','Tint','UVScale','UVOffset']);
  return {scalars:sc,vectors:vc,lookKeys:[...Object.keys(sc),...Object.keys(vc)].filter(n=>!common.has(n))};}
/* ---------------- both: build the extra files for one export ----------------
   info[setName] = { sh (the set's shader), tex {BaseColor, ORM, Normal, Emissive: {name,data}}, alpha }
   Returns the files to add beside the textures (names are relative to the export folder). */
function eshFiles(to,name,info,size,modelFile,opt){const out=[],pn=pascal(name),sets=Object.keys(info);
  if(to==='godot'){const base='res://gouache/'+pn+'/',sh0='res://gouache/_shaders/',made=new Set();
    for(const s of sets){const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},sn=eshSafe(s),look=eshLook(sh.kind),alpha=!!I.alpha,file=look+(alpha?'_alpha':'')+'.gdshader';
      if(!made.has(file)){made.add(file);out.push({name:'../_shaders/'+file,data:new TextEncoder().encode(eshGodotShader(sh.kind==='specgloss'?'std':sh.kind,alpha)),shared:true});}
      const texs=[];if(T.BaseColor)texs.push(['albedo_tex',base+T.BaseColor.name]);if(T.ORM)texs.push(['orm_tex',base+T.ORM.name]);if(T.Normal)texs.push(['normal_tex',base+T.Normal.name]);if(T.Emissive)texs.push(['emission_tex',base+T.Emissive.name]);
      const params=[['has_orm','bool',T.ORM?'true':'false'],...eshGodotParams(sh)];
      const outline=(sh.kind==='toon'||sh.kind==='cel')&&shParams(sh).outline>0;
      if(outline){if(!made.has('_outline')){made.add('_outline');out.push({name:'../_shaders/Outline.gdshader',data:new TextEncoder().encode(eshGodotOutline()),shared:true});}
        out.push({name:sn+'_outline.tres',data:new TextEncoder().encode(eshGodotMaterial(sh0+'Outline.gdshader',[],[['outline_colour','vec3',eshV3(shParams(sh).ocol||[0,0,0])],['outline_width','float',eshF(shParams(sh).outline*size*0.0014)]]))});}
      if(sh.kind==='fur'){/* fur: the shell materials are chained with next_pass, the outermost first made */
        for(let n=ESH_FUR_SHELLS;n>=1;n--)out.push({name:sn+'_fur'+n+'.tres',data:new TextEncoder().encode(eshGodotMaterial(sh0+file,texs,[...params,['shell_k','float',eshF(n/ESH_FUR_SHELLS)]],n<ESH_FUR_SHELLS?base+sn+'_fur'+(n+1)+'.tres':null))});
        out.push({name:sn+'.tres',data:new TextEncoder().encode(eshGodotMaterial(sh0+file,texs,params,base+sn+'_fur1.tres'))});continue;}
      out.push({name:sn+'.tres',data:new TextEncoder().encode(eshGodotMaterial(sh0+file,texs,params,outline?base+sn+'_outline.tres':null))});}
    return out;}
  if(to==='unity'){const bi=texCfg.unityRP==='builtin',shaderPath=bi?'../GouacheShadedBuiltin.shader':'../GouacheShaded.shader',sguid=bi?ESH_BUILTIN_GUID:ESH_SHADER_GUID;
    for(const s of sets){const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},sn=eshSafe(s),g={};
      const reg=(key,f,kind)=>{if(!f)return;g[key]=eshGuid(pn+'/'+f.name);out.push({name:f.name+'.meta',data:new TextEncoder().encode(eshUnityMeta('tex',g[key],kind))});};
      reg('base',T.BaseColor,'color');reg('orm',T.ORM,'data');reg('normal',T.Normal,'normal');reg('emis',T.Emissive,'color');
      const P=shParams(sh),width=(sh.kind==='toon'||sh.kind==='cel')?(P.outline||0)*size*0.0014:0;
      out.push({name:sn+'.mat',data:new TextEncoder().encode(eshUnityMaterial(sn,sh,g,{alpha:I.alpha&&!bi},width,sguid))},{name:sn+'.mat.meta',data:new TextEncoder().encode(eshUnityMeta('mat',eshGuid(pn+'/'+sn+'.mat')))});}
    out.push({name:'../GouacheAssign.cs',data:new TextEncoder().encode(ESH_UNITY_ASSIGN),shared:true},{name:'../GouacheAssign.cs.meta',data:new TextEncoder().encode('fileFormatVersion: 2\nguid: '+ESH_ASSIGN_GUID+'\nMonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n'),shared:true});
    out.push({name:shaderPath,data:new TextEncoder().encode(bi?ESH_BUILTIN_SHADER:ESH_UNITY_SHADER),shared:true},{name:shaderPath+'.meta',data:new TextEncoder().encode(eshUnityMeta('shader',sguid)),shared:true});
    return out;}
  if(to==='unreal'){const list=sets.map(s=>{const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},tex={};for(const k of ['BaseColor','ORM','Normal','Emissive'])if(T[k])tex[k]=T[k].name;
      const pr=eshUnrealParams(sh,size,!!T.ORM);return {name:s,safe:eshSafe(s),kind:sh.kind,look:eshLook(sh.kind),tex,alpha:!!I.alpha,scalars:pr.scalars,vectors:pr.vectors,lookKeys:pr.lookKeys,variant:I.variant||null};});
    out.push({name:'gouache_unreal.gdata',data:new TextEncoder().encode(JSON.stringify({name:pn,model:modelFile||null,masterVersion:ESH_MASTER_VER,updateMasters:!!(opt&&opt.updateMasters),updates:(opt&&opt.updates)||[],sets:list},null,1))},{name:'gouache_unreal_setup.py',data:new TextEncoder().encode(UNREAL_SETUP||'')});
    return out;}
  return out;}

/* is the engine's Gouache shader going out with this export? */
const eshWanted=()=>platform.isDesktop&&(es.to==='unity'||es.to==='godot'||es.to==='unreal')&&texCfg.engShader!==false;
/* a file's place in the export folder; '../x' is the folder above (the shared Unity shader) */
function eshPath(dir,name){const sep=dir.includes('\\')?'\\':'/';let d=dir.replace(/[\\/]+$/,'');while(name.startsWith('../')){name=name.slice(3);d=d.replace(/[\\/][^\\/]*$/,'');}return d+sep+name;}
