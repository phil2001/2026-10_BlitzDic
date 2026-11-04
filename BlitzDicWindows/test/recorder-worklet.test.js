import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/recorder-worklet.js',import.meta.url),'utf8');

test('separate worklet keeps source positions across multichannel input and source gaps',()=>{
 let Processor;const messages=[];
 runInNewContext(source,{AudioWorkletProcessor:class{port={postMessage:value=>messages.push(value)};},registerProcessor:(_,value)=>{Processor=value;},Float32Array});
 const node=new Processor({processorOptions:{separate:true}});
 node.process([[Float32Array.of(.2,.4)],[Float32Array.of(.4,.8),Float32Array.of(.6,1)]]);
 assert.equal(messages[0].length,4);
 for(const [i,value] of [.2,.5,.4,.9].entries())assert.ok(Math.abs(messages[0][i]-value)<1e-6);
 node.process([[],[Float32Array.of(.7,.8)]]);
 assert.deepEqual(Array.from(messages[1]).map(value=>Math.round(value*10)),[0,7,0,8]);
 node.process([[Float32Array.of(.1,.2)],[]]);
 assert.deepEqual(Array.from(messages[2]).map(value=>Math.round(value*10)),[1,0,2,0]);
});
