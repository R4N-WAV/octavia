import Phaser from "phaser";
import { integerZoom, BASE_W, BASE_H } from "./game/render";
import { BootScene } from "./game/scenes/BootScene";
import { StartScene } from "./game/scenes/StartScene";
import { TestAreaScene } from "./game/scenes/TestAreaScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: BASE_W,
  height: BASE_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#1b1f2a",
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom(window.innerWidth, window.innerHeight) },
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, fixedStep: true, fps: 60 } },
  scene: [BootScene, StartScene, TestAreaScene],
});

window.addEventListener("resize", () => game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight)));
