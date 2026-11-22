// Makes the video of the Notstrom Intro from its two sprite sheets, and checks it.
//
//   node docs/design/notstrom-intro/tools/encode_video.mjs            cut the 95 pictures, scale them by 2 (nearest neighbour), encode WebM + MP4
//   node docs/design/notstrom-intro/tools/encode_video.mjs --check    decode both videos and compare every picture with the sheets
//
// Needs `ffmpeg` and `ffprobe` (with libvpx-vp9 and libx264) on the PATH; they are tools, not npm dependencies. The layout below repeats
// NOTSTROM_INTRO in apps/web/src/notstrom-intro.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ASSETS = path.resolve("apps/web/public/assets/notstrom-intro");
const SHEETS = [
  { file: "notstrom-1.png", frames: 60 },
  { file: "notstrom-2.png", frames: 35 },
];
const WIDTH = 640;
const HEIGHT = 296;
const COLUMNS = 6;
const FPS = 12;
const SCALE = 2;
const FRAMES = SHEETS.reduce((sum, sheet) => sum + sheet.frames, 0);
/** Mean absolute difference per colour channel (0 to 255) a decoded picture, scaled down again, may have from the sheet's picture. */
const TOLERANCE = 6;

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: options.raw ? "buffer" : "utf8", maxBuffer: 1 << 30 });
  if (result.error) throw new Error(`${command} could not run (is it installed?): ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout;
};

/** Where picture `index` lies in the sheets: the sheet's file and its pixel position, row by row. */
function locate(index) {
  let first = 0;
  for (const { file, frames } of SHEETS) {
    if (index < first + frames) {
      const inSheet = index - first;
      return { file, x: (inSheet % COLUMNS) * WIDTH, y: Math.floor(inSheet / COLUMNS) * HEIGHT };
    }
    first += frames;
  }
  throw new RangeError(`no picture ${index}`);
}

const cutArgs = (index, filter, output) => {
  const { file, x, y } = locate(index);
  return ["-v", "error", "-y", "-i", path.join(ASSETS, file), "-vf", `crop=${WIDTH}:${HEIGHT}:${x}:${y}${filter}`, "-frames:v", "1", ...output];
};

function encode() {
  const frames = mkdtempSync(path.join(tmpdir(), "notstrom-frames-"));
  try {
    for (let index = 0; index < FRAMES; index++) {
      const name = path.join(frames, `${String(index + 1).padStart(3, "0")}.png`);
      // The sheets are palette pictures: scale only after the change to RGB, or the doubling is off by half a picture point and blurs it.
      run("ffmpeg", cutArgs(index, `,format=rgb24,scale=iw*${SCALE}:ih*${SCALE}:flags=neighbor`, [name]));
    }
    // Colours: the pictures are sRGB; the video says BT.709 limited range, which every browser reads the same way.
    const common = ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "%03d.png"), "-an", "-r", String(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
    const convert = "scale=out_color_matrix=bt709:out_range=tv:flags=neighbor,format=yuv420p";
    mkdirSync(ASSETS, { recursive: true });
    run("ffmpeg", [...common, "-vf", convert, "-c:v", "libvpx-vp9", "-crf", "10", "-b:v", "0", "-deadline", "best", "-cpu-used", "0", "-row-mt", "0", "-g", "12", path.join(ASSETS, "notstrom-intro.webm")]);
    run("ffmpeg", [...common, "-vf", convert, "-c:v", "libx264", "-preset", "veryslow", "-crf", "8", "-profile:v", "high", "-g", "12", "-movflags", "+faststart", path.join(ASSETS, "notstrom-intro.mp4")]);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

/** The raw RGB pictures of a video, scaled down by the whole number again (an average of each block, which also evens out codec noise). */
const decode = (file) =>
  run("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${WIDTH}:${HEIGHT}:flags=area`, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { raw: true });

function check() {
  const size = WIDTH * HEIGHT * 3;
  const failures = [];
  for (const name of ["notstrom-intro.webm", "notstrom-intro.mp4"]) {
    const file = path.join(ASSETS, name);
    const probe = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames", "-of", "json", file]));
    const stream = probe.streams[0];
    if (stream.width !== WIDTH * SCALE || stream.height !== HEIGHT * SCALE) failures.push(`${name}: size ${stream.width} x ${stream.height}`);
    if (stream.r_frame_rate !== `${FPS}/1`) failures.push(`${name}: ${stream.r_frame_rate} frames a second`);
    if (Number(stream.nb_read_frames) !== FRAMES) failures.push(`${name}: ${stream.nb_read_frames} pictures`);
    const decoded = decode(file);
    let worst = 0;
    for (let index = 0; index < FRAMES; index++) {
      const original = run("ffmpeg", cutArgs(index, "", ["-pix_fmt", "rgb24", "-f", "rawvideo", "-"]), { raw: true });
      let sum = 0;
      for (let at = 0; at < size; at++) sum += Math.abs(original[at] - decoded[index * size + at]);
      const mean = sum / size;
      worst = Math.max(worst, mean);
      if (mean > TOLERANCE) failures.push(`${name}: picture ${index} differs by ${mean.toFixed(2)} (tolerance ${TOLERANCE})`);
    }
    console.log(`${name}: ${stream.nb_read_frames} pictures, ${stream.width} x ${stream.height}, worst mean difference ${worst.toFixed(2)} of 255`);
  }
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}

if (process.argv.includes("--check")) check();
else encode();
