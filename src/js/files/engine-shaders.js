/* ================= Gouache shaders for Unity and Godot (0.93.4) =================
   Kenn: when you export to a game engine, bring the viewer shader over too (Standard, Skin, Brushed metal, Velvet,
   Toon, Cel, Spec/Gloss, Panner, Retro), so the model looks about the same there. Each texture set gets a material
   that uses its shader and its textures (base colour, ORM = AO/roughness/metal, normal, emissive):
   - Godot 4: <Set>.gdshader + <Set>.tres (a ShaderMaterial with the textures hooked up); Toon and Cel also get an
     outline material chained on (next pass).
   - Unity (URP): one shader, GouacheShaded.shader, plus <Set>.mat for each set and .meta files, so the textures are
     found (normal maps get the Normal map type). Built-in and HDRP projects: the shader is URP only.
   - Unreal: gouache_unreal.json + gouache_unreal_setup.py. Run the script in the editor (Tools > Execute Python Script):
     it imports the textures and builds one material per set (Lit; Cloth for Velvet, Subsurface for Skin, Unlit with
     the banding worked out in a Custom node for Toon, Cel and Retro).
   The look is a close match, not identical: each engine lights differently. */
const ESH_KIND_NAMES=['Standard','Skin','Brushed metal','Velvet','Toon','Cel','Spec/Gloss','Panner','Retro'];
const ESH_SHADER_GUID='47a0c5e1b2d34f6a8c91e0f3d5b7a901';
function eshGuid(s){let a=0x811c9dc5,b=0x1b873593,c=0x9e3779b1,d=0x85ebca6b;for(let i=0;i<s.length;i++){const k=s.charCodeAt(i);a=Math.imul(a^k,16777619);b=Math.imul(b^k,2246822519);c=Math.imul(c^(k<<1),3266489917);d=Math.imul(d^(k+i),668265263);}
  return [a,b,c,d].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');}
const eshF=n=>{const t=String(+(+n).toFixed(4));return /[.e]/.test(t)?t:t+'.0';};
const eshSafe=s=>String(s||'Material').replace(/[\\/:*?"<>|\s]+/g,'_');
/* the size of the model (for the outline width, which the viewer measures in screen pixels) */
function eshModelSize(m){if(!m||!m.pos)return 1;const mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];for(let i=0;i<m.pos.length;i+=3)for(let j=0;j<3;j++){const v=m.pos[i+j];if(v<mn[j])mn[j]=v;if(v>mx[j])mx[j]=v;}
  return Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1;}

/* ---------------- Godot 4 ---------------- */
function eshGodotShader(sh,have,alpha){const k=sh.kind,P=shParams(sh),col=a=>'vec3('+(a||[1,1,1]).map(eshF).join(', ')+')';
  const U=[],F=[],L=[],V=[],RM=[];
  const flt=k==='retro'&&P.filt===0?'filter_nearest':'filter_linear_mipmap';
  U.push(have.base?'uniform sampler2D albedo_tex : source_color, '+flt+', repeat_enable;':'uniform vec3 base_color : source_color = vec3(0.8);');
  if(have.orm)U.push('uniform sampler2D orm_tex : filter_linear_mipmap, repeat_enable;');else U.push('uniform float roughness_value : hint_range(0.0, 1.0) = 0.6;','uniform float metallic_value : hint_range(0.0, 1.0) = 0.0;');
  if(have.normal)U.push('uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;','uniform float normal_strength : hint_range(0.0, 4.0) = 1.0;');
  if(have.emis)U.push('uniform sampler2D emission_tex : source_color, filter_linear_mipmap, repeat_enable;');
  let uvLine='vec2 uv = UV;';
  if(k==='panner'){U.push('uniform vec2 scroll_speed = vec2('+eshF(P.sx)+', '+eshF(P.sy)+');');uvLine='vec2 uv = UV + TIME * scroll_speed;';}
  if(k==='retro'){U.push('uniform float texels = '+eshF(P.res)+';','uniform float dither_amount = '+eshF(P.dither)+';','uniform vec3 colour_levels = vec3('+[(1<<P.br)-1,(1<<P.bg)-1,(1<<P.bb)-1].map(eshF).join(', ')+');',
      'uniform float light_bands = '+eshF(P.steps||0)+';','uniform float ambient_amount = '+eshF(P.amb==null?.35:P.amb)+';','uniform float brightness = '+eshF(P.bright==null?1:P.bright)+';',
      'uniform float fog_amount = '+eshF(P.fog||0)+';','uniform vec3 fog_colour : source_color = '+col(P.fogc)+';');
    RM.push('diffuse_lambert','specular_disabled','vertex_lighting');
    uvLine='vec2 uv = (floor(UV * texels) + 0.5) / texels;';
    if(P.wobble>0){U.push('uniform float snap_grid = '+eshF(320-280*P.wobble)+';');
      V.push('void vertex() {','\tvec4 p = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);','\tp.xy = floor(p.xy / p.w * snap_grid + 0.5) / snap_grid * p.w;','\tPOSITION = p;','}');}}
  F.push('void fragment() {','\t'+uvLine);
  F.push('\tvec4 a = '+(have.base?'texture(albedo_tex, uv)':'vec4(base_color, 1.0)')+';','\tALBEDO = a.rgb;');
  if(alpha)F.push('\tALPHA = a.a;');
  if(have.orm)F.push('\tvec3 orm = texture(orm_tex, uv).rgb;','\tAO = orm.r;','\tROUGHNESS = orm.g;','\tMETALLIC = orm.b;');else F.push('\tROUGHNESS = roughness_value;','\tMETALLIC = metallic_value;');
  if(have.normal)F.push('\tNORMAL_MAP = texture(normal_tex, uv).rgb;','\tNORMAL_MAP_DEPTH = normal_strength;');
  if(have.emis)F.push('\tEMISSION = texture(emission_tex, uv).rgb;');
  if(k==='aniso'){U.push('uniform float stretch = '+eshF(Math.min(1,Math.abs(P.amount)))+';','uniform float direction_turns = '+eshF(P.dir)+';');
    F.push('\tANISOTROPY = stretch;','\tANISOTROPY_FLOW = vec2(cos(direction_turns * TAU), sin(direction_turns * TAU));');}
  if(k==='velvet'){U.push('uniform vec3 sheen_colour : source_color = '+col(P.col)+';','uniform float sheen = '+eshF(P.sheen)+';','uniform float sheen_softness = '+eshF(P.srough)+';','uniform float rim_power = '+eshF(P.rim)+';');
    F.push('\tfloat fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), max(rim_power, 0.5) * 3.0 + 1.0);','\tEMISSION += sheen_colour * sheen * fr * mix(1.0, 0.5, sheen_softness);','\tROUGHNESS = max(ROUGHNESS, 0.55);');}
  if(k==='skin'){U.push('uniform vec3 blood_colour : source_color = '+col(P.col)+';','uniform float scatter_strength = '+eshF(P.scatter*P.strength)+';','uniform float scatter_depth = '+eshF(P.depth*.1)+';','uniform float transmission = '+eshF(P.transmission)+';','uniform float oiliness = '+eshF(P.oil)+';');
    F.push('\tSSS_STRENGTH = scatter_strength;','\tSSS_TRANSMITTANCE_COLOR = vec4(blood_colour, 1.0);','\tSSS_TRANSMITTANCE_DEPTH = scatter_depth;','\tSSS_TRANSMITTANCE_BOOST = transmission;','\tSPECULAR = 0.5 + oiliness * 0.4;');}
  if(k==='toon'||k==='cel'){
    U.push('uniform vec3 shadow_colour : source_color = '+col(P.col)+';','uniform float highlight = '+eshF(P.spec)+';','uniform float rim_light = '+eshF(P.rim)+';');
    if(k==='toon')U.push('uniform float bands = '+eshF(P.steps)+';','uniform float band_shift = '+eshF(P.offset)+';');else U.push('uniform float shadow_line = '+eshF(P.thresh)+';','uniform float edge_softness = '+eshF(P.soft)+';');
    F.push('\tfloat fresnel = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);','\tEMISSION += ALBEDO * smoothstep(1.0 - rim_light, 1.0, fresnel) * rim_light;');
    L.push('void light() {','\tfloat l = dot(NORMAL, LIGHT) * 0.5 + 0.5;');
    if(k==='toon')L.push('\tfloat st = max(bands, 1.0);','\tfloat band = floor(l * st + 0.5 * band_shift) / st;');else L.push('\tfloat band = smoothstep(shadow_line - edge_softness * 0.5, shadow_line + edge_softness * 0.5 + 0.0001, l);');
    L.push('\tvec3 lit = mix(shadow_colour, vec3(1.0), clamp(band, 0.0, 1.0));','\tDIFFUSE_LIGHT += lit * LIGHT_COLOR * ATTENUATION;',
      '\tvec3 h = normalize(LIGHT + VIEW);','\tfloat sp = step(1.0 - highlight * 0.05, dot(NORMAL, h)) * (1.0 - ROUGHNESS * 0.5) * step(0.01, highlight);','\tSPECULAR_LIGHT += sp * LIGHT_COLOR * ATTENUATION;','}');}
  if(k==='retro'){F.push('\tfloat bx = float((int(FRAGCOORD.x) & 3) * 4 + (int(FRAGCOORD.y) & 3)) / 16.0;','\tvec3 c = pow(clamp(ALBEDO, 0.0, 1.0), vec3(1.0 / 2.2));','\tc = floor(c * colour_levels + 0.5 + (bx - 0.5) * dither_amount) / colour_levels;','\tALBEDO = pow(clamp(c, 0.0, 1.0), vec3(2.2)) * brightness;',
      '\tROUGHNESS = 1.0;','\tMETALLIC = 0.0;','\tFOG = vec4(fog_colour, clamp(1.0 - exp(-length(VERTEX) * fog_amount * 0.35), 0.0, 1.0));');}
  F.push('}');
  const head=['// Gouache Studio · '+(ESH_KIND_NAMES[Math.max(0,SHADERS.findIndex(x=>x[0]===k))]||k)+' shader for Godot 4','// A close match to the 3D view’s shader: Godot lights it its own way, so it will not be identical.','shader_type spatial;'];
  if(RM.length)head.push('render_mode '+RM.join(', ')+';');
  return [...head,'',...U,'',...V,...(V.length?['']:[]),...F,...(L.length?['']:[]),...L,''].join('\n');}
function eshGodotOutline(sh,width){const P=shParams(sh);
  return ['// Gouache Studio · outline for Toon / Cel (inverted hull)','shader_type spatial;','render_mode cull_front, unshaded;','uniform vec3 outline_colour : source_color = vec3('+(P.ocol||[0,0,0]).map(eshF).join(', ')+');','uniform float outline_width = '+eshF(width)+';',
    'void vertex() {','\tVERTEX += NORMAL * outline_width;','}','void fragment() {','\tALBEDO = outline_colour;','}',''].join('\n');}
/* the .tres of a ShaderMaterial: shader and textures */
function eshGodotMaterial(res,shaderPath,texs,extra){const ext=[],set=[];let id=1;const add=(type,path)=>{ext.push('[ext_resource type="'+type+'" path="'+path+'" id="'+id+'"]');return id++;};
  const s=add('Shader',shaderPath);for(const [param,path] of texs){const t=add('Texture2D',path);set.push('shader_parameter/'+param+' = ExtResource("'+t+'")');}
  let np=null;if(extra&&extra.nextPass)np=add('Material',extra.nextPass);
  return ['[gd_resource type="ShaderMaterial" load_steps='+(ext.length+1)+' format=3]','',...ext,'','[resource]','shader = ExtResource("'+s+'")',...set,...(np?['next_pass = ExtResource("'+np+'")']:[]),''].join('\n');}

/* ---------------- Unity (URP) ---------------- */
const ESH_UNITY_SHADER=`// Gouache Studio — one shader for every look of the 3D view (Universal Render Pipeline).
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
            float _HasOrm, _HasNormal, _HasEmis, _Roughness, _Metallic, _Kind, _OutW, _Cutoff, _UseAlpha;
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
                float3 N = normalize(i.nWS);
                float3 T = normalize(i.tWS.xyz);
                float3 B = cross(N, T) * i.tWS.w;
                if (_HasNormal > 0.5) { float3 tn = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uv)); N = normalize(tn.x * T + tn.y * B + tn.z * N); }
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
const ESH_BUILTIN_SHADER=`// Gouache Studio — one shader for every look of the 3D view (Built-in Render Pipeline).
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
        float _HasOrm, _HasNormal, _HasEmis, _Roughness, _Metallic, _Kind;
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
            if (_Kind > 0.5 && _Kind < 1.5) rough = lerp(rough, _Skin.x, 0.75);
            o.Metallic = metal; o.Smoothness = 1.0 - rough; o.Occlusion = ao;
            o.Normal = _HasNormal > 0.5 ? UnpackNormal(tex2D(_BumpMap, uv)) : float3(0, 0, 1);
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
const eshYV=a=>'{r: '+eshF(a[0])+', g: '+eshF(a[1])+', b: '+eshF(a[2])+', a: '+eshF(a[3]==null?1:a[3])+'}';
function eshUnityMaterial(name,sh,texGuids,flags,width,shaderGuid){const u=shadeUniforms(sh),k=sh.kind,P=shParams(sh),kind=Math.max(0,SHADERS.findIndex(x=>x[0]===k)),
    kk=kind===6?0:kind;/* Spec/Gloss: the textures are already metal/rough */
  const tex=[['_BaseMap',texGuids.base],['_OrmMap',texGuids.orm],['_BumpMap',texGuids.normal],['_EmissionMap',texGuids.emis]].filter(x=>x[1]);
  const te=tex.map(([n,g])=>'    - '+n+':\n        m_Texture: {fileID: 2800000, guid: '+g+', type: 3}\n        m_Scale: {x: 1, y: 1}\n        m_Offset: {x: 0, y: 0}').join('\n');
  const shp=u.uShP.slice(),shq=u.uShQ.slice(),skin=u.uSkin.slice();if(k==='retro')shp[3]=u.uSnap||0;
  const floats=[['_Kind',kk],['_HasOrm',texGuids.orm?1:0],['_HasNormal',texGuids.normal?1:0],['_HasEmis',texGuids.emis?1:0],['_OutW',width||0],['_UseAlpha',flags.alpha?1:0],['_SrcBlend',flags.alpha?5:1],['_DstBlend',flags.alpha?10:0],['_ZWrite',flags.alpha?0:1],['_Cutoff',.5],['_Roughness',.6],['_Metallic',0]];
  const colors=[['_BaseColor',[1,1,1,1]],['_ShP',shp],['_ShQ',shq],['_ShC',[...(u.uShC||[1,1,1]),1]],['_ShD',[...(u.uShD||[0,0,0]),1]],['_Skin',skin],['_Pan',k==='panner'?[P.sx,P.sy,0,0]:[0,0,0,0]]];
  return ['%YAML 1.1','%TAG !u! tag:unity3d.com,2011:','--- !u!21 &2100000','Material:','  serializedVersion: 8','  m_ObjectHideFlags: 0','  m_CorrespondingSourceObject: {fileID: 0}','  m_PrefabInstance: {fileID: 0}','  m_PrefabAsset: {fileID: 0}',
    '  m_Name: '+name,'  m_Shader: {fileID: 4800000, guid: '+(shaderGuid||ESH_SHADER_GUID)+', type: 3}','  m_ValidKeywords: []','  m_InvalidKeywords: []','  m_LightmapFlags: 4','  m_EnableInstancingVariants: 0','  m_DoubleSidedGI: 0','  m_CustomRenderQueue: '+(flags.alpha?3000:-1),'  stringTagMap: {}','  disabledShaderPasses: []',
    '  m_LockedProperties: ','  m_SavedProperties:','    serializedVersion: 3','    m_TexEnvs:',te||'    []','    m_Ints: []','    m_Floats:',floats.map(([n,v])=>'    - '+n+': '+eshF(v)).join('\n'),'    m_Colors:',colors.map(([n,v])=>'    - '+n+': '+eshYV(v)).join('\n'),'  m_BuildTextureStacks: []',''].join('\n');}
function eshUnityMeta(kind,guid,extra){const head='fileFormatVersion: 2\nguid: '+guid+'\n';
  if(kind==='shader')return head+'ShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n  preprocessorOverride: 0\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
  if(kind==='mat')return head+'NativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: 2100000\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
  /* a texture: colour maps are sRGB; normal maps get the Normal map type; ORM and other data maps are linear */
  const normal=extra==='normal',linear=extra!=='color';
  return head+'TextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 12\n  mipmaps:\n    mipMapMode: 0\n    enableMipMap: 1\n    sRGBTexture: '+(linear?0:1)+'\n    linearTexture: 0\n    fadeOut: 0\n    borderMipMap: 0\n    mipMapsPreserveCoverage: 0\n    alphaTestReferenceValue: 0.5\n    mipMapFadeDistanceStart: 1\n    mipMapFadeDistanceEnd: 3\n'+
    '  bumpmap:\n    convertToNormalMap: 0\n    externalNormalMap: 0\n    heightScale: 0.25\n    normalMapFilter: 0\n  isReadable: 0\n  streamingMipmaps: 0\n  streamingMipmapsPriority: 0\n  grayScaleToAlpha: 0\n  generateCubemap: 6\n  cubemapConvolution: 0\n  seamlessCubemap: 0\n  textureFormat: 1\n  maxTextureSize: 8192\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 1\n    aniso: 4\n    mipBias: 0\n    wrapU: 0\n    wrapV: 0\n    wrapW: 0\n  nPOTScale: 1\n  lightmap: 0\n  compressionQuality: 50\n  spriteMode: 0\n  alphaUsage: 1\n  alphaIsTransparency: 0\n  spriteTessellationDetail: -1\n  textureType: '+(normal?1:0)+'\n  textureShape: 1\n  singleChannelComponent: 0\n  maxTextureSizeSet: 0\n  compressionQualitySet: 0\n  textureFormatSet: 0\n  applyGammaDecoding: 0\n  platformSettings:\n  - serializedVersion: 3\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: 8192\n    resizeAlgorithm: 0\n    textureFormat: -1\n    textureCompression: 1\n    compressionQuality: 50\n    crunchedCompression: 0\n    allowsAlphaSplitting: 0\n    overridden: 0\n    ignorePlatformSupport: 0\n    androidETC2FallbackOverride: 0\n    forceMaximumCompressionQuality_BC6H_BC7: 0\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';}

/* ---------------- both: build the extra files for one export ----------------
   info[setName] = { sh (the set's shader), tex {BaseColor, ORM, Normal, Emissive: {name,data}}, alpha }
   Returns the files to add beside the textures (names are relative to the export folder). */
function eshFiles(to,name,info,size){const out=[],pn=pascal(name),sets=Object.keys(info);
  if(to==='godot'){const base='res://gouache/'+pn+'/',width=eshF(size*0.0014);
    for(const s of sets){const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},have={base:!!T.BaseColor,orm:!!T.ORM,normal:!!T.Normal,emis:!!T.Emissive},sn=eshSafe(s);
      out.push({name:sn+'.gdshader',data:new TextEncoder().encode(eshGodotShader(sh,have,I.alpha))});
      const texs=[];if(have.base)texs.push(['albedo_tex',base+T.BaseColor.name]);if(have.orm)texs.push(['orm_tex',base+T.ORM.name]);if(have.normal)texs.push(['normal_tex',base+T.Normal.name]);if(have.emis)texs.push(['emission_tex',base+T.Emissive.name]);
      const outline=(sh.kind==='toon'||sh.kind==='cel')&&shParams(sh).outline>0;
      if(outline){out.push({name:sn+'_outline.gdshader',data:new TextEncoder().encode(eshGodotOutline(sh,shParams(sh).outline*size*0.0014))});
        out.push({name:sn+'_outline.tres',data:new TextEncoder().encode(eshGodotMaterial(null,base+sn+'_outline.gdshader',[]))});}
      out.push({name:sn+'.tres',data:new TextEncoder().encode(eshGodotMaterial(null,base+sn+'.gdshader',texs,outline?{nextPass:base+sn+'_outline.tres'}:null))});}
    return out;}
  if(to==='unity'){const bi=texCfg.unityRP==='builtin',shaderPath=bi?'../GouacheShadedBuiltin.shader':'../GouacheShaded.shader',sguid=bi?ESH_BUILTIN_GUID:ESH_SHADER_GUID;
    for(const s of sets){const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},sn=eshSafe(s),g={};
      const reg=(key,f,kind)=>{if(!f)return;g[key]=eshGuid(pn+'/'+f.name);out.push({name:f.name+'.meta',data:new TextEncoder().encode(eshUnityMeta('tex',g[key],kind))});};
      reg('base',T.BaseColor,'color');reg('orm',T.ORM,'data');reg('normal',T.Normal,'normal');reg('emis',T.Emissive,'color');
      const P=shParams(sh),width=(sh.kind==='toon'||sh.kind==='cel')?(P.outline||0)*size*0.0014:0;
      out.push({name:sn+'.mat',data:new TextEncoder().encode(eshUnityMaterial(sn,sh,g,{alpha:I.alpha&&!bi},width,sguid))},{name:sn+'.mat.meta',data:new TextEncoder().encode(eshUnityMeta('mat',eshGuid(pn+'/'+sn+'.mat')))});}
    out.push({name:shaderPath,data:new TextEncoder().encode(bi?ESH_BUILTIN_SHADER:ESH_UNITY_SHADER),shared:true},{name:shaderPath+'.meta',data:new TextEncoder().encode(eshUnityMeta('shader',sguid)),shared:true});
    return out;}
  if(to==='unreal'){const list=sets.map(s=>{const I=info[s],T=I.tex||{},sh=I.sh||{kind:'std',p:{}},tex={};for(const k of ['BaseColor','ORM','Normal','Emissive'])if(T[k])tex[k]=T[k].name;
      return {name:s,safe:eshSafe(s),kind:sh.kind,p:shParams(sh),tex,alpha:!!I.alpha};});
    out.push({name:'gouache_unreal.json',data:new TextEncoder().encode(JSON.stringify({name:pn,sets:list},null,1))},{name:'gouache_unreal_setup.py',data:new TextEncoder().encode(UNREAL_SETUP||'')});
    return out;}
  return out;}

/* is the engine's Gouache shader going out with this export? */
const eshWanted=()=>platform.isDesktop&&(es.to==='unity'||es.to==='godot'||es.to==='unreal')&&texCfg.engShader!==false;
/* a file's place in the export folder; '../x' is the folder above (the shared Unity shader) */
function eshPath(dir,name){const sep=dir.includes('\\')?'\\':'/';let d=dir.replace(/[\\/]+$/,'');while(name.startsWith('../')){name=name.slice(3);d=d.replace(/[\\/][^\\/]*$/,'');}return d+sep+name;}
