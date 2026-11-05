import {resolve} from 'node:path';
import {chromium,_electron as electron} from 'playwright';
import {runSpeech as speech} from '../src/speech.js';
let captureScope;
const runSpeech=(request,options)=>speech(request.action==='capture-target'?{...request,scope:captureScope}:request,{...options,onProgress:text=>{if(process.env.BLITZDIC_UIA_TRACE==='1')process.stderr.write(text);}});
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const speechRuntime=process.env.BLITZDIC_TEST_SPEECH_EXECUTABLE||`${root}/.runtime/venv/Scripts/python.exe`;
const name=process.env.BLITZDIC_BROWSER||'chrome';
assert.ok(['chrome','edge'].includes(name),'BLITZDIC_BROWSER must be chrome or edge');
const paths={chrome:'C:/Program Files/Google/Chrome/Application/chrome.exe',edge:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'};
const title=`BlitzDic website fixture ${Date.now()}`;
const requests=[];
const server=createServer(async(request,response)=>{
 if(request.url==='/v1/chat/completions'){
  let data='';for await(const part of request)data+=part;
  const body=JSON.parse(data);requests.push(body);
  const mode=/emotional gesprochenes Transkript/.test(body.messages[0].content)?'calm':'clean';
  response.setHeader('Content-Type','application/json');response.end(JSON.stringify({choices:[{message:{content:`Website ${mode} fixture: This is a local speech recognition test.`},finish_reason:'stop'}]}));return;
 }
 response.setHeader('Content-Type','text/html');response.end(`<title>${title}</title><label>Owned website test<textarea id="editor" style="width:480px;height:120px">Before </textarea></label>`);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
let context,dictation,keyboard,inspectWindow,ui;
const preset=process.env.BLITZDIC_TEST_PRESET||'whisper',hold=process.env.BLITZDIC_TEST_HOLD==='1';
assert.ok(['whisper','parakeet-ultra'].includes(preset));
try {
 if(process.env.BLITZDIC_WEBSITE_E2E==='1'){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.BLITZDIC_TEST_EXECUTABLE;
  keyboard=spawn(`${root}/.runtime/venv/Scripts/python.exe`,[`${root}/scripts/test-hotkey.py`],{windowsHide:true});await once(keyboard.stdout,'data');
  dictation=await electron.launch({executablePath,args:[...(executablePath?[]:[root]),`--user-data-dir=${root}/.runtime/website-e2e-${Date.now()}`,
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${root}/.runtime/test-speech.wav`],env});
  ui=await dictation.firstWindow();await ui.waitForSelector('#provider option',{state:'attached'});
  await dictation.evaluate(async({app})=>{
   const {createRequire,syncBuiltinESMExports}=process.getBuiltinModule('module');
   const require=createRequire(`${app.getAppPath()}/package.json`),childProcess=require('node:child_process'),original=childProcess.spawn;
   globalThis.websiteTestTrace=[];
   childProcess.spawn=(...args)=>{
    const child=original(...args),end=child.stdin?.end.bind(child.stdin);
    if(end)child.stdin.end=(data,...rest)=>{
     let request;try{request=JSON.parse(String(data));}catch{}
     if(['capture-target','insert-text'].includes(request?.action)){
      let output='';child.stdout.on('data',chunk=>output+=chunk.toString('utf8'));
      child.on('close',()=>{try{const result=JSON.parse(output);globalThis.websiteTestTrace.push({action:request.action,signature:result.target?.signature||request.target?.signature,inserted:result.inserted,reason:result.reason});}catch{}});
     }
     if(request?.action==='capture-target'&&globalThis.websiteTestScope)data=JSON.stringify({...request,scope:globalThis.websiteTestScope});
     return end(data,...rest);
    };
    return child;
   };
   syncBuiltinESMExports();
  });
  await ui.evaluate(async({preset,hold,name,baseURL})=>{
   const {settings}=await window.blitz.load();settings.speech.preset=preset;settings.speech.language='en';settings.shortcutBehavior=hold?'hold':'toggle';
   settings.websiteModes=[{host:'blitzdic.test',mode:'clean'},{host:'mail.blitzdic.test',mode:'calm'}];
   settings.appModes=[{executable:name==='edge'?'msedge.exe':'chrome.exe',mode:'emoji'}];
   settings.provider={provider:'custom',location:'local',model:'website-fixture',baseURL,apiKey:''};await window.blitz.settings(settings);
  },{preset,hold,name,baseURL:`http://127.0.0.1:${server.address().port}/v1`});
  await dictation.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide();});
 }
 context=await chromium.launchPersistentContext(`${root}/.runtime/website-${name}-${Date.now()}`,{executablePath:paths[name],headless:false,viewport:{width:900,height:640},args:['--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP *.blitzdic.test 127.0.0.1','--proxy-server=direct://','--proxy-bypass-list=*']});
 const page=context.pages()[0];
 await page.goto(`http://mail.blitzdic.test:${server.address().port}/private-path?secret=must-not-leave-worker`);
 await page.bringToFront();await page.locator('#editor').click();
 const cdp=await context.browser().newBrowserCDPSession();
 const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');
 const pid=processInfo.find(p=>p.type==='browser').id;
 const pageCdp=await context.newCDPSession(page);
 const {targetInfo}=await pageCdp.send('Target.getTargetInfo');
 const {windowId}=await cdp.send('Browser.getWindowForTarget',{targetId:targetInfo.targetId});
 await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
 await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
 await page.bringToFront();await page.locator('#editor').click();
 const ownWindow=async(check=true)=>{
  const child=spawn(`${root}/.runtime/venv/Scripts/python.exe`,[`${root}/scripts/test-browser-window.py`,String(pid),title,check&&process.env.BLITZDIC_TEST_WAIT_FOR_FOCUS!=='1'?'request':'observe',String(check?(process.env.BLITZDIC_TEST_WAIT_FOR_FOCUS==='1'?1800:30):0)],{windowsHide:true});let data='';child.stdout.on('data',c=>data+=c);
  assert.equal((await once(child,'close'))[0],0);const state=JSON.parse(data);if(check){assert.equal(state.windows.length,1);assert.equal(state.foreground,true,'Refusing capture outside the owned browser window');captureScope={window:state.windows[0],process:Number(pid)};if(dictation)await dictation.evaluate((_,scope)=>{globalThis.websiteTestScope=scope;},captureScope);}return state;
 };
 inspectWindow=()=>ownWindow(false);
 console.log(`READY: ${title} (${name}); waiting for the exact owned foreground browser window.`);
 await page.waitForTimeout(500);await ownWindow();
 let capture;
 for(let attempt=0;attempt<2;attempt++) {
  await ownWindow();
  capture=await runSpeech({action:'capture-target',website:true},{pythonPath:speechRuntime,timeoutMs:6000});
  console.log(JSON.stringify({browser:name,version:context.browser().version(),kind:capture.target?.kind,reason:capture.reason,host:capture.websiteHost}));
  if(capture.websiteHost)break;await page.waitForTimeout(200);
 }
 assert.equal(capture.websiteHost,'mail.blitzdic.test');assert.equal(capture.target?.kind,'uia');
 assert.equal(JSON.stringify(capture).includes('must-not-leave-worker'),false);
 const noHost=await runSpeech({action:'capture-target',website:false},{pythonPath:speechRuntime,timeoutMs:6000});
 assert.equal(noHost.websiteHost,null);assert.ok(noHost.target);
 await page.locator('#editor').fill('https://wrong-host.test/not-the-website');
 await ownWindow();
 const fieldUrl=await runSpeech({action:'capture-target',website:true},{pythonPath:speechRuntime,timeoutMs:6000});
 assert.equal(fieldUrl.websiteHost,'mail.blitzdic.test','A URL-shaped editable value must not select a website');
 await page.evaluate(port=>{
  const field=document.querySelector('#editor'),rect=field.getBoundingClientRect(),frame=document.createElement('iframe');
  frame.id='cover';frame.src=`http://frame.blitzdic.test:${port}/child`;
  Object.assign(frame.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,zIndex:'9999'});
  document.body.append(frame);field.focus();
 },server.address().port);
 await page.frameLocator('#cover').locator('#editor').waitFor();
 await ownWindow();
 const covered=await runSpeech({action:'capture-target',website:true},{pythonPath:speechRuntime,timeoutMs:6000});
 assert.ok([null,'mail.blitzdic.test'].includes(covered.websiteHost),'An unfocused covering frame must not replace the focused website host');
 await page.frameLocator('#cover').locator('#editor').click();await ownWindow();
 const frame=await runSpeech({action:'capture-target',website:true},{pythonPath:speechRuntime,timeoutMs:6000});
 console.log(JSON.stringify({case:'focused-frame',kind:frame.target?.kind,reason:frame.reason,host:frame.websiteHost}));
 assert.equal(frame.websiteHost,'frame.blitzdic.test','Focused cross-origin frame uses its own document host');
 console.log(`PASS: real ${name} focused website host only, optional collection off, no path/query in capture IPC. Browser plugin not available; Playwright used.`);
 console.log(`PASS: ${name} ignores a URL-shaped field value and an unfocused covering frame's host, and recognizes the focused cross-origin frame.`);
 if(process.env.BLITZDIC_WEBSITE_E2E==='1'){
  await page.evaluate(()=>document.querySelector('#cover').remove());
  const handle=(await ownWindow()).windows[0];
  const key=async(action,number)=>{const reply=once(keyboard.stdout,'data');keyboard.stdin.write(`${action} ${handle} ${number}\n`);assert.equal((await reply)[0].toString().trim(),'sent');};
  for(const scenario of [{number:1,mode:'calm'},{number:2,mode:'clean'},{number:1,mode:'verbatim'}]){
   if(scenario.mode==='verbatim')await ui.evaluate(async()=>{const {settings}=await window.blitz.load();settings.provider.model='';await window.blitz.settings(settings);});
   await page.locator('#editor').click();await page.locator('#editor').fill('Before ');await page.locator('#editor').evaluate(el=>el.setSelectionRange(7,7));await ownWindow();
   await key(hold?'down':'toggle',scenario.number);
   await ui.waitForFunction(()=>document.querySelector('#record').textContent==='Aufnahme beenden',{}, {polling:100,timeout:15000});
   assert.equal(await ui.locator('#mode').inputValue(),scenario.mode);
   await new Promise(resolve=>setTimeout(resolve,6200));await key(hold?'up':'toggle',scenario.number);
   await ui.waitForFunction(()=>document.querySelector('#status').textContent==='Transkription abgeschlossen.'||/bleibt in BlitzDic|fehlgeschlagen|Error/.test(document.querySelector('#status').textContent),{}, {polling:100,timeout:60000});
   assert.equal(await ui.locator('#status').textContent(),'Transkription abgeschlossen.');
   assert.match(await page.locator('#editor').inputValue(),/local speech recognition test/i);
   if(scenario.mode!=='verbatim')assert.match(await page.locator('#editor').inputValue(),new RegExp(`Website ${scenario.mode} fixture:`));
   const history=(await ui.evaluate(()=>window.blitz.load())).history;assert.equal(history[0].mode,scenario.mode);assert.equal(history[0].speechModel,preset);
   assert.equal(JSON.stringify(history).includes('blitzdic.test'),false);
   console.log(`PASS: native ${hold?'held':'toggle'} ${name} shortcut + actual ${preset}: ${scenario.mode}, correct external insertion and encrypted history`);
  }
  assert.equal(requests.length,2);assert.match(requests[0].messages[0].content,/emotional gesprochenes Transkript/);assert.match(requests[1].messages[0].content,/Korrigiere Rechtschreibung/);
  assert.match(requests[0].messages.at(-1).content,/local speech recognition test/i);assert.equal(JSON.stringify(requests).includes('blitzdic.test'),false);assert.equal(JSON.stringify(requests).includes('must-not-leave-worker'),false);
  console.log('PASS: website specificity beats browser rule, explicit mode retained, no configured LLM falls back to verbatim, no browser host/path/query in provider payload or dictation history.');
 }
} catch(error) {
 if(inspectWindow){
  const state=await inspectWindow();console.error('Owned browser state:',state);
  if(dictation&&state.foreground){
   const trace=await dictation.evaluate(()=>globalThis.websiteTestTrace||[]),expected=trace.findLast(item=>item.action==='capture-target')?.signature?.split(':');
   const current=await runSpeech({action:'capture-target',website:false},{pythonPath:speechRuntime,timeoutMs:6000});
   const actual=current.target?.signature?.split(':');
   if(expected&&actual)console.error('Signature equality:',{window:expected[0]===actual[0],process:expected[1]===actual[1],element:expected[2]===actual[2],prefix:expected[3]===actual[3],selection:expected[4]===actual[4],document:expected[5]===actual[5]});
  }
 }
 if(dictation)console.error('Dictation diagnostics:',await(await dictation.firstWindow()).evaluate(()=>({status:document.querySelector('#status').textContent,button:document.querySelector('#record').textContent,mode:document.querySelector('#mode').value,resultLength:document.querySelector('#result').value.length})));
 if(context){const value=await context.pages()[0].locator('#editor').inputValue();console.error('Browser diagnostics:',{unchanged:value==='Before ',length:value.length});}
 throw error;
} finally {keyboard?.stdin.end();await dictation?.close();await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
