// Real Web Audio / recorder / worklet / WAV with generated media streams.
// No microphone, desktop capture, audible output, Electron IPC or ASR.
// Browser plugin unavailable; headless Playwright avoids desktop focus.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<title>BlitzDic generated two-track audio fixture</title>');return;}
  if(!req.url.startsWith('/src/'))throw new Error('fixture path');
  const file=resolve(root,`.${req.url}`);if(!file.startsWith(root+sep))throw new Error('fixture path');
  res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,executablePath:process.env.BLITZDIC_TEST_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);assert.match(await page.title(),/generated two-track/);
 const result=await page.evaluate(async()=>{
  const {Recorder}=await import('/src/recorder.js');
  const sourceContext=new AudioContext();const sources=[],streams=[];
  const makeStream=value=>{const source=sourceContext.createConstantSource(),sink=sourceContext.createMediaStreamDestination();source.offset.value=value;source.connect(sink);source.start();sources.push(source);streams.push(sink.stream);return sink.stream;};
  const mic=makeStream(.25),system=makeStream(-.5);
  const oldDisplay=navigator.mediaDevices.getDisplayMedia,oldMic=navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getDisplayMedia=async()=>system;navigator.mediaDevices.getUserMedia=async()=>mic;
  const recorder=new Recorder();
  try{
   await sourceContext.resume();await recorder.start('',{source:'both'});
   await new Promise(resolve=>setTimeout(resolve,2200));
   const preview=recorder.snapshotSince(0),full=recorder.stop();
   const summarize=audio=>{
    const view=new DataView(audio),channels=view.getUint16(22,true),frames=(audio.byteLength-44)/2/channels;
    const means=[];
    for(let channel=0;channel<channels;channel++){
     let sum=0;for(let i=Math.floor(frames/2);i<frames;i++)sum+=view.getInt16(44+(i*channels+channel)*2,true)/32768;
     means.push(sum/(frames-Math.floor(frames/2)));
    }
    return {channels,rate:view.getUint32(24,true),frames,means};
   };
   return {full:summarize(full),preview:summarize(preview.audio),cursor:preview.cursor,stopped:streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))};
  }finally{
   recorder.cancel();navigator.mediaDevices.getDisplayMedia=oldDisplay;navigator.mediaDevices.getUserMedia=oldMic;
   sources.forEach(source=>source.stop());await sourceContext.close();
  }
 });
 assert.equal(result.full.channels,2);assert.equal(result.full.rate,16000);assert.ok(result.full.frames>32000);
 assert.ok(Math.abs(result.full.means[0]-.25)<.002,'Left channel must be microphone');
 assert.ok(Math.abs(result.full.means[1]+.5)<.002,'Right channel must be system audio');
 assert.equal(result.preview.channels,1);assert.equal(result.preview.frames,result.full.frames);assert.equal(result.cursor,result.full.frames);
 assert.ok(Math.abs(result.preview.means[0]+.125)<.002,'Live preview must retain the mixed sources');
 assert.equal(result.stopped,true);assert.deepEqual(errors,[]);
 console.log('PASS real Web Audio: synchronized 16-kHz microphone-left/system-right PCM16, correct source levels and frame counts, mono live preview, all owned media tracks stopped. Generated streams only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
