import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const indexHtml = readFileSync(resolve(webRoot, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(webRoot, "public/manifest.webmanifest"), "utf8"));
const styles = readFileSync(resolve(webRoot, "src/styles.css"), "utf8");

describe("installable app shell", () => {
  it("has a landscape fullscreen manifest with the design-token colours", () => {
    expect(manifest.name).toBe("Primefall");
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.display_override).toEqual(["fullscreen", "standalone"]);
    expect(manifest.orientation).toBe("landscape");
    expect(manifest.theme_color).toBe("#12161c");
    expect(manifest.background_color).toBe("#12161c");
  });

  it("lists icons of 192 and 512 px that exist", () => {
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons as { src: string }[]) {
      expect(existsSync(resolve(webRoot, "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("links the manifest, the touch icon and carries the Apple meta tags", () => {
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(existsSync(resolve(webRoot, "public/icons/apple-touch-icon.png"))).toBe(true);
    expect(indexHtml).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="Primefall"');
    expect(indexHtml).toContain('name="theme-color" content="#12161c"');
  });

  it("uses the dynamic viewport height and blocks overscroll", () => {
    expect(styles).toMatch(/\.app \{[^}]*height: 100dvh/);
    expect(styles).toMatch(/overscroll-behavior: none/);
  });
});
