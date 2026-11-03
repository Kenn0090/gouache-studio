/* ================= The live link into Unity, Godot and Unreal (0.94, bridge level 2) =================
   Kenn: a bridge, so sending to an engine sets everything up straight away. Gouache offers to put a small plug-in into
   the engine project; it listens on this computer only (127.0.0.1). After an export, Gouache tells it what was sent and
   it does the work: Unity refreshes (and its assign script gives the model its materials), Godot scans and builds a
   ready scene with the materials on the model, Unreal runs the setup script. The same message path as the Blender link. */
const EL_PORT={unity:47651,godot:47652,unreal:47653};
const EL_NAME={unity:'Unity',godot:'Godot',unreal:'Unreal'};

const EL_UNITY=`// Gouache Studio link: lets Gouache Studio tell this Unity editor that new files were sent, so it refreshes at once.
// It listens on this computer only (127.0.0.1:${EL_PORT.unity}). Delete this file to remove the link.
#if UNITY_EDITOR
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using UnityEditor;
using UnityEngine;

[InitializeOnLoad]
public static class GouacheLink
{
    const int Port = ${EL_PORT.unity};
    static HttpListener listener;
    static Thread thread;
    static readonly ConcurrentQueue<string> jobs = new ConcurrentQueue<string>();

    static GouacheLink()
    {
        EditorApplication.update += Tick;
        AssemblyReloadEvents.beforeAssemblyReload += Stop;
        Start();
    }

    static void Start()
    {
        try
        {
            listener = new HttpListener();
            listener.Prefixes.Add("http://127.0.0.1:" + Port + "/");
            listener.Start();
            thread = new Thread(Serve) { IsBackground = true };
            thread.Start();
        }
        catch (Exception e) { Debug.LogWarning("Gouache link could not start: " + e.Message); }
    }

    static void Stop()
    {
        try { if (listener != null) { listener.Stop(); listener.Close(); } } catch (Exception) { }
    }

    static void Serve()
    {
        while (listener != null && listener.IsListening)
        {
            try
            {
                var ctx = listener.GetContext();
                string body;
                using (var r = new StreamReader(ctx.Request.InputStream, Encoding.UTF8)) body = r.ReadToEnd();
                jobs.Enqueue(body);
                var bytes = Encoding.UTF8.GetBytes("ok");
                ctx.Response.StatusCode = 200;
                ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
                ctx.Response.Close();
            }
            catch (Exception) { break; }
        }
    }

    static void Tick()
    {
        string body;
        bool any = false;
        while (jobs.TryDequeue(out body)) any = true;
        if (any)
        {
            Debug.Log("Gouache link: new files sent, refreshing.");
            AssetDatabase.Refresh();
        }
    }
}
#endif
`;

