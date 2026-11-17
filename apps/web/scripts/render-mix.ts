// Mix check for agents and reviewers: `npm run render-mix -w apps/web [-- --out <dir>]`.
// Plays a scripted match through the real sound engine (`src/audio.ts`) in Chromium, but into an OfflineAudioContext, so
// the result is a file and not sound. It renders three times (the music alone, the voices and effects alone, everything) and
// measures how loud the music is against the rest in each phase and in four frequency bands. That is how an agent "listens":
// whether it sounds good is for a person to decide, but "the music drowns the effects" is a number.
import { chromium } from "@playwright/test";
import { HeroClass } from "game-core";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 32_000;
const SECONDS = 62;

/** The phases of the script, in seconds, and the music level the game wants in each. */
const PHASES = [
  { name: "planning", from: 1, to: 12, level: 0 },
  { name: "countdown", from: 12, to: 22, level: 1 },
  { name: "resolution", from: 22, to: 40, level: 2 },
  { name: "contested", from: 40, to: 60, level: 3 },
] as const;

type Step = { at: number } & ({ op: "level"; level: number } | { op: "ui"; name: string } | { op: "play"; hero: HeroClass; kind: "voice" | "sfx"; asset: string; priority: number });

function script(): Step[] {
  const steps: Step[] = PHASES.map((phase) => ({ at: phase.from === 1 ? 0 : phase.from, op: "level" as const, level: phase.level }));
  const play = (at: number, hero: HeroClass, kind: "voice" | "sfx", asset: string, priority: number) => steps.push({ at, op: "play", hero, kind, asset, priority });
  for (const at of [4, 8]) steps.push({ at, op: "ui", name: "cardPlayed" });
  steps.push({ at: 10, op: "ui", name: "cardDraw" });
  for (let at = 13; at < 22; at++) steps.push({ at, op: "ui", name: "countdownTick" });
  // Two rounds of the Resolution and then the contested Prime Zone: shots, hits, steps, voices of three Heroes.
  for (const start of [23, 31, 41, 47, 53]) {
    play(start, HeroClass.Assassin, "voice", "voice.attack-1", 4);
    play(start + 0.4, HeroClass.Assassin, "sfx", "sfx.lightning", 5);
    play(start + 0.9, HeroClass.Bruiser, "sfx", "sfx.steel-tear-1", 5);
    play(start + 0.9, HeroClass.Bruiser, "voice", "voice.hit-heavy-1", 5);
    play(start + 1.6, HeroClass.Controller, "sfx", "sfx.bomb-swoosh", 5);
    play(start + 2.6, HeroClass.Controller, "sfx", "sfx.bomb-blast", 5);
    play(start + 2.6, HeroClass.Controller, "voice", "voice.attack-1", 4);
    for (let i = 0; i < 6; i++) {
      play(start + 3 + i * 0.5, HeroClass.Bruiser, "sfx", `sfx.step-${(i % 3) + 1}`, 3);
      play(start + 3.2 + i * 0.5, HeroClass.Controller, "sfx", `sfx.step-${(i % 3) + 1}`, 3);
    }
    play(start + 4, HeroClass.Bruiser, "sfx", "sfx.slam", 5);
    play(start + 4.2, HeroClass.Assassin, "sfx", "sfx.impact-body", 5);
    play(start + 4.3, HeroClass.Assassin, "voice", "voice.hit-light-2", 5);
    play(start + 5.5, HeroClass.Bruiser, "voice", "voice.cover-1", 3);
    play(start + 5.5, HeroClass.Bruiser, "sfx", "sfx.cover-thump", 2);
  }
  return steps.sort((a, b) => a.at - b.at);
}

/** `ducked`: the music with the ducking of the voices and effects, whose own sound is muted. */
type Pass = "music" | "fx" | "full" | "ducked";

/** Runs in the page: plays the script into an OfflineAudioContext and returns the mixdown. */
async function renderInPage(args: { pass: Pass; steps: Step[]; sampleRate: number; seconds: number; classes: HeroClass[] }): Promise<number[]> {
  const { GameAudio } = window as unknown as { GameAudio: typeof import("../src/audio").GameAudio };
  const context = new OfflineAudioContext(2, args.sampleRate * args.seconds, args.sampleRate);
  const audio = new GameAudio(() => context as unknown as AudioContext);
  const withMusic = args.pass !== "fx";
  const withFx = args.pass !== "music";
  const muteFx = args.pass === "ducked";
  await audio.load(args.classes);
  await audio.loadMap();
  if (withMusic) await audio.loadMusic();
  if (muteFx) {
    const buses = audio as unknown as { voiceBus: GainNode; sfxBus: GainNode };
    buses.voiceBus.gain.value = 0;
    buses.sfxBus.gain.value = 0;
  }
  if (withMusic) audio.startMusic();
  if (withFx) audio.startAmbience();
  const byTime = new Map<number, Step[]>();
  for (const step of args.steps) byTime.set(step.at, [...(byTime.get(step.at) ?? []), step]);
  const run = (steps: Step[]) => {
    for (const step of steps) {
      if (step.op === "level" && withMusic) audio.setMusicLevel(step.level as 0 | 1 | 2 | 3);
      else if (step.op === "ui" && withFx) audio.playUi(step.name as never);
      else if (step.op === "play" && withFx) audio.play([{ kind: step.kind, heroClass: step.hero, heroId: String(step.hero), assetId: step.asset, startMs: 0, priority: step.priority }]);
    }
  };
  run(byTime.get(0) ?? []);
  for (const [at, steps] of byTime) {
    if (at === 0) continue;
    context.suspend(at).then(() => {
      run(steps);
      void context.resume();
    });
  }
  const buffer = await context.startRendering();
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  return Array.from(left, (value, i) => (value + (right[i] ?? 0)) / 2);
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = (re[b] as number) * wr - (im[b] as number) * wi;
        const ti = (re[b] as number) * wi + (im[b] as number) * wr;
        re[b] = (re[a] as number) - tr;
        im[b] = (im[a] as number) - ti;
        re[a] = (re[a] as number) + tr;
        im[a] = (im[a] as number) + ti;
      }
    }
  }
}

