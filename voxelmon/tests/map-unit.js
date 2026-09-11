import * as THREE from 'three';
import {worldMap as map, MAP_MARKERS} from '../js/map.js';
import {mapServices,mapScale} from '../js/map-symbols.js';
import {World} from '../js/world.js';
import {Player} from '../js/player.js';
import {defaultState,migrateSave,SAVE_VERSION} from '../js/state.js';
import {regions,REGION_GEOMETRY} from '../js/regions.js';
import {STRUCTURE_TYPES} from '../js/structures.js';
import {events} from '../js/events.js';
import {gyms} from '../js/gyms.js';
import {progression} from '../js/progression.js';

export async function runMapUnits(){
  const checks=[];const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
  const canvas=document.createElement('canvas'),wrap=document.createElement('div');wrap.style.cssText='width:1200px;height:600px';canvas.style.cssText='width:100%;height:100%';wrap.append(canvas);document.body.append(wrap);map.bindCanvas(canvas);
  let state,world,player;
  const setup=()=>{state=defaultState(170753942);regions.attach(state);world=new World(new THREE.Scene(),state.seed);regions.ensureHome();gyms.attach(state);progression.attach(state);map.attach(state,world);player=new Player(8.5,20,8.5);map.pollPlayer(player);map.show();return state;};
  const paint=zoom=>{map.zoom=zoom;map.invalidate();map.draw();};
  setup();
  const ctx=map.ctx,rotate=ctx.rotate;let observed=null;ctx.rotate=function(angle){observed=angle;return rotate.call(this,angle);};
  for(const [yaw,cardinal,x,z] of [[0,'N',0,-1],[Math.PI/2,'O',-1,0],[Math.PI,'S',0,1],[-Math.PI/2,'E',1,0]]){
    player.yaw=yaw;observed=null;map.pollPlayer(player);map.invalidate();map.draw();const look=player.lookDir();
    check('heading '+cardinal,observed!==null&&Math.abs(Math.sin(observed)-look.x)<1e-9&&Math.abs(-Math.cos(observed)-look.z)<1e-9&&Math.abs(look.x-x)<1e-9&&Math.abs(look.z-z)<1e-9);
  }ctx.rotate=rotate;
  check('scale bar follows zoom in world blocks',[.05,.5,1.2,4,14].every(z=>{const s=mapScale(z);return Math.abs(s.pixels-s.blocks*z)<1e-9&&s.pixels>=40&&s.pixels<=100;}));
  setup();check('player fog remains 3x3',map.discoveredCount()===9);
  for(const [radius,count] of [[4,57],[6,121],[2,21]]){setup();const before=map.discoveredCount();const added=map.revealRadius(800,800,radius);check(`reveal radius ${radius}`,added===count&&map.discoveredCount()===before+count);}
  setup();state.map.markers['gym:test']={id:'gym:test',type:'gym',x:8.5,z:8.5};map.attach(state,world);map.pollPlayer(player);map.show();check('exists in map save is not discovery',!map.visibleMarkers.some(m=>m.id==='gym:test'));
  events.emit('structureDiscovered',{structureId:'gym:test',structureType:'gym',x:8.5,z:8.5});paint(2);check('discovery event makes marker visible',map.visibleMarkers.some(m=>m.id==='gym:test'));
  events.emit('structureDiscovered',{structureId:'camp:test',structureType:'camp',x:22,z:22});paint(.5);check('world zoom hides minor, retains gym',!map.visibleMarkers.some(m=>m.id==='camp:test')&&map.visibleMarkers.some(m=>m.id==='gym:test'));
  paint(2);check('region zoom hides minor',!map.visibleMarkers.some(m=>m.id==='camp:test'));paint(8);check('local zoom reveals minor',map.visibleMarkers.some(m=>m.id==='camp:test'));
  check('all 32 structure types classified',Object.keys(STRUCTURE_TYPES).length===32&&Object.keys(STRUCTURE_TYPES).every(k=>['MAJOR','MINOR','SERVICE','ROUTE','CHALLENGE'].includes(MAP_MARKERS[k]?.category)));
  check('hub hierarchy',MAP_MARKERS.azure_port.hierarchy==='CITY'&&MAP_MARKERS.settlement.hierarchy==='VILLAGE'&&MAP_MARKERS.mist_settlement.hierarchy==='VILLAGE'&&MAP_MARKERS.mining_camp.hierarchy==='OUTPOST'&&MAP_MARKERS.cliff_outpost.hierarchy==='OUTPOST');
  check('services use real NPC/layout anchors',[['settlement',3],['mist_settlement',2],['mining_camp',2],['cliff_outpost',2],['azure_port',3]].every(([type,n])=>mapServices({id:type,type,x:0,z:0}).length===n));
  setup();const h=regions.homeGym();
  for(const [rid,offset] of [['region_1',{dx:0,dz:0}],['region_2',REGION_GEOMETRY.settlement],['region_3',REGION_GEOMETRY.miningCamp],['region_4',REGION_GEOMETRY.cliffOutpost],['region_5',REGION_GEOMETRY.azurePort]]){
    player.pos.set(h.x+offset.dx,25,h.z+offset.dz);map.pollPlayer(player);
    if(rid==='region_1')check('R1 is known from the start',map.regionKnown(rid));
    else check(`${rid} not named or framed before discovery`,!map.regionKnown(rid)&&!map.frameRegion());
    regions.discover(rid,player.pos.x,player.pos.z);const before=JSON.stringify(state.map);const ok=map.frameRegion();map.draw();
    check(`${rid} known framing without revealing fog`,ok&&map.currentRegion()===rid&&JSON.stringify(state.map)===before);
  }
  const before=JSON.stringify(state.map);map.frameExplored();map.draw();const b=map.exploredBounds,a=map.worldToScreen(b.x0,b.z0),d=map.worldToScreen(b.x1,b.z1);
  check('explored framing fits known corridor',a.px>=0&&a.py>=0&&d.px<=map.width&&d.py<=map.height&&map.zoom<1.2);
  check('framing does not reveal R6 or mutate save',JSON.stringify(state.map)===before&&!state.regions.discovered.region_6);
  map.centerOnPlayer();check('player framing',map.panX===player.pos.x&&map.panZ===player.pos.z);
  map.onPointerDown({button:0,clientX:100,clientY:100});map.onPointerMove({clientX:200,clientY:170});map.onPointerUp();const pan=[map.panX,map.panZ];map.pollPlayer(player);map.draw();check('manual pan never auto recenters',map.panX===pan[0]&&map.panZ===pan[1]);
  const rect=canvas.getBoundingClientRect(),pointer={clientX:rect.left+200,clientY:rect.top+160,deltaY:-1};const point=map.worldFromEvent(pointer,rect);map.onWheel(pointer);const after=map.worldFromEvent(pointer,rect);check('zoom anchors mouse world point',Math.hypot(point.x-after.x,point.z-after.z)<1e-8);
  map.onPointerDown({...pointer,button:2});check('waypoint create via pointer',Math.hypot(state.map.waypoint.x-after.x,state.map.waypoint.z-after.z)<1e-8);
  map.setWaypoint(444,555);map.centerWaypoint();check('waypoint move and center',map.panX===444&&map.panZ===555);map.removeWaypoint();check('waypoint remove',state.map.waypoint===null);
  setup();events.emit('structureDiscovered',{structureId:'settlement:test',structureType:'settlement',x:10,z:10});paint(8);check('contextual legend includes visible hub/services',map.legend.includes('village')&&map.legend.includes('pc')&&map.legend.includes('heal')&&!map.legend.includes('challenge'));
  setup();events.emit('structureDiscovered',{structureId:'azure_port:test',structureType:'azure_port',x:10,z:10});paint(6);const services=map.visibleMarkers.filter(m=>m.type==='service');
  check('co-located services have distinct cartographic positions',services.length===3&&services.every((a,i)=>services.slice(i+1).every(b=>Math.hypot(a.px-b.px,a.py-b.py)>=27)));
  map.panX=10000;paint(8);check('offscreen content absent from legend',!map.legend.includes('village')&&!map.legend.includes('pc'));
  setup();const camp=world.structures.near(8,8,600).find(s=>s.type==='camp');state.stats.structuresDiscovered[camp.id]=true;state.map.discoveredCells[`${Math.floor(camp.x/16)},${Math.floor(camp.z/16)}`]={biomeId:camp.biome,regionId:'region_1'};
  const restored=migrateSave(JSON.parse(JSON.stringify(state)));map.attach(restored,world);check('old discovered missing type restored, old cells preserved',!!restored.map.markers[camp.id]&&typeof restored.map.discoveredCells[`${Math.floor(camp.x/16)},${Math.floor(camp.z/16)}`]==='object'&&SAVE_VERSION===2);
  map.pollPlayer(player);map.show();map.draw();const count=map.drawCount;for(let i=0;i<100;i++)map.draw();check('unchanged map skips rendering',map.drawCount===count);
  wrap.style.width='640px';wrap.style.height='320px';map.resize();map.draw();check('resize updates actual canvas',map.width===640&&map.height===320&&canvas.width===640*map.dpr);
  map.hide();wrap.remove();return checks;
}
