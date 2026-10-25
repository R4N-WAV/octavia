# Octavia — Vision & Step 1 Design

**Date:** 2026-10-25
**Status:** Approved (2026-10-25)
**Scope of this spec:** the overall vision (for reference) and the full design of **Step 1** — movement, the beat clock, and beat-snapped sound. Steps 2–4 get their own spec → plan → build cycle.

---

## 1. Vision

Octavia is a pixel-art, side-scrolling action game. The player is a being made of music — powered by and existing through sound and its frequencies. Every step, jump and action is part of the music.

### Design pillars

1. **You can never play wrong.** There is no "off-beat". Every action is caught by the music and placed on the nearest musical subdivision (straight, triplet, sixteenth…). The music follows the player, not the other way round.
2. **Dead Cells feel, Deadbolt craft.** Fluid, instant, forgiving 2D movement (Dead Cells). Crisp pixel art, strong silhouettes, punchy animation and mood (Deadbolt's craft, applied to a nature setting).
3. **One emotional orchestral voice.** Melodic, emotional orchestral writing in the spirit of John Powell (*How to Train Your Dragon 2*), anime and children's-film scores. Calm areas are pastoral; fights add driving percussion, staccato strings, brass, and subtle electronic pulses that hint at what Octavia is.
4. **Body sounds real, soul plays music.** Every action has a natural sound (grass footsteps, cloth, landing thud) played instantly, layered with Octavia's signature instrument — the **clarinet** — snapped to the beat behind it.

### Setting

Open countryside: a grass plain far out near farms and forests. Step 1–4 use a single level on this plain.

### Roadmap

| Step | Delivers |
|---|---|
| **1 (this spec)** | Movement (run, variable jump, drop-through), beat clock, beat-snapped clarinet + natural sounds, a simple pastoral loop, test area with placeholder art |
| 2 | Adaptive orchestral music engine (Conductor): layers, intensity, calm vs combat arrangement, leitmotifs |
| 3 | Combat and enemies (beat-synced), percussive orchestral impact hits |
| 4 | First real level with final art direction |
| Later | Story mode; Composition mode (playthrough recorded as a musical piece); roguelite layer; desktop (Tauri/Electron) and iOS/Android (Capacitor) builds; touch controls; more moves (double jump, dodge roll, ledge grab, wall jump, air dash) |

---

## 2. Step 1 — the player's experience

- Open the game link in a browser; click once to start (browsers require this before playing sound).
- A small test area on the grass plain: sky, distant forest silhouette, flat ground and a few floating wooden **one-way platforms**. Placeholder art, but at the final pixel resolution.
- Octavia (placeholder figure) can **run**, **jump** (tap = short hop, hold = full jump) and **drop through** one-way platforms (down + jump).
- Movement is forgiving: a jump still works a moment after running off an edge, and a jump pressed slightly before landing fires on landing.
- **Sound:**
  - A gentle looping pastoral backing (strings pad + harp arpeggio) at **96 BPM in C minor**.
  - **Natural layer**, instant: grass footsteps, jump swish, landing thud.
  - **Clarinet layer**, beat-snapped and in key: notes and short phrases triggered by running, jumping and landing — it should sound like improvising over the backing.
  - Footsteps land on the beat: the run cycle is paced to the tempo.
- **Seeing the beat:** grass and ambient light sway subtly on the beat.
- **Tuning overlay** (toggle with a key, default `` ` ``): shows the beat grid, each action's input moment and where its note snapped, plus live tuning values.
- Controls: keyboard and gamepad.

**Out of scope for Step 1:** combat, enemies, adaptive arrangement, final art, menus, saving, touch controls, desktop/mobile builds, composition export.

---

## 3. Technical decisions (with plain-language reasons)

| Decision | Choice | Why |
|---|---|---|
| Language & build | TypeScript + Vite | Type safety catches mistakes early; Vite gives instant reloads during development. |
| Game framework | Phaser 3 (latest 3.x, pinned) | Handles rendering, sprites, cameras, tilemaps and input so we spend effort on feel and music. |
| Physics | Phaser Arcade physics for collisions only; our own movement code on top, fixed 60 Hz update | Dead Cells feel needs hand-tuned movement; a fixed update makes movement identical on every device. |
| Rendering | Internal resolution **480×270**, integer-scaled, nearest-neighbour, pixel-snapped camera | Crisp pixels at any screen size, from phones to monitors; 16:9 fits most screens. |
| Timekeeping | Everything musical uses the audio hardware clock (`AudioContext.currentTime`) | Sound and visuals can never drift apart. |
| Music data | All music — backing and player notes — is **note events**, not audio recordings | Lets the engine rearrange music live (Step 2) and record playthroughs (Composition mode). |
| Instruments | Recorded orchestral **samples** (not synthesisers) | Far closer to the orchestral sound we want. |
| Audio library | Web Audio API; the plan evaluates `@audiorective/core` (Audiorective plugin) for scheduling/instrument structure and adopts it only if it meets the requirements in §4.3; otherwise plain Web Audio | Sample-accurate scheduling is non-negotiable; the library is a convenience, not a dependency we bend the design around. |
| Tests | Vitest (unit), Playwright (browser smoke test) | Music timing and movement rules are checked automatically on every change. |
| Portability rule | The music core (`src/music/`) imports nothing from Phaser; input is read as abstract actions | Keeps desktop/mobile ports and touch controls a matter of adding, not rewriting. |

---

## 4. Architecture

```
            ┌──────────────── MUSIC CORE  (src/music, no Phaser) ───────────────┐
 actions ──►│ Clock ─► Quantizer ─► Scheduler ─► Instruments (sampler) ─► out   │
 (timed)    │              ▲             ▲                                       │
            │        ClarinetVoice    Score (backing loop)                      │
            │              (melody choice)        │                             │
            │                     EventLog ◄──────┘ (every scheduled note)      │
            └────────────────────────────────────────────────────────────────────┘
                 ▲ beat time / beat events          ▲ gameplay events
            ┌────┴──────────────── GAME  (src/game, Phaser) ────────────────────┐
            │ Input ─► PlayerController ─► Animation (run cycle phase-locked)   │
            │ World (test area, platforms) · Camera · BeatVisuals · DebugOverlay │
            │ Foley (natural sounds, instant)                                    │
            └────────────────────────────────────────────────────────────────────┘
```

### 4.1 Clock (`src/music/clock.ts`)

- Owns tempo (BPM) and meter (4/4). Step 1: one fixed tempo per level, default **96 BPM** (tunable in the overlay).
- Song position is measured in **beats** from a start time on the audio clock.
- Converts audio seconds ↔ beats.
- Converts input timestamps (`performance.now()`-based, from browser events) to audio time using `AudioContext.getOutputTimestamp()`, so input moments are measured on the same clock as the music, including the device's output latency.
- Emits beat/bar events to the game (used for visuals), computed from the audio clock each frame.

### 4.2 Quantizer (`src/music/quantizer.ts`)

A pure function: `(inputTimeBeats, gridSet, rules) → snappedTimeBeats`.

- **Grid points** are the union of the subdivisions in the action's grid set, measured in beats:
  - quarter = 1, eighth = 1/2, sixteenth = 1/4, eighth-triplet = 1/3, sixteenth-triplet = 1/6, thirty-second = 1/8.
- **Each point has a strength:** downbeat of bar > beat > eighth > triplet > sixteenth > sixteenth-triplet > thirty-second.
- **Snapping rules, in order:**
  1. **Late grace:** if the input is at most **30 ms after** a grid point, the note plays **immediately** and is logged at that point. (People hear notes within ~30 ms as simultaneous, so this sounds on time and adds no delay.)
  2. **Strong-point pull:** otherwise, if a point of strength ≥ eighth lies within **40 ms ahead**, snap to it.
  3. **Nearest forward:** otherwise snap to the nearest upcoming grid point.
- With the default jump grid set (quarter, eighth, sixteenth, eighth-triplet, sixteenth-triplet, thirty-second) the largest gap between points is 1/8 beat = **≈78 ms at 96 BPM**, so no note waits longer than ~78 ms. Grid sets and windows are tunable in the overlay.
- **Only sound is quantized.** Movement and natural sounds always happen instantly.

### 4.3 Scheduler & instruments (`src/music/scheduler.ts`, `src/music/instruments/`)

- Look-ahead scheduling: a timer runs every ~25 ms and schedules any notes due in the next ~100 ms on the audio clock (sample-accurate start times).
- Player notes arrive with a snapped time, typically 0–78 ms ahead, and are scheduled immediately.
- **Sampler instrument:** plays a sample for a MIDI pitch and velocity, pitch-shifting from the nearest sampled note; simple attack/release envelope; per-instrument volume.
- Instruments for Step 1: **clarinet** (player voice), **strings pad** and **harp** (backing).
- Sample sources: openly licensed orchestral libraries — candidates **VSCO 2 Community Edition** (CC0) and **Sonatina Symphonic Orchestra**. The plan verifies instrument coverage and licence before use. Every asset's source and licence is recorded in `CREDITS.md`.
- **Mobile-readiness:** audio starts only after the first click/tap (start screen); samples load before play begins.

### 4.4 Score (`src/music/score/`)

- The backing loop is written as note data: an **8-bar progression in C minor** (i–VI–III–VII shape: Cm – A♭ – E♭ – B♭, voiced for strings pad), with a gentle harp arpeggio in eighths, looping seamlessly.
- The score exposes the **current chord** and **key** so the clarinet can play in harmony.

### 4.5 ClarinetVoice (`src/music/clarinetVoice.ts`)

Chooses *which* notes the clarinet plays; the Quantizer chooses *when*.

- Notes come from the current chord's tones, with scale tones (C natural minor) as passing notes. Range: clarinet's comfortable middle register.
- **Jump:** an upward leap from the last note to a chord tone; held jumps get a longer note.
- **Land:** resolves downward to a chord tone; short note.
- **Running:** a short melodic fragment (2–4 notes) at the start of each bar while running, built from a small set of hand-written motif shapes transposed to the current chord. Not every step plays a clarinet note — the footsteps carry the rhythm.
- **Idle:** silent.
- Melodic memory: remembers the last note so phrases connect smoothly (prefers small steps; leaps only on jumps).

### 4.6 EventLog (`src/music/eventLog.ts`)

- Every scheduled note (backing and player) is recorded as:
  `{ timeBeats, durationBeats, instrument, pitch (MIDI), velocity, source: "score" | "player", action?: "jump" | "land" | "run" }`
  plus the level's tempo.
- Step 1 keeps the log in memory and lets the overlay dump it to the browser console as JSON. This is the foundation for Composition mode; no export UI yet.

### 4.7 Input (`src/game/input/`)

- Maps devices to abstract **actions**: `left`, `right`, `down`, `jump` (press and release), each with the browser event's timestamp.
- Default keys: arrows / A-D for movement, Space / W / Up for jump, S / Down for down. Gamepad: left stick / d-pad, south button (A/Cross) to jump.
- The controller only ever sees actions, so touch can be added later as another source.

### 4.8 PlayerController (`src/game/player/`)

A small state machine: `idle`, `run`, `jump-rise`, `fall`, `land`.

Starting values (all tunable in the overlay, all in internal pixels):

| Parameter | Start value |
|---|---|
| Max run speed | 150 px/s |
| Ground acceleration / deceleration | reach max in ~0.08 s / stop in ~0.06 s |
| Air control | 65 % of ground acceleration |
| Full jump height | 56 px (≈3.5 tiles of 16 px) |
| Short hop (released early) | ~18 px — jump velocity is cut when the button is released while rising |
| Gravity | tuned so a full jump lasts ~0.6 s; 1.8× gravity when falling; reduced gravity near the apex for a little hang time |
| Max fall speed | 330 px/s |
| Coyote time (jump after leaving edge) | 100 ms |
| Jump buffer (press before landing) | 120 ms |
| Drop-through | down + jump on a one-way platform; collision with that platform ignored for 200 ms |

Gameplay events emitted to the music core and foley: `jump` (with held duration when known), `land` (with fall speed), `runStart`, `runStop`, `footstep`.

### 4.9 Animation & beat sync (`src/game/player/animation.ts`)

- **Run cycle phase-locked to the clock:** two footsteps per beat (on eighths: 312.5 ms per step at 96 BPM). Animation frame is computed from song position, not from elapsed frames, so footstep contact frames always land on eighth-note points. When running starts, the first stride is shortened or lengthened slightly (≤ one eighth) so contact lands on the next eighth. `footstep` events fire on contact frames.
- Jump and land animations play at normal speed in Step 1 (they are short). Beat-stretching of other key frames (e.g. attack impacts) comes with combat in Step 3.
- Placeholder sprite: a simple figure at ~16×24 px with idle, run (8 frames), rise, fall, land poses.

### 4.10 Foley (`src/game/audio/foley.ts`)

- Natural sounds play **instantly** when their gameplay event fires: grass footstep (3–4 variations, random pick, slight pitch variation), jump swish, landing thud (louder for harder landings).
- Mixed **in front** of the clarinet; the clarinet sits behind as the "soul" layer.
- Sources: CC0 sound libraries (e.g. Kenney, Freesound CC0), recorded in `CREDITS.md`.

### 4.11 World, camera, beat visuals

- Test area built as a small tilemap (16 px tiles): ground, a few one-way wooden platforms at varied heights, parallax sky and forest silhouette.
- Camera follows the player with light smoothing and look-ahead in the running direction; positions rounded to whole pixels.
- **BeatVisuals:** grass tufts sway and ambient light brightens slightly on each beat (a bit more on bar downbeats), driven by Clock beat events.

### 4.12 Debug / tuning overlay

- Toggle with `` ` ``.
- Shows: tempo, current beat/bar, a scrolling beat grid with each action's input moment (marker) and snapped note time (marker), the snap delay in ms, current chord, and FPS.
- Live sliders for tempo, movement parameters and quantizer windows; a "dump event log" button.

---

## 5. Project layout

```
octavia/
  index.html
  package.json, tsconfig.json, vite.config.ts
  CREDITS.md                 # every asset's source + licence
  public/assets/
    audio/samples/{clarinet,strings,harp}/
    audio/foley/
    sprites/
  src/
    main.ts                  # boot Phaser + music core
    music/                   # NO Phaser imports
      clock.ts
      quantizer.ts
      scheduler.ts
      instruments/sampler.ts
      score/pastoralLoop.ts
      clarinetVoice.ts
      eventLog.ts
    game/
      scenes/{BootScene,StartScene,TestAreaScene}.ts
      input/
      player/{PlayerController,animation}.ts
      audio/foley.ts
      world/
      debug/DebugOverlay.ts
  tests/
    unit/                    # Vitest: clock, quantizer, clarinetVoice, controller rules, eventLog
    e2e/                     # Playwright smoke test
```

---

## 6. Error handling

- **Audio won't start** (blocked or no audio device): the start screen stays until a click/tap succeeds; if the audio context still cannot start, the game runs silently and shows a small "sound unavailable" notice. Movement never depends on audio.
- **A sample fails to load:** that instrument is silenced and a warning is logged; the game continues.
- **Tab hidden / audio suspended:** the game pauses; on return, the clock re-anchors to the audio clock so nothing jumps or bursts.
- **Frame-rate drops:** movement uses a fixed 60 Hz update with an accumulator (capped to avoid a "spiral" after long pauses); music timing is unaffected because it runs on the audio clock.

---

## 7. Testing

- **Unit (Vitest):**
  - Clock: seconds ↔ beats round-trips, tempo changes, input-time conversion.
  - Quantizer: late grace, strong-point pull, nearest-forward, maximum wait never exceeding the largest grid gap, triplet and straight points mixing correctly.
  - ClarinetVoice: notes always in key and chord-appropriate; jumps go up, landings resolve down; stays in range.
  - EventLog: every scheduled note recorded with the right fields.
  - Controller rules (pure functions): coyote time, jump buffer, variable jump cut, drop-through timing.
- **Browser smoke test (Playwright):** game loads with no console errors, start screen → test area, holding right moves the player, pressing jump makes the player leave the ground.
- **Manual feel check (you):** play and judge; the tuning overlay lets us adjust together.

## 8. Step 1 is done when

1. The game runs in a desktop browser from `npm run dev` (and a built version).
2. Run, variable jump and drop-through work with coyote time and jump buffering.
3. The pastoral loop plays seamlessly; footsteps land on eighth notes while running.
4. Clarinet notes from jump, land and running are in key and never more than ~78 ms after the input at 96 BPM; natural sounds play instantly.
5. The tuning overlay shows input vs snapped times and allows live tuning.
6. All unit tests and the smoke test pass.
7. All assets are openly licensed and listed in `CREDITS.md`.

## 9. Known risks

- **Sample quality / coverage:** free libraries may not include every instrument at good quality. Mitigation: verify in the plan; instruments are swappable without engine changes.
- **Output latency differences between devices** (especially Bluetooth headphones, later mobile). Mitigation: latency-aware time conversion (§4.1); a manual latency offset can be added to settings later.
- **Clarinet phrases sounding repetitive.** Mitigation: motif set is data, easy to extend; real musical variety arrives with the Conductor in Step 2.
