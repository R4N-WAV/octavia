import type { InputState } from "./inputState";

export function bindDomInput(state: InputState, target: Window): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (state.handleKey(e.code, true, e.timeStamp)) e.preventDefault();
  };
  const onUp = (e: KeyboardEvent) => {
    if (state.handleKey(e.code, false, e.timeStamp)) e.preventDefault();
  };
  const onBlur = () => state.releaseAll(performance.now());
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return () => {
    target.removeEventListener("keydown", onDown);
    target.removeEventListener("keyup", onUp);
    target.removeEventListener("blur", onBlur);
  };
}
