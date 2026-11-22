import path from "node:path";
import { fileURLToPath } from "node:url";

// Where the screenshot tool writes its pictures. A module of its own, so that the end-to-end test can read it without importing
// `screenshots.ts`, which starts the tool (and ends the process) when it is not run under Vitest.
export const WEB_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT_DIR = path.join(WEB_ROOT, "screenshots");
