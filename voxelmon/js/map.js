/** Map V2 foundation. Save-compatible exploration; all camera/index state is UI only. */
import { events } from './events.js';
import { getRegionName, getRegionAt, regions } from './regions.js';
import { gyms } from './gyms.js';
import { progression } from './progression.js';
import { MAP_MARKERS, MAP_LEGEND, mapServices, semanticLevel, mapHeading, mapScale, drawMapSymbol } from './map-symbols.js';
export { MAP_MARKERS, mapHeading, semanticLevel, mapScale } from './map-symbols.js';
export const MAP_CELL = 16;
export const MAP_PALETTE = {
  plains:'#6db84a', forest:'#2f7a3a', desert:'#d4c078', snow:'#d8e4f0', mountain:'#8a8a94',
  beach:'#e2d08f', ocean:'#3a6fb0', mist_forest:'#4a6a62', crimson_highlands:'#8a3028',
  wind_highlands:'#7aa0c8', azure_archipelago:'#3a9aaa', unknown:'#1a1c24',
};
const REVEAL_RADIUS = { watchtower:4, storm_observatory:6, azure_lighthouse:2 };
const SECTOR = 256, MAX_ZOOM = 14;
export const cellKey = (cx,cz) => `${cx},${cz}`;
export const worldToCell = (x,z) => ({cx:Math.floor(x/MAP_CELL),cz:Math.floor(z/MAP_CELL)});
const sectorKey = (x,z) => cellKey(Math.floor(x/SECTOR),Math.floor(z/SECTOR));
const include = (b,x,z,size=0) => b ? {x0:Math.min(b.x0,x),z0:Math.min(b.z0,z),x1:Math.max(b.x1,x+size),z1:Math.max(b.z1,z+size)} : {x0:x,z0:z,x1:x+size,z1:z+size};
const overlaps = (a,b) => a.x1>=b.x0 && a.x0<=b.x1 && a.z1>=b.z0 && a.z0<=b.z1;
const finite = m => m && Number.isFinite(m.x) && Number.isFinite(m.z);

// Query occupied sectors rather than scanning the world or every saved marker.
function visitBuckets(index,bounds,visit) {
  const x0=Math.floor(bounds.x0/SECTOR),x1=Math.floor(bounds.x1/SECTOR),z0=Math.floor(bounds.z0/SECTOR),z1=Math.floor(bounds.z1/SECTOR);
  if ((x1-x0+1)*(z1-z0+1)>index.size) {
    for(const bucket of index.values()) if(overlaps(bucket.bounds,bounds)) visit(bucket.items);
  } else for(let z=z0;z<=z1;z++) for(let x=x0;x<=x1;x++) {const bucket=index.get(cellKey(x,z));if(bucket)visit(bucket.items);}
}
function indexItem(index,m) {
  const key=sectorKey(m.x,m.z);let bucket=index.get(key);
  if(!bucket){const x=Math.floor(m.x/SECTOR)*SECTOR,z=Math.floor(m.z/SECTOR)*SECTOR;bucket={bounds:{x0:x,z0:z,x1:x+SECTOR,z1:z+SECTOR},items:[]};index.set(key,bucket);}
  bucket.items.push(m);
}

