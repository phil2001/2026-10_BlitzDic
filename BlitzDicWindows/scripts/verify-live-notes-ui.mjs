// Renderer fixture only: fake IPC/recorder, no native mute or microphone access.
// Browser plugin not available; headless Playwright avoids taking desktop focus.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {defaultSettings} from '../src/store.js';
import {providers} from '../src/providers.js';
import {LiveNotes} from '../src/live-notes.js';

const root=resolve(import.meta.dirname,'..'),artifacts=resolve(root,'.runtime',`live-notes-ui-${Date.now()}`);
await mkdir(artifacts,{recursive:true});
console.log(`Renderer fixture artifacts: ${artifacts}`);
const fakeRecorder=`import {encodeWav} from './wav.js';export class Recorder {constructor(){this.state='idle';}async start(_device,options={}){await options.beforeCapture?.();this.state='recording';return true;}cancel(){this.state='idle';}stop(){this.cancel();return new Uint8Array();}snapshotSince(cursor){return {audio:encodeWav([new Float32Array(16000)],8000),cursor:cursor+16000,dropped:false};}}`;
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(!/^\/(?:src|ui)\//.test(path))throw new Error('Invalid fixture path');
  const file=resolve(root,`.${path}`);if(!file.startsWith(root+sep))throw new Error('Invalid fixture path');
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[extname(file)]||'application/octet-stream');
  res.end(path==='/src/recorder.js'?fakeRecorder:await readFile(file));
 } catch {res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,executablePath:process.env.BLITZDIC_TEST_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const page=await browser.newPage({viewport:{width:1200,height:820}}),errors=[],calls=[];
 await page.clock.install();
 let settings=defaultSettings();settings.provider.model='live-fixture';
 const live=new LiveNotes({modelRoot:'models',recognize:async()=>({text:'Anna prüft die Unterlagen. Das Budget beträgt 2500 Euro.'}),generate:async()=> 'Themen\n- Budget 2500 Euro.\nTo-dos\n- Anna: Unterlagen prüfen.'});
 let stopGate=null,releaseStop;
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(['warning','error'].includes(message.type()))errors.push(message.text());});
 await page.exposeBinding('fixtureLoad',()=>({settings:structuredClone(settings),providers,history:[],version:'renderer-fixture',modelsBundled:true,speakerModelsAvailable:true}));
 await page.exposeBinding('fixtureCall',async(_,name,args)=>{
  calls.push({name,args});
  if(name==='settings')settings=structuredClone(args[0]);
  if(name==='meeting-live-start')return live.start(settings);
  if(name==='meeting-live-update')return live.update(args[0],Uint8Array.from(args[1]).buffer,args[2]);
  if(name==='meeting-live-catchup')return live.catchUp(args[0]);
  if(name==='meeting-live-stop'){if(stopGate)await stopGate;return live.stop(args[0]);}
  if(name==='cancel'){live.cancel();return;}
  if(name==='meeting-audio')return {original:'Complete recording fixture.',warning:args[1]?.echoFilter?'Echo-Filter nicht verfügbar. Fixture-Warnung.':null};
  return name==='meetings'?[]:undefined;
 });
 await page.addInitScript(()=>{
  window.blitz=new Proxy({}, {get:(_,name)=>name==='load'?()=>window.fixtureLoad():String(name).startsWith('on')?()=>()=>{}:(...args)=>{if(name==='meeting-live-update'){window.liveUpdates=(window.liveUpdates||0)+1;args[1]=Array.from(new Uint8Array(args[1]));}return window.fixtureCall(name,args);}});
  navigator.mediaDevices.enumerateDevices=async()=>[];
 });
 const url=`http://127.0.0.1:${server.address().port}/ui/index.html`;
 await page.goto(url);assert.equal(page.url(),url);assert.equal(await page.title(),'BlitzDic');
 await page.waitForSelector('#app-version',{state:'attached'});
 await page.locator('[data-page=meetings]').click();
 const enable=page.locator('#meeting-live-enabled');assert.equal(await enable.isChecked(),false);await enable.check();
 await page.locator('#meeting-record').click();await page.waitForFunction(()=>!document.querySelector('#meeting-live-refresh').disabled);
 assert.equal(await enable.isDisabled(),true);
 await page.locator('#meeting-live-refresh').click();await page.waitForFunction(()=>document.querySelector('#meeting-live-notes').value.includes('2500 Euro'));
 assert.match(await page.locator('#meeting-live-destination').textContent(),/127\.0\.0\.1/);
 await page.clock.fastForward(150000);await page.waitForFunction(()=>window.liveUpdates===2&&!document.querySelector('#meeting-live-refresh').disabled);
 await page.locator('#meeting-live-catchup').click();await page.waitForFunction(()=>!document.querySelector('#meeting-live-recap-label').hidden);
 await page.locator('#meeting-live-panel').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(artifacts,'desktop.png')});
 await page.setViewportSize({width:760,height:620});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(artifacts,'small.png')});
 await page.locator('#meeting-record').click();await page.waitForFunction(()=>document.querySelector('#meeting-transcript').value.includes('Complete recording fixture.'));
 assert.equal(await enable.isChecked(),false);assert.match(await page.locator('#meeting-live-notes').inputValue(),/2500 Euro/);
 assert.equal(calls.filter(call=>call.name==='meeting-audio').length,1);
 await enable.check();await page.locator('#meeting-record').click();await page.waitForFunction(()=>!document.querySelector('#meeting-live-refresh').disabled);
 stopGate=new Promise(resolve=>{releaseStop=resolve;});
 await page.locator('#meeting-record').click();await page.locator('#meeting-cancel').click();
 releaseStop();stopGate=null;
 await page.waitForFunction(()=>document.querySelector('#meeting-record').textContent==='Meeting aufnehmen');
 await page.waitForTimeout(100);
 assert.equal(calls.filter(call=>call.name==='meeting-audio').length,1,'Cancellation during live stop must not start a late full transcription');
 assert.equal(await page.locator('#meeting-echo-option').isVisible(),false);
 await page.locator('#meeting-source').selectOption('both');assert.equal(await page.locator('#meeting-echo').isChecked(),true);
 assert.match(await page.locator('#meeting-speaker-count-label').textContent(),/im Systemaudio/);
 await page.setViewportSize({width:1200,height:820});await page.locator('#meeting-echo-hint').scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(artifacts,'echo-desktop.png')});
 await page.setViewportSize({width:760,height:620});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(artifacts,'echo-small.png')});
 await page.locator('#meeting-record').click();assert.equal(await page.locator('#meeting-source').isDisabled(),true);
 await page.locator('#meeting-record').click();await page.waitForFunction(()=>!document.querySelector('#meeting-source').disabled);
 assert.equal(calls.filter(call=>call.name==='meeting-audio').at(-1).args[1].echoFilter,true);
 assert.match(await page.locator('#status').textContent(),/Echo-Filter nicht verfügbar/);
 await page.locator('#meeting-echo').uncheck();assert.equal(await page.locator('#meeting-speaker-count-label').textContent(),'Sprecherzahl');
 await page.locator('#meeting-record').click();await page.locator('#meeting-record').click();
 await page.waitForFunction(()=>!document.querySelector('#meeting-source').disabled);
 assert.equal(calls.filter(call=>call.name==='meeting-audio').at(-1).args[1].echoFilter,false);
 assert.deepEqual(errors,[]);
 console.log(`PASS: real renderer + LiveNotes service with simulated ASR/LLM/IPC: explicit opt-in, manual + timed update, catch-up, connection display, full transcript separate, cancelled stop cannot restart ASR, screenshots/no overflow/no console errors. Artifacts: ${artifacts}`);
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
