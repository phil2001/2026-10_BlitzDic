// Real bundled ASR and HTTP provider transport; the loopback LLM response is a fixture.
// No microphone, audio endpoint mutation, external service or installed application.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {LiveNotes} from '../src/live-notes.js';
import {defaultSettings} from '../src/store.js';
import {encodeWav} from '../src/wav.js';

const resources=resolve(process.argv[2]||'dist/windows-2026-11-02T15-20-18-865Z-943dc7/win-unpacked/resources');
const wav=await readFile('.runtime/test-speech.wav');
assert.equal(wav.toString('ascii',0,4),'RIFF');
assert.equal(wav.toString('ascii',8,12),'WAVE');
let format,data;
for(let at=12;at+8<=wav.length;){
 const size=wav.readUInt32LE(at+4),end=at+8+size;assert.ok(end<=wav.length);
 const kind=wav.toString('ascii',at,at+4);
 if(kind==='fmt ')format=wav.subarray(at+8,end);
 if(kind==='data')data=wav.subarray(at+8,end);
 at=end+(size%2);
}
assert.ok(format&&data);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),1);assert.equal(format.readUInt16LE(14),16);
const pcm=Float32Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768);
const audio=encodeWav([pcm],format.readUInt32LE(4)),requests=[];
const server=createServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk;
 requests.push({url:req.url,body:JSON.parse(body)});
 res.setHeader('Content-Type','application/json');
 res.end(JSON.stringify({choices:[{message:{content:'Themen\n- Synthetischer Spracherkennungstest.'},finish_reason:'stop'}]}));
});
server.listen(0,'127.0.0.1');await once(server,'listening');
try {
 for(const preset of ['whisper','parakeet-ultra']){
  const settings=defaultSettings();settings.speech.preset=preset;settings.speech.language='en';
  settings.provider={provider:'custom',location:'local',baseURL:`http://127.0.0.1:${server.address().port}/v1`,model:'live-fixture'};
  const live=new LiveNotes({modelRoot:resolve(resources,'models'),pythonPath:resolve(resources,'speech-runtime/blitzdic-speech.exe')});
  const {id}=live.start(settings),start=requests.length;
  const state=await live.update(id,audio);assert.equal(state.consumed,true);assert.equal(state.problem,'');assert.match(state.notes,/Spracherkennungstest/);
  await live.catchUp(id);await live.stop(id);
  assert.equal(requests.length,start+2);
  for(const request of requests.slice(start)){
   assert.equal(request.url,'/v1/chat/completions');assert.equal(request.body.model,'live-fixture');
   assert.match(request.body.messages.at(-1).content,/speech recognition test/i);
   assert.doesNotMatch(JSON.stringify(request.body),/audioBase64|UklGR/);
  }
  assert.equal(live.session.pending,'');assert.deepEqual(live.session.stretches,[]);
  console.log(`PASS ${preset}: real packaged ASR -> live notes + catch-up over loopback HTTP; text-only provider payload; transient text cleared on stop.`);
 }
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
