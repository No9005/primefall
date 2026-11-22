// The Notstrom Intro of the tap on Classic (docs/design/notstrom-intro): the title screen is pulled away, the ship leaves the hyperspace, the Notstrom
// comes closer, an astronaut's visor mirrors it, the camera rides along the hull to the airlock, and a flash fills the picture.
// It is drawn in pixels at 640 x 296 and shown at 12 pictures a second, packed in two sprite sheets (see the README there).
// What comes before the sheets, the title screen pulled away and the tunnel of streaks, runs live on the title screen itself.

/** How long the live part runs: until the light ring at the end of the hyperspace begins, where the first picture of the sheets is. */
export const WHIP_MS = 1170;

export const NOTSTROM_INTRO = {
  fps: 12,
  frames: 95,
  width: 640,
  height: 296,
  columns: 6,
  sheets: [
    { file: "notstrom-1.png", frames: 60 },
    { file: "notstrom-2.png", frames: 35 },
  ],
  /** The colour of the last picture, which the flash fades out from into the next screen. */
  flashColor: "#ffd9a0",
} as const;

/**
 * The sound of the Notstrom Intro is 8.9 s long from the tap on Start and fades out in its last 0.4 s. The Hero Select loop starts 8.7 s after
 * the tap, 0.2 s before the sound is out, and fades in over a second, so the two overlap softly. The audio clock times it (`startNotstromIntroCue`
 * in `audio.ts`), not the pictures: they start after the live part and the decoding, which takes a different time on every device.
 * Docs: `audio-source/music/notstrom-intro-cue/`.
 */
export const NOTSTROM_INTRO_SOUND = { loopStartsAtSeconds: 8.7, loopFadeInSeconds: 1 } as const;

export const NOTSTROM_INTRO_DURATION_MS = (NOTSTROM_INTRO.frames / NOTSTROM_INTRO.fps) * 1000;

/** The picture to show `elapsedMs` after the Notstrom Intro started; the last one stays. */
export function frameAt(elapsedMs: number): number {
  const index = Math.floor((Math.max(0, elapsedMs) / 1000) * NOTSTROM_INTRO.fps);
  return Math.min(index, NOTSTROM_INTRO.frames - 1);
}

/** Where a picture lies: its sheet, and its column and row in the sheet. */
export function locateFrame(index: number): { sheet: number; column: number; row: number } {
  let first = 0;
  for (const [sheet, { frames }] of NOTSTROM_INTRO.sheets.entries()) {
    if (index < first + frames) {
      const inSheet = index - first;
      return { sheet, column: inSheet % NOTSTROM_INTRO.columns, row: Math.floor(inSheet / NOTSTROM_INTRO.columns) };
    }
    first += frames;
  }
  throw new RangeError(`The Notstrom Intro has no picture ${index}`);
}

/**
 * Whether Classic plays the Notstrom Intro before the Hero Select. A player who asked their device for less motion does not get it, nor
 * does a browser that an automated test drives (so that the tests do not wait for it); `?notstrom-intro=on` plays it anyway.
 */
export function shouldPlayNotstromIntro(options: { reducedMotion: boolean; automated: boolean; forced: boolean }): boolean {
  if (options.forced) return true;
  return !options.reducedMotion && !options.automated;
}

/** `shouldPlayNotstromIntro` for this browser and these start parameters. */
export const notstromIntroPlays = (parameters: URLSearchParams): boolean =>
  shouldPlayNotstromIntro({ reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, automated: navigator.webdriver, forced: parameters.get("notstrom-intro") === "on" });

export const notstromIntroSheetUrl = (sheet: number): string => `${import.meta.env.BASE_URL}assets/notstrom-intro/${NOTSTROM_INTRO.sheets[sheet]!.file}`;
