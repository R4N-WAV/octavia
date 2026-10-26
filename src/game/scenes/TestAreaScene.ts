import Phaser from "phaser";
import { buildTestArea, TILE } from "../world/testArea";
import { TILE_INDEX } from "../art/placeholderArt";
import { InputState } from "../input/inputState";
import { bindDomInput } from "../input/bindDom";
import { PlayerController } from "../player/PlayerController";
import { SilentPlayerMusic } from "../../music/playerEvents";
import { publishTestState } from "../testHook";

const BPM = 96;

export class TestAreaScene extends Phaser.Scene {
  private player!: PlayerController;
  private input2 = new InputState();
  private forest!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private lookAhead = 24;

  constructor() {
    super("TestArea");
  }

  create(): void {
    const area = buildTestArea();
    const worldW = area.width * TILE;
    const worldH = area.height * TILE;

    this.add.image(0, 0, "sky").setOrigin(0).setScrollFactor(0);
    this.forest = this.add.tileSprite(0, 270 - 90 - 20, 480, 90, "forest").setOrigin(0).setScrollFactor(0);
    this.hills = this.add.tileSprite(0, 270 - 60 - 20, 480, 60, "hills").setOrigin(0).setScrollFactor(0);

    const data = area.tiles.map((row, r) =>
      row.map((t) => (t === 0 ? -1 : t === 2 ? TILE_INDEX.plank : r === 15 ? TILE_INDEX.grass : TILE_INDEX.dirt)),
    );
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setCollision([TILE_INDEX.grass, TILE_INDEX.dirt, TILE_INDEX.plank]);
    layer.forEachTile((t) => {
      if (t.index === TILE_INDEX.plank) t.setCollision(false, false, true, false);
    });

    // Silent build: beat comes from the wall clock until the audio engine arrives.
    const beat = () => (performance.now() / 1000) * (BPM / 60);
    const unbind = bindDomInput(this.input2, window);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unbind);

    this.player = new PlayerController(this, area.spawn.x, area.spawn.y, this.input2, new SilentPlayerMusic(), beat);
    this.player.attachLayer(this, layer);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.player.sprite.setCollideWorldBounds(true);
    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, (delta: number) => {
      let pad: Gamepad | null = null;
      try {
        pad = navigator.getGamepads?.()[0] ?? null;
      } catch {
        // Gamepad API can be blocked by the embedding page; keyboard still works.
      }
      this.input2.pollGamepad(pad, performance.now());
      this.player.fixedStep(delta, performance.now());
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setRoundPixels(true);

    publishTestState(() => ({
      scene: "TestArea",
      player: { x: this.player.sprite.x, y: this.player.sprite.y, grounded: this.player.state.grounded },
      audio: "silent",
      eventCount: 0,
    }));
  }

  update(_time: number, delta: number): void {
    this.player.updateVisual(performance.now());
    const target = this.player.facing * 24;
    this.lookAhead += (target - this.lookAhead) * Math.min(1, delta / 250);
    this.cameras.main.setFollowOffset(-this.lookAhead, 0);
    const sx = this.cameras.main.scrollX;
    this.forest.tilePositionX = Math.round(sx * 0.3);
    this.hills.tilePositionX = Math.round(sx * 0.6);
  }
}
