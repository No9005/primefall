import { useEffect, useState } from "react";
import "./tutorial.css";
import { cardFace, describeEffects } from "./planning-selection";
import { TUTORIAL_STEP_SECONDS, TUTORIAL_STEPS, TutorialDrop, TutorialTopic } from "./tutorial";

const COLS = 7;
const ROWS = 5;
const PRIME_ZONE = { fromCol: 2, toCol: 4, fromRow: 1, toRow: 3 };
const HERO = { col: 0, row: 2 };
const ENEMY = { col: 6, row: 2 };
/** Sight step: tiles behind the blockers are dark, the enemy standing there is not Visible. */
const BLOCKERS = [{ col: 3, row: 3 }, { col: 3, row: 4 }];
const HIDDEN_ENEMY = { col: 6, row: 4 };
const VISIBLE_ENEMY = { col: 6, row: 0 };
const MOVE_TARGET = { col: 2, row: 2 };

const same = (a: { col: number; row: number }, b: { col: number; row: number }) => a.col === b.col && a.row === b.row;
const inShadow = ({ col, row }: { col: number; row: number }) => col > 3 && row >= 3;

function tileClasses(col: number, row: number, topic: TutorialTopic): string {
  const tile = { col, row };
  const classes = ["tutorial-tile"];
  const inZone = col >= PRIME_ZONE.fromCol && col <= PRIME_ZONE.toCol && row >= PRIME_ZONE.fromRow && row <= PRIME_ZONE.toRow;
  if (inZone) classes.push("prime");
  if (topic === TutorialTopic.Goal && inZone) classes.push("glow");
  if (topic === TutorialTopic.Move && same(tile, MOVE_TARGET)) classes.push("move-target");
  if (topic === TutorialTopic.Sight) {
    if (BLOCKERS.some((blocker) => same(blocker, tile))) classes.push("blocker");
    classes.push(inShadow(tile) ? "dark" : "lit");
  }
  return classes.join(" ");
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

  const faces =
    step.topic === TutorialTopic.Overdrive && step.card
      ? [false, true].map((overdrive) => ({ overdrive, energyCost: step.card!.energyCost, effectText: describeEffects(overdrive ? step.card!.overdrive : step.card!.effects) ?? "" }))
      : undefined;
  const face = step.card ? cardFace(step.card) : undefined;
  const heroMoved = step.topic === TutorialTopic.Move && seconds >= TUTORIAL_STEP_SECONDS / 2;
  const heroPosition = heroMoved ? MOVE_TARGET : HERO;
  const enemyPositions = step.topic === TutorialTopic.Sight ? [VISIBLE_ENEMY, HIDDEN_ENEMY] : [ENEMY];
  const dropped = seconds >= TUTORIAL_STEP_SECONDS / 2;

  return (
    <section className="tutorial" aria-label="Tutorial" data-testid="tutorial">
      <h2 className="tutorial-title" data-testid="tutorial-title">
        {step.title}
      </h2>
      <div className="tutorial-stage">
        <div className="tutorial-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            return <div key={i} className={tileClasses(col, row, step.topic)} />;
          })}
          <div className="tutorial-hero ally" style={{ gridColumn: heroPosition.col + 1, gridRow: heroPosition.row + 1 }}>
            {step.topic === TutorialTopic.Block && dropped ? "Shield 2" : "Hero"}
          </div>
          {enemyPositions.map((enemy) => (
            <div
              key={`${enemy.col},${enemy.row}`}
              className={`tutorial-hero enemy${step.topic === TutorialTopic.Sight && same(enemy, HIDDEN_ENEMY) ? " unseen" : ""}`}
              style={{ gridColumn: enemy.col + 1, gridRow: enemy.row + 1 }}
            >
              {step.topic === TutorialTopic.Sight && same(enemy, HIDDEN_ENEMY) ? "?" : "Hero"}
            </div>
          ))}
          {step.topic === TutorialTopic.Sight && <div className="tutorial-sight-line" data-testid="tutorial-sight-line" />}
          {step.topic === TutorialTopic.Goal && (
            <div className="tutorial-counter" data-testid="tutorial-counter">
              {goalCount(seconds)}/3
            </div>
          )}
        </div>
        <div className="tutorial-side">
          <div className={`drop-chip ${step.drop === TutorialDrop.BlockChip ? "lit" : "off"}${step.drop === TutorialDrop.BlockChip && dropped ? " active" : ""}`}>BLOCK</div>
          <div className={`energy${step.drop === TutorialDrop.EnergyOrb ? " drop-lit" : ""}${step.drop === TutorialDrop.EnergyOrb && dropped ? " active" : ""}`}>
            {step.drop === TutorialDrop.EnergyOrb && dropped ? 1 : 0}
          </div>
        </div>
        {step.card && face && (
          <div className="tutorial-hand">
            {faces ? (
              faces.map((modeFace, i) => (
                <div key={modeFace.overdrive ? "overdrive" : "normal"} className={`card mode-face ${step.card!.type}${modeFace.overdrive ? " overdrive" : ""}${dropped && i === 1 ? " chosen" : ""}`}>
                  <span className="card-name">{step.card!.name}</span>
                  <span className="card-cost">{modeFace.energyCost}</span>
                  <span className="card-type">{modeFace.overdrive ? "OVERDRIVE" : "NORMAL"}</span>
                  <span className="card-text">{modeFace.effectText}</span>
                  {dropped && modeFace.overdrive && <span className="card-use">Exiled</span>}
                </div>
              ))
            ) : (
              <div className={`card ${step.card.type} tutorial-card drop-${step.drop}`} key={step.topic}>
                <span className="card-name">{step.card.name}</span>
                <span className="card-cost">{step.card.energyCost}</span>
                <span className="card-type">{face.type}</span>
                <span className="card-text">{face.effectText}</span>
              </div>
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
