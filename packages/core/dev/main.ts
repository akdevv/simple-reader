import { SPEEDS, type Speed } from "../src/types";
import { mountReader } from "../src/reader";
import { createPlayer } from "../src/tts/player";

const $ = (id: string) => document.getElementById(id)!;
const player = createPlayer({ assetBase: "/tts/" });
mountReader($("article"), player, {
  onState: (state) => {
    $("state").textContent = JSON.stringify(state, null, 1);
  },
});

$("toggle").onclick = () => player.toggle();
$("prev").onclick = () => player.prev();
$("next").onclick = () => player.next();
const speed = $("speed") as HTMLSelectElement;
speed.innerHTML = SPEEDS.map(
  (s) => `<option ${s === 1 ? "selected" : ""}>${s}</option>`,
).join("");
speed.onchange = () => player.setSpeed(Number(speed.value) as Speed);
