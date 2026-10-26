// Bundle the game into one HTML page (for sharing a playable build), plus the samples next to it.
// Usage: npm run build && node scripts/build-artifact.mjs <out-dir>
// Writes <out-dir>/octavia.html and <out-dir>/assets/audio/samples/** as .wav (the artifact host does not serve .flac).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: node scripts/build-artifact.mjs <out-dir>");
const out = join(outDir, "octavia.html");

const manifest = JSON.parse(readFileSync("public/assets/audio/samples/manifest.json", "utf8"));
const published = ["assets/audio/samples/manifest.json"];
for (const zones of Object.values(manifest.instruments)) {
  for (const z of zones) {
    const wav = z.url.replace(/\.flac$/, ".wav");
    mkdirSync(dirname(join(outDir, wav)), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join("public", z.url), "-c:a", "pcm_s16le", join(outDir, wav)]);
    z.url = wav;
    published.push(wav);
  }
}
mkdirSync(join(outDir, "assets/audio/samples"), { recursive: true });
writeFileSync(join(outDir, "assets/audio/samples/manifest.json"), JSON.stringify(manifest));
writeFileSync(join(outDir, "files.json"), JSON.stringify(published.map((path) => ({ path }))));
const jsFile = readdirSync("dist/assets").find((f) => f.endsWith(".js"));
if (!jsFile) throw new Error("run `npm run build` first");
const js = readFileSync(`dist/assets/${jsFile}`, "utf8").replaceAll("</script", "<\\/script");

const html = `<title>Octavia</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Single dark look on purpose: a dusk game screen. */
  :root { --bg: #0b0d12; --fg: #f3e3c8; --muted: #9a8fae; --key: #232d55; color-scheme: dark; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--fg); font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; overflow: hidden;
    touch-action: none; -webkit-user-select: none; user-select: none;
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box; }
  #game { flex: none; }
  #game canvas { display: block; image-rendering: pixelated; }
  .keys { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; font-size: 12px; color: var(--muted); }
  kbd { background: var(--key); color: var(--fg); border-radius: 3px; padding: 1px 5px; font: inherit; }
  @media (pointer: coarse) { .keys { display: none; } }
</style>
<div id="game"></div>
<div class="keys">
  <span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> run</span>
  <span><kbd>Space</kbd> / <kbd>W</kbd> jump (tap to hop, hold to go higher)</span>
  <span><kbd>↓</kbd> + <kbd>Space</kbd> drop through a plank</span>
  <span>Music: backing loop only for now · keyboard or gamepad</span>
</div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB) and ${published.length} sample files`);
