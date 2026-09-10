import * as THREE from 'three';
import { World, B, CHUNK } from '../js/world.js';
import { regions, getRegionAt, REGIONS, REGION_GEOMETRY } from '../js/regions.js';
import { STRUCTURE_TYPES } from '../js/structures.js';
import { defaultState, migrateSave, persistSave, loadSave, SAVE_VERSION } from '../js/state.js';
import { gyms, GYMS } from '../js/gyms.js';
import { trainers, TRAINERS } from '../js/trainers.js';
import { progression } from '../js/progression.js';

export async function run() {
  const checks = [], metrics = [], snapshots = [];
  const check = (name, pass, detail) => checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const hash = data => { let h=2166136261; for(const b of data) h=Math.imul(h^b,16777619); return h>>>0; };
  const setup = state => { progression.attach(state); trainers.attach(state); gyms.attach(state); gyms.setProgression(progression); };
  for (const g of Object.values(GYMS)) {
    const s=defaultState(1); setup(s);
    check(`${g.id}: leader blocked before requirements`, !trainers.canBattle(g.leader).ok);
    s.gyms[g.id].puzzleSolved=true;
    for(const t of g.trainers) s.trainers.defeated[t]=true;
    check(`${g.id}: path remains mandatory`, !trainers.canBattle(g.leader).ok);
    for(const u of g.requirements.progression) progression.unlock(u);
    s.gyms[g.id].puzzleSolved=false;
    check(`${g.id}: puzzle remains mandatory`, !trainers.canBattle(g.leader).ok);
    s.gyms[g.id].puzzleSolved=true;
    for(const t of g.trainers) {
      delete s.trainers.defeated[t];
      check(`${g.id}: requires ${t}`, !trainers.canBattle(g.leader).ok);
      s.trainers.defeated[t]=true;
    }
    check(`${g.id}: authorized`, trainers.canBattle(g.leader).ok);
    let money=0; trainers.setRewardHandler(n=>money+=n);
    const first=gyms.resolveLeaderVictory(g.leader), second=gyms.resolveLeaderVictory(g.leader);
    check(`${g.id}: reward once`, first===TRAINERS[g.leader].rewardMoney && second===0 && money===first);
    check(`${g.id}: badge and hook`, progression.hasBadge(g.badgeId) && g.rewards.unlocks.every(u=>progression.isUnlocked(u)));
    check(`${g.id}: no repeat battle`, !trainers.canBattle(g.leader).ok);
  }
  const regional = Object.keys(STRUCTURE_TYPES).filter(t=>!['gym','settlement','camp','ruin','healing_shrine'].includes(t));
  for(const seed of [170753942,12345,987654321]) {
    const s=defaultState(seed); regions.attach(s);
    let w=new World(new THREE.Scene(),seed); const h=regions.ensureHome();
    check(`${seed}: home resolves`, !!h);
    if(!h) continue;
    const capture=()=>regional.map(t=>w.structures.candidate(t,h.cellX,h.cellZ));
    const before=capture();
    check(`${seed}: all campaign structures resolve`,before.every(Boolean));
    check(`${seed}: all structures own home cell`,before.every(c=>c?.cellX===h.cellX&&c?.cellZ===h.cellZ));
    for(const [id,offset] of [['region_2',REGION_GEOMETRY.settlement],['region_3',REGION_GEOMETRY.miningCamp],['region_4',REGION_GEOMETRY.cliffOutpost],['region_5',REGION_GEOMETRY.azurePort]])
      check(`${seed}: canonical ${id}`,getRegionAt(h.x+offset.dx,h.z+offset.dz)===id);
    const secondary=[];
    for(let z=-4;z<=4;z++)for(let x=-4;x<=4;x++) {
      if(x===h.cellX&&z===h.cellZ)continue;
      if(w.structures.candidate('gym',x,z))secondary.push([x,z]);
    }
    const copies=secondary.flatMap(([x,z])=>regional.map(t=>w.structures.candidate(t,x,z)).filter(Boolean));
    check(`${seed}: no secondary campaign copies`,copies.length===0,{copies:copies.length,secondaryGyms:secondary.length});
    const target=before.find(s=>s.type==='gym_tide');
    const cx=Math.floor(target.x/CHUNK),cz=Math.floor(target.z/CHUNK);
    const t0=performance.now(); const data=w.generateChunkData(cx,cz); const generationMs=performance.now()-t0;
    const stamp0=performance.now(); let stampCalls=0; w.structures.stampChunk(cx*CHUNK,cz*CHUNK,CHUNK,()=>stampCalls++); const stampingMs=performance.now()-stamp0;
    snapshots.push({seed,home:s.regions.home,structures:before,chunk:[cx,cz],hash:hash(data)});
    let dirty=0; const original=w.markDirty.bind(w); w.markDirty=(...args)=>{dirty++;original(...args);};
    const x=target.x,y=target.y+1,z=target.z;
    const old=w.getBlock(x,y,z); for(const c of w.chunks.values())c.dirty=false;
    const start=performance.now(); for(let i=0;i<1000;i++)w.setBlock(x,y,z,old);
    const writeMs=performance.now()-start;
    check(`${seed}: unchanged writes do not dirty`,dirty===0,{dirty});
    w.setBlock(x,y,z,B.WOOD); w.setBlock(x+1,y,z,B.AIR);
    s.edits=w.edits; persistSave(s); const loaded=loadSave();
    check(`${seed}: save version unchanged`,loaded.version===SAVE_VERSION&&SAVE_VERSION===2);
    regions.attach(loaded); w=new World(new THREE.Scene(),seed,loaded.edits); const again=regions.ensureHome(9000,-9000);
    check(`${seed}: reload preserves home`,equal(h,again));
    check(`${seed}: reload preserves structures`,equal(before,capture()));
    check(`${seed}: placed edit survives reload`,w.getBlock(x,y,z)===B.WOOD);
    check(`${seed}: removed edit survives reload`,w.getBlock(x+1,y,z)===B.AIR);
    const editedHash=hash(w.ensureChunkData(cx,cz).data);
    w.viewRadius=0; const update0=performance.now(); w.update(9000,9000,1); const updateMs=performance.now()-update0;
    check(`${seed}: actual far update unloads chunk`,!w.chunks.has(`${cx},${cz}`));
    check(`${seed}: chunk reload hash`,hash(w.ensureChunkData(cx,cz).data)===editedHash);
    check(`${seed}: travel preserves home`,equal(h,regions.homeGym()));
    metrics.push({seed,generationMs,stampingMs,stampCalls,unchangedWrites:1000,dirtyCalls:dirty,writeMs,updateMs});
  }
  for(const raw of [{seed:12345},{seed:12345,version:1},{seed:12345,version:2},{seed:12345,version:2,gyms:{gym_tide:{puzzleSolved:true,tides:{a:2,b:0,c:1}}}}]) {
    const s=migrateSave(structuredClone(raw)); const once=JSON.stringify(s); migrateSave(s);
    check(`migration ${JSON.stringify(raw)} idempotent`,JSON.stringify(s)===once);
    regions.attach(s); new World(new THREE.Scene(),s.seed,s.edits); const h=regions.ensureHome();
    check(`migration ${raw.version??'missing'} deterministic missing home`,!!h&&equal(h,regions.ensureHome()));
  }
  check('no region 6',!REGIONS.region_6);
  return {checks,metrics,snapshots};
}
