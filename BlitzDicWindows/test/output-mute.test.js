import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {OutputMute} from '../src/output-mute.js';

const tick = () => new Promise(setImmediate);
function fixture() {
  const child = new EventEmitter(), commands = [];
  Object.assign(child, {stdin:new PassThrough(), stdout:new PassThrough(), stderr:new PassThrough()});
  child.stdin.on('data', data => commands.push(JSON.parse(data.toString())));
  let spawns = 0, errors = 0;
  const control = new OutputMute({pythonPath:'python.exe', spawnProcess:()=>{spawns++; return child;}, onError:()=>errors++});
  const send = event => child.stdout.write(`${JSON.stringify(event)}\n`);
  return {child, commands, control, send, ack:command=>send({event:'state',...command}), get spawns(){return spawns;}, get errors(){return errors;}};
}

test('disabled/idle output mute does not start a helper or touch an endpoint', async () => {
  const f=fixture(); await f.control.setActive(false); assert.equal(f.spawns,0); f.control.destroy();
});

test('stop during helper startup supersedes mute before any active command is sent', async () => {
  const f=fixture();
  try {
    const on=f.control.setActive(true); await tick();
    const off=f.control.setActive(false); f.send({event:'ready'}); await tick();
    assert.deepEqual(f.commands,[{id:1,active:false}]); f.ack(f.commands[0]); await Promise.all([on,off]);
  } finally {f.control.destroy();}
});

test('in-flight mute is followed by acknowledged restore; shutdown requests EOF without killing its owner', async () => {
  const f=fixture();
  try {
    const on=f.control.setActive(true); await tick(); f.send({event:'ready'}); await tick();
    const off=f.control.setActive(false); assert.deepEqual(f.commands,[{id:1,active:true}]);
    f.ack(f.commands[0]); await on; await tick();
    assert.deepEqual(f.commands[1],{id:2,active:false}); f.ack(f.commands[1]); await off;
    const again=f.control.setActive(true); await tick(); f.ack(f.commands[2]); await again;
    f.control.destroy(); assert.equal(f.child.stdin.writableEnded,true);
  } finally {f.control.destroy();}
});

test('helper loss rejects pending work and requests restoration instead of force killing', async () => {
  const f=fixture();
  try {
    const on=f.control.setActive(true); await tick(); f.send({event:'ready'}); await tick();
    f.child.emit('close',1); await assert.rejects(on,/Stummschaltung/);
    assert.equal(f.child.stdin.writableEnded,true); assert.equal(f.errors,1);
    await assert.rejects(f.control.setActive(true),/Stummschaltung/); await f.control.setActive(false);
  } finally {f.control.destroy();}
});

test('a fresh recording cannot skip restoration of the previous endpoint lease', async () => {
  const f=fixture();
  try {
    const first=f.control.setActive(true); await tick(); f.send({event:'ready'}); await tick();
    f.ack(f.commands[0]); await first;
    const stop=f.control.setActive(false), next=f.control.setActive(true); await tick();
    assert.deepEqual(f.commands[1],{id:2,active:false});
    f.ack(f.commands[1]); await stop; await tick();
    assert.deepEqual(f.commands[2],{id:3,active:true}); f.ack(f.commands[2]); await next;
  } finally {f.control.destroy();}
});

test('a synchronous process launch failure cannot leave a permanently pending startup', async () => {
  const control = new OutputMute({pythonPath:'python.exe',spawnProcess:()=>{throw new Error('fixture failure');}});
  try {
    await assert.rejects(control.setActive(true),/Stummschaltung/);
    await assert.rejects(control.setActive(true),/Stummschaltung/);
    await control.setActive(false);
  } finally {control.destroy();}
});