const EL_GODOT_CFG='[plugin]\n\nname="Gouache Studio link"\ndescription="Lets Gouache Studio tell Godot that new files were sent: it scans, then builds a ready scene with the materials on the model."\nauthor="Gouache Studio"\nversion="1.0"\nscript="plugin.gd"\n';
const EL_GODOT=`# Gouache Studio link for Godot 4. It listens on this computer only (127.0.0.1:${EL_PORT.godot}).
# When Gouache Studio sends something, this scans the project and builds <Name>_ready.tscn next to the model:
# the model with each surface's material set from the .tres file of the same name.
@tool
extends EditorPlugin

const PORT := ${EL_PORT.godot}
var server := TCPServer.new()
var jobs: Array = []
var tries := 0

func _enter_tree() -> void:
	var err := server.listen(PORT, "127.0.0.1")
	if err != OK:
		push_warning("Gouache link could not listen on port %d" % PORT)
	set_process(true)

func _exit_tree() -> void:
	server.stop()

func _process(_delta: float) -> void:
	if server.is_connection_available():
		var c := server.take_connection()
		var data := ""
		var t := Time.get_ticks_msec()
		while Time.get_ticks_msec() - t < 700:
			c.poll()
			var n := c.get_available_bytes()
			if n > 0:
				data += c.get_utf8_string(n)
				var i := data.find("\\r\\n\\r\\n")
				if i != -1 and data.length() >= i + 4 + _content_length(data):
					break
		var body := ""
		var k := data.find("\\r\\n\\r\\n")
		if k != -1:
			body = data.substr(k + 4)
		c.put_data("HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\nok".to_utf8_buffer())
		c.disconnect_from_host()
		var job = JSON.parse_string(body)
		if typeof(job) == TYPE_DICTIONARY:
			jobs.append(job)
			tries = 0
			get_editor_interface().get_resource_filesystem().scan()
	if jobs.size() > 0:
		tries += 1
		if tries % 40 == 0:
			_build(jobs[0])

func _content_length(head: String) -> int:
	for line in head.split("\\r\\n"):
		if line.to_lower().begins_with("content-length:"):
			return int(line.split(":")[1].strip_edges())
	return 0

func _safe(s: String) -> String:
	var r := RegEx.new()
	r.compile("[^A-Za-z0-9_\\\\-]+")
	return r.sub(s, "_", true)

func _build(job: Dictionary) -> void:
	var dir := "res://gouache/%s/" % job.get("name", "")
	var model: String = job.get("model", "")
	if model == "":
		jobs.pop_front()
		return
	var ps = load(dir + model)
	if ps == null or not (ps is PackedScene):
		if tries > 400:
			push_warning("Gouache link: %s was not imported in time" % model)
			jobs.pop_front()
		return
	var wrapper := Node3D.new()
	wrapper.name = job.get("name", "Gouache")
	var inst: Node = ps.instantiate()
	wrapper.add_child(inst)
	inst.owner = wrapper
	var count := 0
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in mesh.get_surface_count():
			var m := mesh.surface_get_material(s)
			var nm := m.resource_name if m != null else ""
			for cand in [nm, _safe(nm)]:
				var p: String = dir + cand + ".tres"
				if cand != "" and ResourceLoader.exists(p):
					mi.owner = wrapper
					mi.set_surface_override_material(s, load(p))
					count += 1
					break
	var out := PackedScene.new()
	out.pack(wrapper)
	ResourceSaver.save(out, dir + job.get("name", "Gouache") + "_ready.tscn")
	get_editor_interface().get_resource_filesystem().scan()
	print("Gouache link: %s_ready.tscn built (%d materials set)" % [job.get("name", ""), count])
	wrapper.free()
	jobs.pop_front()
`;

const EL_UNREAL=`# Gouache Studio link for Unreal (Python Editor Script Plugin). It listens on this computer only (127.0.0.1:${EL_PORT.unreal}).
# When Gouache Studio sends something, this runs gouache_unreal_setup.py from the folder it was sent to.
import json
import os
import queue
import socket
import threading

import unreal

PORT = ${EL_PORT.unreal}
_jobs = queue.Queue()
_state = globals().setdefault("_gouache_state", {"started": False})


def _read_request(conn):
    conn.settimeout(3)
    data = b""
    while b"\\r\\n\\r\\n" not in data:
        chunk = conn.recv(4096)
        if not chunk:
            break
        data += chunk
    head, _, body = data.partition(b"\\r\\n\\r\\n")
    n = 0
    for line in head.split(b"\\r\\n"):
        if line.lower().startswith(b"content-length:"):
            n = int(line.split(b":")[1].strip())
    while len(body) < n:
        chunk = conn.recv(4096)
        if not chunk:
            break
        body += chunk
    return body


def _serve(sock):
    while True:
        try:
            conn, _ = sock.accept()
        except OSError:
            break
        try:
            job = json.loads(_read_request(conn).decode("utf-8"))
            _jobs.put(job)
            conn.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\nok")
        except Exception as e:
            unreal.log_warning("Gouache link: bad message (" + str(e) + ")")
        finally:
            conn.close()


def _tick(delta):
    while not _jobs.empty():
        job = _jobs.get()
        script = os.path.join(job.get("dir", ""), "gouache_unreal_setup.py")
        if not os.path.exists(script):
            unreal.log_warning("Gouache link: " + script + " was not found")
            continue
        unreal.log("Gouache link: setting up " + str(job.get("name", "")))
        try:
            with open(script, "r", encoding="utf-8") as f:
                code = compile(f.read(), script, "exec")
            exec(code, {"__file__": script, "__name__": "__main__"})
        except Exception as e:
            unreal.log_error("Gouache link: setup failed: " + str(e))


if not _state["started"]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("127.0.0.1", PORT))
        s.listen(4)
        threading.Thread(target=_serve, args=(s,), daemon=True).start()
        unreal.register_slate_post_tick_callback(_tick)
        _state["started"] = True
        unreal.log("Gouache link: listening on port " + str(PORT))
    except Exception as e:
        unreal.log_warning("Gouache link could not start: " + str(e))
`;

