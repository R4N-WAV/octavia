import Phaser from "phaser";
import { publishTestState } from "../testHook";

export class StartScene extends Phaser.Scene {
  constructor() {
    super("Start");
  }
  create(): void {
    this.add.image(240, 135, "sky");
    this.add.text(240, 110, "OCTAVIA", { fontFamily: "monospace", fontSize: "24px", color: "#f3e3c8" }).setOrigin(0.5);
    const prompt = this.add
      .text(240, 150, "click or press any key", { fontFamily: "monospace", fontSize: "10px", color: "#f3e3c8" })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 625, yoyo: true, repeat: -1 });
    publishTestState(() => ({ scene: "Start", player: null, audio: "pending", eventCount: 0 }));

    const go = () => this.scene.start("TestArea");
    this.input.once("pointerdown", go);
    this.input.keyboard?.once("keydown", go);
  }
}
