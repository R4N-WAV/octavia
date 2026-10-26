// Pure helpers for scripts/prepare-samples.mjs (unit-tested).

const NOTE_RE = /(?:^|_)([A-G]#?)(-?\d)(?=[_.])/;
const SEMITONE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

/** @param {string} fileName @returns {{ name: string, octave: number } | null} */
export function parseNoteName(fileName) {
  const m = NOTE_RE.exec(fileName);
  return m ? { name: m[1], octave: Number(m[2]) } : null;
}

/** C4 = 60 when octaveOffset is 0. @param {string} name @param {number} octave @param {number} octaveOffset */
export function noteToMidi(name, octave, octaveOffset) {
  const s = SEMITONE[name];
  if (s === undefined) throw new Error(`unknown note ${name}`);
  return (octave + octaveOffset + 1) * 12 + s;
}

/**
 * One file per pitch. Within a pitch, the first token in `prefer` found in the file name wins;
 * otherwise the alphabetically first file.
 * @param {string[]} files @param {string[]} prefer @returns {string[]}
 */
export function pickPreferred(files, prefer) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const f of files) {
    const n = parseNoteName(f.split("/").pop() ?? f);
    if (!n) continue;
    const key = `${n.name}${n.octave}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const out = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort();
    const hit = prefer.map((p) => sorted.find((f) => f.includes(p))).find(Boolean);
    out.push(hit ?? sorted[0]);
  }
  return out.sort();
}
