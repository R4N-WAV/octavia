// Bundle the game into one self-contained HTML page (for sharing a playable build).
// Usage: npm run build && node scripts/build-artifact.mjs <out.html>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/build-artifact.mjs <out.html>");
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
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box; }
  #game canvas { display: block; image-rendering: pixelated; max-width: 100%; }
  .keys { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; font-size: 12px; color: var(--muted); }
  kbd { background: var(--key); color: var(--fg); border-radius: 3px; padding: 1px 5px; font: inherit; }
</style>
<div id="game"></div>
<div class="keys">
  <span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> run</span>
  <span><kbd>Space</kbd> / <kbd>W</kbd> jump (tap to hop, hold to go higher)</span>
  <span><kbd>↓</kbd> + <kbd>Space</kbd> drop through a plank</span>
  <span>Silent test build · keyboard or gamepad</span>
</div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
