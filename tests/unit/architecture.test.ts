import { it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

it("src/music imports nothing from phaser", () => {
  for (const f of files("src/music")) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["']phaser["']/);
});
