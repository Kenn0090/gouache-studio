"""Curated CC0 surface damage; downloads live in .texture-downloads."""
import hashlib, io, json, pathlib, random, struct, zipfile
from PIL import Image, ImageOps, ImageChops
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'assets/grunge'; downloads=root/'.texture-downloads'
manifest=folder/'workshop-sources.json'
old=json.loads(manifest.read_text()) if manifest.exists() else []
records=[]; images={}
sha=lambda data:hashlib.sha256(data).hexdigest()
def hard(im,black=65,white=175):
    im=ImageOps.autocontrast(im.convert('L'),cutoff=.5)
    return im.point(lambda v:max(0,min(255,round((v-black)*255/(white-black)))))
def save(im,slug,name,category,source,author,processing,hashes,download=None):
    im=ImageOps.fit(im.convert('L'),(1024,1024),method=Image.Resampling.LANCZOS)
    path=folder/(slug+'.webp'); im.save(path,'WEBP',quality=92,method=6); images[slug]=im
    records.append(dict(slug=slug,name=name,category=category,source=source,author=author,
        license='CC0-1.0',processing=processing,sourceSha256=hashes,outputSha256=sha(path.read_bytes()),
        download=download,width=1024,height=1024))
    print(name,path.stat().st_size,flush=True)
pdp=[
 ('real-grunge-scratches.jpg','photographed-gashes','Photographed gashes','Scratches','20754','Talia Felix',60,160),
 ('pdp-376133.jpg','scraped-and-cracked-paint','Scraped and cracked paint','Grunge','376133','Ian L',70,170),
 ('pdp-162935.jpg','scored-surface-scan','Scored surface scan','Scratches','162935','Charles Rondeau',75,170),
 ('pdp-169024.jpg','rough-distress-scan','Rough distress scan','Grunge','169024','George Hodan',65,175)]
for file,slug,name,cat,id,author,black,white in pdp:
    raw=(downloads/file).read_bytes()
    save(hard(Image.open(io.BytesIO(raw)),black,white),slug,name,cat,
        'https://www.publicdomainpictures.net/en/view-image.php?image='+id,author,
        f'Original image; grayscale; input levels {black}–{white}; central square crop',sha(raw))
ph=[
 ('blue_metal_plate','scratched-painted-steel','Scratched painted steel','Scratches',65,160),
 ('metal_plate_02','industrial-scuffed-plate','Industrial scuffed plate','Grunge',65,165),
 ('rusty_painted_metal','torn-metal-coating','Torn metal coating','Grunge',65,160),
 ('rusty_metal_sheet','corroded-sheet-scan','Corroded sheet scan','Grunge',85,180),
 ('rusty_metal_04','flaked-rust-scan','Flaked rust scan','Grunge',55,165),
 ('painted_plaster_wall','worn-plaster-scan','Worn plaster scan','Grunge',90,175),
 ('blue_plaster_weathered','weathered-plaster-scan','Weathered plaster scan','Grunge',75,165)]
catalogue=json.loads((downloads/'polyhaven-catalogue.json').read_text())
for id,slug,name,cat,black,white in ph:
    raw=(downloads/(id+'.jpg')).read_bytes();meta=json.loads((downloads/(id+'-files.json')).read_text())
    authors=catalogue[id].get('authors',{});author=', '.join(authors.keys()) if isinstance(authors,dict) else str(authors)
    save(hard(Image.open(io.BytesIO(raw)),black,white),slug,name,cat,'https://polyhaven.com/a/'+id,author,
        f'Original surface scan; grayscale; input levels {black}–{white}',sha(raw),meta['Diffuse']['1k']['jpg']['url'])
ac=[
 ('Metal003','Roughness','scraped-steel','Scraped steel','Scratches',True),
 ('Metal009','Roughness','brushed-tool-wear','Brushed tool wear','Scratches',False),
 ('Metal017','Roughness','weathered-grime','Weathered grime','Grunge',False),
 ('Metal018','Roughness','chipped-surface-wear','Chipped surface wear','Grunge',False),
 ('PaintedPlaster003','Color','plaster-grunge','Plaster grunge','Grunge',True)]
for id,channel,slug,name,cat,invert in ac:
    with zipfile.ZipFile(downloads/(id+'.zip')) as pack:
        raw=pack.read(next(n for n in pack.namelist() if n.endswith('_'+channel+'.jpg')))
    im=hard(Image.open(io.BytesIO(raw)),60,180)
    if invert: im=ImageOps.invert(im)
    save(im,slug,name,cat,'https://ambientcg.com/view?id='+id,'Lennart Demes',
        'Grayscale '+channel+'; input levels 60–180'+('; invert' if invert else ''),sha(raw),
        'https://ambientcg.com/get?file='+id+'_1K-JPG.zip')
