import type { Message, ReaderState } from "./messages";
import { IDLE_STATE } from "./messages";
import {
  HIGHLIGHT_COLORS,
  SPEEDS,
  VOICES,
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

function render(state: ReaderState): void {
  switch (state.phase) {
    case "idle":
      show("idle");
      break;

    case "extracting":
      show("loading");
      $("loading-label").textContent = "Reading page…";
      ($("loading-fill") as HTMLElement).style.width = "10%";
      break;

    case "loading-model":
      show("loading");
      $("loading-label").textContent =
        state.modelProgress > 0
          ? `Downloading voice… ${state.modelProgress}%`
          : "Loading voice…";
      ($("loading-fill") as HTMLElement).style.width =
        `${state.modelProgress}%`;
      break;

    case "generating":
    case "playing":
    case "paused":
    case "done": {
      show("player");

      const generating =
        state.phase !== "done" && state.generated < state.total;
      $("gen-label").hidden = !generating;
      $("gen-label").textContent =
        `Generating audio… ${state.generated}/${state.total}`;

      $("icon-play").hidden = state.phase === "playing";
      $("icon-pause").hidden = state.phase !== "playing";

      const pos = Math.max(0, state.index);
      ($("progress-fill") as HTMLElement).style.width = state.total
        ? `${((state.phase === "done" ? state.total : pos + 1) / state.total) * 100}%`
        : "0%";
      $("sentence-label").textContent =
        state.phase === "done"
          ? "Finished"
          : state.index >= 0
            ? `Sentence ${state.index + 1} of ${state.total}`
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
$("btn-toggle").addEventListener("click", () =>
  send({ type: "sr:control", action: "toggle" }),
);
$("btn-next").addEventListener("click", () =>
  send({ type: "sr:control", action: "next" }),
);
$("btn-prev").addEventListener("click", () =>
  send({ type: "sr:control", action: "prev" }),
);

/* ---------- settings ---------- */

const panel = $("panel-settings");
$("btn-settings").addEventListener("click", () => {
  panel.hidden = !panel.hidden;
});

const voiceSelect = $("sel-voice") as HTMLSelectElement;
for (const voice of VOICES) {
  voiceSelect.add(new Option(voice.label, voice.id));
}
voiceSelect.addEventListener("change", () =>
  saveSettings({ voiceId: voiceSelect.value }),
);

const speedSelect = $("sel-speed") as HTMLSelectElement;
for (const speed of SPEEDS) {
  speedSelect.add(new Option(`${speed}×`, String(speed)));
}
speedSelect.addEventListener("change", () =>
  saveSettings({ speed: Number(speedSelect.value) }),
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
    saveSettings({ highlightColor: value });
    markActiveSwatch(value);
  });
  swatches.appendChild(btn);
}

loadSettings().then((s) => {
  voiceSelect.value = s.voiceId;
  speedSelect.value = String(s.speed);
  markActiveSwatch(s.highlightColor);
});

/* ---------- state sync ---------- */

// Live updates while the popup is open.
chrome.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type === "sr:state") render(msg.state);
});

// Initial state: ask the offscreen doc; no answer means nothing is running.
chrome.runtime
  .sendMessage({ type: "sr:get-state" } satisfies Message)
  .then((state?: ReaderState) => render(state ?? IDLE_STATE))
  .catch(() => render(IDLE_STATE));
