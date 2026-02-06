export function setupMockBrowser() {
  const store = {
    local: {},
    sync: {}
  };

  function readFrom(area, keys) {
    const bucket = store[area] || {};
    if (Array.isArray(keys)) {
      return keys.reduce((acc, key) => {
        acc[key] = bucket[key];
        return acc;
      }, {});
    }
    if (typeof keys === 'string') {
      return { [keys]: bucket[keys] };
    }
    if (keys && typeof keys === 'object') {
      return Object.keys(keys).reduce((acc, key) => {
        acc[key] = bucket[key] ?? keys[key];
        return acc;
      }, {});
    }
    return { ...bucket };
  }

  function writeTo(area, value) {
    const bucket = store[area] || (store[area] = {});
    Object.assign(bucket, value);
  }

  globalThis.browser = {
    storage: {
      local: {
        get: async (keys) => readFrom('local', keys),
        set: async (value) => writeTo('local', value)
      },
      sync: {
        get: async (keys) => readFrom('sync', keys),
        set: async (value) => writeTo('sync', value)
      }
    }
  };

  return store;
}

export function resetGlobals() {
  delete globalThis.browser;
  delete globalThis.chrome;
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
