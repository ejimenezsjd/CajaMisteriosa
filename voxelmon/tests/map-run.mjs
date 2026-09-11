import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const testRoot=fileURLToPath(new URL('../',import.meta.url)),root=process.env.GAME_ROOT?resolve(process.env.GAME_ROOT):testRoot;
const output=process.env.MAP_OUTPUT?resolve(process.env.MAP_OUTPUT):null;
if(output)await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const base=pathname.startsWith('/tests/')?testRoot:root;const path=resolve(base,'.'+pathname);if(!path.startsWith(base.replace(/[\\/]$/,'')+sep))throw Error('path');const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[extname(path)]??'application/octet-stream','Cache-Control':'no-store'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try{
 const result={checks:[],errors:[]};const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>result.errors.push(String(e)));
 await p.goto(origin+'/tests/fixture.html');
 if(!process.argv.includes('--benchmark'))result.checks=await p.evaluate(async()=>(await import('./map-unit.js')).runMapUnits());
 // Identical, deterministic map-only fixture before/after. No game terrain generation in timed sections.
 await p.goto(origin+'/tests/fixture.html');
 result.performance=await p.evaluate(async()=>{
  const {worldMap:m}=await import('../js/map.js'),{defaultState}=await import('../js/state.js'),{regions}=await import('../js/regions.js');
  const s=defaultState(170753942);regions.attach(s);s.regions.discovered.region_1=true;
  for(let z=-50;z<50;z++)for(let x=-50;x<50;x++)s.map.discoveredCells[`${x},${z}`]='plains';
  for(let i=0;i<2000;i++){const id=`camp:${i},0`;s.stats.structuresDiscovered[id]=true;s.map.markers[id]={id,type:i%5?'camp':'gym',x:(i*37%1600)-800,z:(i*91%1600)-800};}
  const wrap=document.createElement('div');wrap.style.cssText='width:1200px;height:600px';const c=document.createElement('canvas');c.style.cssText='width:100%;height:100%';wrap.append(c);document.body.append(wrap);
  m.attach(s,{biomeAt:()=> 'plains'});m.bindCanvas(c);m.player={pos:{x:0,z:0},yaw:0};m.show();m.zoom=1.2;m.invalidate?.();m.draw();
  const sample=(n,pan)=>{const values=[];for(let i=0;i<n;i++){if(pan){m.panX=(i%20)-10;m.invalidate?.();}const start=performance.now();m.draw();values.push(performance.now()-start);}values.sort((a,b)=>a-b);return {n,totalMs:values.reduce((a,b)=>a+b,0),medianMs:values[Math.floor(n*.5)],p95Ms:values[Math.floor(n*.95)]};};
  sample(20,true);const dirty=sample(120,true),stationary=sample(300,false);return {fixture:{cells:10000,markers:2000,viewport:[1200,600],zoom:1.2},dirty,stationary};
 });
 await p.close();
 if(!process.argv.includes('--benchmark')){const {runMapRuntime}=await import('./map-runtime.mjs');const r=await runMapRuntime(browser,origin,output);result.checks.push(...r.checks);result.errors.push(...r.errors);}
 result.pass=result.checks.filter(c=>c.pass).length;result.fail=result.checks.filter(c=>!c.pass).length;
 if(process.env.RESULT_FILE)await writeFile(resolve(process.env.RESULT_FILE),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.fail||result.errors.length)process.exitCode=1;
}finally{await browser.close();await new Promise(r=>server.close(r));}