/* is a file there? */
async function elExists(path){try{return (await platform.invoke('file_mtime',{path}))>0;}catch(e){return false;}}
const elJoin=(base,...p)=>[base.replace(/[\\/]+$/,''),...p].join(esSep(base));
/* the file that shows the link is in the project */
const elMarker=(to,base)=>to==='unity'?elJoin(base,'Assets','Gouache','GouacheLink.cs'):to==='godot'?elJoin(base,'addons','gouache_link','plugin.gd'):elJoin(base,'Content','Python','gouache_link.py');
async function elInstalled(to){const b=es.dirs[to];return !!b&&await elExists(elMarker(to,b));}
/* put the plug-in into the project (Gouache never changes anything else in it) */
async function elInstall(to){const b=es.dirs[to];if(!b){toast('Choose the '+EL_NAME[to]+' project first.');return false;}
  const enc=s=>new TextEncoder().encode(s),put=async(path,data)=>{await platform.invoke('make_dir',{path:path.replace(/[\\/][^\\/]*$/,'')});await platform.writeFile(path,typeof data==='string'?enc(data):data);};
  try{
    if(to==='unity'){const f=elMarker(to,b);await put(f,EL_UNITY);await put(f+'.meta',eshUnityMeta('mono',eshGuid('GouacheLink.cs')));toast('Unity link added (Assets/Gouache/GouacheLink.cs). Unity picks it up when you switch to it.');}
    else if(to==='godot'){const d=elJoin(b,'addons','gouache_link');await put(elJoin(d,'plugin.cfg'),EL_GODOT_CFG);await put(elJoin(d,'plugin.gd'),EL_GODOT);toast('Godot link added. In Godot: Project › Project Settings › Plugins, tick “Gouache Studio link”.');}
    else{const d=elJoin(b,'Content','Python'),init=elJoin(d,'init_unreal.py');await put(elJoin(d,'gouache_link.py'),EL_UNREAL);
      if(!(await elExists(init))){await put(init,'import gouache_link\n');toast('Unreal link added. Turn on the Python Editor Script Plugin (Edit › Plugins) and restart Unreal.');}
      else toast('Unreal link added as gouache_link.py. Your project already has an init_unreal.py: add the line “import gouache_link” to it, and turn on the Python Editor Script Plugin.');}
    return true;}catch(e){console.warn(e);toast('The link could not be added: '+(e.message||e));return false;}}
/* after an export: tell the engine what was sent */
async function elPing(to,dir,files,name){if(!EL_PORT[to]||es.live===false||!(await elInstalled(to)))return false;
  const m=files.find(f=>/\.(glb|fbx|obj)$/i.test(f.name)),payload={name:pascal(name),dir,model:m?m.name:null};
  let ok=false;try{ok=await platform.invoke('blender_send',{path:JSON.stringify(payload),port:EL_PORT[to]});}catch(e){}
  toast(ok?'Told '+EL_NAME[to]+' to set it up.':EL_NAME[to]+' isn’t listening: open the project in the editor (with the link on) and send again. The files are saved.');return ok;}
/* the controls in the export window */
function elRow(redraw){const to=es.to;if(!EL_PORT[to]||!platform.isDesktop||!es.dirs[to])return [];
  const row=el('div',{class:'chips'});const st=el('span',{class:'note',id:'elStatus',text:'Checking the link…'});
  elInstalled(to).then(has=>{st.textContent=has?EL_NAME[to]+' link: installed in the project.':EL_NAME[to]+' link: not in the project yet.';row.append(el('button',{class:'btn sm',id:'elInstall',text:has?'Update the link':'Add the link to the project',onclick:async()=>{if(await elInstall(to))redraw();}}));});
  return [el('div',{class:'sub',text:'Live link'}),chk('elLive','Set it up in '+EL_NAME[to]+' straight away (needs the link)',es.live!==false,v=>{es.live=v;esSave();}),st,row];}
