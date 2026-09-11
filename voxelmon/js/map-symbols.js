/** Cartographic vocabulary only. No world generation, quests or progression. */
import { SETTLEMENT_LAYOUT, MIST_SETTLEMENT_LAYOUT, CLIFF_OUTPOST_LAYOUT, AZURE_PORT_LAYOUT, STRUCTURE_TYPES } from './structures.js';

const marker = (label, icon, category, level = 1, extra = {}) => ({ label, icon, category, level, ...extra });
export const MAP_MARKERS = {
  camp: marker('Campamento', 'camp', 'MINOR', 2),
  ruin: marker('Ruinas', 'landmark', 'MINOR', 2),
  healing_shrine: marker('Santuario curativo', 'heal', 'SERVICE', 1),
  settlement: marker('Asentamiento', 'village', 'MAJOR', 0, { hierarchy: 'VILLAGE' }),
  gym: marker('Gimnasio Verde', 'gym', 'CHALLENGE', 0, { gymId: 'gym_verdant' }),
  regional_gate: marker('Paso fronterizo', 'gate', 'ROUTE', 1),
  watchtower: marker('Atalaya brumosa', 'landmark', 'MAJOR', 0),
  ancient_outpost: marker('Puesto ancestral', 'landmark', 'MAJOR'),
  mist_settlement: marker('Refugio Brumoso', 'village', 'MAJOR', 0, { hierarchy: 'VILLAGE' }),
  gym_mist: marker('Gimnasio de las Brumas', 'gym', 'CHALLENGE', 0, { gymId: 'gym_mist' }),
  mining_camp: marker('Puesto minero', 'outpost', 'MAJOR', 0, { hierarchy: 'OUTPOST' }),
  crimson_ruin: marker('Ruina Carmesí', 'challenge', 'CHALLENGE', 0),
  gym_crimson: marker('Gimnasio de la Forja', 'gym', 'CHALLENGE', 0, { gymId: 'gym_crimson' }),
  cliff_outpost: marker('Puesto del Acantilado', 'outpost', 'MAJOR', 0, { hierarchy: 'OUTPOST' }),
  wind_shrine: marker('Santuario del Viento', 'landmark', 'MAJOR'),
  storm_observatory: marker('Observatorio', 'landmark', 'MAJOR', 0),
  tempest_spire: marker('Pináculo del Vendaval', 'challenge', 'CHALLENGE', 0),
  gym_gale: marker('Gimnasio del Vendaval', 'gym', 'CHALLENGE', 0, { gymId: 'gym_gale' }),
  highland_exit: marker('Arco de las alturas', 'gate', 'ROUTE'),
  coastal_gate: marker('Entrada costera', 'gate', 'ROUTE'),
  azure_port: marker('Puerto Azur', 'city', 'MAJOR', 0, { hierarchy: 'CITY' }),
  azure_bridge: marker('Puente Azur', 'bridge', 'ROUTE'),
  tidal_ruins: marker('Ruinas de Marea', 'landmark', 'MAJOR', 0),
  azure_lighthouse: marker('Faro Azur', 'landmark', 'MAJOR', 0),
  tide_lookout: marker('Mirador de marea', 'landmark', 'MINOR', 2),
  fisherman_camp: marker('Campamento pesquero', 'camp', 'MINOR', 2),
  weathered_shrine: marker('Santuario erosionado', 'landmark', 'MINOR', 2),
  broken_span: marker('Tramo roto', 'bridge', 'ROUTE'),
  reef_atoll: marker('Atolón del Arrecife', 'challenge', 'CHALLENGE', 0),
  tidal_bridge: marker('Puente de Marea', 'bridge', 'ROUTE'),
  gym_tide: marker('Gimnasio de las Mareas', 'gym', 'CHALLENGE', 0, { gymId: 'gym_tide' }),
  open_sea_gate: marker('Arco del mar abierto', 'gate', 'ROUTE'),
};

export const MAP_LEGEND = {
  player: 'Jugador', city: 'Ciudad', village: 'Pueblo', outpost: 'Puesto', gym: 'Gimnasio',
  landmark: 'Landmark', gate: 'Paso', challenge: 'Desafío', camp: 'Campamento', bridge: 'Puente',
  pc: 'PC', shop: 'Tienda', heal: 'Curación', craft: 'Crafting', waypoint: 'Mi destino',
};

