import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { autostartArgument, installedCopy, loginItemDeactivated, loginItemName, syncLoginItem } from '../src/login-item.js';

const exe = 'C:\\Users\\Praxis\\AppData\\Local\\Programs\\BlitzDic\\BlitzDic.exe';

// Mirrors Electron's Windows login items: HKCU Run value plus StartupApproved state.
function fakeApp(items = []) {
  return {
    items, calls: [],
    getLoginItemSettings() { return { launchItems: this.items.map(item => ({ ...item })) }; },
    setLoginItemSettings(settings) {
      this.calls.push(settings);
      const previous = this.items.find(item => item.name === settings.name);
      this.items = this.items.filter(item => item.name !== settings.name);
      if (settings.openAtLogin) this.items.push({ name: settings.name, path: settings.path, args: settings.args, scope: 'user',
        enabled: settings.enabled ?? previous?.enabled ?? true });
    },
  };
}
const entry = (overrides = {}) => ({ name: loginItemName, path: exe, args: [autostartArgument], scope: 'user', enabled: true, ...overrides });

test('first start registers a hidden autostart for the installed executable', () => {
  const app = fakeApp();
  syncLoginItem(app, true, { path: exe });
  assert.deepEqual(app.items, [entry()]);
});

test('an existing current entry is left alone, including a Task Manager deactivation', () => {
  const app = fakeApp([entry({ enabled: false })]);
  syncLoginItem(app, true, { path: exe });
  assert.equal(app.calls.length, 0);
  assert.equal(loginItemDeactivated(app, exe), true);
});

test('switching the setting on again re-enables a deactivated entry', () => {
  const app = fakeApp([entry({ enabled: false })]);
  syncLoginItem(app, true, { path: exe, explicit: true });
  assert.deepEqual(app.items, [entry()]);
  assert.equal(loginItemDeactivated(app, exe), false);
});

test('switching the setting off removes the entry', () => {
  const app = fakeApp([entry(), { name: 'Other', path: 'C:\\other.exe', args: [], scope: 'user', enabled: true }]);
  syncLoginItem(app, false, { path: exe, explicit: true });
  assert.deepEqual(app.items.map(item => item.name), ['Other']);
  syncLoginItem(app, false, { path: exe });
  assert.equal(app.calls.length, 1, 'nothing left to remove');
});

test('an entry from another install location is updated and keeps its on/off state', () => {
  const app = fakeApp([entry({ path: 'D:\\Alt\\BlitzDic.exe', enabled: false })]);
  syncLoginItem(app, true, { path: exe });
  assert.deepEqual(app.items, [entry({ enabled: false })]);
});

test('path comparison ignores Windows letter case', () => {
  const app = fakeApp([entry({ path: exe.toUpperCase() })]);
  syncLoginItem(app, true, { path: exe });
  assert.equal(app.calls.length, 0);
});

test('an entry without the hidden-start argument is replaced', () => {
  const app = fakeApp([entry({ args: [] })]);
  syncLoginItem(app, true, { path: exe });
  assert.deepEqual(app.items, [entry()]);
});

test('machine-wide entries of the same name are not touched', () => {
  const app = fakeApp([entry({ scope: 'machine' })]);
  assert.equal(loginItemDeactivated(app, exe), false);
  syncLoginItem(app, false, { path: exe });
  assert.equal(app.calls.length, 0);
});

test('only a copy installed by the setup manages autostart, not an unpacked or test build', () => {
  const files = new Set([String.raw`C:\Program Files\BlitzDic\Uninstall BlitzDic.exe`]);
  const exists = path => files.has(path);
  assert.equal(installedCopy(String.raw`C:\Program Files\BlitzDic\BlitzDic.exe`, exists), true);
  assert.equal(installedCopy(String.raw`C:\Projekte\BlitzDic\dist\windows-1\win-unpacked\BlitzDic.exe`, exists), false);
  assert.equal(installedCopy(undefined, exists), false);
  // The real file check: this test file's folder has no uninstaller.
  assert.equal(installedCopy(fileURLToPath(import.meta.url)), false);
});
