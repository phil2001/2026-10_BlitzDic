import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveNotes} from '../src/live-notes.js';
import {defaultSettings} from '../src/store.js';
import {encodeWav} from '../src/wav.js';
import {Recorder} from '../src/recorder.js';

const audio=()=>encodeWav([new Float32Array(16000)],8000);
const settings=()=>({...defaultSettings(),provider:{provider:'custom',location:'local',baseURL:'http://127.0.0.1:1234/v1',model:'fixture'}});
const tick=()=>new Promise(setImmediate);

test('live notes freeze the selected local/LAN/API connection and reject invalid destinations before audio',async()=>{
 for(const [location,baseURL] of [['local','http://127.0.0.1:1234/v1'],['lan','http://192.168.1.5:1234/v1'],['api','https://api.example.test/v1']]){
  const config=settings();Object.assign(config.provider,{location,baseURL});const calls=[];
  const live=new LiveNotes({modelRoot:'models',pythonPath:'worker',recognize:async()=>({text:'Anna prüft 2500 Euro.'}),generate:async(c,prompt,text)=>{calls.push({c,text});return 'To-dos\n- Anna: 2500 Euro prüfen.';}});
  const start=live.start(config);config.provider.baseURL='https://changed.invalid';config.provider.model='changed';
  const state=await live.update(start.id,audio());assert.equal(state.consumed,true);assert.equal(state.location,location);
  assert.equal(calls[0].c.baseURL,baseURL);assert.equal(calls[0].c.model,'fixture');assert.match(calls[0].text,/2500 Euro/);
  await live.stop(start.id);
 }
 const live=new LiveNotes({});const invalid=settings();invalid.provider.baseURL='http://remote.invalid';
 assert.throws(()=>live.start(invalid),/Loopback/);
});

test('a failed note update consumes audio once, retains text and retries it with the next section',async()=>{
 let recognition=0,generation=0;const prompts=[];
 const live=new LiveNotes({modelRoot:'models',recognize:async()=>({text:++recognition===1?'Anna prüft die Unterlagen.':'Lieferung bleibt offen.'}),generate:async(_,__,text)=>{prompts.push(text);if(++generation===1)throw new Error('fixture unavailable');return 'Aufgabe Anna; Lieferung offen.';}});
 const {id}=live.start(settings());const first=await live.update(id,audio());
 assert.equal(first.consumed,true);assert.match(first.problem,/gerade nicht/);assert.equal(first.notes,'');
 const second=await live.update(id,audio());assert.equal(recognition,2);assert.match(prompts[1],/Anna prüft/);assert.match(prompts[1],/Lieferung bleibt/);
 assert.equal(second.notes,'Aufgabe Anna; Lieferung offen.');assert.equal(second.problem,'');await live.stop(id);
});

test('repeated failed source is marked incomplete without blocking later notes',async()=>{
 let count=0,attempt=0;
 const live=new LiveNotes({modelRoot:'models',recognize:async()=>({text:++count===1?'Problematischer Abschnitt.':'Neue Aufgabe für Anna.'}),generate:async()=>{if(++attempt<3)throw new Error('fixture failure');return 'Neue Aufgabe für Anna.';}});
 const {id}=live.start(settings());await live.update(id,audio());const result=await live.update(id,audio(),{dropped:true});
 assert.equal(result.incomplete,true);assert.match(result.problem,/vollständige Aufnahme/);assert.match(result.notes,/Neue Aufgabe/);await live.stop(id);
});

test('stop owns a pending worker until it settles and rejects late/stale results',async()=>{
 let finish;const live=new LiveNotes({modelRoot:'models',recognize:()=>new Promise(resolve=>{finish=resolve;}),generate:async()=>assert.fail('Cancelled audio must not reach the LLM')});
 const {id}=live.start(settings());const pending=live.update(id,audio());await tick();const stopped=live.stop(id);
 assert.throws(()=>live.start(settings()),/vorherigen/);finish({text:'Late source'});
 const result=await pending;await stopped;assert.equal(result.notes,'');assert.equal(result.consumed,false);
 const next=live.start(settings());assert.notEqual(next.id,id);await assert.rejects(live.update(id,audio()),/beendet/);await live.stop(next.id);
});

test('catch-up uses only the latest ten minutes and enforces provider/output bounds',async()=>{
 let now=0,index=0;const sent=[];
 const live=new LiveNotes({modelRoot:'models',now:()=>now,recognize:async()=>({text:++index===1?'Old topic.':'Recent decision.'}),generate:async(_,prompt,text)=>{sent.push({prompt,text});return 'Belegte Notizen.';}});
 const {id}=live.start(settings());await live.update(id,audio());now=601000;await live.update(id,audio());await live.catchUp(id);
 assert.doesNotMatch(sent.at(-1).text,/Old topic/);assert.match(sent.at(-1).text,/Recent decision/);
 await assert.rejects(live.update(id,new ArrayBuffer(3)),/Audio/);await live.stop(id);
 const oversized=new LiveNotes({modelRoot:'models',recognize:async()=>({text:'source'}),generate:async()=>'x'.repeat(5501)});
 const session=oversized.start(settings());const state=await oversized.update(session.id,audio());assert.equal(state.notes,'');assert.match(state.problem,/5500/);await oversized.stop(session.id);
});

test('audio tails are non-destructive, cursor-scoped and capped at five preview minutes',()=>{
 const recorder=new Recorder();recorder.state='recording';recorder.session={context:{sampleRate:8000}};
 const chunk=new Float32Array(8000*301);chunk.fill(0.25);recorder.chunks=[chunk];recorder.samples=chunk.length;
 const tail=recorder.snapshotSince(0);assert.equal(tail.dropped,true);assert.equal(tail.cursor,chunk.length);
 assert.equal(tail.audio.byteLength,44+8000*300*2);assert.equal(recorder.chunks[0],chunk);assert.equal(recorder.samples,8000*301);
 assert.equal(recorder.snapshotSince(tail.cursor),null);assert.throws(()=>recorder.snapshotSince(tail.cursor+1));
});

test('late LLM output cannot replace notes after stop',async()=>{
 let finish;const live=new LiveNotes({modelRoot:'models',recognize:async()=>({text:'Recorded source'}),generate:()=>new Promise(resolve=>{finish=resolve;})});
 const {id}=live.start(settings());const pending=live.update(id,audio());await tick();
 const stopping=live.stop(id);finish('Late notes');await pending;const state=await stopping;
 assert.equal(state.notes,'');assert.equal(state.stopped,true);
});
