export interface Settings {
  speed: number;
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2, 3];

export const DEFUALT_SETTINGS: Settings = {
  speed: 1,
};

export async function getSettings(): Promise<Settings> {
  if (!chrome.storage?.local) return { ...DEFUALT_SETTINGS };
  return (await chrome.storage?.local.get(DEFUALT_SETTINGS)) as Settings;
}

export function setSettings(patch: Partial<Settings>): void {
  chrome.storage?.local?.set(patch).catch(() => {});
}
