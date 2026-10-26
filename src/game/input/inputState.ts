export type Action = "left" | "right" | "down" | "jump";

export interface ActionEdge {
  action: Action;
  pressed: boolean;
  timeMs: number;
}

export interface GamepadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
  timestamp: number;
}

export const KEY_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "down",
  KeyS: "down",
  Space: "jump",
  KeyW: "jump",
  ArrowUp: "jump",
};

const ACTIONS: Action[] = ["left", "right", "down", "jump"];

export class InputState {
  // Held digital sources (keys, touch buttons), keyed by source id.
  private held = new Map<string, Action>();
  private pad: Record<Action, boolean> = { left: false, right: false, down: false, jump: false };
  private edges: ActionEdge[] = [];

  isDown(a: Action): boolean {
    if (this.pad[a]) return true;
    for (const v of this.held.values()) if (v === a) return true;
    return false;
  }

  private snapshot(): Record<Action, boolean> {
    return { left: this.isDown("left"), right: this.isDown("right"), down: this.isDown("down"), jump: this.isDown("jump") };
  }

  private emitChanges(before: Record<Action, boolean>, timeMs: number): void {
    for (const a of ACTIONS) {
      const now = this.isDown(a);
      if (now !== before[a]) this.edges.push({ action: a, pressed: now, timeMs });
    }
  }

  handleKey(code: string, down: boolean, timeMs: number): boolean {
    const action = KEY_MAP[code];
    if (!action) return false;
    this.handleButton(`key:${code}`, action, down, timeMs);
    return true;
  }

  /** Any held source: on-screen touch buttons use ids like "touch:jump". */
  handleButton(id: string, action: Action, down: boolean, timeMs: number): void {
    const before = this.snapshot();
    if (down) this.held.set(id, action);
    else this.held.delete(id);
    this.emitChanges(before, timeMs);
  }

  pollGamepad(pad: GamepadLike | null, timeMs: number): void {
    const before = this.snapshot();
    if (!pad) {
      this.pad = { left: false, right: false, down: false, jump: false };
    } else {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const b = (i: number) => pad.buttons[i]?.pressed === true;
      this.pad = {
        left: ax < -0.4 || b(14),
        right: ax > 0.4 || b(15),
        down: ay > 0.5 || b(13),
        jump: b(0),
      };
    }
    this.emitChanges(before, timeMs);
  }

  releaseAll(timeMs: number): void {
    const before = this.snapshot();
    this.held.clear();
    this.pad = { left: false, right: false, down: false, jump: false };
    this.emitChanges(before, timeMs);
  }

  axisX(): -1 | 0 | 1 {
    const l = this.isDown("left");
    const r = this.isDown("right");
    if (l === r) return 0;
    return l ? -1 : 1;
  }

  drainEdges(): ActionEdge[] {
    const out = this.edges;
    this.edges = [];
    return out;
  }
}
