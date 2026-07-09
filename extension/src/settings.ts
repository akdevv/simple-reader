/** User settings, persisted in chrome.storage.local. */

export interface Settings {
  speed: number;
  highlightColor: string;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export const HIGHLIGHT_COLORS = [
  { name: "Amber", value: "rgba(255, 200, 60, 0.45)" },
  { name: "Mint", value: "rgba(80, 220, 150, 0.40)" },
  { name: "Sky", value: "rgba(90, 180, 255, 0.40)" },
  { name: "Rose", value: "rgba(255, 120, 170, 0.40)" },
  { name: "Lilac", value: "rgba(180, 140, 255, 0.40)" },
];

export const DEFAULT_SETTINGS: Settings = {
  speed: 1,
  highlightColor: HIGHLIGHT_COLORS[0].value,
};

/** get() with defaults merges stored values over them. */
export async function loadSettings(): Promise<Settings> {
  if (!chrome.storage?.local) return { ...DEFAULT_SETTINGS };
  return (await chrome.storage.local.get(DEFAULT_SETTINGS)) as Settings;
}

export function saveSettings(patch: Partial<Settings>): void {
  chrome.storage?.local?.set(patch).catch(() => {});
}

export function onSettingsChanged(cb: (patch: Partial<Settings>) => void): void {
  if (!chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const patch: Partial<Settings> = {};
    for (const key of ["speed", "highlightColor"] as const) {
      if (key in changes) (patch as Record<string, unknown>)[key] = changes[key].newValue;
    }
    if (Object.keys(patch).length > 0) cb(patch);
  });
}
