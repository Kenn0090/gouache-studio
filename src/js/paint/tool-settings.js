/* (0.97.11, Kenn) the Tools shelf shows only thumbnails; the settings of the chosen weld, stitch or surface detail appear in the Brush settings panel.
   Each tool builds its settings once (tsSet) and the Brush panel puts them in place (tsHost). */
const TS={weld:null,stitch:null,detail:null};
function tsSet(kind,node){TS[kind]=node;for(const h of document.querySelectorAll('#brushBody .toolset[data-kind="'+kind+'"]'))h.replaceChildren(node);}
function tsEnsure(kind){if(TS[kind])return;try{({weld:()=>weldToolsRender(),stitch:()=>stitchToolsRender(),detail:()=>surfaceDetailRender()})[kind]();}catch(e){}}
function tsHost(kind){tsEnsure(kind);const h=el('div',{class:'toolset','data-kind':kind});if(TS[kind])h.append(TS[kind]);return h;}
