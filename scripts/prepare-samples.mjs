// Fetch VSCO 2 Community Edition (CC0) samples at a pinned commit, trim and convert them to
// mono FLAC, verify each file's octave by pitch detection, and write the sample manifest.
// Usage: node scripts/prepare-samples.mjs   (needs git and ffmpeg)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { noteToMidi, parseNoteName, pickPreferred } from "./sampleNames.mjs";

const REPO = "https://github.com/sgossner/VSCO-2-CE";
const COMMIT = "440300901dfe9275fd84e0b7763af1f8443ae62e";
const CACHE = ".vsco-cache";
const OUT = "public/assets/audio/samples";

const INSTRUMENTS = {
  clarinetSus: { dir: "Woodwinds/Clarinet/susLong", prefer: ["_v2_", "_v1_"], cap: 4.0 },
  clarinetStac: { dir: "Woodwinds/Clarinet/stac", prefer: ["_v2_rr1", "_v1_rr1"], cap: 1.0 },
  harp: { dir: "Strings/Harp", prefer: ["_mf"], cap: 3.5 },
  celloSection: { dir: "Strings/Cello Section/susvib", prefer: ["_v1_1", "_v1"], cap: 5.0 },
  violinSection: { dir: "Strings/Violin Section/susVib", prefer: ["_v1"], cap: 5.0 },
};

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28, ...opts });

function fetchRepo() {
  if (!existsSync(join(CACHE, ".git"))) {
    sh("git", ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO, CACHE]);
  }
  sh("git", ["-C", CACHE, "fetch", "--depth", "1", "origin", COMMIT]);
  sh("git", ["-C", CACHE, "sparse-checkout", "set", "--no-cone", ...Object.values(INSTRUMENTS).map((i) => `/${i.dir}/`), "/LICENSE"]);
  sh("git", ["-C", CACHE, "checkout", "--force", COMMIT]);
}

/** YIN fundamental-frequency estimate of mono f32 samples. */
function detectF0(samples, sr) {
  const minLag = Math.floor(sr / 2000);
  const maxLag = Math.floor(sr / 50);
  const n = samples.length - maxLag;
  const d = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x = samples[i] - samples[i + lag];
      s += x * x;
    }
    d[lag] = s;
  }
  let running = 0;
  const cmnd = new Float64Array(maxLag + 1);
  cmnd[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag];
    cmnd[lag] = running === 0 ? 1 : (d[lag] * lag) / running;
  }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmnd[lag] < 0.15) {
      while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) {
    best = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) if (cmnd[lag] < cmnd[best]) best = lag;
  }
  return sr / best;
}

function f0OfFile(path) {
  const raw = sh("ffmpeg", ["-v", "error", "-ss", "0.3", "-t", "0.2", "-i", path, "-ac", "1", "-ar", "44100", "-f", "f32le", "-"]);
  const samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  return detectF0(samples, 44100);
}

const centsOff = (f, midi) => 1200 * Math.log2(f / (440 * 2 ** ((midi - 69) / 12)));

const durationOf = (path) =>
  Number(sh("ffprobe", ["-v", "error", "-show_entries", "stream=duration", "-of", "csv=p=0", path]).toString().trim()) || 0;

function convert(src, dest, cap) {
  // Quiet samples can fall entirely under the trim threshold; retry gentler, then untrimmed.
  for (const threshold of ["-50dB", "-65dB", null]) {
    const trim = threshold ? `silenceremove=start_periods=1:start_threshold=${threshold},` : "";
    sh("ffmpeg", [
      "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "44100",
      "-af", `${trim}atrim=0:${cap},afade=t=out:st=${(cap - 0.15).toFixed(2)}:d=0.15`,
      "-c:a", "flac", dest,
    ]);
    if (durationOf(dest) >= 0.3) return;
  }
  throw new Error(`${src}: converted sample is shorter than 0.3 s`);
}

function main() {
  fetchRepo();
  rmSync(OUT, { recursive: true, force: true });
  const manifest = { instruments: {} };
  let total = 0;

  for (const [id, cfg] of Object.entries(INSTRUMENTS)) {
    const dir = join(CACHE, cfg.dir);
    const files = pickPreferred(readdirSync(dir).filter((f) => f.endsWith(".wav")).map((f) => join(dir, f)), cfg.prefer);

    // Decide this library's octave numbering from the first three files.
    const offset = [0, 1, -1].find((off) =>
      files.slice(0, 3).every((f) => {
        const n = parseNoteName(f.split("/").pop());
        return Math.abs(centsOff(f0OfFile(f), noteToMidi(n.name, n.octave, off))) < 50;
      }),
    );
    if (offset === undefined) throw new Error(`${id}: could not match sample pitches to note names`);

    mkdirSync(join(OUT, id), { recursive: true });
    const zones = [];
    for (const f of files) {
      const n = parseNoteName(f.split("/").pop());
      const midi = noteToMidi(n.name, n.octave, offset);
      const dest = join(OUT, id, `${midi}.flac`);
      convert(f, dest, cfg.cap);
      total += statSync(dest).size;
      zones.push({ midi, url: `assets/audio/samples/${id}/${midi}.flac` });
    }
    zones.sort((a, b) => a.midi - b.midi);
    manifest.instruments[id] = zones;
    console.log(`${id}: ${zones.length} zones, MIDI ${zones[0].midi}–${zones.at(-1).midi}, octave offset ${offset}`);
  }

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`total ${(total / 1024 / 1024).toFixed(1)} MB`);
}

main();
