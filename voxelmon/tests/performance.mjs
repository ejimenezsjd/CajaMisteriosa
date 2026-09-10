export async function runPerformance(browser, origin) {
  const page=await browser.newPage();
  try {
    await page.goto(origin+'/tests/fixture.html');
    await page.evaluate(async()=>{
      const {defaultState,SAVE_KEY}=await import('../js/state.js');
      const {createMonster}=await import('../js/data.js?v=15');
      const s=defaultState(170753942);s.team=[createMonster('emberin',30)];
      localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    });
    await page.goto(origin+'/index.html');await page.waitForFunction(()=>!!window.__vm);await page.click('#btn-continue');
    await page.waitForFunction(()=>__vm.mode==='play',{},{timeout:60000});
    await page.evaluate(()=>{
      for(let i=2;i<=5;i++){__vm.regionSystem.openGate('region_'+i);__vm.progression.unlock('region_'+i+'_path_unlocked');}
      const h=__vm.regionSystem.homeGym(),s=__vm.world.structures.candidate('gym_tide',h.cellX,h.cellZ);
      __vm.progression.unlock('gym_5_path_unlocked');
      __vm.player.pos.set(s.x+0.5,s.y+2,s.z-14.5);__vm.player.vel.set(0,0,0);
    });
    await page.waitForTimeout(5000);
    await page.evaluate(()=>{
      const w=__vm.world;
      window.perf={writes:0,same:0,dirty:0,writeMs:0,updates:0,updateMs:0,generations:0,generationMs:0,stamps:0,stampingMs:0,sources:{}};
      const set=w.setBlock.bind(w),dirty=w.markDirty.bind(w),update=w.update.bind(w),generate=w.generateChunkData.bind(w),stamp=w.structures.stampChunk.bind(w.structures);
      w.setBlock=(x,y,z,b)=>{const t=performance.now();perf.writes++;if(w.getBlock(x,y,z)===b)perf.same++;const r=set(x,y,z,b);perf.writeMs+=performance.now()-t;return r;};
      w.markDirty=(...a)=>{perf.dirty++;return dirty(...a);};
      w.update=(...a)=>{const t=performance.now();const r=update(...a);perf.updates++;perf.updateMs+=performance.now()-t;return r;};
      w.generateChunkData=(...a)=>{const t=performance.now();const r=generate(...a);perf.generations++;perf.generationMs+=performance.now()-t;return r;};
      w.structures.stampChunk=(...a)=>{const t=performance.now();const r=stamp(...a);perf.stamps++;perf.stampingMs+=performance.now()-t;return r;};
    });
    await page.waitForTimeout(2000);
    return await page.evaluate(()=>({scene:'Gym5, seed 170753942, 2s stationary after 5s settling',...perf,position:__vm.debug.pos(),gpu:'not measured; headless rendering is not a GPU benchmark'}));
  } finally {await page.close();}
}
