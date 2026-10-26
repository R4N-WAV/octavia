import Phaser from "phaser";
import { fitSize, BASE_W, BASE_H } from "./game/render";
import { BootScene } from "./game/scenes/BootScene";
import { StartScene } from "./game/scenes/StartScene";
import { TestAreaScene } from "./game/scenes/TestAreaScene";
import { sharedInput } from "./game/input/sharedInput";
import { bindDomInput } from "./game/input/bindDom";
import { isTouchDevice, mountTouchControls } from "./game/input/touchControls";

const parent = document.getElementById("game")!;

function sizeParent(): void {
  const { width, height } = fitSize(window.innerWidth, window.innerHeight);
  parent.style.width = `${width}px`;
  parent.style.height = `${height}px`;
}
sizeParent();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: BASE_W,
  height: BASE_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#1b1f2a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, fixedStep: true, fps: 60 } },
  scene: [BootScene, StartScene, TestAreaScene],
});

window.addEventListener("resize", () => {
  sizeParent();
  game.scale.refresh();
});

bindDomInput(sharedInput, window);
if (isTouchDevice()) mountTouchControls(sharedInput);
