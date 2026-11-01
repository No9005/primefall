import { HERO_DECKS, HeroClass, ROUND_LIMIT, type HeroView, type SquadView } from "game-core";
import { useState } from "react";
import { Board } from "./Board";

/** The Hero the player plans for; the other two are AI planned (offline prototype spec). */
export const PLAYER_HERO_CLASS = HeroClass.Bruiser;

const HERO_NAMES: Record<HeroClass, string> = {
  [HeroClass.Bruiser]: "Bruiser",
  [HeroClass.Controller]: "Controller",
  [HeroClass.Assassin]: "Assassin",
};

function SquadPanel({ heroes, selectedId, onSelect }: { heroes: readonly HeroView[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="hud squad-panel" aria-label="Squad">
      {heroes.map((hero) => {
        const playerControlled = hero.heroClass === PLAYER_HERO_CLASS;
        return (
          <button
            key={hero.id}
            type="button"
            className="hero-row"
            aria-pressed={hero.id === selectedId}
            disabled={!playerControlled}
            onClick={() => onSelect(hero.id)}
          >
            <span className="hero-name">{HERO_NAMES[hero.heroClass]}</span>
            <span className="counts">
              Deck {hero.deckCount} · Exile {hero.exileCount}
            </span>
            {!playerControlled && <span className="tag">AI</span>}
          </button>
        );
      })}
    </aside>
  );
}

function Hand({ hero }: { hero: HeroView }) {
  const deck = HERO_DECKS[hero.heroClass];
  return (
    <ul className="hud hand" aria-label="Hand">
      {hero.hand.map((cardIndex) => {
        const card = deck[cardIndex]!;
        return (
          <li key={cardIndex} className="card">
            <span className="card-name">{card.name}</span>
            <span className="card-cost">{card.energyCost}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PlanningScreen({ view }: { view: SquadView }) {
  const initial = view.heroes.find((hero) => hero.heroClass === PLAYER_HERO_CLASS)!;
  const [selectedId, setSelectedId] = useState(initial.id);
  const selected = view.heroes.find((hero) => hero.id === selectedId) ?? initial;

  return (
    <div className="planning">
      <Board
        heroes={view.heroes}
        selectedId={selected.id}
        onSelect={(id) => view.heroes.find((hero) => hero.id === id)?.heroClass === PLAYER_HERO_CLASS && setSelectedId(id)}
      />
      <header className="hud top-bar">
        <span data-testid="round">
          Round {view.round} / {ROUND_LIMIT}
        </span>
      </header>
      <SquadPanel heroes={view.heroes} selectedId={selected.id} onSelect={setSelectedId} />
      <Hand hero={selected} />
    </div>
  );
}
