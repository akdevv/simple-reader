import type { Message, ReaderState } from "@/shared/messages";
import { IDLE_STATE } from "@/shared/messages";
import type { Settings } from "@/shared/settings";
import { DEFAULT_SETTINGS, SPEEDS, loadSettings, saveSettings } from "@/shared/settings";

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

function start(): void {
  render({ ...IDLE_STATE, phase: "extracting" });
  send({ type: "sr:start" });
}

function toggle(): void {
  // Flip optimistically for instant feedback; the state broadcast corrects it.
  $("btn-toggle").classList.toggle("playing");
  send({ type: "sr:control", action: "toggle" });
}

$("btn-start").addEventListener("click", start);
$("btn-retry").addEventListener("click", start);
$("btn-toggle").addEventListener("click", toggle);
$("btn-next").addEventListener("click", () =>
  send({ type: "sr:control", action: "next" }),
);
$("btn-prev").addEventListener("click", () =>
  send({ type: "sr:control", action: "prev" }),
);

/* ---------- keyboard (while the popup is open) ---------- */

document.addEventListener("keydown", (e) => {
  if (views.player.hidden) return;
  switch (e.code) {
    case "Space":
      e.preventDefault(); // don't "click" the focused button too
      toggle();
      break;
    case "ArrowRight":
      e.preventDefault();
      send({ type: "sr:control", action: "next" });
      break;
    case "ArrowLeft":
      e.preventDefault();
      send({ type: "sr:control", action: "prev" });
      break;
  }
});

/* ---------- speed ---------- */

let currentSettings: Settings = { ...DEFAULT_SETTINGS };
const speedBtn = $("btn-speed") as HTMLButtonElement;

function renderSpeed(): void {
  speedBtn.textContent = `${currentSettings.speed}×`;
}

speedBtn.addEventListener("click", () => {
  const i = SPEEDS.indexOf(currentSettings.speed);
  const speed = SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
  currentSettings = { ...currentSettings, speed };
  renderSpeed();
  saveSettings({ speed });
  // Push directly to the offscreen doc (it can't read storage itself).
  send({ type: "sr:settings", settings: currentSettings });
});

loadSettings().then((s) => {
  currentSettings = s;
  renderSpeed();
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
