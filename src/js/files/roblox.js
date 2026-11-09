/* ================= Roblox (0.96.4, Kenn: "support Roblox as an export", files + live link) =================
   Files: the Roblox preset writes Color / Normal / Roughness / Metalness (a SurfaceAppearance's four maps, at most 1024 px) and an
   FBX for Roblox Studio's 3D Importer. Live link: Gouache keeps the last send on its own listener (src-tauri link.rs,
   GET /get/<key>), and the Gouache plug-in in Roblox Studio (toolbar Gouache › Live link / Get now) builds a MeshPart per texture
   set with a SurfaceAppearance from it, replacing the last one in place. Roblox takes at most 20,000 triangles a part, so a bigger
   set is cut into several parts with the same maps.
   Data: "roblox-latest" = JSON {id,name,scale,parts:[{name,mesh,maps:{Color,Normal,Roughness,Metalness},w,h}]};
   mesh blob = u32 vertices, u32 triangles, f32 positions (studs), f32 normals, f32 UVs (top-left origin, as glTF), u32 indices;
   map blob = raw RGBA, top row first. */
const RBX_MAX_TRIS=20000,RBX_STUD=0.28;/* metres per stud */
let esLastBySet=null;
/* the model in Roblox studs: its real size from the file (metres), unless that is very small or huge */
function rbxScale(m){const real=m&&m.fitS?1/m.fitS:0,studs=2*real/RBX_STUD;return real&&studs>0.5&&studs<2048?real/RBX_STUD:4;/* else 8 studs across */}
function rbxChunks(m,idx){const out=[];for(let s=0;s<idx.length;s+=RBX_MAX_TRIS*3)out.push(idx.subarray(s,Math.min(idx.length,s+RBX_MAX_TRIS*3)));return out;}
function rbxMeshBlob(m,idx,scale){const map=new Map(),vs=[];const ix=new Uint32Array(idx.length);
  for(let i=0;i<idx.length;i++){const v=idx[i];let j=map.get(v);if(j===undefined){j=vs.length;map.set(v,j);vs.push(v);}ix[i]=j;}
  const nv=vs.length,nt=idx.length/3,buf=new ArrayBuffer(8+nv*32+nt*12),dv=new DataView(buf);dv.setUint32(0,nv,true);dv.setUint32(4,nt,true);
  const P=new Float32Array(buf,8,nv*3),N=new Float32Array(buf,8+nv*12,nv*3),U=new Float32Array(buf,8+nv*24,nv*2);
  for(let i=0;i<nv;i++){const v=vs[i];for(let c=0;c<3;c++){P[i*3+c]=m.pos[v*3+c]*scale;N[i*3+c]=m.nrm?m.nrm[v*3+c]:0;}U[i*2]=m.uv?m.uv[v*2]:0;U[i*2+1]=m.uv?m.uv[v*2+1]:0;}
  new Uint32Array(buf,8+nv*32,nt*3).set(ix);return new Uint8Array(buf);}
async function rbxPixels(png){const bm=await createImageBitmap(new Blob([png],{type:'image/png'})),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);const d=x.getImageData(0,0,c.width,c.height);return {w:c.width,h:c.height,data:new Uint8Array(d.data.buffer)};}
async function rbxPut(key,bytes){if(platform.isDesktop)return platform.invoke('link_publish',bytes,{headers:{'x-key':key}});(rbxPut.mem||(rbxPut.mem={}))[key]=bytes;}
/* publish the last export for the Roblox plug-in. bySet = {set name: [files of the Roblox preset]} */
async function rbxPublish(name,bySet,m){m=m||mxModel();if(!m||!m.idx)return null;const sets=Object.keys(bySet||{}),groups=mxGroups(m,sets),id=Date.now().toString(36),parts=[];
  /* the model is stored centred and 2 units across: back to its real size (in studs) */
  const S=rbxScale(m);let k=0;
  for(const g of groups){const files=bySet[g.name]||bySet[sets[0]]||[],maps={};let w=0,h=0;
    for(const f of files){if(!/\.png$/i.test(f.name))continue;const px=await rbxPixels(f.data);const key='rbx-'+id+'-'+(k)+'-'+f.suffix;await rbxPut(key,px.data);maps[f.suffix]=key;w=px.w;h=px.h;}
    const chunks=rbxChunks(m,g.idx);chunks.forEach((idx,i)=>{parts.push({name:pascal(g.name)+(chunks.length>1?'_'+(i+1):''),mesh:'rbx-'+id+'-'+k+'-mesh'+i,maps,w,h,_idx:idx});});k++;}
  for(const p of parts){await rbxPut(p.mesh,rbxMeshBlob(m,p._idx,S));delete p._idx;}
  const info={id,name:pascal(name),scale:S,parts};await rbxPut('roblox-latest',new TextEncoder().encode(JSON.stringify(info)));return info;}

