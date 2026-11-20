// Windows autostart (HKCU Run key) for the installed app. Started this way, the
// app stays in the tray and loads the speech model, so dictation is ready.
export const loginItemName = 'BlitzDic';
export const autostartArgument = '--autostart';

const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

function entry(app, path) {
  const items = app.getLoginItemSettings({ path, args: [autostartArgument] }).launchItems ?? [];
  const existing = items.find(item => item.name === loginItemName && item.scope === 'user');
  return { existing, current: !!existing && samePath(existing.path, path) && !!existing.args?.includes(autostartArgument) };
}

// explicit: the user changed the setting just now. Only then is an entry that
// was deactivated in Task Manager or Windows Settings switched on again.
export function syncLoginItem(app, wanted, { path, explicit = false }) {
  const { existing, current } = entry(app, path);
  const base = { path, args: [autostartArgument], name: loginItemName };
  if (wanted) {
    if (explicit) app.setLoginItemSettings({ ...base, openAtLogin: true, enabled: true });
    // Missing, or left over from another install location: keep its on/off state.
    else if (!current) app.setLoginItemSettings({ ...base, openAtLogin: true, enabled: existing ? existing.enabled !== false : true });
  } else if (existing) {
    app.setLoginItemSettings({ ...base, openAtLogin: false });
  }
}

// true when the entry exists but Windows was told not to run it.
export function loginItemDeactivated(app, path) {
  const { existing } = entry(app, path);
  return !!existing && existing.enabled === false;
}
