// Renders the frames of the film: node docs/design/intro/tools/render_frames.mjs <out-dir>
// Every CSS animation of film.html is paused and set to the time of the frame, so the same frames come out every time.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FPS = 12;
/** The film ends on the full flash: the part of the flight animation (7.94 s after its 1.3 s start) where the flash is complete. */
const END_SECONDS = 1.3 + 7.94 * 0.9664;
/**
 * The film starts where the light ring of the hyperspace's end begins (78 % of its 1.5 s); what comes before it, the title screen
 * pulled away and the tunnel, the app draws live from the title screen itself.
 */
const FIRST_FRAME = Number(process.env.FIRST_FRAME ?? Math.round(1.5 * 0.78 * FPS));
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? "frames");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 640, height: 296 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, "..", "film.html")).href);
await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
const lastFrame = Math.ceil(END_SECONDS * FPS);
for (let index = FIRST_FRAME; index <= lastFrame; index++) {
  const ms = Math.min(index / FPS, END_SECONDS) * 1000;
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);
  await page.screenshot({ path: join(out, `f${String(index - FIRST_FRAME).padStart(3, "0")}.png`) });
}
await browser.close();
console.log(`${lastFrame - FIRST_FRAME + 1} frames at ${FPS} fps in ${out}`);
