// The visual style: how the game is drawn, not how it plays. Saved in localStorage (missing or broken storage is
// swallowed, like the saved match) and overridable for one page by the start parameter `?style=pixel|original`.

export const VisualStyle = {
  Pixel: "pixel",
  Original: "original",
} as const;
export type VisualStyle = (typeof VisualStyle)[keyof typeof VisualStyle];

export const DEFAULT_VISUAL_STYLE: VisualStyle = VisualStyle.Pixel;
export const VISUAL_STYLE_STORAGE_KEY = "primefall.visualStyle";

/** The two choices of the Options screen, in display order. */
export const VISUAL_STYLE_CHOICES: readonly { style: VisualStyle; label: string; text: string }[] = [
  { style: VisualStyle.Pixel, label: "Pixel art", text: "Heroes and board drawn as pixel art." },
  { style: VisualStyle.Original, label: "Original", text: "The smooth stylized look the game started with." },
];

type StyleStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StyleStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** A style value from storage or a start parameter; undefined for anything unknown. */
export function parseVisualStyle(value: string | null | undefined): VisualStyle | undefined {
  return Object.values(VisualStyle).find((style) => style === value);
}

/** The saved style; the default if nothing is saved, the value is unknown or storage is broken. */
export function loadVisualStyle(storage: StyleStorage | undefined = defaultStorage()): VisualStyle {
  try {
    return parseVisualStyle(storage?.getItem(VISUAL_STYLE_STORAGE_KEY)) ?? DEFAULT_VISUAL_STYLE;
  } catch {
    return DEFAULT_VISUAL_STYLE;
  }
}

export function saveVisualStyle(style: VisualStyle, storage: StyleStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(VISUAL_STYLE_STORAGE_KEY, style);
  } catch {
    // Ignored: the choice just does not survive a reload.
  }
}

/** The style for this page: the start parameter wins over the saved choice. */
export function currentVisualStyle(search: string = globalThis.location?.search ?? "", storage?: StyleStorage): VisualStyle {
  return parseVisualStyle(new URLSearchParams(search).get("style")) ?? loadVisualStyle(storage ?? defaultStorage());
}

/**
 * The seam the board and the Hero Select ask for the look to draw. The Pixel-art renderers do not exist yet, so
 * Pixel art still resolves to the Original look; the next tickets add a second way to draw, not a second way to play.
 */
export function renderedStyle(style: VisualStyle = currentVisualStyle()): VisualStyle {
  return style === VisualStyle.Pixel ? VisualStyle.Original : style;
}
