import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {EscapeControl} from '../src/escape-control.js';

function fixture() {
  const child = new EventEmitter();
  Object.assign(child, {stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {this.killed = true;}});
  let escapes = 0, errors = 0;
  const control = new EscapeControl({pythonPath: 'python.exe', spawnProcess: () => child,
    onEscape: () => escapes++, onError: () => errors++});
  const send = event => child.stdout.write(`${JSON.stringify(event)}\n`);
  const state = (id, active) => send({event: 'state', id, active});
  return {child, control, send, state, get escapes() {return escapes;}, get errors() {return errors;}};
}

test('Escape ownership follows acknowledged commands and ignores late generations', async () => {
  const f = fixture();
  try {
    const first = f.control.setActive(true); f.send({event: 'ready'});
    await new Promise(setImmediate); f.state(1, true); await first;
    f.send({event: 'escape', id: 1}); assert.equal(f.escapes, 1);
    const off = f.control.setActive(false);
    f.send({event: 'escape', id: 1}); assert.equal(f.escapes, 1);
    await new Promise(setImmediate); f.state(2, false); await off;
    const second = f.control.setActive(true);
    await new Promise(setImmediate); f.state(3, true); await second;
    f.send({event: 'escape', id: 1}); assert.equal(f.escapes, 1);
    f.send({event: 'escape', id: 3}); assert.equal(f.escapes, 2);
  } finally {f.control.destroy();}
});

test('helper failure rejects outstanding commands and future attempts instead of hanging', async () => {
  const f = fixture();
  const operation = f.control.setActive(true); f.send({event: 'ready'});
  await new Promise(setImmediate); f.child.emit('close', 1);
  await assert.rejects(operation, /Escape-Steuerung/);
  await assert.rejects(f.control.setActive(true), /Escape-Steuerung/);
  assert.equal(f.errors, 1); assert.equal(f.child.killed, true);
  f.control.destroy();
});

test('shutdown ignores queued Escape and rejects an unacknowledged command', async () => {
  const f = fixture();
  const operation = f.control.setActive(true); f.send({event: 'ready'});
  await new Promise(setImmediate); f.control.destroy();
  f.send({event: 'escape', id: 1});
  await assert.rejects(operation, /beendet/);
  assert.equal(f.escapes, 0); assert.equal(f.errors, 0);
});
