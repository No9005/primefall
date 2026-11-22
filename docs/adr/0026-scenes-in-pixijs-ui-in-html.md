# Scenes in PixiJS, UI in HTML and CSS

Everything the player looks at as a picture world is drawn by PixiJS. Everything the player reads, presses or navigates is HTML and CSS.

## Context

ADR 0012 chose PixiJS for the presentation of the match; ADR 0021 describes the UI of the match. Since then more screens were built, in different ways: the title screen is images and CSS animations, the Hero Select in the hangar is layers and strips of frames played by CSS, the Notstrom Intro is a 2D canvas that draws a sprite sheet, the match board is PixiJS with texture atlases, and the Side Select and the Glossary (since removed) are HTML. The same Hero exists in two picture formats (an atlas for the match, strips for the hangar), a cross-fade or a transition has to be built twice (once in CSS, once in a canvas), and the timing of CSS animations, timers and the canvas ticker is not shared.

The owner wants one way to render and one place to change things, and wants the buttons, the text and the navigation to keep what the DOM gives: semantics, keyboard, focus, screen readers, text layout and test ids.

## Decision

**Two kinds of things, kept apart.**

| | Scene | UI |
|---|---|---|
| What | Backgrounds, sprites, effects, animation and the moving between them: the title screen's planet, fireballs and logo, the Notstrom Intro, the hangar with its Heroes, the Notstrom Map (the board), the Hero's pose in a Side Select or an end screen | Buttons, menu rows, text, the HUD, cards, panels, sheets, dialogs, the Queue |
| Drawn by | PixiJS | HTML and CSS (React) |
| Why | One animation format, one clock, transitions and cross-fades in one place | Semantics, accessibility, keyboard and touch targets, text, test ids |

Card animations (the pull, the drop, the shuffle) and menu rows are UI, so they stay DOM.

Rules:

1. **One stage.** The app has one PixiJS `Application` and one canvas, below the UI layer. A scene is a container that is put on the stage and taken off it; a screen does not make an application of its own. This includes the match board, which had an application of its own and now is a scene on the stage (issue #462); the glossary pictures, which had one too, were removed with the Glossary. The stage owns the ticker, the asset loader, the fit to the window and the transitions between scenes.
2. **UI over the scene.** Buttons and text are DOM elements above the canvas. Anything in a scene that is pressed (a Hero in the Hero Select) gets an invisible DOM element as its tap area, with the accessible name, the focus, the keyboard and the test id, **except the board, whose tiles are reached through one transparent input layer over the canvas** (there are hundreds of tiles and they move with the camera). The picture comes from PixiJS, the input and the meaning from the DOM.
3. **One animation format.** Clips are texture atlases (a PNG and a JSON with the frames and the animations, frames trimmed, in rows, at most 4096 pixels on a side, which every phone's GPU accepts), loaded by the stage's loader and played by one clip player. Strips played by CSS (`background-position` in steps) and sheets drawn by hand on a 2D canvas are not used for scenes any more. State machines that decide which clip plays (the Hero Select's idle, action and select of each Hero) stay pure code without rendering, as they are today.
4. **One clock.** All motion of a scene follows the stage's ticker (its delta time), not CSS animations or independent timers, so that a cross-fade, a shake, a fog wipe and a Hero's walk run in step, and can be stepped by a test or a recording.
5. **One fit.** The stage fits a design size (960 x 444 design pixels for the picture scenes) into the window, and a scene's picture goes on beyond that frame on all sides (it fades into the dark), so no window shape shows bars. A scene with its own camera, the board, instead asks for the second fit mode, which fills the window and hands the scene its size and the capped resolution. This logic exists once, in the stage.
6. **Drawing on demand.** The ticker draws only while something animates or changes, and stops while the page is hidden; a still scene costs no frames (battery, heat).
7. **Texture lifecycle.** A scene loads its atlases when it enters and destroys its textures when it leaves; the stage keeps only what the next scene needs. The resolution of the canvas is capped (device pixels times fit, at most a set limit) so that large screens do not get a huge canvas.
8. **Context loss.** The stage handles the loss and the return of the WebGL context: it rebuilds the current scene.
9. **Reduced motion** is handled in the scene code (a still picture, no cross-fade), as it is in the DOM screens today.
10. **A seam for tests.** The stage shows the state of the current scene in attributes of its root (the scene's name and whether it is ready), the tap areas keep their test ids and accessible names, and the screenshot tool waits for the ready state. A test never reads pixels to learn the state of a scene.
11. **Rules stay out of scenes.** A scene shows what the simulation says and what the UI asks for; it does not decide (ADR 0017).

## Consequences

- **One pipeline:** a Hero, a clip or an effect is made and changed in one format and one place; the hangar and the match show the same Hero from the same atlas.
- **Transitions are built once:** the walk of the Heroes and the fog wipe from the hangar to the map, the cross-fade from the title to the Notstrom Intro, the flash at its end, can run in one canvas, on one clock.
- **Less memory, no oversize textures:** trimmed frames in atlases of at most 4096 pixels (the strips of today are up to 14,960 pixels wide and are not trimmed).
- **The UI keeps the DOM:** screen readers, keyboard, focus rings, the text of the card faces, the 44 px touch targets and the test ids stay as they are.
- **Costs and risks:** the screens built in CSS so far (the title screen, the Hero Select in the hangar, the Notstrom Intro) have to be rebuilt as scenes; one context for everything means a context loss affects everything (handled, rule 8); textures stay in the graphics memory until they are destroyed (rule 7); a PixiJS ticker draws all the time unless it is stopped (rule 6); sprites are not elements in the browser's inspector; end-to-end tests cannot read a canvas and use the seam of rule 10; software rendering (no GPU) is slower for a canvas than for CSS, which makes screenshot runs without a GPU longer.
- **`GLOSSARY.md`** has no entry for Scene and UI yet; they are defined in this record.

Supplements ADR 0012 (PixiJS for the presentation) and ADR 0021 (UI direction); the rules of the simulation (ADR 0017) are not touched.
