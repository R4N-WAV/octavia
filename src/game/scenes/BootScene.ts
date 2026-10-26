import Phaser from "phaser";
import { generatePlaceholderArt } from "../art/placeholderArt";
import { publishTestState } from "../testHook";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create(): void {
    generatePlaceholderArt(this);
    publishTestState(() => ({ scene: "Boot", player: null, audio: "pending", eventCount: 0 }));
    this.scene.start("Start");
  }
}
