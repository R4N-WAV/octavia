# Octavia Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable browser test area where Octavia runs, jumps and drops through platforms with Dead Cells-style feel, over a looping C-minor pastoral backing, with instant natural sounds and beat-snapped clarinet notes.

**Architecture:** A Phaser-free music core (`src/music/`) built on `@audiorective/core` + `@audiorective/clock` owns time (audio clock), quantizing, melody choice, scheduling and the event log. The Phaser game (`src/game/`) owns input, movement, world and visuals, reads time from `MusicClock`, and reports gameplay events to `PlayerMusic`. Pure logic (quantizer, voice, score, movement, input) is unit-tested in Node; Web Audio and Phaser glue are covered by a Playwright smoke test and manual play.

**Tech Stack:** TypeScript 5.9.3, Vite 6.4.5, Phaser 3.90.0 (Arcade physics), @audiorective/core 2.3.2, @audiorective/clock 2.3.2, Vitest 3.2.7, @playwright/test 1.63.0, ffmpeg (asset prep only), VSCO 2 CE samples (CC0).

**Spec:** `docs/superpowers/specs/2026-10-25-octavia-step1-design.md`

### Spec amendments made while planning (verified 2026-10-25)

1. **Foley is synthesized** (filtered noise + low sine thumps) instead of CC0 recordings: Kenney, Freesound and OpenGameArt are unreachable from the build environment. `Foley` keeps a method-per-sound API so recordings can replace synthesis later.
2. **Scheduler = `@audiorective/clock`** (`Timeline` + `Clock` + `LinearBarRuler`, 25 ms tick / 100 ms look-ahead defaults). No hand-written `scheduler.ts`; `src/music/notePlayer.ts` schedules + logs notes.
3. **Footstep sounds are scheduled on the audio clock** at eighth-note points while running (sample-accurate) instead of fired from animation frames. Animation frames are derived from the same beat position, so they coincide.
4. **Run start plays one pickup note** (snapped) so short runs are heard; bar-start phrases continue while running.
5. **Samples ship as mono 44.1 kHz FLAC** (lossless, no encoder padding that would shift timing; decodable in Chrome, Firefox, Safari).
6. **Input times are converted with `engine.core.perceivedTime`** (Audiorective: `currentTime` minus graph and output latency) instead of `getOutputTimestamp()` — same intent, already latency-aware.

## Global Constraints

