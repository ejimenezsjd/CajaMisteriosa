import {resolve} from 'node:path';

/** Prepared exploration history, real UI. Screenshots are fixtures, not new discoveries. */
export async function runMapRuntime(browser,origin,output){
  const checks=[],errors=[],warnings=[];const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
  const p=await browser.newPage({viewport:{width:1280,height:720}});
  p.on('pageerror',e=>{if(e.name==='NotAllowedError'&&/pointer lock/i.test(e.message))warnings.push(String(e));else errors.push(String(e));});
  try{
    await p.goto(origin+'/tests/fixture.html');
    await p.evaluate(async()=>{
      const THREE=await import('three'),{World}=await import('../js/world.js'),{defaultState,SAVE_KEY}=await import('../js/state.js');
      const {regions,getRegionAt}=await import('../js/regions.js'),{createMonster}=await import('../js/data.js?v=15');
      const s=defaultState(170753942);regions.attach(s);const w=new World(new THREE.Scene(),s.seed);regions.ensureHome();const h=regions.homeGym();s.team=[createMonster('emberin',30)];s.pos={x:h.x+.5,y:h.y+2,z:h.z-20};
      const classic=new Set(['camp','ruin','healing_shrine','gym','settlement']);
      const initial=w.structures.near(8.5,8.5,800).filter(s=>s.type==='settlement').sort((a,b)=>Math.hypot(a.x-8.5,a.z-8.5)-Math.hypot(b.x-8.5,b.z-8.5))[0];
      const list=w.structures.near(h.x,h.z+500,700).filter(m=>!classic.has(m.type));list.unshift({x:8.5,z:8.5},initial,h);
      const distToSegment=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);};
      for(let z=-5;z<70;z++)for(let x=-4;x<33;x++){
        const point={x:x*16+8,z:z*16+8};
        const near=list.some(m=>Math.hypot(m.x-point.x,m.z-point.z)<36)||distToSegment(point,list[0],initial)<26||distToSegment(point,initial,h)<26;
        if(near)s.map.discoveredCells[`${x},${z}`]=w.biomeAt(point.x,point.z);
      }
      for(const m of list)if(m.id){s.stats.structuresDiscovered[m.id]=true;s.map.markers[m.id]={id:m.id,type:m.type,x:m.x,z:m.z,y:m.y};s.regions.discovered[getRegionAt(m.x,m.z)]=true;}
      // A real minor structure near the start for semantic level coverage.
      const camp=w.structures.near(h.x,h.z,130).find(m=>m.type==='camp');if(camp){s.stats.structuresDiscovered[camp.id]=true;s.map.markers[camp.id]={id:camp.id,type:camp.type,x:camp.x,z:camp.z};s.map.discoveredCells[`${Math.floor(camp.x/16)},${Math.floor(camp.z/16)}`]=camp.biome;}
      localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    });
    await p.goto(origin+'/index.html');await p.waitForFunction(()=>!!window.__vm);await p.click('#btn-continue');await p.waitForFunction(()=>__vm.mode==='play',{},{timeout:60000});
    await p.keyboard.press('m');await p.waitForFunction(()=>__vm.mode==='map');
    const frame=async(type,zoom=null)=>{
      await p.evaluate(({type,zoom})=>{const v=__vm,m=v.mapSystem,h=v.regionSystem.homeGym();let s=h;if(type!=='gym')s=v.world.structures.candidate(type,h.cellX,h.cellZ);v.player.pos.set(s.x+.5,s.y+2,s.z+.5);m.pollPlayer(v.player);m.frameRegion();if(zoom!==null){m.centerOnPlayer();m.zoom=zoom;m.invalidate();}m.draw();},{type,zoom});
      await p.waitForTimeout(80);
    };
    const shot=async name=>{if(output)await p.screenshot({path:resolve(output,name),timeout:60000});};
    const layout=async(label)=>check(label,await p.evaluate(()=>{
      const ids=['map-canvas','map-legend','map-region','btn-map-center','btn-map-region','btn-map-explored','btn-map-waypoint','btn-map-close'];
      return ids.every(id=>{const b=document.getElementById(id).getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5;});
    }));
    await p.click('#btn-map-explored');await shot('W1A-01-world.png');await layout('1280x720 controls, legend and canvas fit');
    await frame('mist_settlement');await p.click('#btn-map-region');await shot('W1A-02-region.png');
    check('region name visible from discovery',await p.locator('#map-region').textContent()==='Tierras Brumosas · Región 2');
    await frame('azure_port',6);await shot('W1A-03-local.png');check('local service legend in shipped UI',await p.locator('#map-legend').textContent().then(t=>['PC','Tienda','Curación'].every(s=>t.includes(s))));
    await frame('gym_mist',2.4);await shot('W1A-04-r2-fog.png');
    const fog=await p.evaluate(()=>JSON.stringify(__vm.state.map.discoveredCells));await p.click('#btn-map-explored');check('UI framing leaves fog unchanged',await p.evaluate(()=>JSON.stringify(__vm.state.map.discoveredCells))===fog);
    await frame('cliff_outpost');await shot('W1A-05-r4.png');
    await frame('azure_port');await shot('W1A-06-r5.png');
    await p.click('#btn-map-waypoint');const box=await p.locator('#map-canvas').boundingBox();await p.mouse.click(box.x+box.width*.63,box.y+box.height*.58);await p.click('#btn-map-waypoint-center');await shot('W1A-07-waypoint.png');
    check('waypoint UI centers selected destination',await p.evaluate(()=>{const m=__vm.mapSystem,w=__vm.state.map.waypoint;return !!w&&m.panX===w.x&&m.panZ===w.z;}));
    await p.click('#btn-map-waypoint-remove');check('waypoint removed through button',await p.evaluate(()=>__vm.state.map.waypoint===null));
    await p.setViewportSize({width:1920,height:1080});await p.click('#btn-map-explored');await p.waitForTimeout(100);await layout('1920x1080 controls, legend and canvas fit');await shot('W1A-09-1920.png');
    await p.setViewportSize({width:390,height:844});await frame('azure_port');await shot('W1A-08-small-screen.png');await layout('390x844 controls, legend and canvas fit');
    check('no region 6 discovery',await p.evaluate(()=>!__vm.state.regions.discovered.region_6));
    await p.keyboard.press('Escape');for(const [key,mode]of [['i','inventory'],['k','dex'],['Tab','dex'],['m','map']]){await p.keyboard.press(key);check(`${key} key remains ${mode}`,await p.evaluate(mode=>__vm.mode===mode,mode));await p.keyboard.press('Escape');}
    check('runtime console clean',errors.length===0,{errors,warnings});
  }finally{await p.close();}
  return {checks,errors};
}
