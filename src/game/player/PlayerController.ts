import Phaser from "phaser";
import type { InputState } from "../input/inputState";
import type { PlayerEvents } from "../../music/playerEvents";
import { DEFAULT_MOVEMENT, JumpLogic, applyJumpCut, stepHorizontal, stepVertical, type MovementParams } from "./movement";
import { chooseAnim, runFrameAtBeat, type PlayerAnim } from "./animation";
import { TILE_INDEX } from "../art/placeholderArt";

export class PlayerController {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  readonly state: { grounded: boolean; vx: number; vy: number; anim: PlayerAnim } = { grounded: false, vx: 0, vy: 0, anim: "idle" };
  facing: 1 | -1 = 1;

  private readonly jumpLogic: JumpLogic;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wasGrounded = false;
  private running = false;
  private lastVy = 0;
  private lastLandMs = -Infinity;
  private ignoreOneWayUntilMs = 0;
  private lastPressMs = -Infinity;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly input: InputState,
    private readonly events: PlayerEvents,
    private readonly beatSource: () => number,
    private readonly params: MovementParams = DEFAULT_MOVEMENT,
  ) {
    this.sprite = scene.physics.add.sprite(x, y, "player", "idle");
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setSize(8, 20).setOffset(4, 4);
    this.jumpLogic = new JumpLogic(params);
  }

  attachLayer(scene: Phaser.Scene, layer: Phaser.Tilemaps.TilemapLayer): void {
    this.layer = layer;
    scene.physics.add.collider(this.sprite, layer, undefined, ((_p: unknown, tile: Phaser.Tilemaps.Tile) =>
      !(tile.index === TILE_INDEX.plank && performance.now() < this.ignoreOneWayUntilMs)) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback);
  }

  isOnOneWay(): boolean {
    if (!this.layer) return false;
    const b = this.sprite.body;
    const tile = this.layer.getTileAtWorldXY(b.center.x, b.bottom + 1);
    return tile?.index === TILE_INDEX.plank;
  }

  /** Called once per fixed physics step (60 Hz), after collisions resolved. */
  fixedStep(dt: number, nowMs: number): void {
    const p = this.params;
    const body = this.sprite.body;
    const grounded = body.blocked.down || body.touching.down;
    let vx = body.velocity.x;
    let vy = body.velocity.y;

    for (const e of this.input.drainEdges()) {
      if (e.action !== "jump") continue;
      if (e.pressed) {
        this.jumpLogic.press(e.timeMs);
        this.lastPressMs = e.timeMs;
      } else {
        if (vy < 0) vy = applyJumpCut(vy, p);
        this.events.jumpRelease(e.timeMs);
      }
    }

    if (grounded && !this.wasGrounded) {
      this.lastLandMs = nowMs;
      this.events.land(nowMs, Phaser.Math.Clamp(this.lastVy / p.maxFallSpeed, 0, 1));
    }

    const dir = this.input.axisX();
    if (dir !== 0) this.facing = dir;
    vx = stepHorizontal(vx, dir, grounded, dt, p);

    let airborneNow = !grounded;
    const decision = this.jumpLogic.update({ grounded, downHeld: this.input.isDown("down"), onOneWay: grounded && this.isOnOneWay() }, nowMs);
    if (decision.kind === "jump") {
      vy = -p.jumpVelocity;
      airborneNow = true;
      this.events.jump(nowMs - this.lastPressMs <= p.jumpBufferMs ? Math.max(this.lastPressMs, nowMs - p.jumpBufferMs) : nowMs);
    } else if (decision.kind === "dropThrough") {
      this.ignoreOneWayUntilMs = nowMs + p.dropThroughMs;
      vy = 60;
      airborneNow = true;
    } else {
      vy = stepVertical(vy, this.input.isDown("jump"), dt, p);
    }

    const running = !airborneNow && Math.abs(vx) > 10;
    if (running !== this.running) {
      this.running = running;
      this.events.runChanged(running, nowMs);
    }

    body.setVelocity(vx, vy);
    this.lastVy = vy;
    this.wasGrounded = grounded && !airborneNow;
    this.state.grounded = this.wasGrounded;
    this.state.vx = vx;
    this.state.vy = vy;
  }

  /** Called once per rendered frame. */
  updateVisual(nowMs: number): void {
    const anim = chooseAnim({ grounded: this.state.grounded, vx: this.state.vx, vy: this.state.vy, msSinceLanding: nowMs - this.lastLandMs });
    this.state.anim = anim;
    this.sprite.setFrame(anim === "run" ? `run${runFrameAtBeat(this.beatSource())}` : anim);
    this.sprite.setFlipX(this.facing < 0);
  }
}
