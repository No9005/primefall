import { type Camera, type CameraView, fitCamera, isZoomed, nearestPixelStepScale, panBy, pixelMaxScale, pixelStepBy, zoomAt } from "./board-layout";

/** A drag of a zoomed board starts after this many pixels; a shorter movement is still a tap. */
const DRAG_THRESHOLD = 8;
/**
 * The turn of the wheel (a trackpad: in pixels) that moves the zoom one step. After a step the same gesture needs three times that
 * for the next one, so the run-out of a trackpad swipe does not run through all steps; a pause of this many ms ends a gesture.
 */
const WHEEL_STEP_TURN = 40;
const WHEEL_GESTURE_GAP_MS = 120;

/** What the gestures need from the board: the camera and the view, and what a tap or a press means. All points are in view pixels. */
export interface GestureHost {
  camera(): Camera;
  view(): CameraView;
  /** Moves the camera by hand (this ends the automatic framing of an armed Move). */
  setCameraByHand(camera: Camera): void;
  /** The tile under the finger while it is down, `undefined` when it is lifted or the touch became a drag or pinch. */
  press(point: { x: number; y: number } | undefined): void;
  tap(point: { x: number; y: number }): void;
}

export interface WheelTurn {
  x: number;
  y: number;
  deltaY: number;
  /** 0: pixels (a trackpad), otherwise lines or pages (a mouse wheel notch). */
  deltaMode: number;
  /** Milliseconds, any monotonic clock: only the gap between two turns matters. */
  at: number;
}

/**
 * The input of the board: a tap picks, one finger on a zoomed board pans, two fingers pinch and the wheel zooms. The board's input layer
 * (a DOM element over the canvas) feeds it pointer events; it does not know about the DOM.
 */
export class BoardGestures {
  /** Fingers (or the mouse button) currently down, by pointer id. */
  private readonly down = new Map<number, { x: number; y: number }>();
  private dragStart = { x: 0, y: 0 };
  private dragged = false;
  /** A drag or pinch is not a tap. */
  private suppressTap = false;
  /** Pixel art zooms in whole steps. A pinch adds up the scale it asks for and lands on the nearest step. */
  private gestureScale: number | undefined;
  private wheelTurn = 0;
  private wheelStepped = false;
  private lastWheelAt = -Infinity;

  constructor(private readonly host: GestureHost) {}

  pointerDown(id: number, x: number, y: number): void {
    this.down.set(id, { x, y });
    if (this.down.size === 1) {
      this.suppressTap = false;
      this.dragged = false;
      this.dragStart = { x, y };
      this.host.press({ x, y });
    } else {
      this.suppressTap = true;
      this.host.press(undefined);
    }
  }

  pointerMove(id: number, x: number, y: number): void {
    const previous = this.down.get(id);
    if (!previous) return;
    const current = { x, y };
    const { host } = this;
    if (this.down.size >= 2) {
      const [a, b] = [...this.down.entries()].map(([pointer, point]) => (pointer === id ? current : point));
      const [oldA, oldB] = [...this.down.values()];
      const oldDistance = Math.hypot(oldA!.x - oldB!.x, oldA!.y - oldB!.y);
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const oldMid = { x: (oldA!.x + oldB!.x) / 2, y: (oldA!.y + oldB!.y) / 2 };
      const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      this.down.set(id, current);
      if (oldDistance === 0) return;
      const zoomed = zoomAt(host.camera(), this.gestureZoom(distance / oldDistance), oldMid.x, oldMid.y, host.view());
      host.setCameraByHand(panBy(zoomed, mid.x - oldMid.x, mid.y - oldMid.y, host.view()));
      return;
    }
    this.down.set(id, current);
    if (!isZoomed(host.camera(), host.view())) return;
    if (!this.dragged && Math.hypot(current.x - this.dragStart.x, current.y - this.dragStart.y) > DRAG_THRESHOLD) {
      this.dragged = true;
      this.suppressTap = true;
      host.press(undefined);
    }
    if (this.dragged) host.setCameraByHand(panBy(host.camera(), current.x - previous.x, current.y - previous.y, host.view()));
  }

  /** The finger lifted: a tap when nothing dragged or pinched, and when it came down on the board. */
  pointerUp(id: number, x: number, y: number): void {
    if (!this.down.has(id)) return;
    if (!this.suppressTap) this.host.tap({ x, y });
    this.release(id);
  }

  pointerCancel(id: number): void {
    this.release(id);
  }

  private release(id: number): void {
    this.down.delete(id);
    if (this.down.size === 0) this.gestureScale = undefined;
    // The finger left after a pinch pans from where it is.
    if (this.down.size === 1) this.dragged = true;
    this.host.press(undefined);
  }

  private gestureZoom(ratio: number): number {
    const { host } = this;
    const camera = host.camera();
    if (!host.view().pixel) return camera.scale * ratio;
    const fitted = fitCamera(host.view()).scale;
    this.gestureScale = Math.min(Math.max((this.gestureScale ?? camera.scale) * ratio, fitted), pixelMaxScale(fitted));
    return nearestPixelStepScale(this.gestureScale);
  }

  /** The wheel moves one step for a small turn, so zooming reacts at once; a trackpad fling does not run through all steps. */
  wheel({ x, y, deltaY, deltaMode, at }: WheelTurn): void {
    const { host } = this;
    const camera = host.camera();
    if (!host.view().pixel) {
      host.setCameraByHand(zoomAt(camera, camera.scale * Math.exp(-deltaY * 0.0015), x, y, host.view()));
      return;
    }
    // A line or page turn of a mouse wheel counts as a whole notch; pixels come from a trackpad.
    if (at - this.lastWheelAt > WHEEL_GESTURE_GAP_MS) {
      this.wheelTurn = 0;
      this.wheelStepped = false;
    }
    this.lastWheelAt = at;
    this.wheelTurn += deltaMode === 0 ? deltaY : Math.sign(deltaY) * WHEEL_STEP_TURN;
    if (Math.abs(this.wheelTurn) < WHEEL_STEP_TURN * (this.wheelStepped ? 3 : 1)) return;
    const next = pixelStepBy(camera.scale, this.wheelTurn < 0 ? 1 : -1);
    this.wheelTurn = 0;
    this.wheelStepped = true;
    host.setCameraByHand(zoomAt(camera, next, x, y, host.view()));
  }
}

/**
 * Connects the gestures to the transparent element over the canvas (the board's input layer). Coordinates are relative to the element,
 * which has the size of the canvas. Returns the function that removes the listeners.
 */
export function attachBoardInput(element: HTMLElement, gestures: BoardGestures): () => void {
  const local = (event: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onDown = (event: PointerEvent) => {
    element.setPointerCapture?.(event.pointerId);
    const { x, y } = local(event);
    gestures.pointerDown(event.pointerId, x, y);
  };
  const onMove = (event: PointerEvent) => {
    const { x, y } = local(event);
    gestures.pointerMove(event.pointerId, x, y);
  };
  const onUp = (event: PointerEvent) => {
    const { x, y } = local(event);
    gestures.pointerUp(event.pointerId, x, y);
  };
  const onCancel = (event: PointerEvent) => gestures.pointerCancel(event.pointerId);
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const { x, y } = local(event);
    gestures.wheel({ x, y, deltaY: event.deltaY, deltaMode: event.deltaMode, at: performance.now() });
  };
  element.addEventListener("pointerdown", onDown);
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onCancel);
  element.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    element.removeEventListener("pointerdown", onDown);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onCancel);
    element.removeEventListener("wheel", onWheel);
  };
}