// Service positions are derived from the existing world layouts / NPC anchors.
const serviceSpecs = {
  settlement: [['pc', SETTLEMENT_LAYOUT.pc], ['shop', 'merchant'], ['heal', 'healer']],
  mist_settlement: [['pc', MIST_SETTLEMENT_LAYOUT.pc], ['craft', MIST_SETTLEMENT_LAYOUT.workbench]],
  mining_camp: [['shop', 'regional_merchant'], ['heal', 'field_medic']],
  cliff_outpost: [['pc', CLIFF_OUTPOST_LAYOUT.pc], ['shop', 'highland_merchant']],
  azure_port: [['pc', AZURE_PORT_LAYOUT.pc], ['shop', 'azure_merchant'], ['heal', 'azure_healer']],
};
export function mapServices(m) {
  const result = [];
  for (const [icon, location] of serviceSpecs[m.type] ?? []) {
    const local = typeof location === 'string'
      ? STRUCTURE_TYPES[m.type]?.npcAnchors?.find(a => a.role === location)?.local : location;
    if (local) result.push({ id: `${m.id}:${icon}`, type: 'service', icon, x: m.x + local[0], z: m.z + local[1], label: MAP_LEGEND[icon] });
  }
  return result;
}

export function semanticLevel(zoom) { return zoom < 1 ? 0 : zoom < 4 ? 1 : 2; }
export function mapHeading(yaw) { return -yaw; }
export function mapScale(zoom, targetPixels = 100) {
  const value = targetPixels / zoom, power = 10 ** Math.floor(Math.log10(value));
  const units = value / power;
  const blocks = (units >= 5 ? 5 : units >= 2 ? 2 : 1) * power;
  return { blocks, pixels: blocks * zoom };
}

/** All symbols use geometry, not emoji or color alone; cached once by MapSystem. */
export function drawMapSymbol(c, icon) {
  c.strokeStyle = '#eef1e5'; c.fillStyle = '#182d36'; c.lineWidth = 1.8;
  c.lineJoin = 'round'; c.lineCap = 'round';
  const path = points => { c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke(); };
  const house = (x,y,w,h) => { c.fillRect(x,y,w,h); c.strokeRect(x,y,w,h); path([[x-1,y],[x+w/2,y-4],[x+w+1,y]]); };
  if (icon === 'gym') { path([[-7,-4],[0,-8],[7,-4],[7,4],[0,8],[-7,4],[-7,-4]]); path([[-3,0],[0,3],[4,-2]]); }
  else if (['village','city','outpost'].includes(icon)) {
    if (icon === 'outpost') house(-5,-1,10,8);
    else { house(-9,0,7,7); house(2,-2,7,9); if (icon === 'city') { c.fillRect(-3,-8,6,15); c.strokeRect(-3,-8,6,15); path([[-3,-8],[-3,-11],[1,-9]]); } }
  } else if (icon === 'pc') { c.strokeRect(-8,-6,16,11); path([[0,5],[0,8],[-5,8],[5,8]]); path([[-4,-2],[3,-2]]); }
  else if (icon === 'heal') { path([[-9,0],[0,-8],[9,0]]); path([[-7,3],[-3,3],[-1,-1],[2,7],[4,3],[8,3]]); }
  else if (icon === 'shop') { path([[-8,-4],[7,-4],[3,-8]]); path([[8,4],[-7,4],[-3,8]]); }
  else if (icon === 'craft') { path([[-7,7],[6,-6],[3,-8],[8,-3],[6,-6]]); path([[-7,-6],[-3,-2]]); }
  else if (icon === 'gate') { path([[-8,8],[-8,-6],[8,-6],[8,8]]); path([[-4,8],[-4,-1],[0,-4],[4,-1],[4,8]]); }
  else if (icon === 'challenge') { path([[0,-9],[9,7],[-9,7],[0,-9]]); path([[0,-3],[0,2]]); c.fillStyle='#eef1e5'; c.fillRect(-1,4,2,2); }
  else if (icon === 'bridge') { path([[-9,7],[-9,-5],[-5,0],[0,2],[5,0],[9,-5],[9,7]]); path([[-9,5],[9,5]]); }
  else if (icon === 'camp') { path([[-9,7],[0,-8],[9,7],[-9,7]]); path([[-3,7],[0,0],[3,7]]); }
  else if (icon === 'waypoint') { path([[-4,9],[-4,-9],[8,-6],[-4,-2]]); }
  else if (icon === 'player') { path([[0,-9],[6,7],[0,3],[-6,7],[0,-9]]); }
  else { path([[0,-9],[7,0],[0,9],[-7,0],[0,-9]]); c.beginPath(); c.arc(0,0,2,0,Math.PI*2); c.stroke(); }
}
