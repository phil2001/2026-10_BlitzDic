export const releasesURL = 'https://github.com/phil2001/BlitzDic/releases';
// The repository is addressed by its permanent GitHub id (phil2001/BlitzDic, formerly
// 2026-10_BlitzDic): a rename would otherwise turn the request into a refused redirect.
const endpoint = 'https://api.github.com/repositories/1440779940/releases/latest';
// Download links carry the repository's current name; they must stay in this owner's account.
const releasePage = /^https:\/\/github\.com\/phil2001\/([A-Za-z0-9._-]+)\/releases\/tag\/[^/]+$/;

function version(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  const pre = match[4]?.split('.') ?? [];
  if (pre.some(part => !part || (/^\d+$/.test(part) && part.length > 1 && part[0] === '0'))) return null;
  return {core: match.slice(1, 4).map(BigInt), pre};
}

function newerStable(candidate, installed) {
  for (let index = 0; index < 3; index++) {
    if (candidate.core[index] !== installed.core[index]) return candidate.core[index] > installed.core[index];
  }
  return installed.pre.length > 0;
}

// Only an explicit user action calls this function. No credentials, settings,
// transcript or device identifier is sent, and no installer is downloaded.
export async function checkRelease(installedVersion, {fetchImpl = fetch, timeoutMs = 10000} = {}) {
  const installed = version(installedVersion);
  if (!installed) throw new Error('Installierte Versionsnummer konnte nicht geprüft werden.');
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetchImpl(endpoint, {signal, redirect: 'error', credentials: 'omit',
      headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'BlitzDic'}});
  } catch {
    throw new Error(signal.aborted ? 'Zeitüberschreitung bei der Versionsprüfung.' : 'GitHub ist nicht erreichbar. Lokale Diktate funktionieren weiterhin.');
  }
  if (response.status === 404) {await response.body?.cancel(); return {state: 'unpublished'};}
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error([403, 429].includes(response.status) ? 'GitHub-Anfragelimit erreicht. Bitte später erneut prüfen.' : 'GitHub konnte die Veröffentlichung nicht liefern.');
  }
  let release;
  try {
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 256 * 1024) {await reader.cancel(); throw new Error('size');}
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    release = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    throw new Error(signal.aborted ? 'Zeitüberschreitung bei der Versionsprüfung.' : 'GitHub lieferte keine gültigen Veröffentlichungsdaten.');
  }
  const latest = version(release?.tag_name);
  if (!latest || latest.pre.length || release.draft !== false || release.prerelease !== false)
    throw new Error('Keine gültige stabile Veröffentlichung gefunden.');
  const repository = releasePage.exec(typeof release.html_url === 'string' ? release.html_url : '')?.[1];
  if (!repository) return {state: 'no-windows-installer', version: release.tag_name};
  const assetPrefix = `https://github.com/phil2001/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
  const releaseVersion = release.tag_name.replace(/^v/, '');
  // GitHub normalizes spaces in uploaded asset names to dots. Accept only
  // these two exact product/version names and their matching repository URL.
  const installerNames = [`BlitzDic Setup ${releaseVersion}.exe`, `BlitzDic.Setup.${releaseVersion}.exe`];
  const windowsInstaller = Array.isArray(release.assets) && release.assets.some(asset =>
    installerNames.includes(asset?.name) &&
    asset.browser_download_url === assetPrefix + encodeURIComponent(asset.name) &&
    Number.isSafeInteger(asset.size) && asset.size > 0);
  if (!windowsInstaller) return {state: 'no-windows-installer', version: release.tag_name};
  return {state: newerStable(latest, installed) ? 'available' : 'current', version: release.tag_name};
}

export function supportInfo({version, platform, arch, release}) {
  return `BlitzDic ${version}\nSystem: ${platform} ${release} (${arch})\n\n` +
    'Verwendetes Sprachmodell:\nWas habe ich gemacht?\nWas ist passiert?\nWas habe ich erwartet?\n\n' +
    'Bitte keine Patientendaten, Diktate, Aufnahmen oder API-Schluessel ergaenzen.';
}
