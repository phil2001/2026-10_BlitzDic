import { BrowserWindow, ipcMain, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'ui/recording-indicator.html')).href;

// A separate sandboxed surface with no settings, transcript or general app IPC.
export class RecordingIndicator {
  constructor(onStop) {
    this.active = false; this.enabled = true; this.hidden = false; this.epoch = 0;
    this.stopListener = event => { if (this.trusted(event) && this.active) onStop(); };
    this.hideListener = event => {
      if (this.trusted(event) && this.active) { this.hidden = true; this.hide(); }
    };
    ipcMain.on('indicator-stop', this.stopListener);
    ipcMain.on('indicator-hide', this.hideListener);
  }
  trusted(event) {
    return this.window && !this.window.isDestroyed() && event.sender === this.window.webContents &&
      event.senderFrame === this.window.webContents.mainFrame && event.senderFrame.url === url;
  }
  async ensureWindow() {
    if (this.window && !this.window.isDestroyed()) return this.ready;
    const {workArea: area} = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    this.window = new BrowserWindow({width: 284, height: 68,
      x: Math.round(area.x + (area.width - 284) / 2), y: area.y + area.height - 100,
      title: 'BlitzDic · Aufnahme', show: false, frame: false, transparent: true,
      focusable: false, skipTaskbar: true, alwaysOnTop: true, resizable: false,
      minimizable: false, maximizable: false, hasShadow: false,
      webPreferences: {preload: join(root, 'desktop/indicator-preload.cjs'),
        sandbox: true, contextIsolation: true, nodeIntegration: false}});
    this.window.setMenuBarVisibility(false);
    this.window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    this.window.webContents.on('will-navigate', event => event.preventDefault());
    this.ready = this.window.loadURL(url);
    return this.ready;
  }
  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide(); this.window.webContents.send('indicator-active', null);
    }
  }
  async setEnabled(enabled) { this.enabled = enabled; await this.sync(); }
  async setActive(active) {
    if (active && !this.active) { this.hidden = false; this.startedAt = Date.now(); }
    this.active = active; await this.sync();
  }
  async sync() {
    const epoch = ++this.epoch;
    if (!this.active || !this.enabled || this.hidden) { this.hide(); return; }
    await this.ensureWindow();
    if (epoch !== this.epoch || !this.active || !this.enabled || this.hidden || this.window.isDestroyed()) return;
    const bounds = this.window.getBounds(), area = screen.getDisplayMatching(bounds).workArea;
    // Recover a dragged window after a monitor or work-area change.
    this.window.setPosition(Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width))),
      Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height))));
    this.window.webContents.send('indicator-active', this.startedAt);
    this.window.showInactive();
  }
  level(value) {
    if (this.active && this.enabled && !this.hidden && this.window && !this.window.isDestroyed())
      this.window.webContents.send('indicator-level', Math.max(0, Math.min(1, value)));
  }
  destroy() {
    this.active = false; this.epoch++;
    ipcMain.removeListener('indicator-stop', this.stopListener);
    ipcMain.removeListener('indicator-hide', this.hideListener);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
