export interface OctaviaTestState {
  scene: string;
  player: { x: number; y: number; grounded: boolean } | null;
  audio: "running" | "silent" | "pending";
  eventCount: number;
}

export function publishTestState(get: () => OctaviaTestState): void {
  (window as unknown as { __octavia: { state: () => OctaviaTestState } }).__octavia = { state: get };
}
