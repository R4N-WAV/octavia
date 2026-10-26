# Credits

## Orchestral samples — VS Chamber Orchestra: Community Edition (VSCO 2 CE)

- Versilian Studios. Recorded by Sam Gossner & Simon Dalzell; sample cutting by Elan Hickler / Soundemote.
- License: **CC0 1.0 Universal** (public domain dedication).
- Source: https://github.com/sgossner/VSCO-2-CE at commit `440300901dfe9275fd84e0b7763af1f8443ae62e`.
- Folders used: `Woodwinds/Clarinet/susLong`, `Woodwinds/Clarinet/stac`, `Strings/Harp`,
  `Strings/Cello Section/susvib`, `Strings/Violin Section/susVib`.
- Processing (`scripts/prepare-samples.mjs`): one velocity layer per pitch, mixed to mono,
  44.1 kHz, leading silence trimmed (−50 dB), length capped with a 150 ms fade-out, encoded as FLAC.

## Sound effects

- Footsteps, jump swish and landing thud are synthesized in code (`src/game/audio/foley.ts`); no third-party audio.

## Software

- [Phaser](https://phaser.io) — MIT License.
- [Audiorective](https://github.com/audiorective/audiorective) (`@audiorective/core`, `@audiorective/clock`) — MIT License.
