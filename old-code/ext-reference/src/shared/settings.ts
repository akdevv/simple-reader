/** User settings, persisted in chrome.storage.local. */

export interface Settings {
  speed: number;
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export const DEFAULT_SETTINGS: Settings = {
  speed: 1,
};

/** get() with defaults merges stored values over them. */
export async function loadSettings(): Promise<Settings> {
  if (!chrome.storage?.local) return { ...DEFAULT_SETTINGS };
  return (await chrome.storage.local.get(DEFAULT_SETTINGS)) as Settings;
}

export function saveSettings(patch: Partial<Settings>): void {
  chrome.storage?.local?.set(patch).catch(() => {});
}
