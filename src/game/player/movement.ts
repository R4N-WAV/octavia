// y axis points down: rising velocities are negative.
export interface MovementParams {
  maxRunSpeed: number;
  groundAccel: number;
  groundDecel: number;
  airControl: number;
  jumpVelocity: number;
  jumpCutSpeed: number;
  gravity: number;
  fallGravityMultiplier: number;
  apexThreshold: number;
  apexGravityMultiplier: number;
  maxFallSpeed: number;
  coyoteMs: number;
  jumpBufferMs: number;
  dropThroughMs: number;
}

export const DEFAULT_MOVEMENT: MovementParams = {
  maxRunSpeed: 150,
  groundAccel: 1875,
  groundDecel: 2500,
  airControl: 0.65,
  jumpVelocity: 325.6,
  jumpCutSpeed: 160,
  gravity: 946.7,
  fallGravityMultiplier: 1.8,
  apexThreshold: 40,
  apexGravityMultiplier: 0.5,
  maxFallSpeed: 330,
  coyoteMs: 100,
  jumpBufferMs: 120,
  dropThroughMs: 200,
};

export function stepHorizontal(vx: number, dir: -1 | 0 | 1, grounded: boolean, dt: number, p: MovementParams): number {
  const control = grounded ? 1 : p.airControl;
  const turning = dir !== 0 && vx !== 0 && Math.sign(vx) !== dir;
  const rate = (dir === 0 || turning ? p.groundDecel : p.groundAccel) * control * dt;
  const target = dir * p.maxRunSpeed;
  if (vx < target) return Math.min(target, vx + rate);
  if (vx > target) return Math.max(target, vx - rate);
  return vx;
}

export function stepVertical(vy: number, jumpHeld: boolean, dt: number, p: MovementParams): number {
  let g: number;
  if (vy < 0) g = jumpHeld && -vy < p.apexThreshold ? p.gravity * p.apexGravityMultiplier : p.gravity;
  else g = p.gravity * p.fallGravityMultiplier;
  return Math.min(p.maxFallSpeed, vy + g * dt);
}

export function applyJumpCut(vy: number, p: MovementParams): number {
  return vy < -p.jumpCutSpeed ? -p.jumpCutSpeed : vy;
}

export type JumpDecision = { kind: "none" } | { kind: "jump"; buffered: boolean; coyote: boolean } | { kind: "dropThrough" };

export class JumpLogic {
  private pressMs: number | null = null;
  private lastGroundedMs = -Infinity;
  private jumped = false;
  private seenAirborne = false;

  constructor(private readonly p: MovementParams) {}

  press(atMs: number): void {
    this.pressMs = atMs;
  }

  update(s: { grounded: boolean; downHeld: boolean; onOneWay: boolean }, nowMs: number): JumpDecision {
    if (s.grounded) {
      if (!this.jumped || this.seenAirborne) {
        this.lastGroundedMs = nowMs;
        this.jumped = false;
        this.seenAirborne = false;
      }
    } else if (this.jumped) {
      this.seenAirborne = true;
    }

    if (this.pressMs === null || nowMs - this.pressMs > this.p.jumpBufferMs) {
      this.pressMs = null;
      return { kind: "none" };
    }
    const buffered = nowMs - this.pressMs > 0;

    if (s.grounded) {
      this.pressMs = null;
      if (s.downHeld && s.onOneWay) return { kind: "dropThrough" };
      this.markJumped();
      return { kind: "jump", buffered, coyote: false };
    }
    if (!this.jumped && nowMs - this.lastGroundedMs <= this.p.coyoteMs) {
      this.pressMs = null;
      this.markJumped();
      return { kind: "jump", buffered, coyote: true };
    }
    return { kind: "none" };
  }

  private markJumped(): void {
    this.jumped = true;
    this.seenAirborne = false;
    this.lastGroundedMs = -Infinity;
  }
}

export function simulateJump(p: MovementParams, holdSteps: number, dt = 1 / 60): { apexHeight: number; airTimeSec: number } {
  let y = 0;
  let vy = -p.jumpVelocity;
  let minY = 0;
  for (let i = 0; i < 2000; i++) {
    if (i === holdSteps) vy = applyJumpCut(vy, p);
    vy = stepVertical(vy, i < holdSteps, dt, p);
    y += vy * dt;
    minY = Math.min(minY, y);
    if (y >= 0 && vy > 0) return { apexHeight: -minY, airTimeSec: (i + 1) * dt };
  }
  return { apexHeight: -minY, airTimeSec: 2000 * dt };
}
