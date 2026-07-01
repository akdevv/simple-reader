import type { Message } from "./messages";
import { IDLE_STATE } from "./messages";

/** Tab currently being read; offscreen state messages get relayed here for highlighting. */
let readingTabId: number | null = null;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification:
      "Runs the local text-to-speech model and plays the generated audio.",
  });
}

// Pages Chrome never lets extensions touch.
const RESTRICTED_URL =
  /^(chrome|chrome-extension|edge|about|devtools|view-source):|^https:\/\/chrome\.google\.com\/webstore|^https:\/\/chromewebstore\.google\.com/;

async function startReading(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  if (tab.url && RESTRICTED_URL.test(tab.url)) {
    throw new Error(
      "Chrome doesn't allow extensions on this page. Try a regular article.",
    );
  }
  readingTabId = tab.id;

  await ensureOffscreen();
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["content.css"],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });
  // Content script is idempotent; ask it to (re)extract the page.
  await chrome.tabs.sendMessage(tab.id, { type: "sr:extract" });
}

chrome.runtime.onMessage.addListener((msg: Message, sender) => {
  switch (msg.type) {
    case "sr:start":
      startReading().catch((err) => {
        console.error("[simple-reader] start failed:", err);
        chrome.runtime
          .sendMessage({
            type: "sr:state",
            state: {
              ...IDLE_STATE,
              phase: "error",
              error:
                err instanceof Error && err.message
                  ? err.message
                  : "This page can't be read.",
            },
          } satisfies Message)
          .catch(() => {});
      });
      break;

    case "sr:sentences":
      if (sender.tab?.id) readingTabId = sender.tab.id;
      chrome.runtime
        .sendMessage({
          type: "sr:generate",
          texts: msg.texts,
          pageKey: msg.pageKey,
        } satisfies Message)
        .catch(() => {});
      break;

    case "sr:state": {
      // Relay playback position to the content script for in-page highlighting.
      if (readingTabId === null) break;
      const { phase, index } = msg.state;
      const relay: Message =
        (phase === "playing" || phase === "paused") && index >= 0
          ? { type: "sr:highlight", index }
          : { type: "sr:clear" };
      chrome.tabs.sendMessage(readingTabId, relay).catch(() => {
        // Tab navigated away or closed — stop playback.
        readingTabId = null;
        chrome.runtime.sendMessage({
          type: "sr:control",
          action: "stop",
        } satisfies Message);
      });
      break;
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== readingTabId) return;
  readingTabId = null;
  chrome.runtime
    .sendMessage({ type: "sr:control", action: "stop" } satisfies Message)
    .catch(() => {});
});
