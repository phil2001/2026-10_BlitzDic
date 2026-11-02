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

const root=resolve(import.meta.dirname,'..'),artifacts=resolve(root,'.runtime',`output-mute-ui-${Date.now()}`);
await mkdir(artifacts,{recursive:true});
console.log(`Renderer fixture artifacts: ${artifacts}`);
const fakeRecorder=`export class Recorder {constructor(){this.state='idle';}async start(_device,options={}){await options.beforeCapture?.();this.state='recording';return true;}cancel(){this.state='idle';}stop(){this.cancel();return new Uint8Array();}}`;
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
 let settings=defaultSettings();
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(['warning','error'].includes(message.type()))errors.push(message.text());});
 await page.exposeBinding('fixtureLoad',()=>({settings:structuredClone(settings),providers,history:[],version:'renderer-fixture',modelsBundled:true,speakerModelsAvailable:true}));
 await page.exposeBinding('fixtureCall',(_,name,args)=>{
  calls.push({name,args});if(name==='settings')settings=structuredClone(args[0]);
  if(name==='prepare-output')return {warning:'Simulierte Stummschaltung nicht verfügbar.'};
  return name==='meetings'?[]:undefined;
 });
 await page.addInitScript(()=>{
  window.blitz=new Proxy({}, {get:(_,name)=>name==='load'?()=>window.fixtureLoad():String(name).startsWith('on')?()=>()=>{}:(...args)=>window.fixtureCall(name,args)});
  navigator.mediaDevices.enumerateDevices=async()=>[];
 });
 const url=`http://127.0.0.1:${server.address().port}/ui/index.html`;
 await page.goto(url);assert.equal(page.url(),url);assert.equal(await page.title(),'BlitzDic');
 await page.waitForSelector('#app-version',{state:'attached'});
 await page.locator('[data-page=settings]').click();
 const checkbox=page.getByRole('checkbox',{name:'Windows-Ausgabe während eines Diktats stummschalten',exact:true});
 assert.equal(await checkbox.isChecked(),false);await checkbox.check();await page.locator('#save-settings').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Einstellungen gespeichert.');
 assert.equal(settings.muteOutputWhileRecording,true);
 await page.screenshot({path:resolve(artifacts,'desktop.png')});
 await page.setViewportSize({width:760,height:620});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(artifacts,'small.png')});
 await page.reload();await page.waitForSelector('#app-version',{state:'attached'});
 await page.locator('[data-page=settings]').click();assert.equal(await checkbox.isChecked(),true);
 await page.locator('[data-page=meetings]').click();await page.locator('#meeting-record').click();
 await page.waitForFunction(()=>document.querySelector('#meeting-record').textContent==='Aufnahme beenden und transkribieren');
 assert.ok(calls.some(call=>call.name==='recording-state'&&call.args[0]===true&&call.args[2]==='meeting'));
 assert.equal(calls.filter(call=>call.name==='prepare-output').length,0);
 await page.locator('#meeting-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#meeting-record').textContent==='Meeting aufnehmen');
 await page.locator('[data-page=dictation]').click();await page.locator('#record').click();
 await page.waitForFunction(()=>document.querySelector('#record').textContent==='Aufnahme beenden');
 assert.ok(calls.some(call=>call.name==='recording-state'&&call.args[0]===true&&call.args[2]===undefined));
 assert.equal(calls.filter(call=>call.name==='prepare-output').length,1);
 assert.equal(await page.locator('#status').textContent(),'Simulierte Stummschaltung nicht verfügbar.');
 await page.locator('#cancel').click();assert.deepEqual(errors,[]);
 console.log(`PASS: renderer default off, save/reload, meeting kind, dictation default, screenshots/no overflow/no console errors. Fake IPC/recorder; native mutation not tested. Artifacts: ${artifacts}`);
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
