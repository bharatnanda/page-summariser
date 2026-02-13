import { platform } from '../platform.js';

const THEME_KEY = 'theme';

export async function getStoredTheme() {
  try {
    const result = await platform.storage.get('sync', [THEME_KEY]);
    return result[THEME_KEY] || 'light';
  } catch (error) {
    return 'light';
  }
}

export function applyTheme(theme) {
  if (!document?.body) return;
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
}

export async function loadThemeAndApply() {
  const theme = await getStoredTheme();
  applyTheme(theme);
  return theme;
}
