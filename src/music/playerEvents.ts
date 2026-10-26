/** What the game reports about the player; the music layer turns these into notes. */
export interface PlayerEvents {
  jump(atMs: number): void;
  jumpRelease(atMs: number): void;
  land(atMs: number, impact: number): void;
  runChanged(running: boolean, atMs: number): void;
}

export class SilentPlayerMusic implements PlayerEvents {
  jump(): void {}
  jumpRelease(): void {}
  land(): void {}
  runChanged(): void {}
}