pack_raw=(downloads/'oga-scratches.zip').read_bytes()
with zipfile.ZipFile(io.BytesIO(pack_raw)) as pack:
    def brushes(name):
        data=pack.read(name);pos=data.index(b'\n')+1;pos=data.index(b'\n',pos)+1;out=[]
        while pos<len(data):
            size,version,w,h,depth=struct.unpack('>5I',data[pos:pos+20])
            if version!=2 or depth!=1:raise ValueError('Unsupported GIMP brush')
            im=Image.frombytes('L',(w,h),data[pos+size:pos+size+w*h]);bounds=im.getbbox()
            if bounds:out.append(im.crop(bounds))
            pos+=size+w*h
        return out
    cuts=brushes('Scratches long.gih');chips=brushes('Damaged Paint.gih')
def stamp(im,mark,x,y,width,angle):
    mark=mark.resize((width,max(2,round(width*mark.height/mark.width))),Image.Resampling.LANCZOS)
    mark=mark.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    for dy in [-1024,0,1024]:
        for dx in [-1024,0,1024]:
            tile=Image.new('L',(1024,1024));tile.paste(mark,(x-mark.width//2+dx,y-mark.height//2+dy))
            im=ImageChops.lighter(im,tile)
    return im
for slug,name,kind,count,seed in [
 ('jagged-long-gashes','Jagged long gashes','cuts',10,104),
 ('hard-crossed-gashes','Hard crossed gashes','cuts',22,218),
 ('broken-paint-chips','Broken paint chips','chips',65,340),
 ('scraped-chipped-coating','Scraped chipped coating','both',32,470)]:
    rng=random.Random(seed);im=Image.new('L',(1024,1024))
    for i in range(count):
        pool=chips if kind=='chips' or (kind=='both' and i%3) else cuts
        mark=pool[rng.randrange(len(pool))]
        width=rng.randint(350,900) if pool is cuts else rng.randint(40,180)
        angle=rng.choice([0,0,0,35,-45,90])+rng.uniform(-9,9)
        im=stamp(im,mark,rng.randrange(1024),rng.randrange(1024),width,angle)
    save(hard(im,35,155),slug,name,'Scratches' if kind=='cuts' else 'Grunge',
        'https://opengameart.org/content/scratch-damaged-paint-brush','ElDuderino',
        f'Original CC0 damage brush marks; wrapped placement, seed {seed}; hard levels 35–155',sha(pack_raw),
        'https://opengameart.org/sites/default/files/scratch-damaged-paint-brush.zip')
# Different mixed damage recipes retain the originals separately.
mixes=[
 ('mixed-scored-paint','Mixed · Scored paint','scraped-and-cracked-paint','hard-crossed-gashes','subtract'),
 ('mixed-gashed-coating','Mixed · Gashed coating','torn-metal-coating','jagged-long-gashes','lighter'),
 ('mixed-grime-and-gashes','Mixed · Grime and gashes','weathered-grime','photographed-gashes','difference'),
 ('mixed-extreme-damage','Mixed · Extreme damage','flaked-rust-scan','scraped-chipped-coating','subtract')]
for slug,name,a,b,mode in mixes:
    im=getattr(ImageChops,mode)(images[a],images[b])
    if slug=='mixed-extreme-damage':im=ImageChops.subtract(im,images['hard-crossed-gashes'])
    contributors=[r for r in records if r['slug'] in [a,b]+(['hard-crossed-gashes'] if slug=='mixed-extreme-damage' else [])]
    sources=[r['source'] for r in contributors];hashes=[r['sourceSha256'] for r in contributors]
    save(hard(im,45,190),slug,name,'Grunge',sources,', '.join(r['author'] for r in contributors),
        f'Mixed originals: {a}, {b}; {mode} blend; hard levels 45–190',hashes)
# Reject exact duplicates and only remove generated, retired single files within this folder.
fingerprints={}
for rec in records:
    if rec['outputSha256'] in fingerprints:raise ValueError('Duplicate: '+rec['name'])
    fingerprints[rec['outputSha256']]=rec['name']
new_slugs={r['slug'] for r in records}
for rec in old:
    if rec['slug'] not in new_slugs:
        target=(folder/(rec['slug']+'.webp')).resolve()
        if target.parent!=folder.resolve():raise ValueError('Unsafe asset path')
        if target.exists():target.unlink()
manifest.write_text(json.dumps(records,indent=2)+'\n')
(root/'src/js/ui/texture-workshop-library.js').write_text('/* Curated CC0 damage assets. Generated by scripts/texture-workshop.py. */\nconst TX_WORKSHOP='+json.dumps(records,indent=2)+';\n')