const BANDS = [
  { name: "<200Hz", from: 0, to: 200 },
  { name: "200-1k", from: 200, to: 1000 },
  { name: "1k-4k", from: 1000, to: 4000 },
  { name: ">4k", from: 4000, to: SAMPLE_RATE / 2 },
] as const;

/** Power of `samples[from..to)` seconds per band (mean square, windows of 2048 samples) and in all. */
function bandPower(samples: number[], fromS: number, toS: number): number[] {
  const size = 2048;
  const total = BANDS.map(() => 0);
  let windows = 0;
  for (let start = Math.floor(fromS * SAMPLE_RATE); start + size <= toS * SAMPLE_RATE; start += size) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = (samples[start + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    fft(re, im);
    BANDS.forEach((band, b) => {
      for (let k = Math.max(1, Math.floor((band.from / SAMPLE_RATE) * size)); k < Math.min(size / 2, (band.to / SAMPLE_RATE) * size); k++) {
        total[b] = (total[b] as number) + ((re[k] as number) ** 2 + (im[k] as number) ** 2) / size ** 2;
      }
    });
    windows++;
  }
  return total.map((power) => power / Math.max(1, windows));
}

const db = (power: number) => 10 * Math.log10(Math.max(power, 1e-14));

function writeWav(file: string, samples: number[]): void {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SAMPLE_RATE, 24);
  data.writeUInt32LE(SAMPLE_RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  writeFileSync(file, data);
}

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const server = await createServer({ root, logLevel: "error", server: { port: 5197, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    await page.goto("http://localhost:5197/?music=on");
    // The engine is loaded by the page itself (a dynamic import in this script would be rewritten by vite-node).
    await page.addScriptTag({ type: "module", content: 'import { GameAudio } from "/src/audio.ts"; window.GameAudio = GameAudio;' });
    await page.waitForFunction(() => "GameAudio" in window);
    const steps = script();
    const classes = [HeroClass.Bruiser, HeroClass.Controller, HeroClass.Assassin];
    const rendered = {} as Record<Pass, number[]>;
    for (const pass of ["music", "fx", "full", "ducked"] as const) {
      rendered[pass] = await page.evaluate(renderInPage, { pass, steps, sampleRate: SAMPLE_RATE, seconds: SECONDS, classes });
      if (outDir) {
        mkdirSync(outDir, { recursive: true });
        writeWav(path.join(outDir, `mix-${pass}.wav`), rendered[pass]);
      }
    }
    console.log("Loudness of the music against the voices and effects (dB of mean power, the music without ducking; negative: the music is quieter)");
    console.log("phase        music   fx     music-fx | per band (music-fx):", BANDS.map((band) => band.name).join("  "));
    let previous: number | undefined;
    for (const phase of PHASES) {
      const music = bandPower(rendered.music, phase.from + 2, phase.to);
      const fx = bandPower(rendered.fx, phase.from + 2, phase.to);
      const musicDb = db(music.reduce((a, b) => a + b, 0));
      const duckedDb = db(bandPower(rendered.ducked, phase.from + 2, phase.to).reduce((a, b) => a + b, 0));
      const fxDb = db(fx.reduce((a, b) => a + b, 0));
      const step = previous === undefined ? "" : `  step ${(musicDb - previous >= 0 ? "+" : "") + (musicDb - previous).toFixed(1)} dB`;
      previous = musicDb;
      console.log(
        `${phase.name.padEnd(11)} ${musicDb.toFixed(1).padStart(6)} ${fxDb.toFixed(1).padStart(6)} ${(musicDb - fxDb).toFixed(1).padStart(8)}  | ${BANDS.map((_, b) => (db(music[b] as number) - db(fx[b] as number)).toFixed(1).padStart(6)).join(" ")}${step}  ducking ${(duckedDb - musicDb).toFixed(1)} dB`,
      );
    }
    let peak = 0;
    for (const sample of rendered.full) peak = Math.max(peak, Math.abs(sample));
    console.log(`peak of the full mix: ${db(peak ** 2).toFixed(1)} dBFS`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
