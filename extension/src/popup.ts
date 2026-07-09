import type { Message, ReaderState } from "./messages";
import { IDLE_STATE } from "./messages";
import type { Settings } from "./settings";
import {
  DEFAULT_SETTINGS,
  HIGHLIGHT_COLORS,
  SPEEDS,
  loadSettings,
  saveSettings,
} from "./settings";

const $ = (id: string) => document.getElementById(id)!;

const views = {
  idle: $("view-idle"),
  loading: $("view-loading"),
  player: $("view-player"),
  error: $("view-error"),
};

function show(name: keyof typeof views): void {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

/** Show the bar only for a real download (determinate); spinner covers the rest. */
function setLoadingBar(pct: number | null): void {
  $("loading-bar").hidden = pct === null;
  ($("loading-fill") as HTMLElement).style.width = pct === null ? "0%" : `${pct}%`;
}

function render(state: ReaderState): void {
  switch (state.phase) {
    case "idle":
      show("idle");
      break;

    case "extracting":
      show("loading");
      $("loading-label").textContent = "Reading page…";
      $("loading-hint").textContent = "";
      setLoadingBar(null);
      break;

    case "loading-model":
      show("loading");
      // No progress events = the voice is already downloaded, just warming up.
      $("loading-label").textContent =
        state.modelProgress > 0
          ? `Downloading voice… ${state.modelProgress}%`
          : "Preparing voice…";
      $("loading-hint").textContent =
        state.modelProgress > 0
          ? "Only happens once — it's cached after this"
          : "";
      setLoadingBar(state.modelProgress > 0 ? state.modelProgress : null);
      break;

    case "generating":
    case "playing":
    case "paused":
    case "done": {
      show("player");

      const generating =
        state.phase !== "done" && state.generated < state.total;
      $("gen-row").hidden = !generating;
      $("gen-label").textContent =
        `Generating audio ${state.generated}/${state.total}`;

      // Per product decision: ▶ is shown WHILE playing (status), ⏸ when paused.
      $("btn-toggle").classList.toggle("playing", state.phase === "playing");

      const pos = Math.max(0, state.index);
      ($("progress-fill") as HTMLElement).style.width = state.total
        ? `${((state.phase === "done" ? state.total : pos + 1) / state.total) * 100}%`
        : "0%";
      $("sentence-label").textContent =
        state.phase === "done"
          ? "Finished — press to replay"
          : state.index >= 0
            ? `${state.phase === "playing" ? "Playing" : "Paused"} · ${state.index + 1} of ${state.total}`
            : `${state.total} sentences`;

      ($("btn-prev") as HTMLButtonElement).disabled = state.index <= 0;
      ($("btn-next") as HTMLButtonElement).disabled =
        state.index >= state.total - 1;
      break;
    }

    case "error":
      show("error");
      $("error-label").textContent = state.error ?? "Something went wrong.";
      break;
  }
}

function send(msg: Message): void {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

/* ---------- playback controls ---------- */

$("btn-start").addEventListener("click", () => {
  render({ ...IDLE_STATE, phase: "extracting" });
  send({ type: "sr:start" });
});
$("btn-retry").addEventListener("click", () => {
  render({ ...IDLE_STATE, phase: "extracting" });
  send({ type: "sr:start" });
});
$("btn-toggle").addEventListener("click", () => {
  // Flip optimistically for instant feedback; the state broadcast corrects it.
  $("btn-toggle").classList.toggle("playing");
  send({ type: "sr:control", action: "toggle" });
});
$("btn-next").addEventListener("click", () =>
  send({ type: "sr:control", action: "next" }),
);
$("btn-prev").addEventListener("click", () =>
  send({ type: "sr:control", action: "prev" }),
);

/* ---------- settings ---------- */

let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/** Persist AND push directly to the offscreen doc (it can't read storage). */
function updateSettings(patch: Partial<Settings>): void {
  currentSettings = { ...currentSettings, ...patch };
  saveSettings(patch);
  send({ type: "sr:settings", settings: currentSettings });
}

const panel = $("panel-settings");
$("btn-settings").addEventListener("click", () => {
  panel.hidden = !panel.hidden;
  $("btn-settings").setAttribute("aria-expanded", String(!panel.hidden));
});

const speedSelect = $("sel-speed") as HTMLSelectElement;
for (const speed of SPEEDS) {
  speedSelect.add(new Option(`${speed}×`, String(speed)));
}
speedSelect.addEventListener("change", () =>
  updateSettings({ speed: Number(speedSelect.value) }),
);

const swatches = $("swatches");
function markActiveSwatch(color: string): void {
  for (const el of swatches.children) {
    el.setAttribute(
      "aria-checked",
      String(el.getAttribute("data-color") === color),
    );
  }
}
for (const { name, value } of HIGHLIGHT_COLORS) {
  const btn = document.createElement("button");
  btn.className = "swatch";
  btn.title = name;
  btn.setAttribute("role", "radio");
  btn.setAttribute("aria-checked", "false");
  btn.setAttribute("data-color", value);
  btn.style.backgroundColor = value;
  btn.addEventListener("click", () => {
    updateSettings({ highlightColor: value });
    markActiveSwatch(value);
  });
  swatches.appendChild(btn);
}

loadSettings().then((s) => {
  currentSettings = s;
  speedSelect.value = String(s.speed);
  markActiveSwatch(s.highlightColor);
});

/* ---------- state sync ---------- */

// Live updates while the popup is open.
chrome.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type === "sr:state") render(msg.state);
});

// Render idle immediately so the popup opens at full size (no layout jump),
// then ask the offscreen doc; no answer means nothing is running.
render(IDLE_STATE);
chrome.runtime
  .sendMessage({ type: "sr:get-state" } satisfies Message)
  .then((state?: ReaderState) => render(state ?? IDLE_STATE))
  .catch(() => {});
