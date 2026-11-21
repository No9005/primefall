// The film of the tap on Classic (docs/design/intro): the title screen is pulled away, the ship leaves the hyperspace, the Notstrom
// comes closer, an astronaut's visor mirrors it, the camera rides along the hull to the airlock, and a flash fills the picture.
// It is drawn in pixels at 640 x 296 and shown at 12 pictures a second, packed in two sprite sheets (see the README there).
// What comes before the sheets, the title screen pulled away and the tunnel of streaks, runs live on the title screen itself.

/** How long the live part runs: until the light ring at the end of the hyperspace begins, where the first picture of the sheets is. */
export const WHIP_MS = 1170;

export const FILM = {
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

export const FILM_DURATION_MS = (FILM.frames / FILM.fps) * 1000;

/** The picture to show `elapsedMs` after the film started; the last one stays. */
export function frameAt(elapsedMs: number): number {
  const index = Math.floor((Math.max(0, elapsedMs) / 1000) * FILM.fps);
  return Math.min(index, FILM.frames - 1);
}

/** Where a picture lies: its sheet, and its column and row in the sheet. */
export function locateFrame(index: number): { sheet: number; column: number; row: number } {
  let first = 0;
  for (const [sheet, { frames }] of FILM.sheets.entries()) {
    if (index < first + frames) {
      const inSheet = index - first;
      return { sheet, column: inSheet % FILM.columns, row: Math.floor(inSheet / FILM.columns) };
    }
    first += frames;
  }
  throw new RangeError(`The film has no picture ${index}`);
}

/**
 * Whether Classic plays the film before the Hero Select. A player who asked their device for less motion does not get it, nor
 * does a browser that an automated test drives (so that the tests do not wait for it); `?intro=on` plays it anyway.
 */
export function shouldPlayIntro(options: { reducedMotion: boolean; automated: boolean; forced: boolean }): boolean {
  if (options.forced) return true;
  return !options.reducedMotion && !options.automated;
}

/** `shouldPlayIntro` for this browser and these start parameters. */
export const introPlays = (parameters: URLSearchParams): boolean =>
  shouldPlayIntro({ reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, automated: navigator.webdriver, forced: parameters.get("intro") === "on" });

export const filmSheetUrl = (sheet: number): string => `${import.meta.env.BASE_URL}assets/intro/${FILM.sheets[sheet]!.file}`;
