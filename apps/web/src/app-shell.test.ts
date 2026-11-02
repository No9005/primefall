import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(webRoot, file), "utf8");

describe("installable app shell", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
    name: string;
    display: string;
    display_override: string[];
    orientation: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string }[];
  };

  it("declares a fullscreen landscape Primefall app with the design-token colours", () => {
    expect(manifest.name).toBe("Primefall");
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.display_override).toEqual(["fullscreen", "standalone"]);
    expect(manifest.orientation).toBe("landscape");
    expect(manifest.theme_color).toBe("#12161c");
    expect(manifest.background_color).toBe("#12161c");
  });

  it("lists 192 and 512 px icons that exist", () => {
    expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
    for (const icon of manifest.icons) expect(existsSync(path.join(webRoot, "public", icon.src))).toBe(true);
  });

  it("is linked from index.html together with the Apple meta tags and the touch icon", () => {
    const html = read("index.html");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color" content="#12161c"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    const touchIcon = /rel="apple-touch-icon" href="\/([^"]+)"/.exec(html)?.[1];
    expect(touchIcon && existsSync(path.join(webRoot, "public", touchIcon))).toBe(true);
  });

  it("keeps HUD edge offsets inside the safe area and the page from scrolling", () => {
    const css = read("src/styles.css");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("overscroll-behavior: none");
    expect(css).toContain("100dvh");
    expect(css).not.toMatch(/\b(top|left|right|bottom): 6px/);
  });
});