/* where Roblox Studio looks for local plug-ins: %LOCALAPPDATA%\Roblox\Plugins (Windows), ~/Documents/Roblox/Plugins (Mac) */
async function rbxPluginsDir(){try{const a=await platform.invoke('autosave_dir');
    if(/[\\/]AppData[\\/]Roaming[\\/]/i.test(a))return a.split(/[\\/]AppData[\\/]Roaming[\\/]/i)[0]+'\\AppData\\Local\\Roblox\\Plugins';
    if(/\/Library\/Application Support\//.test(a))return a.split('/Library/Application Support/')[0]+'/Documents/Roblox/Plugins';}catch(e){}return null;}
async function rbxInstall(){const bytes=new TextEncoder().encode(RBX_PLUGIN);
  if(!platform.isDesktop){const r=await deliver('GouacheLink.lua',new Blob([bytes],{type:'text/plain'}));toast(deliveredText(r,'The Roblox Studio plug-in')+' Put it in Roblox Studio’s Plugins folder (Plugins tab › Plugins Folder).');return;}
  let d=await rbxPluginsDir();if(!d){d=await platform.pickFolder();if(!d)return;}
  try{await platform.invoke('make_dir',{path:d});const p=d.replace(/[\\/]+$/,'')+(d.includes('\\')?'\\':'/')+'GouacheLink.lua';await platform.writeFile(p,bytes);
    toast('Roblox Studio plug-in saved to '+p+'. Restart Roblox Studio, then use the Gouache buttons in the Plugins tab (allow it to reach 127.0.0.1 when asked).');}
  catch(e){toast('Could not save the plug-in: '+(e.message||e));}}

const RBX_PLUGIN=`--[[ Gouache Studio link for Roblox Studio (a local plug-in: Plugins tab > Plugins Folder).
  Gouache Studio keeps its last Roblox export on this computer (127.0.0.1:${LINK_PORT}). "Live link" brings each new send in by itself;
  "Get now" brings in the last one. Each texture set becomes a MeshPart with a SurfaceAppearance, in a Model called Gouache_<name>
  (a new send replaces the old one in place). Roblox asks once whether this plug-in may reach 127.0.0.1: allow it.
  The parts are made in Studio (EditableMesh / EditableImage): publish your place or use File > Save to Roblox to keep them. ]]
local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local BASE = "http://127.0.0.1:${LINK_PORT}/get/"

local toolbar = plugin:CreateToolbar("Gouache")
local liveBtn = toolbar:CreateButton("Live link", "Bring in each send from Gouache Studio by itself", "")
local nowBtn = toolbar:CreateButton("Get now", "Bring in the last send from Gouache Studio", "")
liveBtn.ClickableWhenViewportHidden = true
nowBtn.ClickableWhenViewportHidden = true

local live = false
local lastId = plugin:GetSetting("GouacheLastId")
local busy = false

local function fetch(key)
	local ok, res = pcall(function()
		return HttpService:RequestAsync({ Url = BASE .. key, Method = "GET" })
	end)
	if ok and res.Success then
		return res.Body
	end
	return nil, ok and res.StatusCode or res
end

local function buildMesh(raw)
	local b = buffer.fromstring(raw)
	local nv, nt = buffer.readu32(b, 0), buffer.readu32(b, 4)
	local P, N, U, I = 8, 8 + nv * 12, 8 + nv * 24, 8 + nv * 32
	local em = AssetService:CreateEditableMesh()
	local vid, nid, uid = table.create(nv), table.create(nv), table.create(nv)
	for i = 0, nv - 1 do
		vid[i] = em:AddVertex(Vector3.new(buffer.readf32(b, P + i * 12), buffer.readf32(b, P + i * 12 + 4), buffer.readf32(b, P + i * 12 + 8)))
		nid[i] = em:AddNormal(Vector3.new(buffer.readf32(b, N + i * 12), buffer.readf32(b, N + i * 12 + 4), buffer.readf32(b, N + i * 12 + 8)))
		uid[i] = em:AddUV(Vector2.new(buffer.readf32(b, U + i * 8), buffer.readf32(b, U + i * 8 + 4)))
	end
	for t = 0, nt - 1 do
		local a, c, d = buffer.readu32(b, I + t * 12), buffer.readu32(b, I + t * 12 + 4), buffer.readu32(b, I + t * 12 + 8)
		local f = em:AddTriangle(vid[a], vid[c], vid[d])
		em:SetFaceNormals(f, { nid[a], nid[c], nid[d] })
		em:SetFaceUVs(f, { uid[a], uid[c], uid[d] })
	end
	return em
end

local function buildImage(raw, w, h)
	local img = AssetService:CreateEditableImage({ Size = Vector2.new(w, h) })
	img:WritePixelsBuffer(Vector2.zero, Vector2.new(w, h), buffer.fromstring(raw))
	return img
end

local MAPS = { Color = "ColorMapContent", Normal = "NormalMapContent", Roughness = "RoughnessMapContent", Metalness = "MetalnessMapContent" }

local function bringIn(info)
	local name = "Gouache_" .. info.name
	local old = workspace:FindFirstChild(name)
	local pivot = old and old:GetPivot() or nil
	local model = Instance.new("Model")
	model.Name = name
	local images = {}
	for _, p in ipairs(info.parts) do
		local raw = fetch(p.mesh)
		if not raw then
			warn("Gouache: the mesh for " .. p.name .. " did not arrive")
			continue
		end
		local em = buildMesh(raw)
		local part = AssetService:CreateMeshPartAsync(Content.fromObject(em))
		part.Name = p.name
		part.Anchored = true
		local sa = Instance.new("SurfaceAppearance")
		for key, prop in pairs(MAPS) do
			local mk = p.maps[key]
			if mk then
				if not images[mk] then
					local px = fetch(mk)
					if px then
						images[mk] = buildImage(px, p.w, p.h)
					end
				end
				if images[mk] then
					sa[prop] = Content.fromObject(images[mk])
				end
			end
		end
		sa.Parent = part
		part.Parent = model
	end
	if pivot then
		model:PivotTo(pivot)
	else
		local cam = workspace.CurrentCamera
		model:PivotTo(CFrame.new(cam.CFrame.Position + cam.CFrame.LookVector * 20))
	end
	if old then
		old:Destroy()
	end
	model.Parent = workspace
	game:GetService("Selection"):Set({ model })
	print("Gouache: brought in " .. info.name .. " (" .. #info.parts .. " part(s))")
end

local function check(force)
	if busy then
		return
	end
	busy = true
	local ok, err = pcall(function()
		local raw, why = fetch("roblox-latest")
		if not raw then
			if force then
				warn("Gouache: nothing to bring in. Is Gouache Studio running, and did you send to Roblox? (" .. tostring(why) .. ")")
			end
			return
		end
		local info = HttpService:JSONDecode(raw)
		if force or info.id ~= lastId then
			lastId = info.id
			plugin:SetSetting("GouacheLastId", lastId)
			bringIn(info)
		end
	end)
	if not ok then
		warn("Gouache: " .. tostring(err))
	end
	busy = false
end

nowBtn.Click:Connect(function()
	check(true)
end)
liveBtn.Click:Connect(function()
	live = not live
	liveBtn:SetActive(live)
	print(live and "Gouache: live link on" or "Gouache: live link off")
end)
task.spawn(function()
	while true do
		task.wait(2)
		if live then
			check(false)
		end
	end
end)
`;
