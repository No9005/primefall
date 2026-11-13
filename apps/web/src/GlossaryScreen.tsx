import { ActionKind, type CardIndex, HeroClass, type QueuedAction } from "game-core";
import { type ReactNode, useEffect, useState } from "react";
import "./glossary.css";
import { GLOSSARY_ENTRIES, GLOSSARY_GROUPS, type GlossaryEntry, type HudName, type SceneName } from "./glossary";
import { PICTURE, renderScenes } from "./glossary-pictures";
import { PilePanel, QueueColumn } from "./PlanningScreen";
import { resolutionBarText } from "./resolution-hud";

// The glossary: one scrolling screen that shows every mark the player meets. The pictures are the game's own drawing (the
// scenes of `glossary-pictures.ts`) and the game's own HUD components and styles. Static data only: it never creates a
// match host and never reads or writes the saved match, like the Tutorial.

const QUEUE: readonly QueuedAction[] = [
  { kind: ActionKind.Move, card: 0 as CardIndex, destination: { col: 4, row: 3 } },
  { kind: ActionKind.Wait },
];

const ZONE_DOTS = ["own", "contested", "enemy"] as const;

const COMMENTARY = [
  { side: "ally", title: "Assassin · Move", detail: "Walks to the marked tile" },
  { side: "own", title: "Bruiser · Exhausted", detail: "Out of cards: Exhausted" },
  { side: "enemy", title: "Controller · Slow", detail: "Slows Bruiser" },
] as const;

function hudPicture(name: HudName): ReactNode {
  switch (name) {
    case "scorePill":
      return (
        <div className="prime-pill with-zones prime-neutral" aria-label="Victory Points, you 1, enemy 0">
          <span className="prime-label">VP</span>
          <span className="prime-vp-score prime-vp-own">1</span>
          <span className="prime-vp-divider">:</span>
          <span className="prime-vp-score prime-vp-enemy">0</span>
          <span className="zone-dots">
            {ZONE_DOTS.map((state, i) => (
              <span key={state} className={`zone-dot zone-dot-${state}${i === 1 ? " zone-dot-prime" : ""}`} data-state={state} />
            ))}
          </span>
        </div>
      );
    case "timerPill":
      return (
        <div className="timer-pill timer-amber">
          <span className="timer-round">ROUND 3 / 15</span>
          <span className="timer-time">0:09</span>
        </div>
      );
    case "queue":
      return <QueueColumn queue={QUEUE} heroClass={HeroClass.Bruiser} heroId="bruiser" issues={[]} disabled resolutionTick={undefined} nameOf={() => "Enemy"} missHints={[]} onRemove={() => undefined} />;
    case "deckPile":
      return <PilePanel deck={8} discard={2} exile={0} opacity={1} skull={false} greyed={false} />;
    case "resolutionBar":
      return <div className="resolution-bar">{resolutionBarText("ticks", 2, 3)}</div>;
    case "commentary":
      return (
        <ol className="commentary">
          {COMMENTARY.map((entry) => (
            <li key={entry.title} className={`commentary-entry ${entry.side}`}>
              <b>{entry.title}</b>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ol>
      );
  }
}

function Picture({ entry, scenes }: { entry: GlossaryEntry; scenes: ReadonlyMap<SceneName, string> | undefined }) {
  if ("hud" in entry.picture) return <div className="glossary-picture hud">{hudPicture(entry.picture.hud)}</div>;
  const source = scenes?.get(entry.picture.scene);
  return <div className="glossary-picture">{source && <img src={source} alt={entry.name} width={PICTURE.width} height={PICTURE.height} />}</div>;
}

/** `onClose` returns to the start screen. */
export function GlossaryScreen({ onClose }: { onClose: () => void }) {
  const [scenes, setScenes] = useState<ReadonlyMap<SceneName, string>>();
  useEffect(() => {
    let cancelled = false;
    const names = GLOSSARY_ENTRIES.flatMap((entry) => ("scene" in entry.picture ? [entry.picture.scene] : []));
    void renderScenes(names).then((pictures) => {
      if (!cancelled) setScenes(pictures);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="glossary" aria-label="Glossary" data-testid="glossary">
      <header className="glossary-header">
        <button type="button" data-testid="glossary-back" onClick={onClose}>
          Back
        </button>
        <h2>Glossary</h2>
      </header>
      <div className="glossary-body" data-testid="glossary-body">
        {GLOSSARY_GROUPS.map((group) => (
          <section key={group} className="glossary-group" aria-label={group} data-testid={`glossary-group-${group}`}>
            <h3>{group}</h3>
            <div className="glossary-entries">
              {GLOSSARY_ENTRIES.filter((entry) => entry.group === group).map((entry) => (
                <article key={entry.name} className="glossary-entry" data-testid="glossary-entry">
                  <Picture entry={entry} scenes={scenes} />
                  <div className="glossary-text">
                    <h4>{entry.name}</h4>
                    <p>{entry.text}</p>
                    {entry.mode && <p className="glossary-mode">{entry.mode}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
