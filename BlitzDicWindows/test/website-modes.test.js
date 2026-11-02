import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteHost, parseWebsiteModes, normalizeWebsiteModes, modeForContext} from '../src/website-modes.js';

test('website rules retain canonical host only and reject ambiguous inputs', () => {
  assert.equal(websiteHost(' https://WWW.Mail.Example.com:8443/path?private=query#fragment '), 'mail.example.com');
  assert.equal(websiteHost('bücher.de'), 'xn--bcher-kva.de');
  assert.equal(websiteHost('localhost:8080/test'), 'localhost');
  assert.equal(websiteHost('http://[::1]:1234/private'), '[::1]');
  for (const input of ['', null, 'mail google.com', '*.example.com', 'https://user:secret@example.com',
    'file:///C:/private', 'data:text/html,test', 'javascript:alert(1)', '.example.com', 'example.com.', '-bad.com', 'com'])
    assert.equal(websiteHost(input), null, String(input));
  assert.deepEqual(parseWebsiteModes('https://www.Example.com/private?secret=x => clean\nmail.example.com => calm'),
    [{host:'example.com',mode:'clean'},{host:'mail.example.com',mode:'calm'}]);
  assert.throws(() => parseWebsiteModes('www.example.com => clean\nexample.com => calm'), /Doppelte/);
  assert.throws(() => parseWebsiteModes('example.com => unknown'));
  assert.throws(() => normalizeWebsiteModes(Array(201).fill({host:'example.com',mode:'clean'})));
});

test('most specific website overrides app, exact boundaries and explicit modes stay intact', () => {
  const settings = {appModes:[{executable:'chrome.exe',mode:'emoji'}],websiteModes:parseWebsiteModes(
    'example.com => clean\nmail.example.com => calm\nplain.example.com => verbatim')};
  const mode = (host, requested='verbatim') => modeForContext(requested,{host,executable:'chrome.exe'},settings);
  assert.equal(mode('mail.example.com'),'calm');
  assert.equal(mode('deep.mail.example.com'),'calm');
  assert.equal(mode('example.com'),'clean');
  assert.equal(mode('notexample.com'),'emoji');
  assert.equal(mode('example.com.evil.test'),'emoji');
  assert.equal(mode('plain.example.com'),'verbatim');
  assert.equal(mode(null),'emoji');
  assert.equal(mode('mail.example.com','clean'),'clean');
  assert.equal(mode('mail.example.com','emoji'),'emoji');
  const available = value => ['verbatim','emoji','clean'].includes(value);
  assert.equal(modeForContext('verbatim',{host:'mail.example.com',executable:'chrome.exe'},settings,available),'emoji');
  assert.equal(modeForContext('verbatim',{host:'mail.example.com',executable:'other.exe'},settings,available),'verbatim');
});
