/* ================= 3D Paint keeps only tools that work on the model (0.96.5, Kenn) =================
   "Remove any tools that can't be used in the 3D paint section ... and the hotkey access to them as well; these sections should act truly
   independent of each other." Move, Fill bucket / Gradient, Marquee, Lasso, Magic wand and Pen only worked on the flat texture view, so they
   are hidden in 3D Paint and their keys do nothing there (Polygon fill, the mask tools bar's Box/Lasso and the Surface Path take their place).
   Crop, Cage, Array and Shape were hidden before. The mask tools bar still uses Marquee and Lasso inside itself (setTool's force). */
const P3D_OFF_TOOLS=['move','bucket','gradient','gbucket','marquee','lasso','wand','pen','cage','crop','array','shape'];
function p3ToolOk(t){return ui.mode!=='p3d'||!P3D_OFF_TOOLS.includes(t);}
/* on entering 3D Paint with one of them chosen: back to the brush */
function p3ToolFix(){if(ui.mode!=='p3d'||p3ToolOk(ui.tool))return;if(typeof maskToolsOn==='function'&&maskToolsOn()&&(ui.tool==='marquee'||ui.tool==='lasso'))return;setTool('brush',false,true);}
