/**
 * Unified WebExtension API wrapper for Chrome/Firefox/Safari.
 * Uses `browser` where available (promise-based) and falls back to `chrome` callbacks.
 */
const api = globalThis.browser || globalThis.chrome;
const isBrowser = !!globalThis.browser;

/**
 * Convert a callback-style extension API into a Promise.
 * @template T
 * @param {Function} fn
 * @param {Array<any>} [args]
 * @returns {Promise<T>}
 */
function withCallback(fn, args = []) {
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const err = api?.runtime?.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

/** @type {{ get: (area: "sync"|"local"|"session", keys: any) => Promise<any>, set: (area: "sync"|"local"|"session", value: any) => Promise<void>, area: (area: "sync"|"local"|"session") => any, sessionAvailable: () => boolean }} */
const storage = {
  get: (area, keys) => {
    if (isBrowser) return api.storage[area].get(keys);
    return withCallback(api.storage[area].get.bind(api.storage[area]), [keys]);
  },
  set: (area, value) => {
    if (isBrowser) return api.storage[area].set(value);
    return withCallback(api.storage[area].set.bind(api.storage[area]), [value]);
  },
  area: (area) => api.storage[area],
  sessionAvailable: () => Boolean(api.storage?.session)
};

/** @type {{ query: (queryInfo: any) => Promise<any[]>, create: (createProperties: any) => Promise<any> }} */
const tabs = {
  query: (queryInfo) => {
    if (isBrowser) return api.tabs.query(queryInfo);
    return withCallback(api.tabs.query.bind(api.tabs), [queryInfo]);
  },
  create: (createProperties) => {
    if (isBrowser) return api.tabs.create(createProperties);
    return withCallback(api.tabs.create.bind(api.tabs), [createProperties]);
  }
};

/** @type {{ getURL: (path: string) => string, connect: (connectInfo?: any) => any, sendMessage: (message: any) => Promise<any>, openOptionsPage: () => Promise<void>, onMessage: any, onConnect: any, onInstalled: any, lastError: () => any }} */
const runtime = {
  getURL: (path) => api.runtime.getURL(path),
  connect: (connectInfo) => api.runtime.connect(connectInfo),
  sendMessage: (message) => {
    if (isBrowser) return api.runtime.sendMessage(message);
    return withCallback(api.runtime.sendMessage.bind(api.runtime), [message]);
  },
  openOptionsPage: () => {
    if (isBrowser) return api.runtime.openOptionsPage();
    return withCallback(api.runtime.openOptionsPage.bind(api.runtime));
  },
  onMessage: api.runtime.onMessage,
  onConnect: api.runtime.onConnect,
  onInstalled: api.runtime.onInstalled,
  lastError: () => api.runtime.lastError
};

/** @type {{ executeScript: (details: any) => Promise<any> }} */
const scripting = {
  executeScript: (details) => {
    if (isBrowser) return api.scripting.executeScript(details);
    return withCallback(api.scripting.executeScript.bind(api.scripting), [details]);
  }
};

/** @type {{ create: (options: any) => Promise<any> }} */
const notifications = {
  create: (options) => {
    if (isBrowser) return api.notifications.create(options);
    return withCallback(api.notifications.create.bind(api.notifications), [options]);
  }
};

/** @type {{ create: (name: string, alarmInfo?: any) => void, onAlarm: any }} */
const alarms = {
  create: (name, alarmInfo) => api.alarms.create(name, alarmInfo),
  onAlarm: api.alarms.onAlarm
};

/** @type {{ create: (createProperties: any) => void, onClicked: any }} */
const contextMenus = {
  create: (createProperties) => api.contextMenus.create(createProperties),
  onClicked: api.contextMenus.onClicked
};

/**
 * Platform wrapper with a consistent promise-based interface.
 */
export const platform = {
  api,
  isBrowser,
  storage,
  tabs,
  runtime,
  scripting,
  notifications,
  alarms,
  contextMenus
};
