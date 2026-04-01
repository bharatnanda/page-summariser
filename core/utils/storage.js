import { platform } from '../platform.js';

export async function storageGetWithFallback(keys, primary = 'local', fallback = 'sync') {
  try {
    return await platform.storage.get(primary, keys);
  } catch (error) {
    return await platform.storage.get(fallback, keys);
  }
}

export async function storageSetWithFallback(value, primary = 'local', fallback = 'sync') {
  try {
    await platform.storage.set(primary, value);
  } catch (error) {
    // Quota errors should not fall back — the fallback area likely has stricter limits.
    // Only fall back for availability/API errors.
    const msg = String(error?.message || '');
    if (msg.includes('QUOTA_BYTES') || msg.includes('Quota')) throw error;
    await platform.storage.set(fallback, value);
  }
}