- Node 22; exact dependency versions as listed in Tech Stack (no `^`/`~`).
- `src/music/**` must not import `phaser` (enforced by a test in Task 1).
- Internal resolution **480×270**, integer zoom, `pixelArt: true`, `roundPixels: true`; tiles **16 px**.
- Tempo **96 BPM**, meter **4/4**, key **C minor**; loop **8 bars**: Cm (bars 1–2), A♭ (3–4), E♭ (5–6), B♭ (7–8).
- Quantizer: late grace **30 ms**, strong-point pull **40 ms**, max wait ≤ **1/8 beat** (≈78 ms at 96 BPM) with the default jump grid.
- Movement: max run **150 px/s**, accel to max in **0.08 s**, stop in **0.06 s**, air control **65 %**, full jump **56 px**, short hop **~18 px**, total full-jump air time **~0.6 s**, fall gravity **×1.8**, max fall **330 px/s**, coyote **100 ms**, jump buffer **120 ms**, drop-through ignore **200 ms**.
- Run cycle: **2 footsteps per beat** (eighths), 8 frames per beat, contact frames **0 and 4**.
- Instruments: clarinet (sustained + staccato), harp, cello section, violin section — all VSCO 2 CE (CC0), pinned commit `440300901dfe9275fd84e0b7763af1f8443ae62e`; every asset listed in `CREDITS.md`.
- Debug overlay toggle key: **Backquote** (`` ` ``).
- Movement and natural sounds are never delayed; only clarinet notes are quantized.

## Review Focus

1. **Jump mashing** (several presses inside one subdivision) — expect at most one clarinet note per instrument per grid point, never a stacked/flammed pile. Test: Task 9 `dedupes notes on the same grid point`.
2. **Tempo changed live from the overlay** — expect beat position continuous across the change (no jump in the music or animation). Test: Task 6 `setBpm keeps beat position continuous`.
3. **Tab hidden for a long time, then shown** — expect no burst of backlog beat events/visual pulses and music resuming from where it paused. Tests: Task 6 `BeatTracker emits only the latest beat after a large gap` and `pause/resume preserves beat position`.
4. **Pressing jump in mid-air (no double jump yet) or holding it forever** — expect no extra jump and no clarinet note. Test: Task 12 `mid-air press outside buffer does nothing` and `held jump does not re-trigger on landing`.
5. **Audio unavailable** (context won't start / samples missing) — expect the game to run silently with beat visuals still pulsing, no exceptions. Tests: Task 8 `missing instrument is skipped and logged once`; Task 14 smoke `?silent=1 still plays`.

---

## File map

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts, index.html
CREDITS.md, README.md
scripts/prepare-samples.mjs            # VSCO fetch → trimmed FLAC + manifest (dev tool)
scripts/sampleNames.mjs                # pure filename/pitch helpers used by the script (tested)
public/assets/audio/samples/<instrument>/<midi>.flac
public/assets/audio/samples/manifest.json
src/main.ts                            # boot
src/music/                             # NO phaser imports
  types.ts          InstrumentId, NoteRequest, MusicEvent
  rng.ts            seeded RNG
  theory.ts         scales, chords, pitch helpers
  score/pastoralLoop.ts                LoopScore data + chordAtBeat
  quantizer.ts      quantize()
  eventLog.ts       EventLog
  clarinetVoice.ts  ClarinetVoice
  clock.ts          MusicClock, BeatTracker, heardTimeOfInput
  zones.ts          pickZone(), velocityToGain()
  instruments/sampledInstrument.ts     SampledInstrument (AudioProcessor)
  notePlayer.ts     NotePlayer
  scorePlayer.ts    ScorePlayer
  playerMusic.ts    PlayerMusic, SilentPlayerMusic
src/game/
  render.ts         integerZoom()
  input/inputState.ts, input/bindDom.ts
  player/movement.ts, player/animation.ts, player/PlayerController.ts
  audio/foley.ts, audio/audioSystem.ts
  art/placeholderArt.ts
  world/testArea.ts, world/beatVisuals.ts
  scenes/BootScene.ts, scenes/StartScene.ts, scenes/TestAreaScene.ts
  debug/tuning.ts, debug/DebugOverlay.ts
  testHook.ts       window.__octavia
tests/unit/*.test.ts, tests/e2e/smoke.spec.ts
```

---

### Task 1: Project scaffold, render scaling, architecture guard

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/game/render.ts`, `.gitignore`
- Test: `tests/unit/render.test.ts`, `tests/unit/architecture.test.ts`

**Interfaces:**
- Produces: `integerZoom(windowW: number, windowH: number, baseW = 480, baseH = 270): number` (≥ 1). npm scripts `dev`, `build`, `preview`, `test` (vitest run), `typecheck` (tsc --noEmit), `e2e` (playwright test).

- [ ] **Step 1: Create config.** `package.json` with `"type": "module"` and exact versions from Tech Stack (devDependencies: typescript, vite, vitest, @playwright/test; dependencies: phaser, @audiorective/core, @audiorective/clock). `tsconfig.json`: `strict`, `target` ES2022, `module` ESNext, `moduleResolution` Bundler, `lib` [ES2022, DOM, DOM.Iterable], `noUncheckedIndexedAccess`, include `src`, `tests`, `scripts`. `vitest.config.ts`: environment `node`, include `tests/unit/**/*.test.ts`. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.vsco-cache`. `index.html`: black body, no margin, `<div id="game">` centered with flexbox, loads `/src/main.ts`. Run `npm install`.

- [ ] **Step 2: Write failing tests**

```ts
// tests/unit/render.test.ts
import { describe, it, expect } from "vitest";
import { integerZoom } from "../../src/game/render";
describe("integerZoom", () => {
  it("picks the largest whole multiple that fits", () => {
    expect(integerZoom(1920, 1080)).toBe(4);
    expect(integerZoom(1366, 768)).toBe(2);
    expect(integerZoom(2560, 1440)).toBe(5);
  });
  it("never goes below 1", () => expect(integerZoom(300, 200)).toBe(1));
});

// tests/unit/architecture.test.ts — the music core must stay Phaser-free
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const files = (d: string): string[] => readdirSync(d).flatMap((f) => {
  const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p];
});
it("src/music imports nothing from phaser", () => {
  for (const f of files("src/music")) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["']phaser["']/);
});
```

(Create `src/music/types.ts` as an empty `export {};` placeholder so the directory exists; Task 2 fills it.)

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (`integerZoom` missing).

- [ ] **Step 4: Implement `integerZoom` in `src/game/render.ts`** (`Math.max(1, Math.floor(Math.min(w/baseW, h/baseH)))`) and `src/main.ts`: Phaser game, `type: Phaser.AUTO`, `parent: "game"`, `width: 480`, `height: 270`, `pixelArt: true`, `roundPixels: true`, `backgroundColor: "#1b1f2a"`, `scale: { mode: Phaser.Scale.NONE, zoom: integerZoom(innerWidth, innerHeight) }`, `physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, fixedStep: true, fps: 60 } }`, one placeholder scene drawing the text "Octavia". On `window.resize` call `game.scale.setZoom(integerZoom(...))`.

- [ ] **Step 5: Verify** `npm test && npm run typecheck && npm run build` — Expected: all pass, `dist/` produced.

- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: scaffold Vite + Phaser + Vitest project"`

---

### Task 2: Shared types, RNG, music theory, pastoral loop score

**Files:**
- Create: `src/music/types.ts`, `src/music/rng.ts`, `src/music/theory.ts`, `src/music/score/pastoralLoop.ts`
- Test: `tests/unit/theory.test.ts`, `tests/unit/pastoralLoop.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type InstrumentId = "clarinetSus" | "clarinetStac" | "harp" | "celloSection" | "violinSection";
  export type PlayerActionKind = "jump" | "land" | "run";
  export interface NoteRequest { timeBeats: number; durationBeats: number; instrument: InstrumentId; pitch: number; velocity: number; source: "score" | "player"; action?: PlayerActionKind }
  export interface MusicEvent extends NoteRequest { id: number }
  // rng.ts
  export function mulberry32(seed: number): () => number; // [0,1)
  // theory.ts
  export const C_MINOR: readonly number[]; // pitch classes [0,2,3,5,7,8,10]
  export interface Chord { name: string; root: number; tones: readonly number[] } // pitch classes
  export const CHORDS: { Cm: Chord; Ab: Chord; Eb: Chord; Bb: Chord };
  export function pitchClass(midi: number): number;
  export function pitchesInRange(pcs: readonly number[], low: number, high: number): number[]; // ascending MIDI
  // score/pastoralLoop.ts
  export interface ScoreNote { instrument: InstrumentId; pitch: number; velocity: number; durationBeats: number }
  export interface LoopScore { bpm: number; beatsPerBar: number; bars: number; stepsPerBar: number; chordAtBar(bar: number): Chord; notesAtStep(loopStep: number): ScoreNote[] }
  export const pastoralLoop: LoopScore;
  export function chordAtBeat(score: LoopScore, beat: number): Chord; // wraps the loop; negative beats floor-wrap
  ```

**Exact score content** (`stepsPerBar 8` = eighths, `bpm 96`, `beatsPerBar 4`, `bars 8`):

| Chord (bars) | Cello (bar start, 4 beats, vel 0.5) | Violins (bar start, 4 beats, vel 0.45) | Harp eighths (vel 0.5, step 0 of bar 0.6, 1.5 beats) |
|---|---|---|---|
| Cm (0–1) | 48 | 67, 72, 75 | 48 55 60 63 67 63 60 55 |
| A♭ (2–3) | 44 | 68, 72, 75 | 44 51 56 60 63 60 56 51 |
| E♭ (4–5) | 51 | 67, 70, 75 | 51 58 63 67 70 67 63 58 |
| B♭ (6–7) | 46 | 65, 70, 74 | 46 53 58 62 65 62 58 53 |

Chord tones: Cm {0,3,7}, A♭ {8,0,3}, E♭ {3,7,10}, B♭ {10,2,5}.

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/theory.test.ts
it("C minor scale", () => expect([...C_MINOR]).toEqual([0, 2, 3, 5, 7, 8, 10]));
it("pitchesInRange lists chord tones ascending", () =>
  expect(pitchesInRange(CHORDS.Cm.tones, 55, 67)).toEqual([55, 60, 63, 67]));
it("pitchClass handles any octave", () => expect(pitchClass(70)).toBe(10));
it("mulberry32 is deterministic", () => {
  const a = mulberry32(7), b = mulberry32(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

// tests/unit/pastoralLoop.test.ts
it("progression Cm Cm Ab Ab Eb Eb Bb Bb", () =>
  expect([0,1,2,3,4,5,6,7].map((b) => pastoralLoop.chordAtBar(b).name)).toEqual(["Cm","Cm","Ab","Ab","Eb","Eb","Bb","Bb"]));
it("chordAtBeat wraps the 32-beat loop", () => {
  expect(chordAtBeat(pastoralLoop, 33).name).toBe("Cm");
  expect(chordAtBeat(pastoralLoop, -1).name).toBe("Bb");
});
it("bar start has cello, three violins and a harp note", () => {
  const n = pastoralLoop.notesAtStep(0);
  expect(n.filter((x) => x.instrument === "celloSection").map((x) => x.pitch)).toEqual([48]);
  expect(n.filter((x) => x.instrument === "violinSection").map((x) => x.pitch)).toEqual([67, 72, 75]);
  expect(n.filter((x) => x.instrument === "harp")).toEqual([{ instrument: "harp", pitch: 48, velocity: 0.6, durationBeats: 1.5 }]);
});
it("off-bar steps have only harp", () => {
  expect(pastoralLoop.notesAtStep(17)).toEqual([{ instrument: "harp", pitch: 51, velocity: 0.5, durationBeats: 1.5 }]);
});
it("every score pitch belongs to its bar's chord", () => {
  for (let s = 0; s < 64; s++) {
    const chord = pastoralLoop.chordAtBar(Math.floor(s / 8));
    for (const n of pastoralLoop.notesAtStep(s)) expect(chord.tones).toContain(pitchClass(n.pitch));
  }
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/theory.test.ts tests/unit/pastoralLoop.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four files with the table above as data. `notesAtStep` takes `loopStep` modulo 64 (floored).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(music): theory helpers and C-minor pastoral loop score"`

---

### Task 3: Quantizer

**Files:**
- Create: `src/music/quantizer.ts`
- Test: `tests/unit/quantizer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Subdivision = "quarter" | "eighth" | "sixteenth" | "eighthTriplet" | "sixteenthTriplet" | "thirtySecond";
  export const SUBDIVISION_BEATS: Record<Subdivision, number>; // 1, 1/2, 1/4, 1/3, 1/6, 1/8
  export enum Strength { ThirtySecond = 0, SixteenthTriplet = 1, Sixteenth = 2, EighthTriplet = 3, Eighth = 4, Beat = 5, Bar = 6 }
  export interface QuantizeRules { lateGraceSec: number; strongPullSec: number }
  export const DEFAULT_RULES: QuantizeRules; // { lateGraceSec: 0.03, strongPullSec: 0.04 }
  export type SnapMode = "grace" | "pull" | "forward";
  export interface SnapResult { beat: number; strength: Strength; mode: SnapMode }
  export function strengthAt(beat: number, beatsPerBar: number): Strength;
  export function quantize(inputBeat: number, secPerBeat: number, grid: readonly Subdivision[], beatsPerBar: number, rules?: QuantizeRules): SnapResult;
  export const ALL_SUBDIVISIONS: readonly Subdivision[];
  ```

**Algorithm (spec §4.2):** candidate points = union of multiples of each subdivision in `grid`. Strength is intrinsic to position (Bar if multiple of `beatsPerBar`, Beat if integer, Eighth if multiple of 1/2, EighthTriplet if multiple of 1/3, Sixteenth if multiple of 1/4, SixteenthTriplet if multiple of 1/6, else ThirtySecond), using epsilon 1e-6. Rules in order: (1) **grace** — latest point `p ≤ input` with `input − p ≤ graceBeats` → `p`; (2) **pull** — nearest point `p > input` with `p − input ≤ pullBeats` and strength ≥ Eighth → `p`; (3) **forward** — smallest point `p > input`. Window seconds convert to beats via `secPerBeat`. Enumerate candidates per subdivision as `ceil/floor(input / step) * step` neighbours — never loop over the whole song.

- [ ] **Step 1: Write failing tests** (`spb = 0.625` = 96 BPM)

```ts
const spb = 0.625, bar = 4, all = ALL_SUBDIVISIONS;
it("late grace: 20 ms after the beat plays on the beat", () => {
  const r = quantize(1 + 0.02 / spb, spb, all, bar);
  expect(r).toMatchObject({ beat: 1, mode: "grace", strength: Strength.Beat });
});
it("strong pull: 35 ms before an eighth snaps to it in pull mode", () => {
  const r = quantize(0.5 - 0.035 / spb, spb, all, bar);
  expect(r).toMatchObject({ beat: 0.5, mode: "pull" });
});
it("forward: otherwise snaps to the nearest upcoming point", () => {
  const r = quantize(0.22, spb, all, bar); // 1/6 is 33 ms behind (outside grace); next point is 0.25
  expect(r).toMatchObject({ beat: 0.25, mode: "forward" });
});
it("triplets and straight points mix", () =>
  expect(quantize(0.3, spb, all, bar).beat).toBeCloseTo(1 / 3, 9));
it("bar downbeat has Bar strength", () => expect(strengthAt(8, 4)).toBe(Strength.Bar));
it("never waits more than 1/8 beat with the full grid", () => {
  for (let i = 0; i < 5000; i++) {
    const x = i * 0.0137;
    const r = quantize(x, spb, all, bar);
    expect(r.beat - x).toBeLessThanOrEqual(0.125 + 1e-9);
    expect(r.beat - x).toBeGreaterThanOrEqual(-0.03 / spb - 1e-9);
  }
});
it("coarser grid snaps only to its own points", () =>
  expect(quantize(0.6, spb, ["eighth"], bar).beat).toBe(1));
it("works for negative beats (count-in)", () =>
  expect(quantize(-0.2, spb, ["eighth"], bar).beat).toBe(0));
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/quantizer.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** per the algorithm.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): beat quantizer with grace, pull and forward rules`

---

### Task 4: EventLog

**Files:**
- Create: `src/music/eventLog.ts`
- Test: `tests/unit/eventLog.test.ts`

**Interfaces:**
- Consumes: `NoteRequest`, `MusicEvent` (Task 2).
- Produces:
  ```ts
  export interface EventLogJSON { bpm: number; beatsPerBar: number; events: MusicEvent[] }
  export class EventLog {
    constructor(bpm: number, beatsPerBar: number);
    record(req: NoteRequest): number;              // returns id, ids start at 1, increasing
    amend(id: number, patch: { durationBeats: number }): void; // unknown id: no-op
    setBpm(bpm: number): void;                     // Step 1 has one tempo; stores latest
    events(): readonly MusicEvent[];
    toJSON(): EventLogJSON;
    clear(): void;
  }
  ```

- [ ] **Step 1: Write failing tests**: `records every field and assigns increasing ids`; `amend changes duration only`; `amend on unknown id is a no-op`; `toJSON includes bpm, beatsPerBar and a copy of events` (mutating the returned array must not change the log); `clear empties events but keeps id counter increasing`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/eventLog.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): event log for composition recording`

---

### Task 5: ClarinetVoice

**Files:**
- Create: `src/music/clarinetVoice.ts`
- Test: `tests/unit/clarinetVoice.test.ts`

**Interfaces:**
- Consumes: `Chord`, `pitchesInRange`, `pitchClass`, `C_MINOR` (Task 2); `mulberry32` for tests.
- Produces:
  ```ts
  export interface VoiceNote { offsetBeats: number; pitch: number; durationBeats: number; velocity: number; articulation: "sus" | "stac" }
  export interface ClarinetVoiceOptions { scale: readonly number[]; low: number; high: number; startPitch: number; rng: () => number }
  export const CLARINET_DEFAULTS: Omit<ClarinetVoiceOptions, "rng">; // scale C_MINOR, low 55, high 79, startPitch 67
  export class ClarinetVoice {
    constructor(opts: ClarinetVoiceOptions);
    get lastPitch(): number;
    jump(chord: Chord): VoiceNote;                 // offset 0, 1 beat, vel 0.75, "sus"
    land(chord: Chord, impact: number): VoiceNote; // offset 0, 0.5 beat, vel 0.5 + 0.4*clamp(impact,0,1), "stac"
    pickup(chord: Chord): VoiceNote;               // offset 0, 0.5 beat, vel 0.55, "stac"
    runPhrase(chord: Chord): VoiceNote[];          // 2–4 notes, "sus", vel 0.55
  }
  ```

**Rules (spec §4.5):**
- **jump:** chord tones in range at +3…+9 semitones above `lastPitch`; pick the smallest leap (rng breaks ties between the two smallest). None → chord tone nearest `(low+high)/2`.
- **land:** chord tones in range at −1…−7 below `lastPitch`; pick the closest. None → nearest chord tone in range.
- **pickup:** chord tone nearest `lastPitch` (ties → lower).
- **runPhrase:** motifs as scale-degree steps with rhythms (offsets/durations in beats):
  - A `[0,+1,+2]` offsets `[0,0.5,1]` durations `[0.5,0.5,1]`
  - B `[0,-1,0,+2]` offsets `[0,0.5,1,1.5]` durations `[0.5,0.5,0.5,1]`
  - C `[+2,+1,0]` offsets `[0,0.5,1]` durations `[0.5,0.5,1.5]`
  - D `[0,+2]` offsets `[0,1]` durations `[1,1]`
  Start on the chord tone nearest `lastPitch`, walk scale steps in `scale`, never pick the same motif twice in a row, and reflect a step back inside `[low, high]` if it would leave the range.
- Every returned pitch is within `[low, high]` and in `scale`; `lastPitch` becomes the final note's pitch.

- [ ] **Step 1: Write failing tests** (seed `mulberry32(1)`): `jump goes up to a chord tone`; `land goes down to a chord tone`; `pickup is the nearest chord tone`; `run phrase has 2–4 notes with increasing offsets, all in C minor`; `never repeats a motif twice in a row` (20 phrases); `10 000 random actions stay in range 55–79 and in scale` (cycle chords Cm/Ab/Eb/Bb, random action mix); `jump from the top of the range falls back near the middle`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/clarinetVoice.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): clarinet voice melody choice`

---

### Task 6: MusicClock, BeatTracker, input-time conversion

**Files:**
- Create: `src/music/clock.ts`
- Test: `tests/unit/clock.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `Clock`, `LinearBarRuler`, `ManualTickSource`, `TickSource` type from `@audiorective/clock` (read `references/clock.md` of the audiorective skill before coding).
- Produces:
  ```ts
  export interface TimeSource { readonly currentTime: number }
  export interface GridPoint { beat: number; time: number; index: number; loopStep: number } // index: global step; loopStep: floored mod (stepsPerBar*loopBars)
  export interface MusicWindow { generation: number; grid(stepsPerBar: number): GridPoint[] }
  export interface MusicClockOptions { context: TimeSource; perceivedTime: () => number; bpm: number; beatsPerBar: number; loopBars: number; tickSource?: TickSource }
  export class MusicClock {
    constructor(opts: MusicClockOptions);
    readonly beatsPerBar: number; readonly loopBars: number;
    start(): void; pause(): void; resume(): void;
    get bpm(): number; setBpm(bpm: number): void;  // takes effect at context.currentTime
    secondsPerBeat(): number;
    beatToTime(beat: number): number; timeToBeat(time: number): number;
    perceivedBeat(): number;                        // timeToBeat(perceivedTime())
    onWindow(listener: (w: MusicWindow) => void): () => void; // returns unsubscribe
  }
  export type BeatEvent = { kind: "beat"; beatIndex: number } | { kind: "bar"; barIndex: number; beatIndex: number };
  export class BeatTracker { constructor(beatsPerBar: number); update(beat: number): BeatEvent[] }
  export function heardTimeOfInput(eventMs: number, nowMs: number, perceivedNowSec: number): number; // perceivedNow − (nowMs − eventMs)/1000
  ```
- `BeatTracker.update`: the first call only initializes (emits nothing); later calls emit one `beat` event per newly crossed integer beat (plus `bar` when the beat is a bar downbeat), **but if more than 4 beats were crossed at once, emits only the latest beat (and its bar if any)**. Going backwards emits nothing and re-syncs.

- [ ] **Step 1: Write failing tests** — use the deterministic pattern from the audiorective clock reference (`const fake = { currentTime: 0 }`, `new ManualTickSource()`, advance `fake.currentTime` then `tickSource.tick()`):
  - `beatToTime/timeToBeat round-trip at 96 BPM` (beat 4 ↔ 2.5 s after start).
  - `windows deliver eighth points exactly once` (run 0→5 s in 0.05 s ticks, collect `grid(8)` beats; expect 0, 0.5, 1 … each once, strictly increasing).
  - `loopStep wraps every 8 bars` (beat 32 → loopStep 0 with `grid(8)`, beat 32.5 → 1).
  - `setBpm keeps beat position continuous` (at t=1 s switch 96→120; `timeToBeat(1)` before and after equal within 1e-9; beat at t=1.5 = that + 0.5×2).
  - `pause/resume preserves beat position` (pause at t=1, advance to t=10, resume; beat at resume equals beat at pause).
  - `BeatTracker emits beat and bar events in order` (init 0.9; 1.1 → beat 1; 4.05 → beat 2, beat 3, beat 4 + bar 1).
  - `BeatTracker emits only the latest beat after a large gap` (init 0.5; 40.2 → only beat 40 and bar 10).
  - `heardTimeOfInput subtracts elapsed time` (`heardTimeOfInput(1000, 1016, 5)` → 4.984).
- [ ] **Step 2: Run** `npx vitest run tests/unit/clock.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** One audiorective `Clock` per `MusicClock`; fan its `onTick` window out to listeners via an adapter implementing `MusicWindow` over `window.rulers.bar.grid(stepsPerBar)`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): music clock on the audio timeline, beat tracker`

---

### Task 7: Sample preparation, zones, credits

**Files:**
- Create: `scripts/sampleNames.mjs`, `scripts/prepare-samples.mjs`, `src/music/zones.ts`, `CREDITS.md`, `public/assets/audio/samples/**` (generated, committed)
- Test: `tests/unit/sampleNames.test.ts`, `tests/unit/zones.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // scripts/sampleNames.mjs (typed via JSDoc)
  export function parseNoteName(fileName: string): { name: string; octave: number } | null; // "DCClar_susLong_A#3_v2_rr1_sum.wav" → { name: "A#", octave: 3 }; "KSHarp_E1_f.wav" → { name: "E", octave: 1 }
  export function noteToMidi(name: string, octave: number, octaveOffset: number): number; // C4 + offset 0 → 60
  export function pickPreferred(files: string[], prefer: string[]): string[]; // one file per pitch, first matching token in `prefer` wins, else first
  // src/music/zones.ts
  export interface SampleZone { midi: number; url: string }
  export interface SampleManifest { instruments: Record<InstrumentId, SampleZone[]> }
  export function pickZone(zones: readonly { midi: number }[], pitch: number): { index: number; rate: number }; // nearest; tie → higher zone; rate = 2^((pitch − midi)/12)
  export function velocityToGain(v: number): number; // 0.2 + 0.8·v², v clamped to [0,1]
  ```

**prepare-samples.mjs behaviour:**
1. Shallow, blobless, sparse clone of `https://github.com/sgossner/VSCO-2-CE` into `.vsco-cache/` and check out commit `440300901dfe9275fd84e0b7763af1f8443ae62e`, sparse paths: `Woodwinds/Clarinet/susLong`, `Woodwinds/Clarinet/stac`, `Strings/Harp`, `Strings/Cello Section/susvib`, `Strings/Violin Section/susVib`, `LICENSE`.
2. Instrument table: `clarinetSus` ← `susLong`, prefer `["_v2_", "_v1_"]`, cap 4.0 s; `clarinetStac` ← `stac`, prefer `["_v2_rr1", "_v1_rr1"]`, cap 1.0 s; `harp` ← `Strings/Harp`, prefer `["_mf"]`, cap 3.5 s; `celloSection` ← cello `susvib`, prefer `["_v2", "_v1"]`, cap 5.0 s; `violinSection` ← violin `susVib`, prefer `["_v2", "_v1"]`, cap 5.0 s.
3. Per file: `ffmpeg -i in -ac 1 -ar 44100 -af "silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:<cap>,afade=t=out:st=<cap-0.15>:d=0.15" -c:a flac out/<midi>.flac`.
4. **Octave check:** decode the middle 0.2 s of each output to f32 (ffmpeg `-f f32le`), estimate f0 by autocorrelation (60–2000 Hz), compare with `noteToMidi(…, offset)`; try offsets 0 and +1 on the first three files of each instrument, keep the offset whose error is < 50 cents for all three, **abort with a clear error if neither fits**.
5. Write `public/assets/audio/samples/manifest.json` (`SampleManifest`, urls like `assets/audio/samples/harp/45.flac`) and print the total size.

- [ ] **Step 1: Write failing tests** for `parseNoteName` (both naming styles, `null` for a LICENSE file), `noteToMidi` (`("A",4,0)`→69, `("C",3,1)`→60), `pickPreferred` (keeps one per pitch, honours preference order), `pickZone` (exact zone → rate 1; 2 semitones above a zone → rate ≈1.1225; tie between zones 60 and 64 for pitch 62 → index of 64), `velocityToGain` (0→0.2, 1→1, clamps 1.5→1).
- [ ] **Step 2: Run** `npx vitest run tests/unit/sampleNames.test.ts tests/unit/zones.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** helpers, `zones.ts` and the script.
- [ ] **Step 4: Run** tests — Expected: PASS. Run `node scripts/prepare-samples.mjs` — Expected: manifest lists all five instruments with ≥ 5 zones each, octave offsets reported, total size printed (expect < 20 MB). Listen-check is manual later.
- [ ] **Step 5: Write `CREDITS.md`**: VSCO 2 Community Edition — Versilian Studios (recorded by Sam Gossner & Simon Dalzell), CC0 1.0, source URL + commit hash, list of instrument folders used and processing applied; Foley — synthesized in code, no third-party audio; Phaser (MIT), Audiorective (MIT).
- [ ] **Step 6: Commit** `feat(audio): prepare VSCO 2 CE samples as trimmed FLAC with manifest`

---

### Task 8: SampledInstrument, NotePlayer, ScorePlayer

**Files:**
- Create: `src/music/instruments/sampledInstrument.ts`, `src/music/notePlayer.ts`, `src/music/scorePlayer.ts`
- Test: `tests/unit/notePlayer.test.ts`, `tests/unit/scorePlayer.test.ts`

**Interfaces:**
- Consumes: `MusicClock`, `MusicWindow`, `TimeSource` (Task 6); `EventLog` (Task 4); `LoopScore` (Task 2); `pickZone`, `velocityToGain`, `SampleZone` (Task 7); `AudioProcessor`, `Sampler`, `AudioBufferCache` (`@audiorective/core`; follow the `audio-processor-authoring` skill).
- Produces:
  ```ts
  // notePlayer.ts
  export interface VoiceHandle { stop(when: number): void }
  export interface InstrumentPort { play(n: { when: number; pitch: number; velocity: number; durationSec: number }): VoiceHandle | null }
  export interface NotePlayerDeps { clock: Pick<MusicClock, "beatToTime" | "secondsPerBeat">; context: TimeSource; instruments: Partial<Record<InstrumentId, InstrumentPort>>; log: EventLog; warn?: (msg: string) => void }
  export class NotePlayer {
    constructor(deps: NotePlayerDeps);
    play(req: NoteRequest): number;               // logs, schedules at max(beatToTime(timeBeats), currentTime + 0.005); returns event id
    release(id: number, atBeat: number): void;    // stop voice at max(beatToTime(atBeat), now); amend duration = atBeat − timeBeats (only if shorter)
  }
  // instruments/sampledInstrument.ts
  export interface SampledInstrumentOptions { volume: number; fadeIn: number; fadeOut: number; polyphonyPerZone: number }
  export class SampledInstrument extends AudioProcessor<{ volume: SchedulableParam }> implements InstrumentPort {
    static load(ctx: AudioContext, cache: AudioBufferCache, zones: SampleZone[], opts: SampledInstrumentOptions): Promise<SampledInstrument>;
    get output(): AudioNode;
  }
  export const INSTRUMENT_SETTINGS: Record<InstrumentId, SampledInstrumentOptions>;
  // scorePlayer.ts
  export class ScorePlayer { constructor(clock: MusicClock, notes: NotePlayer, score: LoopScore); start(): void; stop(): void }
  ```
- `SampledInstrument.play`: one `Sampler` per zone (`polyphony: polyphonyPerZone`, `steal: "oldest"`); `trigger({ when, rate, volume: velocityToGain(v), fadeIn })`, then `voice.stop(when + durationSec)` with the instrument's `fadeOut`.
- `INSTRUMENT_SETTINGS`: clarinetSus `{0.9, 0.01, 0.12, 3}`, clarinetStac `{0.85, 0, 0.05, 3}`, harp `{0.6, 0, 0.4, 4}`, celloSection `{0.45, 0.25, 0.6, 2}`, violinSection `{0.35, 0.3, 0.6, 3}` (order: volume, fadeIn, fadeOut, polyphonyPerZone).
- A missing instrument (not loaded) is skipped: the note is still logged, `warn` is called **once per instrument**.
- `ScorePlayer.start` subscribes to `clock.onWindow`; for each `grid(score.stepsPerBar)` point it plays `score.notesAtStep(point.loopStep)` with `timeBeats = point.beat`, `source: "score"`.

- [ ] **Step 1: Write failing tests** with fake ports (record calls) and a fake clock (`beatToTime = b * 0.625`, `secondsPerBeat = 0.625`), `context = { currentTime }`:
  - `schedules at the beat's time and logs the request`.
  - `clamps past times to just after now` (beat 0 with `currentTime = 1` → `when` 1.005).
  - `durationSec = durationBeats × secondsPerBeat`.
  - `release stops the voice and shortens the logged duration`; `release never lengthens`.
  - `missing instrument is skipped and logged once` (two notes → one warning, two log entries).
  - ScorePlayer with a real `MusicClock` + `ManualTickSource` and fake time: ticking 0→2.35 s in 0.05 s steps (windows reach 2.45 s < bar 2 at 2.5 s) produces exactly bar 1's notes (8 harp, 1 cello, 3 violin), all `source: "score"`, harp beats 0, 0.5 … 3.5.
- [ ] **Step 2: Run** `npx vitest run tests/unit/notePlayer.test.ts tests/unit/scorePlayer.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the three files (`SampledInstrument` is exercised by the e2e test in Task 14, not unit-tested).
- [ ] **Step 4: Run** tests and `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): sampled instruments, note player and score player`

---

### Task 9: PlayerMusic

**Files:**
- Create: `src/music/playerMusic.ts`
- Test: `tests/unit/playerMusic.test.ts`

**Interfaces:**
- Consumes: `MusicClock`, `heardTimeOfInput` (Task 6); `quantize`, `Subdivision`, `QuantizeRules`, `SnapMode`, `ALL_SUBDIVISIONS`, `DEFAULT_RULES` (Task 3); `ClarinetVoice` (Task 5); `NotePlayer` (Task 8); `LoopScore`, `chordAtBeat` (Task 2).
- Produces:
  ```ts
  export interface MusicTuning { jumpGrid: Subdivision[]; landGrid: Subdivision[]; pickupGrid: Subdivision[]; rules: QuantizeRules }
  export const DEFAULT_TUNING: MusicTuning; // jump & pickup: ALL_SUBDIVISIONS; land: all except "quarter"; rules DEFAULT_RULES
  export interface SnapReport { action: "jump" | "land" | "runStart"; inputBeat: number; snappedBeat: number; delayMs: number; mode: SnapMode }
  export interface PlayerEvents { // what the game calls; also implemented by SilentPlayerMusic
    jump(atMs: number): void; jumpRelease(atMs: number): void;
    land(atMs: number, impact: number): void; runChanged(running: boolean, atMs: number): void;
  }
  export interface PlayerMusicDeps { clock: MusicClock; notes: NotePlayer; voice: ClarinetVoice; score: LoopScore; tuning: MusicTuning; toHeardTime: (atMs: number) => number; footstep: (when: number) => void }
  export class PlayerMusic implements PlayerEvents {
    constructor(deps: PlayerMusicDeps);
    attach(): () => void;                 // subscribes to clock windows (run phrases + footsteps)
    readonly reports: readonly SnapReport[]; // newest last, max 32
  }
  export class SilentPlayerMusic implements PlayerEvents { /* all no-ops */ }
  ```
- **jump:** heard beat = `clock.timeToBeat(toHeardTime(atMs))`; snap with `jumpGrid`; `voice.jump(chordAtBeat(score, snapped))` → `clarinetSus` note at the snapped beat, `action: "jump"`; remembers the event id. **jumpRelease:** if the jump note is still sounding, `notes.release(id, snapped release beat on the "sixteenth" grid)`. **land:** snap with `landGrid` → `clarinetStac`, `action: "land"`. **runChanged(true):** pickup note (`pickupGrid`, `clarinetStac`, `action: "run"`), set running; **runChanged(false):** clear running.
- **Windows while running:** each `grid(1)` point (bar start) → `voice.runPhrase(chord)` notes at `bar beat + offsetBeats` (`clarinetSus`, `action: "run"`); each `grid(8)` point (eighths) → `footstep(point.time)`.
- **Dedupe:** at most one player note per instrument per snapped beat (|Δ| < 1e-6); a duplicate still produces a `SnapReport` but no note.
- `delayMs = (snappedBeat − inputBeat) × secondsPerBeat × 1000`.

- [ ] **Step 1: Write failing tests** (real `MusicClock` + `ManualTickSource` + fake time, a recording fake `NotePlayer`, `toHeardTime = (ms) => ms / 1000`):
  - `jump snaps and plays a clarinet note in the current chord`.
  - `jump report has mode and delay` (input 20 ms after beat 2 → grace, delay −20 ms ±0.5).
  - `dedupes notes on the same grid point` (three jumps within 10 ms → one note, three reports).
  - `release shortens a held jump note`; `release after the note ended does nothing`.
  - `land plays a staccato note`.
  - `run start plays a pickup; bar starts while running play a phrase; footsteps on every eighth`: tick once at t = 0, call `runChanged(true, 125)` (heard beat 0.2), then tick 0.05→5.0 s in 0.05 s steps (windows reach beat ≈ 8.16). Expect 1 pickup note, run phrases starting at beats 4 and 8 (2 phrases), and exactly 16 footstep calls at the times of beats 0.5, 1.0 … 8.0.
  - `no phrases or footsteps after running stops`.
  - `SilentPlayerMusic accepts every call without throwing`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/playerMusic.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(music): player music bridge — snapped clarinet, phrases, footsteps`

---

### Task 10: Synthesized foley

**Files:**
- Create: `src/game/audio/foley.ts`
- Test: `tests/unit/foley.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface StepVariation { bandHz: number; gain: number; decaySec: number }
  export function footstepVariation(rng: () => number): StepVariation; // bandHz 1400–3200, gain 0.25–0.4, decaySec 0.05–0.08
  export class Foley extends AudioProcessor<{ volume: SchedulableParam }> {
    constructor(ctx: AudioContext, rng?: () => number);
    get output(): AudioNode;
    footstep(when: number): void;              // noise burst → bandpass(bandHz) → env (3 ms attack, decaySec) + 90 Hz sine thump 30 ms at 0.15
    jump(when: number): void;                  // noise → bandpass sweeping 800→2500 Hz over 150 ms, gain 0.3
    land(when: number, impact: number): void;  // noise → lowpass 400 Hz, 120 ms + 70 Hz sine thump; gain 0.2 + 0.4·impact
  }
  ```
- Uses one shared 1 s white-noise `AudioBuffer`; each call creates short-lived nodes that disconnect on `ended`.

- [ ] **Step 1: Write failing test**: `footstepVariation stays in range over 1000 draws and varies` (at least 50 distinct bandHz values).
- [ ] **Step 2: Run** `npx vitest run tests/unit/foley.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** (Web Audio parts verified by the e2e test and by ear).
- [ ] **Step 4: Run** test + `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(audio): synthesized grass footsteps, jump swish, landing thud`

---

### Task 11: Input layer

**Files:**
- Create: `src/game/input/inputState.ts`, `src/game/input/bindDom.ts`
- Test: `tests/unit/inputState.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Action = "left" | "right" | "down" | "jump";
  export interface ActionEdge { action: Action; pressed: boolean; timeMs: number }
  export interface GamepadLike { axes: readonly number[]; buttons: readonly { pressed: boolean }[]; timestamp: number }
  export const KEY_MAP: Record<string, Action>; // ArrowLeft,KeyA→left; ArrowRight,KeyD→right; ArrowDown,KeyS→down; Space,KeyW,ArrowUp→jump
  export class InputState {
    handleKey(code: string, down: boolean, timeMs: number): boolean; // true if mapped (caller then preventDefault)
    pollGamepad(pad: GamepadLike | null, timeMs: number): void;     // axes[0] < −0.4 left, > 0.4 right; axes[1] > 0.5 down; buttons 14/15/13 dpad L/R/down; button 0 jump
    isDown(a: Action): boolean;
    axisX(): -1 | 0 | 1;               // both left+right → 0
    drainEdges(): ActionEdge[];        // edges since last drain, in arrival order
  }
  // bindDom.ts
  export function bindDomInput(state: InputState, target: Window): () => void; // keydown/keyup with event.timeStamp; ignores event.repeat; clears all on blur
  ```
- An action is down if **any** source (any mapped key or the pad) holds it; edges fire only on the overall up→down / down→up change.

- [ ] **Step 1: Write failing tests**: `maps keys to actions`; `key repeat while held produces no extra edge`; `edges carry timestamps in order`; `left+right cancels axisX`; `key and gamepad holding jump together release only when both let go`; `gamepad stick dead zone` (axes[0] = −0.3 → not left); `unmapped key returns false`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/inputState.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(game): device-independent input actions with timestamps`

---

### Task 12: Movement rules and run animation phase

**Files:**
- Create: `src/game/player/movement.ts`, `src/game/player/animation.ts`
- Test: `tests/unit/movement.test.ts`, `tests/unit/animation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // movement.ts (y axis points down; "up" velocities are negative)
  export interface MovementParams { maxRunSpeed: number; groundAccel: number; groundDecel: number; airControl: number; jumpVelocity: number; jumpCutSpeed: number; gravity: number; fallGravityMultiplier: number; apexThreshold: number; apexGravityMultiplier: number; maxFallSpeed: number; coyoteMs: number; jumpBufferMs: number; dropThroughMs: number }
  export const DEFAULT_MOVEMENT: MovementParams;
  // = { maxRunSpeed: 150, groundAccel: 1875, groundDecel: 2500, airControl: 0.65, jumpVelocity: 325.6, jumpCutSpeed: 160,
  //     gravity: 946.7, fallGravityMultiplier: 1.8, apexThreshold: 40, apexGravityMultiplier: 0.5, maxFallSpeed: 330,
  //     coyoteMs: 100, jumpBufferMs: 120, dropThroughMs: 200 }
  export function stepHorizontal(vx: number, dir: -1 | 0 | 1, grounded: boolean, dt: number, p: MovementParams): number;
  export function stepVertical(vy: number, jumpHeld: boolean, dt: number, p: MovementParams): number; // gravity by phase, clamp to maxFallSpeed
  export function applyJumpCut(vy: number, p: MovementParams): number; // rising faster than cut → −jumpCutSpeed
  export type JumpDecision = { kind: "none" } | { kind: "jump"; buffered: boolean; coyote: boolean } | { kind: "dropThrough" };
  export class JumpLogic {
    constructor(p: MovementParams);
    press(atMs: number): void;
    update(s: { grounded: boolean; downHeld: boolean; onOneWay: boolean }, nowMs: number): JumpDecision;
  }
  export function simulateJump(p: MovementParams, holdSteps: number, dt?: number): { apexHeight: number; airTimeSec: number }; // flat ground, 60 Hz default
  // animation.ts
  export type PlayerAnim = "idle" | "run" | "rise" | "fall" | "land";
  export const RUN_FRAMES = 8;
  export function runFrameAtBeat(beat: number): number; // floor(frac(beat) × 8), floored for negatives; contacts at 0 and 4
  export function chooseAnim(s: { grounded: boolean; vx: number; vy: number; msSinceLanding: number }): PlayerAnim; // land for 80 ms after landing; run if |vx| > 10
  ```
- **JumpLogic:** a press is buffered for `jumpBufferMs`. `update` returns `jump` when a live press exists and (grounded, or ungrounded within `coyoteMs` of last grounded **and no jump since**); consumes the press. Down held + on one-way platform + press → `dropThrough` instead. Each press yields at most one jump; holding the button never re-triggers.

- [ ] **Step 1: Write failing tests**
  ```ts
  it("full jump ≈ 56 px", () => { const r = simulateJump(DEFAULT_MOVEMENT, 999); expect(r.apexHeight).toBeGreaterThanOrEqual(52); expect(r.apexHeight).toBeLessThanOrEqual(60); });
  it("full jump air time ≈ 0.6 s", () => { const r = simulateJump(DEFAULT_MOVEMENT, 999); expect(r.airTimeSec).toBeGreaterThan(0.52); expect(r.airTimeSec).toBeLessThan(0.68); });
  it("tap = short hop ≈ 18 px", () => { const r = simulateJump(DEFAULT_MOVEMENT, 1); expect(r.apexHeight).toBeGreaterThanOrEqual(14); expect(r.apexHeight).toBeLessThanOrEqual(22); });
  ```
  plus: `reaches max run speed in ~0.08 s` (5 steps at 60 Hz: ≥ 140, never > 150); `stops in ~0.06 s` (≤ 4 steps); `air control is 65 %`; `fall speed clamps at 330`; `coyote jump works 90 ms after leaving the edge, not 110 ms`; `buffered press 100 ms before landing jumps on landing, 130 ms does not`; `mid-air press outside buffer does nothing`; `held jump does not re-trigger on landing`; `down + jump on one-way → dropThrough`; `down + jump on solid ground → jump`; `runFrameAtBeat`: 0→0, 0.5→4, 0.99→7, 1.0→0, −0.125→7; `chooseAnim` covers all five states.
- [ ] **Step 2: Run** `npx vitest run tests/unit/movement.test.ts tests/unit/animation.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Gravity per step: rising with `|vy| < apexThreshold` and jump held → `gravity × apexGravityMultiplier`; rising otherwise → `gravity`; falling → `gravity × fallGravityMultiplier`. `simulateJump`: start grounded at y = 0, press at step 0, release after `holdSteps` (apply cut on release), integrate semi-implicit Euler until back at y ≥ 0.
- [ ] **Step 4: Run** — Expected: PASS. If a jump-height test fails, tune only `jumpVelocity`/`gravity`/`jumpCutSpeed` and record new values in `DEFAULT_MOVEMENT`.
- [ ] **Step 5: Commit** `feat(game): Dead Cells-style movement rules and beat-locked run frames`

---

### Task 13: Test area, placeholder art, player controller (playable, silent) + e2e harness

**Files:**
- Create: `src/game/art/placeholderArt.ts`, `src/game/world/testArea.ts`, `src/game/player/PlayerController.ts`, `src/game/scenes/BootScene.ts`, `src/game/scenes/StartScene.ts`, `src/game/scenes/TestAreaScene.ts`, `src/game/testHook.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `src/main.ts` (scenes list, remove placeholder scene)
- Test: `tests/unit/testArea.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `InputState`, `bindDomInput` (Task 11); `DEFAULT_MOVEMENT`, `stepHorizontal`, `stepVertical`, `applyJumpCut`, `JumpLogic` (Task 12); `runFrameAtBeat`, `chooseAnim` (Task 12); `PlayerEvents`, `SilentPlayerMusic` (Task 9); `MusicClock` (Task 6).
- Produces:
  ```ts
  // world/testArea.ts
  export const TILE = 16;
  export type TileKind = 0 | 1 | 2; // empty, solid ground, one-way platform
  export interface TestAreaLayout { width: number; height: number; tiles: TileKind[][]; spawn: { x: number; y: number } } // tiles[row][col]
  export function buildTestArea(): TestAreaLayout; // 60×17 tiles; rows 15–16 solid; ≥ 4 one-way platforms 3–6 tiles wide at rows 9–12 with ≥ 2 rows of headroom
  // player/PlayerController.ts
  export class PlayerController {
    constructor(scene: Phaser.Scene, x: number, y: number, input: InputState, events: PlayerEvents, beatSource: () => number, params?: MovementParams);
    readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    fixedStep(dtSec: number, nowMs: number): void; // called from the world's "worldstep" event
    isOnOneWay(): boolean;
    readonly state: { grounded: boolean; vx: number; vy: number; anim: PlayerAnim };
  }
  // testHook.ts
  export interface OctaviaTestState { scene: string; player: { x: number; y: number; grounded: boolean } | null; audio: "running" | "silent" | "pending"; eventCount: number }
  export function publishTestState(get: () => OctaviaTestState): void; // window.__octavia = { state: get }
  ```
- **Placeholder art** (generated at boot with `Graphics.generateTexture`): player sheet 16×24 per frame — idle (1), run (8, legs alternate, contact poses at frames 0 and 4), rise, fall, land; grass ground tile, dirt fill tile, wooden one-way plank tile; sky gradient, distant forest silhouette strip (parallax 0.3), near hills (0.6). Muted dusk-countryside palette.
- **Controller:** Arcade body with world gravity 0 (gravity is ours); per fixed step: drain input edges (jump press → `JumpLogic.press(edge.timeMs)`; jump release → `applyJumpCut` + `events.jumpRelease`), horizontal/vertical integration, `JumpLogic.update`; on jump: set `vy = −jumpVelocity`, `events.jump(edge.timeMs if pressed this step, else nowMs)`; on landing: `events.land(nowMs, clamp(vyBefore / maxFallSpeed, 0, 1))`; run state change (grounded && |vx| > 10) → `events.runChanged`. One-way tiles collide on the top face only (`tile.setCollision(false, false, true, false)`); a collider `processCallback` ignores one-way tiles for `dropThroughMs` after `dropThrough`. Run animation frame = `runFrameAtBeat(beatSource())`. **Stall safety:** after a long frame (tab stall, breakpoint) the player must not tunnel through platforms or teleport — if Arcade's fixed-step catch-up is not already capped, skip catch-up steps beyond 6 per frame.
- **Scenes:** `BootScene` generates textures → `StartScene` shows "Octavia — click or press any key" → `TestAreaScene` (tilemap from `buildTestArea`, player at spawn, camera follow with lerp 0.12 and look-ahead 24 px toward facing, bounds = level, integer positions). In this task `StartScene` simply starts `TestAreaScene` with `SilentPlayerMusic` and a `MusicClock` driven by `{ currentTime: performance.now() / 1000 }` (perceivedTime = same) so animation has a beat.
- **Playwright:** `playwright.config.ts` — `testDir: tests/e2e`, `webServer: { command: "npm run dev -- --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: true }`, chromium with `launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"], executablePath: existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined }`.

- [ ] **Step 1: Write failing tests**
  - Unit `testArea.test.ts`: ground rows full; at least 4 one-way platforms; spawn is above ground on empty tiles; every platform has two empty rows above it.
  - E2E `smoke.spec.ts`:
    ```ts
    test("loads, starts, runs and jumps", async ({ page }) => {
      const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/"); await page.mouse.click(240, 135);
      await page.waitForFunction(() => (window as any).__octavia?.state().scene === "TestArea");
      const x0 = await page.evaluate(() => (window as any).__octavia.state().player.x);
      await page.keyboard.down("ArrowRight"); await page.waitForTimeout(600); await page.keyboard.up("ArrowRight");
      expect(await page.evaluate(() => (window as any).__octavia.state().player.x)).toBeGreaterThan(x0 + 40);
      await page.keyboard.down("Space");
      await page.waitForFunction(() => !(window as any).__octavia.state().player.grounded);
      await page.keyboard.up("Space");
      expect(errors).toEqual([]);
    });
    ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/testArea.test.ts && npm run e2e` — Expected: FAIL.
- [ ] **Step 3: Implement** the files above; `TestAreaScene` registers `this.physics.world.on("worldstep", (delta) => player.fixedStep(delta, performance.now()))` and publishes the test hook.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run e2e` — Expected: PASS. Take one screenshot (`page.screenshot` in a throwaway script or the Playwright trace) and check the scene renders crisply.
- [ ] **Step 5: Commit** `feat(game): playable test area with placeholder art and player controller`

---

### Task 14: Audio integration — engine, start screen, music + foley wiring, beat visuals, pause

**Files:**
- Create: `src/game/audio/audioSystem.ts`, `src/game/world/beatVisuals.ts`
- Modify: `src/game/scenes/StartScene.ts`, `src/game/scenes/TestAreaScene.ts`, `src/game/scenes/BootScene.ts`, `src/game/testHook.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: everything in `src/music/` (Tasks 2–9), `Foley` (Task 10), `createEngine`, `AudioBufferCache` (`@audiorective/core`).
- Produces:
  ```ts
  // audioSystem.ts
  export interface AudioSystem {
    readonly status: "pending" | "running" | "silent";
    readonly clock: MusicClock;            // real audio clock when running; performance.now clock when silent
    readonly playerMusic: PlayerEvents & { reports?: readonly SnapReport[] };
    readonly foley: Pick<Foley, "jump" | "land"> | null;
    readonly log: EventLog;
    start(): Promise<"running" | "silent">; // call from a user gesture; loads manifest + samples, starts ScorePlayer, PlayerMusic.attach
    pause(): void; resume(): void;
  }
  export function createAudioSystem(opts: { silent?: boolean }): AudioSystem;
  // beatVisuals.ts
  export class BeatVisuals { constructor(scene: Phaser.Scene, grassTufts: Phaser.GameObjects.Image[]); onBeat(e: BeatEvent): void; update(dtMs: number): void }
  ```
- `start()`: `engine.core.start()`; if the context is not `running` within 2 s, or the manifest fails → `silent` (show a small "sound unavailable" note in the corner). Individual sample load failures → that instrument missing (NotePlayer warns once). Clock: bpm 96, beatsPerBar 4, loopBars 8, `perceivedTime = () => engine.core.perceivedTime`. `PlayerMusic.toHeardTime = (ms) => heardTimeOfInput(ms, performance.now(), engine.core.perceivedTime)`; `footstep = (when) => foley.footstep(when)`. Seed clarinet RNG from `Date.now()`.
- `?silent=1` query param forces silent mode (for the e2e test of the fallback).
- Game wiring: controller events go to a small fan-out that calls `playerMusic` **and** instant foley (`foley.jump(ctx.currentTime)`, `foley.land(ctx.currentTime, impact)`).
- **BeatVisuals:** each frame `BeatTracker.update(clock.perceivedBeat())`; on beat, grass tufts tilt 2° and ease back over 250 ms (bar downbeat: 3°); a full-screen warm overlay rectangle (additive) pulses alpha +0.04 (bar +0.07) decaying over 300 ms.
- **Visibility:** `document.visibilitychange` hidden → `scene.pause()`, `audio.pause()` (clock pause + `engine.core.suspend()`); visible → resume both.
- Test hook adds `audio` status and `eventCount = log.events().length`.

- [ ] **Step 1: Extend the e2e test** (failing): after the existing steps, `expect(state.audio).toBe("running")`; after a jump, wait until `eventCount` grows and `__octavia.events()` (expose `log.toJSON().events` on the hook) contains an event with `source: "player"`, `action: "jump"`. Add `test("?silent=1 still plays")` that loads `/?silent=1`, clicks, runs right, and expects `audio === "silent"`, the player moved, and no page errors.
- [ ] **Step 2: Run** `npm run e2e` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run e2e` — Expected: PASS. Then run `npm run dev` and listen (or record a 10 s capture with Playwright + `MediaRecorder` if no speakers): the loop plays, footsteps fall on eighths, clarinet answers jumps/landings in key.
- [ ] **Step 5: Commit** `feat: wire music core, foley and beat visuals into the game`

---

### Task 15: Tuning store and debug overlay

**Files:**
- Create: `src/game/debug/tuning.ts`, `src/game/debug/DebugOverlay.ts`
- Modify: `src/game/scenes/TestAreaScene.ts` (pass tuning to controller/music, mount overlay), `src/game/player/PlayerController.ts` (read params from tuning each step)
- Test: `tests/unit/tuning.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_MOVEMENT` (Task 12), `DEFAULT_TUNING`, `SnapReport` (Task 9), `MusicClock` (Task 6), `EventLog` (Task 4).
- Produces:
  ```ts
  // tuning.ts
  export interface SliderSpec { key: string; label: string; min: number; max: number; step: number }
  export interface Tuning { bpm: number; movement: MovementParams; music: MusicTuning }
  export const SLIDERS: SliderSpec[]; // bpm 60–160 step 1; maxRunSpeed 80–260; jumpVelocity 200–450; gravity 500–1600; fallGravityMultiplier 1–3 step 0.1; coyoteMs 0–200; jumpBufferMs 0–250; lateGraceSec 0–0.06 step 0.005; strongPullSec 0–0.08 step 0.005
  export function createTuning(): Tuning;                       // deep copies of defaults
  export function setTuningValue(t: Tuning, key: string, value: number): void; // clamps to the slider range; unknown key throws
  export function getTuningValue(t: Tuning, key: string): number;
  // DebugOverlay.ts
  export class DebugOverlay { constructor(root: HTMLElement, deps: { tuning: Tuning; clock: MusicClock; reports: () => readonly SnapReport[]; log: EventLog; fps: () => number; chordName: () => string }); toggle(): void; update(): void; destroy(): void }
  ```
- Overlay (DOM, monospace, top-right, hidden by default, toggled with **Backquote**): tempo, bar.beat, chord, FPS; a 2-bar scrolling grid canvas (beats, eighths, triplets drawn faintly) with input markers (hollow) and snapped markers (filled) joined by a line, last delay in ms; sliders from `SLIDERS`; "Dump event log" button → `console.log(JSON.stringify(log.toJSON()))`. Changing `bpm` calls `clock.setBpm`.

- [ ] **Step 1: Write failing tests**: `createTuning returns independent copies`; `setTuningValue clamps to the slider range`; `get/set round-trip for every slider key`; `unknown key throws`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/tuning.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; extend `tests/e2e/smoke.spec.ts` with `overlay toggles with backquote` (press `` ` ``, expect `#debug-overlay` visible; press again, hidden).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run e2e` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(debug): live tuning overlay with beat grid and snap markers`

---

### Task 16: README and final verification

**Files:**
- Create: `README.md`
- Modify: none expected (fix anything found)

- [ ] **Step 1: Write `README.md`**: what Octavia is (one paragraph), how to run (`npm install`, `npm run dev`, open the printed URL, click to start), controls (arrows/WASD, Space/W/Up jump, Down/S + jump to drop, Backquote overlay, gamepad), how to test (`npm test`, `npm run e2e`), how samples were prepared (`node scripts/prepare-samples.mjs`), link to the spec and `CREDITS.md`.
- [ ] **Step 2: Full verification**: `npm test && npm run typecheck && npm run build && npm run e2e` — Expected: all pass. Check every item of spec §8 "Step 1 is done when" and note any that need the human's ears/eyes.
- [ ] **Step 3: Commit and push** `git commit -am "docs: README for Step 1"` then `git push -u origin claude/keen-ramanujan-skh3gn`.
