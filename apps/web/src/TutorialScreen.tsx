import { HeroClass } from "game-core";
import { useEffect, useRef, useState } from "react";
import { Board, type TokenHero } from "./Board";
import type { BoardPick, Point } from "./card-drag";
import { BlockChip, CardFace, EnergyOrb, ModeFaceCard } from "./game-parts";
import "./tutorial.css";
import { OVERDRIVE_FACES, SIGHT_SCENE, TUTORIAL_STEP_SECONDS, TUTORIAL_STEPS, TutorialDrop, TutorialTopic } from "./tutorial";

const COLS = 7;
const ROWS = 5;
const PRIME_ZONE = { fromCol: 2, toCol: 4, fromRow: 1, toRow: 3 };
const HERO = { col: 0, row: 2 };
const ENEMY = { col: 6, row: 2 };
const MOVE_TARGET = { col: 2, row: 2 };

const same = (a: { col: number; row: number }, b: { col: number; row: number }) => a.col === b.col && a.row === b.row;

function tileClasses(col: number, row: number, topic: TutorialTopic): string {
  const tile = { col, row };
  const classes = ["tutorial-tile"];
  const inZone = col >= PRIME_ZONE.fromCol && col <= PRIME_ZONE.toCol && row >= PRIME_ZONE.fromRow && row <= PRIME_ZONE.toRow;
  if (inZone) classes.push("prime");
  if (topic === TutorialTopic.Goal && inZone) classes.push("glow");
  if (topic === TutorialTopic.Move && same(tile, MOVE_TARGET)) classes.push("move-target");
  return classes.join(" ");
}

// Static input of the Board in the Line of Sight step. Kept outside the component so the Board's effects do not redraw.
const SIGHT_HEROES: readonly TokenHero[] = [{ id: "hero", heroClass: HeroClass.Bruiser, position: SIGHT_SCENE.hero, exhausted: false }];
const SIGHT_ENEMIES: readonly TokenHero[] = [{ id: SIGHT_SCENE.seenEnemy.id, heroClass: HeroClass.Assassin, position: SIGHT_SCENE.seenEnemy.position, exhausted: false }];
const SIGHT_SHOTS = [SIGHT_SCENE.shot];
const NOTHING: never[] = [];
const NO_PICK: BoardPick = { target: { kind: "none" }, ground: undefined };
const ignore = () => undefined;

/** The Line of Sight step: the game's own Board with its visibility drawing and shot line, on static data. */
function SightBoard() {
  const pickRef = useRef<((point: Point) => BoardPick) | undefined>(() => NO_PICK);
  return (
    <div className="tutorial-sight-board" data-testid="tutorial-sight-board">
      <Board
        destroyedCover={NOTHING}
        placedCover={NOTHING}
        wreckCover={NOTHING}
        revealedAreas={NOTHING}
        visibleTiles={SIGHT_SCENE.visibleTiles}
        heroes={SIGHT_HEROES}
        enemies={SIGHT_ENEMIES}
        selectedId="hero"
        onSelect={ignore}
        targetableIds={NOTHING}
        onTargetTap={ignore}
        hitIds={NOTHING}
        highlights={NOTHING}
        markers={NOTHING}
        onTileTap={ignore}
        zoneLabels={NOTHING}
        areaTiles={NOTHING}
        shotLines={SIGHT_SHOTS}
        targetLines={[]}
        marks={{}}
        paths={[]}
        collisionTiles={[]}
        pickRef={pickRef}
      />
    </div>
  );
}

/** The Resolution counter of the Goal step: 0/3 climbing to 3/3 while the step plays. */
function goalCount(secondsIntoStep: number): number {
  return Math.min(3, Math.floor(secondsIntoStep / (TUTORIAL_STEP_SECONDS / 4)));
}

/** `onPlay` starts a match from the last step; `onClose` returns to the start screen. Neither touches a saved match. */
export function TutorialScreen({ onPlay, onClose }: { onPlay: () => void; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const step = TUTORIAL_STEPS[index]!;
  const last = index === TUTORIAL_STEPS.length - 1;

  // A step runs for TUTORIAL_STEP_SECONDS and then the next one starts; the last step waits for Play.
  useEffect(() => {
    setSeconds(0);
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed = Math.min(elapsed + 0.25, TUTORIAL_STEP_SECONDS);
      setSeconds(elapsed);
      if (elapsed >= TUTORIAL_STEP_SECONDS) {
        clearInterval(timer);
        if (!last) setIndex((i) => i + 1);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [index, last]);

  const heroMoved = step.topic === TutorialTopic.Move && seconds >= TUTORIAL_STEP_SECONDS / 2;
  const heroPosition = heroMoved ? MOVE_TARGET : HERO;
  const dropped = seconds >= TUTORIAL_STEP_SECONDS / 2;

  return (
    <section className="tutorial" aria-label="Tutorial" data-testid="tutorial">
      <h2 className="tutorial-title" data-testid="tutorial-title">
        {step.title}
      </h2>
      <div className="tutorial-stage">
        {step.topic === TutorialTopic.Sight ? (
          <SightBoard />
        ) : (
          <div className="tutorial-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              return <div key={i} className={tileClasses(col, row, step.topic)} />;
            })}
            <div className="tutorial-hero ally" style={{ gridColumn: heroPosition.col + 1, gridRow: heroPosition.row + 1 }}>
              {step.topic === TutorialTopic.Block && dropped ? "Shield 2" : "Hero"}
            </div>
            <div className="tutorial-hero enemy" style={{ gridColumn: ENEMY.col + 1, gridRow: ENEMY.row + 1 }}>
              Hero
            </div>
            {step.topic === TutorialTopic.Goal && (
              <div className="tutorial-counter" data-testid="tutorial-counter">
                {goalCount(seconds)}/3
              </div>
            )}
          </div>
        )}
        <div className="tutorial-side">
          <BlockChip allowed={step.drop === TutorialDrop.BlockChip} active={step.drop === TutorialDrop.BlockChip && dropped} />
          <EnergyOrb available={step.drop === TutorialDrop.EnergyOrb && dropped ? 1 : 0} lit={step.drop === TutorialDrop.EnergyOrb} active={step.drop === TutorialDrop.EnergyOrb && dropped} />
        </div>
        {step.card && (
          <div className="tutorial-hand">
            {step.topic === TutorialTopic.Overdrive ? (
              OVERDRIVE_FACES.map((face) => <ModeFaceCard key={String(face.overdrive)} card={step.card!} face={face} chosen={dropped && face.overdrive} />)
            ) : (
              <button type="button" tabIndex={-1} className={`card ${step.card.type} tutorial-card drop-${step.drop}`} key={step.topic}>
                <CardFace card={step.card} />
              </button>
            )}
          </div>
        )}
      </div>
      <p className="tutorial-caption" data-testid="tutorial-caption">
        {step.caption}
      </p>
      <div className="tutorial-controls">
        <button type="button" data-testid="tutorial-back" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        <span className="tutorial-progress">
          {index + 1}/{TUTORIAL_STEPS.length}
        </span>
        {last ? (
          <button type="button" className="primary" data-testid="tutorial-play" onClick={onPlay}>
            Play
          </button>
        ) : (
          <button type="button" data-testid="tutorial-skip" onClick={() => setIndex(index + 1)}>
            Skip
          </button>
        )}
        {!last && (
          <button type="button" data-testid="tutorial-exit" onClick={onClose}>
            Menu
          </button>
        )}
      </div>
    </section>
  );
}
