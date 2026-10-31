import { safeStorage } from 'electron';

export async function windowsCrypto() {
  if (process.platform !== 'win32' || !await safeStorage.isAsyncEncryptionAvailable())
    throw new Error('Windows-Datenschutz für die lokale Speicherung ist nicht verfügbar.');
  return {
    encrypt: text => safeStorage.encryptStringAsync(text),
    decrypt: async data => (await safeStorage.decryptStringAsync(data)).result,
  };
}
