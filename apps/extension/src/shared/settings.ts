import type { Speed } from "@sr/core";

export interface Settings {
  speed: Speed;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1 };

/** Stored values merged over defaults. */
export async function loadSettings(): Promise<Settings> {
  return (await chrome.storage.local.get(DEFAULT_SETTINGS)) as Settings;
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.local.set(patch);
}
