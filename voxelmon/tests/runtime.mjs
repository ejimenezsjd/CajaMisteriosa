// Integration checks use the shipped UI and battle entry points. Teleports and
// prepared saves isolate prerequisites; they are not a full campaign playthrough.
export async function runRuntime(browser, origin) {
  const checks=[], metrics=[], harnessWarnings=[];
  const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
  const boot=async(kind='current')=>{
    const page=await browser.newPage();
    page.on('pageerror',e=>{
      if(e.name==='NotAllowedError' && /pointer lock/i.test(e.message)) harnessWarnings.push(String(e));
      else check(`${kind}: pageerror`,false,String(e));
    });
    await page.goto(origin+'/tests/fixture.html');
    if(kind!=='new') await page.evaluate(async kind=>{
      const {defaultState,SAVE_KEY}=await import('../js/state.js');
      const {createMonster}=await import('../js/data.js?v=15');
      const s=defaultState(170753942);s.team=[createMonster('emberin',30)];
      if(kind==='v1'||kind==='v2') {s.version=kind==='v1'?1:2;delete s.regions;delete s.gyms;delete s.creatureStorage;}
      if(kind==='postF14') {s.gyms.gym_tide.puzzleSolved=true;s.gyms.gym_tide.tides={a:2,b:0,c:1};s.progression.badges.tide_badge=true;s.progression.unlocked.region_6_path_unlocked=true;}
      localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    },kind);
    await page.goto(origin+'/index.html');
    await page.waitForFunction(()=>!!window.__vm);
    if(kind==='new') {await page.click('#btn-new');await page.locator('#starter-cards button').first().click();}
    else await page.click('#btn-continue');
    await page.waitForFunction(()=>window.__vm?.mode==='play',{},{timeout:60000});
    check(`${kind}: boots`,await page.evaluate(()=>!!window.__vm.player&&!!window.__vm.regionSystem.homeGym()));
    return page;
  };
  try {
  for(const kind of ['new','v1','v2','postF14','current']) {
    const p=await boot(kind);
    if(kind==='postF14')check('postF14: open sea gate restores',await p.evaluate(()=>{const g=__vm.debug.seaGate();return g.unlocked&&g.block===0;}));
    await p.close();
  }
  const p=await boot();
  // Real key bindings and panels (pointer lock intentionally not required).
  for(const [key,mode] of [['i','inventory'],['k','dex'],['Tab','dex'],['m','map']]) {
    await p.keyboard.press(key);check(`${key}: opens ${mode}`,await p.evaluate(m=>__vm.mode===m,mode));
    await p.keyboard.press('Escape');
  }
  const smoke=await p.evaluate(async()=>{
    const v=__vm,out=[];const c=(name,pass)=>out.push({name,pass:!!pass});
    const {SPECIES,DEX_ORDER}=await import('./js/data.js?v=15');
    const {B}=await import('./js/world.js');
    v.inventory.add('apricorn',3);v.inventory.add('copper',1);v.progression.unlock('basic_crafting_unlocked');
    const n=v.inventory.count('balls');const craft=v.craftingSystem.craft('recipe_capture_cube');c('crafting consumes/produces',craft.ok&&v.inventory.count('balls')===n+1&&v.inventory.count('apricorn')===0);
    v.economySystem.grantMoney(100);const money=v.state.money;const buy=v.economySystem.buy('balls',1);c('economy purchase',buy.ok&&v.state.money===money-40);
    c('inventory rejects overdraft',!v.inventory.remove('balls',999999));
    const mon=v.createMonster('gotita',8);mon.hp=7;v.creatureStorage.receiveCapture(mon);const uid=mon.uid;
    v.creatureStorage.deposit(uid);c('PC preserves instance and HP',v.creatureStorage.box().includes(mon)&&mon.hp===7);
    v.creatureStorage.withdraw(uid);c('PC withdrawal',v.state.team.includes(mon)&&mon.uid===uid);
    const evolving=v.createMonster('emberin',4);v.gainXp(evolving,100);c('evolution',evolving.speciesId!=='emberin');
    v.dex.markSeen('mariscol');c('boss seen not caught',v.state.dex.seen.mariscol&&!v.state.dex.caught.mariscol);
    c('Dex catalog metadata',DEX_ORDER.length===Object.keys(SPECIES).length&&Object.values(SPECIES).filter(s=>s.obtainable!==false).length===v.dex.snapshot().obtainable);
    c('wild spawning',v.spawner.creatures.length>0||!!v.spawner.pickSpecies('plains',10,1,'region_1'));
    const h=v.regionSystem.homeGym();
    c('closed region gate blocks hover',!v.buildAssist.canMoveTo(h.x,h.z+50,h.x,h.z+70).ok);
    v.buildAssist.hovering=true;c('hover blocks critical interaction',v.buildAssist.blocksInteraction({type:'npc'})&&v.buildAssist.blocksInteraction({type:'seal'}));v.buildAssist.hovering=false;
    c('open sea gate initially closed',!v.debug.seaGate().unlocked&&v.debug.seaGate().block!==B.AIR);
    c('Gym5 hover exclusion',!!v.debug.gym5().hoverBlocked);
    const before=Object.keys(v.state.map.discoveredCells).length;v.mapSystem.revealRadius(h.x,h.z,2,'test');c('map fog expands',Object.keys(v.state.map.discoveredCells).length>=before);
    return out;
  });checks.push(...smoke);
  // PC terminal is reached through proximity + E, not the management helper.
  await p.evaluate(()=>{__vm.debug.gotoSettlement();});
  await p.waitForFunction(()=>__vm.debug.interaction()?.type==='pc',{},{timeout:15000});
  await p.keyboard.press('e');check('PC terminal E opens storage',await p.evaluate(()=>__vm.mode==='pc'));await p.keyboard.press('Escape');
  const physical=await p.evaluate(async()=>{
    const v=__vm,{GYMS}=await import('./js/gyms.js'),{persistSave}=await import('./js/state.js');
    const g=GYMS.gym_tide;for(const u of g.requirements.progression)v.progression.unlock(u);
    for(const t of g.trainers)v.trainerSystem.resolveVictory(t);
    v.gymSystem.cycleBasin(g.id,'a');v.gymSystem.cycleBasin(g.id,'a');v.gymSystem.cycleBasin(g.id,'c');
    v.gymSystem.resolveLeaderVictory(g.leader);const gate=v.debug.seaGate();
    const home=v.regionSystem.homeGym(),s=v.world.structures.candidate('gym_tide',home.cellX,home.cellZ);
    v.events.emit('structureDiscovered',{structureId:s.id,structureType:s.type,x:s.x,y:s.y,z:s.z,name:s.name});
    // Edits outside the protected progression footprints: place and mine.
    v.world.setBlock(home.x+40,40,home.z+40,5);v.world.setBlock(home.x+41,10,home.z+40,0);
    v.state.edits=v.world.edits;persistSave(v.state);
    return {open:gate.unlocked&&gate.block===0,marker:!!v.state.map.markers[s.id],home:{x:home.x,z:home.z}};
  });
  check('badge opens physical sea gate',physical.open);check('discovery creates Gym5 marker',physical.marker);
  await p.reload();await p.waitForFunction(()=>!!window.__vm);await p.click('#btn-continue');await p.waitForFunction(()=>__vm.mode==='play');
  check('game reload retains player edits and puzzle',await p.evaluate(h=>__vm.world.getBlock(h.x+40,40,h.z+40)===5&&__vm.world.getBlock(h.x+41,10,h.z+40)===0&&__vm.state.gyms.gym_tide.puzzleSolved,physical.home));
  check('game reload retains open gate',await p.evaluate(()=>__vm.debug.seaGate().block===0));
  await p.close();

  const gymIds=['gym_verdant','gym_mist','gym_crimson','gym_gale','gym_tide'];
  for(const gymId of gymIds) {
    const page=await boot();
    await page.evaluate(async id=>{
      const {GYMS}=await import('./js/gyms.js');const v=__vm,g=GYMS[id];window.testGym=g;
      // Bypass travel only. The gym's path, trainers and puzzle remain unmet.
      for(let i=2;i<=5;i++){v.regionSystem.openGate('region_'+i);v.progression.unlock('region_'+i+'_path_unlocked');}
      const h=v.regionSystem.homeGym(),s=id==='gym_verdant'?h:v.world.structures.candidate(id,h.cellX,h.cellZ);
      v.npcSystem.sync(s.x,s.z);
      const npc=[...v.npcSystem.active.values()].find(n=>n.trainerId===g.leader);
      const it=v.interactionSystem.items.get('npc:'+npc.id);
      v.player.pos.set(it.x,it.y-1,it.z+0.2);v.player.vel.set(0,0,0);
    },gymId);
    check(`${gymId}: E targets leader`,await page.evaluate(()=>__vm.debug.interaction()?.id.endsWith(testGym.leader)));
    await page.evaluate(()=>{__vm.buildAssist.mode=true;__vm.buildAssist.hovering=true;});
    await page.keyboard.press('e');
    check(`${gymId}: hover cannot interact`,await page.evaluate(()=>__vm.mode==='play'));
    await page.evaluate(()=>{__vm.buildAssist.mode=false;__vm.buildAssist.hovering=false;});
    await page.keyboard.press('e');
    await page.locator('#dialogue-options button').filter({hasText:/Combatir|Desafiar|combatir|desafiar/}).first().click();
    await page.waitForTimeout(120);
    check(`${gymId}: E/dialogue refuses unmet requirements`,await page.evaluate(()=>__vm.mode!=='battle'));
    if(gymId==='gym_tide'&&process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/f145-gym5-blocked.png'});
    await page.evaluate(()=>__vm.dialogueSystem.close());
    await page.evaluate(()=>__vm.debug.startTrainerBattle(testGym.leader));
    check(`${gymId}: direct entry also refuses`,await page.evaluate(()=>__vm.mode==='play'));
    await page.evaluate(()=>{
      const v=__vm,g=testGym;for(const u of g.requirements.progression)v.progression.unlock(u);
      v.state.gyms[g.id].puzzleSolved=true;for(const id of g.trainers)v.trainerSystem.resolveVictory(id);
    });
    await page.evaluate(()=>{__vm.buildAssist.mode=true;__vm.buildAssist.hovering=true;__vm.debug.startTrainerBattle(testGym.leader);});
    check(`${gymId}: authorized leader still refuses build mode`,await page.evaluate(()=>__vm.mode==='play'));
    await page.evaluate(()=>{
      const v=__vm,g=testGym;v.buildAssist.mode=false;v.buildAssist.hovering=false;
      v.npcSystem.talk([...v.npcSystem.active.values()].find(n=>n.trainerId===g.leader));
    });
    await page.locator('#dialogue-options button').filter({hasText:/Combatir|Desafiar|combatir|desafiar/}).first().click();
    await page.waitForFunction(()=>__vm.mode==='battle');
    check(`${gymId}: authorized dialogue starts real Battle`,await page.evaluate(()=>__vm.debug.battleContext()?.trainerId===testGym.leader));
    if(gymId==='gym_tide'&&process.env.SCREENSHOT_DIR) await page.screenshot({path:process.env.SCREENSHOT_DIR+'/f145-gym5-authorized.png'});
    await page.close();
  }
  const capture=await boot();
  await capture.evaluate(()=>{
    const v=__vm;v.debug.fillParty(6);v.debug.despawnAllWild();v.debug.spawnSpecies('fosmar',8);
    v.debug.inspectNearest();window.capturePcBefore=v.creatureStorage.storageSize();
  });
  check('uncaught tooltip',await capture.locator('#inspect-status').textContent()==='○ NO CAPTURADO');
  await capture.evaluate(()=>{const v=__vm;window.originalRandom=Math.random;Math.random=()=>0;v.startBattle(v.spawner.creatures[0]);});
  await capture.waitForFunction(()=>__vm.mode==='battle');
  await capture.locator('#battle-actions button').filter({hasText:/Cubo/}).click();
  await capture.waitForFunction(()=>__vm.mode==='play',{},{timeout:20000});
  check('real wild capture overflows to PC',await capture.evaluate(()=>{
    Math.random=window.originalRandom;
    return __vm.state.team.length===6&&__vm.creatureStorage.storageSize()===window.capturePcBefore+1&&!!__vm.state.dex.caught.fosmar;
  }));
  await capture.evaluate(()=>{__vm.debug.despawnAllWild();__vm.debug.spawnSpecies('fosmar',8);__vm.debug.inspectNearest();});
  check('caught tooltip',await capture.locator('#inspect-status').textContent()==='✓ CAPTURADO');
  await capture.close();
  const boss=await boot();
  await boss.evaluate(()=>{__vm.progression.setFlag('lighthouse_signal');__vm.bossSystem.activateReefSeal();__vm.debug.startBossBattle('reef_guardian');});
  await boss.waitForFunction(()=>__vm.mode==='battle');
  await boss.locator('#battle-actions button').filter({hasText:/Huir/}).waitFor();
  check('boss real battle and Dex seen',await boss.evaluate(()=>__vm.debug.battleContext()?.bossId==='reef_guardian'&&__vm.state.dex.seen.mariscol&&!__vm.state.dex.caught.mariscol));
  check('boss capture and flee disabled',await boss.locator('#battle-actions button').filter({hasText:/Cubo/}).isDisabled()&&await boss.locator('#battle-actions button').filter({hasText:/Huir/}).isDisabled());
  await boss.close();
  } catch(error) {check('runtime completion',false,error.stack??String(error));}
  return {checks,metrics,harnessWarnings};
}
