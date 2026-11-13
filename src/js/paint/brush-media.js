/* (0.97.10, Kenn) the brush library grouped by what you paint with: Pencil and charcoal, Ink and pen, Paint, Airbrush and spray, Blend and smudge,
   Texture and grunge, Effects, Retouch, Stamps and shapes. Each brush is put in a folder by the set it comes from, then by its name and tool.
   "By set" still shows the old list. */
const BR_MEDIA=[['pencil','Pencil and charcoal'],['ink','Ink and pen'],['paint','Paint (oil, gouache, watercolour)'],['spray','Airbrush and spray'],['blend','Blend and smudge'],
  ['texture','Texture and grunge'],['effects','Effects'],['retouch','Retouch and erase'],['stamps','Stamps and shapes'],['tools','Welds and surface tools'],['other','Other']];
const BR_SET_MEDIUM={bp_basic:null,bp_d:'texture',bp_s:'effects',bp_l:'effects',bp_g:'effects',bp_w:'effects',bp_f:'effects',art_media:null,friend_picks:null,mixing:'paint',
  graffiti:'spray',caplevels:'spray',aqua0:'ink',aqua1:'paint',aqua2:'paint',aqua3:'paint',aqua4:'stamps',aqua5:'blend',aqua6:'retouch',
  sketch0:'pencil',sketch1:'pencil',sketch2:'pencil',sketch3:'ink',sketch4:'ink',sketch5:'ink',sketch6:'ink',texstudio0:'texture',texstudio1:'texture',welds:'tools',builtin:null};
const BR_NAME_RULES=[['stamps',/shard|jagged|torn|fracture|shatter|faceted|^poly \d|abstract|chipped|cut streak|^boxes$|^worm$/i],['paint',/^b\d+$|^stroke \d+|^round$|^brow$|dry brush|dry rake/i],['spray',/soft air/i],['texture',/sponge|foliage|grass|\bfur\b|dither|fluff/i],['ink',/^line$/i],
  ['retouch',/erase|eraser|lift|heal|clone|dodge|burn|remove/i],['blend',/blend|smudge|smear|blur|stump|mixer|soften|wet brush/i],
  ['pencil',/pencil|graphite|charcoal|pastel|chalk|crayon|conte|shader|hatch/i],['ink',/\bink|pen\b|pens\b|marker|liner|nib|g-pen|calligraph|brush pen|rapidograph/i],
  ['spray',/spray|airbrush|\bcap\b|nozzle|splatter|graffiti|mist/i],['paint',/oil|gouache|acrylic|water ?colou?r|paint|wash|bristle|impasto|palette|flat brush|round brush|fan\b/i],
  ['effects',/smoke|fire|flame|lightning|spark|glint|star|cloud|swoosh|crack|explosion/i],['texture',/grain|noise|salt|speckle|scatter|texture|crumb|dirt|rough|scratch|grunge|dust|stipple|static|sprinkle|moss|rust|stone|bark/i],
  ['stamps',/stamp|pixel|square|shape|leaf|dot|star|cross|arrow/i]];
function brushMedium(p,set){
  const nm=p.name||'';if(/stump|smudger|blender|water brush/i.test(nm))return 'blend';if(/erase|eraser|lift-off|lifter/i.test(nm))return 'retouch';
  const m=set&&BR_SET_MEDIUM[set.id];if(m)return m;
  if(p.tool==='smudge')return 'blend';if(['heal','clone','dodge','burn','erase'].includes(p.tool))return 'retouch';
  if(p.weldPaint||p.ownTool&&p.tool==='material')return 'tools';
  const n=p.name||'';for(const [k,re] of BR_NAME_RULES)if(re.test(n))return k;
  return 'other';}
/* the library grouped by medium: [{key,title,items:[{set,p}]}], empty folders left out */
function brushMediaGroups(){const by=new Map(BR_MEDIA.map(([k])=>[k,[]]));const mine=[];
  for(const set of library){if(!set.builtin){mine.push({set,items:set.presets.map(p=>({set,p}))});continue;}
    for(const p of set.presets)by.get(brushMedium(p,set)).push({set,p});}
  return {media:BR_MEDIA.map(([k,t])=>({key:k,title:t,items:by.get(k)})).filter(g=>g.items.length),mine};}
const brLibView=()=>{try{return localStorage.getItem('gs.libView')==='set'?'set':'medium';}catch(e){return 'medium';}};
function brMedFolded(){try{const v=localStorage.getItem('gs.libFoldMed');if(v===null){/* nothing chosen yet: only the folder of the brush you are using is open */let open='pencil';try{if(typeof activePreset!=='undefined'&&activePreset){const set=library.find(x=>x.presets.includes(activePreset));open=brushMedium(activePreset,set);}}catch(e){}return new Set(BR_MEDIA.map(([k])=>'med_'+k).filter(id=>id!=='med_'+open));}return new Set(JSON.parse(v));}catch(e){return new Set();}}
function brMedFoldSave(s){try{localStorage.setItem('gs.libFoldMed',JSON.stringify([...s]));}catch(e){}}
