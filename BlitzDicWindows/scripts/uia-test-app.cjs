const {app, BrowserWindow} = require('electron');
// BLITZDIC_TEST_LAZY_ACCESSIBILITY=1 leaves accessibility as an ordinary app has it.
const forced = process.env.BLITZDIC_TEST_LAZY_ACCESSIBILITY !== '1';
if (forced) app.commandLine.appendSwitch('force-renderer-accessibility');
app.whenReady().then(async () => {
  if (forced) app.setAccessibilitySupportEnabled(true);
  const window = new BrowserWindow({width: 700, height: 420});
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <title>BlitzDic UI Automation test</title>
    <label>Test document<textarea id="editor" rows="6" cols="60">Before </textarea></label>
    <label>Password<input id="password" type="password" value="hidden"></label>
    <label>Read only<textarea id="readonly" readonly>Do not change</textarea></label>
    <div id="rich" contenteditable="true" role="textbox" aria-label="Rich editor">Rich text</div>`));
  window.show(); window.focus();
});
app.on('window-all-closed', () => app.quit());
