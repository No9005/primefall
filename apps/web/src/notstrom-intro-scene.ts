import { Container, Graphics, Sprite } from "pixi.js";
import { notstromIntroVideoUrls } from "./notstrom-intro";
import type { Scene, SceneEnv, VideoClip } from "./stage";
import type { FillView } from "./stage-fit";

// The Notstrom Intro as a scene on the stage (ADR 0026; design: docs/design/notstrom-intro/README.md). The film is a video on a sprite, the one
// film of the app (rule 3), shown whole in the window: as large as fits, dark around it, never cropped or stretched. The film's own end event
// ends the scene, which is the one place where the stage ticker is not the clock. The sound stays with the audio clock (`audio.ts`).

export const NOTSTROM_INTRO_SCENE_NAME = "notstrom-intro";

const BACKDROP = 0x04060f;

export interface NotstromIntroScene extends Scene {
  /** The screen asks for the outcome: `onDone(true)` when the film ran to its end, `onDone(false)` when it was skipped or could not play. `undefined` stops. */
  watch(onDone: ((playedToEnd: boolean) => void) | undefined): void;
  /** Ends the film at once (a tap). */
  skip(): void;
}

export function createNotstromIntroScene(urls: () => string[] = notstromIntroVideoUrls): NotstromIntroScene {
  let clip: VideoClip | undefined;
  let sprite: Sprite | undefined;
  let view: FillView | undefined;
  let outcome: boolean | undefined;
  let onDone: ((playedToEnd: boolean) => void) | undefined;
  let stopListening = () => {};
  let hidden = false;
  let drawn = false;
  /** Where the film goes on after the scene was rebuilt (a lost WebGL context) while the screen is still there. */
  let resumeAt = 0;

  /** The film as large as fits the view, in its middle. */
  function layout() {
    if (!sprite || !view) return;
    const { width, height } = sprite.texture;
    if (width <= 1 || height <= 1) return;
    const scale = Math.min(view.width / width, view.height / height);
    sprite.scale.set(scale);
    sprite.position.set((view.width - width * scale) / 2, (view.height - height * scale) / 2);
  }

  function finish(playedToEnd: boolean) {
    if (outcome !== undefined) return;
    outcome = playedToEnd;
    clip?.pause();
    onDone?.(playedToEnd);
  }

  function play() {
    clip?.play().catch(() => finish(false));
  }

  const scene: NotstromIntroScene = {
    name: NOTSTROM_INTRO_SCENE_NAME,
    fit: "fill",
    assets: [],
    get videos() {
      return [urls()];
    },
    create(env: SceneEnv) {
      clip = env.video(0);
      drawn = false;
      const root = new Container();
      root.addChild(new Graphics().rect(-3000, -3000, 9000, 9000).fill(BACKDROP));
      if (clip) {
        clip.texture.source.scaleMode = "nearest";
        sprite = new Sprite(clip.texture);
        root.addChild(sprite);
        layout();
      }
      return root;
    },
    enter() {
      // The film could not be loaded: the intro is over, as if it was skipped.
      if (!clip) return finish(false);
      stopListening = clip.listen({ ended: () => finish(true), failed: () => finish(false) });
      if (outcome === undefined) {
        if (resumeAt > 0) clip.currentTime = resumeAt;
        if (!hidden) play();
      }
      scene.update(0);
    },
    leave() {
      // Left while the screen still waits for the film (context loss): the rebuilt scene goes on from here.
      resumeAt = outcome === undefined && onDone && clip ? clip.currentTime : 0;
      stopListening();
      stopListening = () => {};
      clip = undefined;
      sprite = undefined;
      drawn = false;
    },
    update() {
      drawn = clip?.hasFrame() ?? false;
    },
    ready: () => drawn,
    animating: () => clip !== undefined && outcome === undefined && !hidden,
    viewChanged(next) {
      view = next;
      layout();
    },
    hiddenChanged(value) {
      hidden = value;
      if (!clip || outcome !== undefined) return;
      if (hidden) clip.pause();
      else play();
    },
    watch(next) {
      onDone = next;
      if (!next) {
        outcome = undefined;
        resumeAt = 0;
      } else if (outcome !== undefined) next(outcome);
    },
    skip: () => finish(false),
  };
  return scene;
}

export const notstromIntroScene = createNotstromIntroScene();
