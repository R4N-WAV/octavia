import type { Action, InputState } from "./inputState";

export const isTouchDevice = (): boolean =>
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

const CSS = `
.oct-touch { position: fixed; inset: auto 0 0 0; display: flex; justify-content: space-between; align-items: flex-end;
  padding: 0 max(14px, env(safe-area-inset-right, 0px)) max(14px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px));
  pointer-events: none; z-index: 5; }
.oct-touch .grp { display: flex; gap: 12px; align-items: flex-end; }
.oct-touch button { pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  width: 64px; height: 64px; border-radius: 50%; border: 2px solid rgba(243,227,200,.45); background: rgba(35,45,85,.45);
  color: #f3e3c8; font: 600 15px ui-monospace, Menlo, monospace; display: grid; place-items: center; padding: 0; }
.oct-touch button.big { width: 78px; height: 78px; }
.oct-touch button.on { background: rgba(224,83,154,.55); border-color: #f3e3c8; }
.oct-rotate { position: fixed; top: max(10px, env(safe-area-inset-top, 0px)); inset-inline: 0; text-align: center;
  color: #9a8fae; font: 12px ui-monospace, Menlo, monospace; pointer-events: none; z-index: 5; }
@media (orientation: landscape) { .oct-rotate { display: none; } }
`;

/** On-screen buttons for phones. Returns a cleanup function. */
export function mountTouchControls(state: InputState, root: HTMLElement = document.body): () => void {
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "oct-touch";
  const hint = document.createElement("div");
  hint.className = "oct-rotate";
  hint.textContent = "Turn your phone sideways for a bigger view";

  const make = (label: string, action: Action, aria: string, big = false): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    if (big) b.classList.add("big");
    const id = `touch:${action}`;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (keeps the press when the finger slides off); the press still counts.
      }
      b.classList.add("on");
      state.handleButton(id, action, true, e.timeStamp);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      b.classList.remove("on");
      state.handleButton(id, action, false, e.timeStamp);
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    return b;
  };

  const left = document.createElement("div");
  left.className = "grp";
  left.append(make("◀", "left", "Run left"), make("▶", "right", "Run right"));
  const right = document.createElement("div");
  right.className = "grp";
  right.append(make("▼", "down", "Down (hold with jump to drop through a plank)"), make("JUMP", "jump", "Jump", true));
  bar.append(left, right);
  root.append(style, bar, hint);
  return () => {
    style.remove();
    bar.remove();
    hint.remove();
  };
}
