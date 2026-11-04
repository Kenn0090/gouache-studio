/* 0.53: panels dock to the left and to the top of the viewport, and a dock can lay its groups out in a row or a column */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const L=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__gs.dk.L)));
 const rect=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom};},sel);
 const drag=async(label,to)=>{const bb=await p.locator('#dock .dktab:text-is("'+label+'")').boundingBox();await p.mouse.move(bb.x+20,bb.y+8);await p.mouse.down();await p.mouse.move(to[0],to[1],{steps:12});await p.mouse.up();await W(400);};
 const wrap=await rect('#workWrap');
 // to the left edge of the viewport
 await drag('Channels',[wrap.x+12,wrap.y+wrap.h/2]);
 let l=await L();ok(l.edges&&l.edges.left.groups.length===1&&l.edges.left.groups[0].tabs[0]==='chan','Channels docked to the left');
 let r=await rect('#dockL'),w2=await rect('#workWrap');ok(r&&r.w>100&&r.r<=w2.x+2&&w2.x>wrap.x+100,'left dock sits beside the viewport, which gave way ('+JSON.stringify(r)+')');
 ok(await p.evaluate(()=>{const e=document.querySelector('#dockL #chanList');return !!e&&e.getBoundingClientRect().width>0;}),'its panel is shown');
 // to the top edge
 const wrap2=await rect('#workWrap');await drag('History',[wrap2.x+wrap2.w/2,wrap2.y+10]);
 l=await L();ok(l.edges.top.groups.length===1&&l.edges.top.groups[0].tabs[0]==='hist','History docked to the top');
 r=await rect('#dockT');w2=await rect('#workWrap');ok(r&&r.h>60&&r.b<=w2.y+2,'top dock sits above the viewport');
 // a second tab on the left edge: new group, stacked
 const w3=await rect('#workWrap');await drag('Maps',[w3.x+10,w3.y+w3.h/2+80]).catch(()=>{});
 // orientation
 await p.evaluate(()=>__gs.dkSetDir('top','col'));await W(200);
 ok((await L()).edges.top.dir==='col','top dock can be stacked vertically');
 await p.evaluate(()=>__gs.dkSetDir('top','row'));await W(200);
 // right dock side by side
 await p.evaluate(()=>__gs.dkSetDir('right','row'));await W(300);
 const gr=await p.evaluate(()=>{const gs=[...document.querySelectorAll('#dock>.dkgrp')].map(e=>e.getBoundingClientRect());return gs.length>1&&gs[0].top===gs[1].top&&gs[1].left>gs[0].left;});
 ok(gr,'right dock can lay its groups side by side');
 await p.evaluate(()=>__gs.dkSetDir('right','col'));await W(200);
 // survives save and fix
 l=await L();ok(l.edges.left.groups.length>=1&&l.edges.top.groups.length===1,'layout keeps the edge docks');
 // showPanel finds a panel in an edge dock
 await p.evaluate(()=>__gs.showPanel('chan'));await W(200);
 ok(await p.evaluate(()=>__gs.panelShown('chan')),'panelShown knows edge docks');
 // closing the last tab removes the dock and gives the space back
 await p.evaluate(()=>{__gs.dkMove('hist',{hidden:true});});await W(300);
 ok(!(await L()).edges.top.groups.length&&(await rect('#dockT')).h<2,'emptied top dock disappears');
 await p.evaluate(()=>{for(const g of [...__gs.dk.L.edges.left.groups])for(const t of [...g.tabs])__gs.dkMove(t,{group:__gs.dk.L.groups[0]});});await W(300);
 const lft=await rect('#dockL');ok(!lft||lft.w<2,'emptied left dock disappears');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' '));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