class MapSystem {
  constructor() {
    this.data=null;this.world=null;this.state=null;this.open=false;this.panX=0;this.panZ=0;this.zoom=4;
    this.canvas=null;this.ctx=null;this.player=null;this.bound=false;this.drag=null;this.lastCell=null;
    this.width=0;this.height=0;this.dpr=1;this.dirty=true;this.icons=new Map();this.legendKey='';
    this.cellIndex=new Map();this.markerIndex=new Map();this.knownRegions=new Map();this.knownMarkers=new Set();
    this.exploredBounds=null;this.cellCount=0;this.markerDirty=true;this.visibleMarkers=[];this.legend=[];
    this.frameMode='player';this.placingWaypoint=false;this.drawCount=0;this.labelWidths=new Map();
  }
  invalidate(){this.dirty=true;}
  attach(state,world) {
    this.state=state;this.data=state.map;this.world=world;
    this.data.discoveredCells??={};this.data.markers??={};
    this.cellIndex.clear();this.knownRegions.clear();this.exploredBounds=null;this.cellCount=0;
    this.knownMarkers=new Set(Object.keys(state.stats?.structuresDiscovered??{}).filter(id=>state.stats.structuresDiscovered[id]));
    this.lastCell=null;this.player=null;this.drag=null;this.placingWaypoint=false;this.zoom=4;this.panX=0;this.panZ=0;
    this.legendKey='';this.markerDirty=true;this.open=false;
    for(const [key,value] of Object.entries(this.data.discoveredCells)) {
      const [cx,cz]=key.split(',').map(Number);if(Number.isFinite(cx)&&Number.isFinite(cz))this.indexCell(cx,cz,value);
    }
    // Restore only proven discoveries omitted by the old map registry. Never scan candidate world content.
    for(const id of this.knownMarkers) {
      if(this.data.markers[id])continue;
      const match=/^([^:]+):(-?\d+),(-?\d+)$/.exec(id);if(!match||!MAP_MARKERS[match[1]])continue;
      const s=world.structures?.candidate(match[1],Number(match[2]),Number(match[3]));
      if(s?.id===id)this.addMarker({structureId:id,structureType:s.type,x:s.x,y:s.y,z:s.z});
    }
    if(!this.bound){this.bindEvents();this.bound=true;}
    this.invalidate();
  }
  bindEvents() {
    events.on('structureDiscovered',p=>{this.addMarker(p);const r=REVEAL_RADIUS[p.structureType];if(r&&finite(p))this.revealRadius(p.x,p.z,r,p.structureType);});
    events.on('regionDiscovered',p=>{if(finite(p))this.revealAt(p.x,p.z);this.invalidate();});
    events.on('regionGateOpened',p=>{
      if(!this.data)return;
      for(const m of Object.values(this.data.markers))if((p.regionId==='region_2'&&m.type==='regional_gate')||(p.regionId==='region_4'&&m.type==='gym_crimson'))m.opened=true;
      this.invalidate();
    });
    for(const event of ['gymCompleted','badgeEarned','bossDefeated'])events.on(event,()=>this.invalidate());
  }
  bindCanvas(canvas) {
    this.resizeObserver?.disconnect();this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.resizeObserver=new ResizeObserver(()=>{if(this.open){this.resize();this.draw();}});
    this.resizeObserver.observe(canvas.parentElement);this.resize();
  }
  indexCell(cx,cz,value) {
    const x=cx*MAP_CELL,z=cz*MAP_CELL,biome=typeof value==='string'?value:value?.biomeId;
    const regionId=getRegionAt(x+8,z+8);
    indexItem(this.cellIndex,{x,z,biome,regionId});this.cellCount++;
    this.exploredBounds=include(this.exploredBounds,x,z,MAP_CELL);
    const r=this.knownRegions.get(regionId)??{bounds:null,anchor:{x:x+8,z:z+8}};
    r.bounds=include(r.bounds,x,z,MAP_CELL);this.knownRegions.set(regionId,r);
  }
  discoveredCount(){return this.cellCount;}
  approxSaveBytes(){try{return JSON.stringify(this.data).length;}catch{return 0;}}
  _revealCell(cx,cz) {
    const key=cellKey(cx,cz);if(this.data.discoveredCells[key])return 0;
    const biome=this.world.biomeAt(cx*MAP_CELL+8,cz*MAP_CELL+8);
    this.data.discoveredCells[key]=biome;this.indexCell(cx,cz,biome);this.invalidate();return 1;
  }
  revealAt(x,z,neighbors=true) {
    if(!this.data||!this.world)return 0;const {cx,cz}=worldToCell(x,z);let n=0;
    const r=neighbors?1:0;for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)n+=this._revealCell(cx+dx,cz+dz);
    return n;
  }
  revealRadius(x,z,radiusCells,source='tower') {
    if(!this.data||!this.world)return 0;const {cx,cz}=worldToCell(x,z),r=Math.max(1,radiusCells|0);let n=0;
    for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dz*dz<=r*r+1)n+=this._revealCell(cx+dx,cz+dz);
    if(n)events.emit('mapAreaRevealed',{source,centerX:x,centerZ:z,radius:r,newCells:n});return n;
  }
  addMarker(p) {
    if(!this.data||!p?.structureId||!MAP_MARKERS[p.structureType]||!finite(p))return;
    const prev=this.data.markers[p.structureId];
    this.knownMarkers.add(p.structureId);
    this.data.markers[p.structureId]={id:p.structureId,type:p.structureType,x:p.x,z:p.z,y:p.y,opened:prev?.opened??false};
    this.markerDirty=true;this.invalidate();
  }
  rebuildMarkers() {
    this.markerIndex.clear();
    for(const id of this.knownMarkers){const m=this.data.markers[id];if(!finite(m)||!MAP_MARKERS[m.type])continue;indexItem(this.markerIndex,m);}
    this.markerDirty=false;
  }
  cellKnown(x,z){const {cx,cz}=worldToCell(x,z);return !!this.data?.discoveredCells[cellKey(cx,cz)];}
  pollPlayer(player) {
    if(!player||!this.data)return;this.player=player;
    const signature=`${player.pos.x},${player.pos.z},${player.yaw}`;
    if(signature!==this.playerSignature){this.playerSignature=signature;this.invalidate();}
    const {cx,cz}=worldToCell(player.pos.x,player.pos.z),key=cellKey(cx,cz);
    if(key!==this.lastCell){this.lastCell=key;this.revealAt(player.pos.x,player.pos.z);}
    // Deliberately never alter panX/panZ while polling.
  }
  centerOnPlayer(){if(this.player){this.panX=this.player.pos.x;this.panZ=this.player.pos.z;this.frameMode='player';this.invalidate();}}
  fitBounds(b,mode) {
    if(!b)return false;
    this.panX=(b.x0+b.x1)/2;this.panZ=(b.z0+b.z1)/2;
    this.zoom=Math.min(MAX_ZOOM,Math.max(.000001,Math.min(Math.max(40,this.width-100)/Math.max(48,b.x1-b.x0),Math.max(40,this.height-100)/Math.max(48,b.z1-b.z0))));
    this.frameMode=mode;this.invalidate();return true;
  }
  frameExplored(){return this.fitBounds(this.exploredBounds,'explored');}
  currentRegion(){return this.player?getRegionAt(this.player.pos.x,this.player.pos.z):null;}
  regionKnown(id){return !!id&&!!this.state?.regions?.discovered?.[id];}
  frameRegion(){const id=this.currentRegion();return this.regionKnown(id)&&this.fitBounds(this.knownRegions.get(id)?.bounds,'region');}
  minZoom(){const b=this.exploredBounds;if(!b)return .2;return Math.max(.000001,Math.min(.2,Math.min(Math.max(40,this.width-100)/(b.x1-b.x0+64),Math.max(40,this.height-100)/(b.z1-b.z0+64))*.8));}
  show(){this.open=true;this.centerOnPlayer();this.resize();this.draw();}
  hide(){this.open=false;this.drag=null;this.placingWaypoint=false;this.canvas?.classList.remove('placing');}
  resize() {
    if(!this.canvas)return;
    const r=this.canvas.parentElement.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height)),dpr=Math.min(window.devicePixelRatio||1,2);
    if(w===this.width&&h===this.height&&dpr===this.dpr)return;
    this.width=w;this.height=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
    if(this.frameMode==='explored')this.frameExplored();else if(this.frameMode==='region')this.frameRegion();
    this.invalidate();
  }
  worldToScreen(x,z,w=this.width,h=this.height){return {px:w/2+(x-this.panX)*this.zoom,py:h/2+(z-this.panZ)*this.zoom};}
  screenToWorld(px,py,w=this.width,h=this.height){return {x:this.panX+(px-w/2)/this.zoom,z:this.panZ+(py-h/2)/this.zoom};}
  worldFromEvent(e,rect){return this.screenToWorld(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height);}
  onWheel(e) {
    if(!this.open)return;const rect=this.canvas.getBoundingClientRect();
    const x=Number.isFinite(e.clientX)?e.clientX-rect.left:this.width/2,y=Number.isFinite(e.clientY)?e.clientY-rect.top:this.height/2;
    const anchor=this.screenToWorld(x,y);this.zoom=Math.max(this.minZoom(),Math.min(MAX_ZOOM,this.zoom*(e.deltaY>0?.9:1.1)));
    this.panX=anchor.x-(x-this.width/2)/this.zoom;this.panZ=anchor.z-(y-this.height/2)/this.zoom;this.frameMode='manual';this.invalidate();this.draw();
  }
  beginWaypoint(){this.placingWaypoint=!this.placingWaypoint;this.canvas?.classList.toggle('placing',this.placingWaypoint);this.invalidate();this.draw();}
  setWaypoint(x,z){if(this.data&&Number.isFinite(x)&&Number.isFinite(z)){this.data.waypoint={x,z};this.placingWaypoint=false;this.canvas?.classList.remove('placing');this.invalidate();}}
  removeWaypoint(){if(this.data){this.data.waypoint=null;this.invalidate();}}
  centerWaypoint(){if(finite(this.data?.waypoint)){this.panX=this.data.waypoint.x;this.panZ=this.data.waypoint.z;this.frameMode='manual';this.invalidate();}}
  onPointerDown(e) {
    if(!this.open)return;
    if(e.button===2||this.placingWaypoint){const p=this.worldFromEvent(e,this.canvas.getBoundingClientRect());this.setWaypoint(p.x,p.z);this.draw();return;}
    if(e.button!==0)return;
    this.drag={x:e.clientX,y:e.clientY,panX:this.panX,panZ:this.panZ};this.frameMode='manual';
    if(e.pointerId!=null)this.canvas.setPointerCapture?.(e.pointerId);
  }
  onPointerMove(e){if(!this.open||!this.drag)return;this.panX=this.drag.panX-(e.clientX-this.drag.x)/this.zoom;this.panZ=this.drag.panZ-(e.clientY-this.drag.y)/this.zoom;this.invalidate();this.draw();}
  onPointerUp(){this.drag=null;}
  icon(name) {
    if(!this.icons.has(name)){
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const c=canvas.getContext('2d');c.scale(2,2);c.translate(16,16);
      c.fillStyle='#182d36';c.beginPath();c.arc(0,0,14,0,Math.PI*2);c.fill();drawMapSymbol(c,name);
      this.icons.set(name,{canvas,url:canvas.toDataURL()});
    }
    return this.icons.get(name);
  }
  syncUI(legend,level) {
    const id=this.currentRegion(),known=this.regionKnown(id);
    const label=document.getElementById('map-region');if(label)label.textContent=known?`${getRegionName(id)} · Región ${id.slice(-1)}`:'Territorio sin registrar';
    const regionButton=document.getElementById('btn-map-region');if(regionButton)regionButton.disabled=!known||!this.knownRegions.has(id);
    const view=document.getElementById('map-view');if(view)view.textContent=['Vista general','Vista regional','Vista local'][level];
    for(const button of ['btn-map-waypoint-center','btn-map-waypoint-remove']){const el=document.getElementById(button);if(el)el.disabled=!finite(this.data.waypoint);}
    const place=document.getElementById('btn-map-waypoint');if(place){place.setAttribute('aria-pressed',String(this.placingWaypoint));place.textContent=this.placingWaypoint?'Toca el mapa…':'Marcar destino';}
    const key=legend.join('|'),el=document.getElementById('map-legend');
    if(el&&key!==this.legendKey){
      el.replaceChildren();for(const name of legend){const item=document.createElement('span'),img=document.createElement('img');img.src=this.icon(name).url;img.alt='';item.append(img,document.createTextNode(MAP_LEGEND[name]));el.append(item);}
      this.legendKey=key;
    }
  }
  draw() {
    if(!this.open||!this.canvas||!this.ctx||!this.data||!this.dirty)return;
    this.dirty=false;this.drawCount++;if(this.markerDirty)this.rebuildMarkers();
    const c=this.ctx,w=this.width,h=this.height,z=this.zoom,level=semanticLevel(z);
    const bounds={x0:this.panX-w/(2*z),x1:this.panX+w/(2*z),z0:this.panZ-h/(2*z),z1:this.panZ+h/(2*z)};
    c.fillStyle='#101d27';c.fillRect(0,0,w,h);
    visitBuckets(this.cellIndex,bounds,items=>{for(const cell of items){if(cell.x+16<bounds.x0||cell.x>bounds.x1||cell.z+16<bounds.z0||cell.z>bounds.z1)continue;
      const p=this.worldToScreen(cell.x,cell.z);c.fillStyle=MAP_PALETTE[cell.biome]??MAP_PALETTE.unknown;c.globalAlpha=.7;c.fillRect(p.px,p.py,16*z+.2,16*z+.2);c.globalAlpha=1;
      if(level===2){c.strokeStyle='#ffffff0a';c.strokeRect(p.px,p.py,16*z,16*z);}
    }});
    const visible=[];const legend=new Set();
    visitBuckets(this.markerIndex,bounds,items=>{for(const m of items){const d=MAP_MARKERS[m.type];if(d.level>level||!this.cellKnown(m.x,m.z))continue;
      const p=this.worldToScreen(m.x,m.z);if(p.px<18||p.py<18||p.px>w-18||p.py>h-18)continue;
      visible.push({...m,...p,icon:d.icon,label:d.label,category:d.category,hierarchy:d.hierarchy,gymId:d.gymId});
      if(level===2)for(const service of mapServices(m)){if(!this.cellKnown(service.x,service.z))continue;const a=this.worldToScreen(service.x,service.z);if(a.px>=18&&a.py>=18&&a.px<=w-18&&a.py<=h-18)visible.push({...service,...a,category:'SERVICE'});}
    }});
    // Resolve symbol collisions in screen space. Leader lines preserve the real anchor;
    // this is cartographic displacement, never a change to saved/world coordinates.
    const occupied=[{x0:w-92,x1:w,z0:0,z1:96},{x0:0,x1:166,z0:h-48,z1:h}];
    const fits=box=>box.x0>=4&&box.x1<=w-4&&box.z0>=4&&box.z1<=h-4&&!occupied.some(b=>overlaps(b,box));
    const rendered=[];
    for(const m of visible){
      const size=m.type==='service'?25:m.hierarchy==='CITY'?34:30;
      const anchor={px:m.px,py:m.py};let position=null;
      for(const radius of [0,32,64,96]){
        for(let step=0;step<(radius?8:1);step++){
          const angle=step*Math.PI/4,px=anchor.px+Math.cos(angle)*radius,py=anchor.py+Math.sin(angle)*radius;
          const box={x0:px-size/2-2,x1:px+size/2+2,z0:py-size/2-2,z1:py+size/2+2};
          if(fits(box)){position={px,py,box};break;}
        }
        if(position)break;
      }
      if(!position)continue;
      occupied.push(position.box);m.px=position.px;m.py=position.py;m.anchor=anchor;rendered.push(m);
    }
    c.strokeStyle='#c8d4c080';c.lineWidth=1;
    for(const m of rendered){if(m.px===m.anchor.px&&m.py===m.anchor.py)continue;c.beginPath();c.moveTo(m.anchor.px,m.anchor.py);c.lineTo(m.px,m.py);c.stroke();}
    for(const m of rendered){const size=m.type==='service'?25:m.hierarchy==='CITY'?34:30;
      c.drawImage(this.icon(m.icon).canvas,m.px-size/2,m.py-size/2,size,size);legend.add(m.icon);
      if(m.gymId){const badge={gym_verdant:'verdant_badge',gym_mist:'mist_badge',gym_crimson:'crimson_badge',gym_gale:'gale_badge',gym_tide:'tide_badge'}[m.gymId];if(gyms.isCompleted(m.gymId)||progression.hasBadge(badge)){c.fillStyle='#e9f6d2';c.font='bold 14px sans-serif';c.fillText('✓',m.px+9,m.py-9);}}
      if(m.type==='regional_gate'){c.strokeStyle=m.opened||regions.isGateOpened('region_2')?'#b8e5a8':'#dba175';c.strokeRect(m.px-16,m.py-16,32,32);}
    }
    const label=(text,px,py,region=false)=>{
      c.font=region?'600 13px sans-serif':'600 12px sans-serif';
      const key=`${region}:${text}`;
      if(!this.labelWidths.has(key))this.labelWidths.set(key,c.measureText(text).width);
      const tw=this.labelWidths.get(key),width=tw+10;
      const offsets=region?[[-width-28,-10],[28,-10],[-width-64,-10],[64,-10],[-width/2,-44],[-width/2,42]]:[[-width/2,19],[21,-9],[-width-21,-9],[-width/2,-37],[-width/2,42],[44,-9],[-width-44,-9],[-width/2,-60]];
      for(const [dx,dy] of offsets){
        const box={x0:px+dx,x1:px+dx+width,z0:py+dy,z1:py+dy+19};
        if(!fits(box))continue;
        occupied.push(box);
        if(Math.abs(dx)>40||Math.abs(dy)>40){c.strokeStyle='#c8d4c060';c.lineWidth=1;c.beginPath();c.moveTo(px,py);c.lineTo(Math.max(box.x0,Math.min(box.x1,px)),box.z0+9);c.stroke();}
        c.fillStyle='#101d27ed';c.fillRect(box.x0,box.z0,width,19);c.fillStyle=region?'#cbdcc3':'#f0efe1';c.fillText(text,box.x0+5,box.z0+14);return;
      }
    };
    // Names require both known cells and the region discovery flag. They share
    // collision space with icons; no territory rectangle is ever revealed.
    if(level===0)for(const [id,r] of this.knownRegions){if(!this.regionKnown(id))continue;const p=this.worldToScreen(r.anchor.x,r.anchor.z);if(p.px>=0&&p.py>=0&&p.px<=w&&p.py<=h)label(getRegionName(id),p.px,p.py,true);}
    for(const hubsFirst of [true,false])for(const m of rendered){if(!!m.hierarchy!==hubsFirst||m.type==='service'||(level===0&&!m.hierarchy&&!m.gymId))continue;label(m.label,m.px,m.py);}
    if(finite(this.data.waypoint)){const p=this.worldToScreen(this.data.waypoint.x,this.data.waypoint.z);if(p.px>=16&&p.py>=16&&p.px<=w-16&&p.py<=h-16){c.drawImage(this.icon('waypoint').canvas,p.px-16,p.py-16,32,32);legend.add('waypoint');}}
    if(this.player){const p=this.worldToScreen(this.player.pos.x,this.player.pos.z);if(p.px>=12&&p.py>=12&&p.px<=w-12&&p.py<=h-12){c.save();c.translate(p.px,p.py);c.rotate(mapHeading(this.player.yaw));c.beginPath();c.moveTo(0,-11);c.lineTo(7,8);c.lineTo(0,4);c.lineTo(-7,8);c.closePath();c.fillStyle='#fffbd9';c.strokeStyle='#132632';c.lineWidth=2;c.fill();c.stroke();c.restore();legend.add('player');}}
    // North-up compass and zoom-dependent graphic scale remain fixed in screen space.
    c.fillStyle='#101d27ed';c.fillRect(w-88,10,78,82);c.fillRect(10,h-44,150,34);c.strokeStyle='#d8dedc';c.lineWidth=1.5;
    c.beginPath();c.moveTo(w-49,26);c.lineTo(w-49,71);c.moveTo(w-70,49);c.lineTo(w-28,49);c.stroke();
    c.font='bold 12px sans-serif';c.fillStyle='#fffbd9';c.textAlign='center';c.fillText('N',w-49,23);c.fillText('S',w-49,85);c.fillText('O',w-78,53);c.fillText('E',w-20,53);c.textAlign='left';
    const scale=mapScale(z);c.beginPath();c.moveTo(20,h-32);c.lineTo(20,h-26);c.lineTo(20+scale.pixels,h-26);c.lineTo(20+scale.pixels,h-32);c.stroke();c.font='12px sans-serif';c.fillText(`${Number(scale.blocks.toPrecision(3))} bloques`,20,h-13);
    this.visibleMarkers=rendered;this.legend=[...legend];this.syncUI(this.legend,level);
  }
  waypointHud(player){const wp=this.data?.waypoint;if(!wp||!player)return null;const dx=wp.x-player.pos.x,dz=wp.z-player.pos.z;return {dist:Math.hypot(dx,dz),dx,dz};}
  snapshot(){const {cx,cz}=this.player?worldToCell(this.player.pos.x,this.player.pos.z):{cx:0,cz:0};return {cell:cellKey(cx,cz),discovered:this.cellCount,markers:Object.keys(this.data?.markers??{}).length,markerTypes:Object.values(this.data?.markers??{}).map(m=>m.type),approxBytes:this.approxSaveBytes(),zoom:this.zoom,open:this.open,level:semanticLevel(this.zoom),frame:this.frameMode,visible:this.visibleMarkers.map(m=>m.id),legend:this.legend,drawCount:this.drawCount};}
  debugRevealRadius(n){return this.player?this.revealRadius(this.player.pos.x,this.player.pos.z,n,'debug'):0;}
  debugFillCells(count){if(!this.player||!this.world)return 0;const {cx,cz}=worldToCell(this.player.pos.x,this.player.pos.z);let n=0;const side=Math.ceil(Math.sqrt(count));for(let dz=0;dz<side&&n<count;dz++)for(let dx=0;dx<side&&n<count;dx++)n+=this._revealCell(cx+dx,cz+dz);return n;}
}
export const worldMap=new MapSystem();
