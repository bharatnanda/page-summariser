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
    await platform.storage.set(fallback, value);
  }
}
