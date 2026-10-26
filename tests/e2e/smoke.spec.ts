import { test, expect, type Page } from "@playwright/test";

type W = { __octavia?: { state(): { scene: string; player: { x: number; y: number; grounded: boolean } | null } } };
const state = (page: Page) => page.evaluate(() => (window as unknown as W).__octavia!.state());

test("loads, starts, runs and jumps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as W).__octavia?.state().scene === "Start");
  await page.mouse.click(480, 270);
  await page.waitForFunction(() => (window as unknown as W).__octavia?.state().scene === "TestArea");
  await page.waitForFunction(() => (window as unknown as W).__octavia!.state().player!.grounded);

  const x0 = (await state(page)).player!.x;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowRight");
  expect((await state(page)).player!.x).toBeGreaterThan(x0 + 40);

  await page.keyboard.down("Space");
  await page.waitForFunction(() => !(window as unknown as W).__octavia!.state().player!.grounded);
  await page.keyboard.up("Space");
  await page.waitForFunction(() => (window as unknown as W).__octavia!.state().player!.grounded);
  expect(errors).toEqual([]);
});
