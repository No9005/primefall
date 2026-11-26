import { useEffect, useRef } from "react";
import { CREDITS_TO_WIN, type GridPosition, type HeroClass, MatchEndReason, type MatchResult, SquadId } from "game-core";
import { gameAudio } from "./audio";

/** The Hero of the player who speaks when the end music has played for a moment. */
export interface EndHero {
  heroId: string;
  heroClass: HeroClass;
  tile: GridPosition | undefined;
}

/** The voice line comes this long after the end music starts; the music steps back for it. */
const END_VOICE_DELAY_MS = 4000;

interface EndScreenProps {
  result: MatchResult;
  /** The player's Squad. */
  squad: SquadId;
  seed: number;
  /** Whose voice line plays over the end music. */
  hero?: EndHero;
  onPlayAgain: () => void;
}

function headline(result: MatchResult, squad: SquadId): string {
  if (result.winner === undefined) return "Draw";
  return result.winner === squad ? "Victory" : "Defeat";
}

function reasonText(result: MatchResult, squad: SquadId): string {
  const own = result.winner === squad;
  switch (result.reason) {
    case MatchEndReason.Credits:
      return `${own ? "Your Squad" : "The enemy Squad"} reached ${CREDITS_TO_WIN} Credits. ${scoreText(result, squad)}`;
    case MatchEndReason.AllHeroesExhausted:
      if (result.winner === undefined) return "All Heroes of both Squads are Exhausted.";
      return `All Heroes of ${own ? "the enemy Squad" : "your Squad"} are Exhausted.`;
    case MatchEndReason.RoundLimit: {
      const enemy = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
      const tiebreak = result.scores[squad] === result.scores[enemy];
      const cards = tiebreak ? ` Equal scores: cards not in the Exile, you ${result.cardTotals[squad]}, enemy ${result.cardTotals[enemy]}.` : "";
      return `Round Limit reached. ${scoreText(result, squad)}${cards}`;
    }
  }
}

function scoreText(result: MatchResult, squad: SquadId): string {
  const enemy = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
  return `Credits: you ${result.scores[squad]}, enemy ${result.scores[enemy]}.`;
}

export function EndScreen({ result, squad, seed, hero, onPlayAgain }: EndScreenProps) {
  const heroRef = useRef(hero);
  heroRef.current = hero;
  // The end music: a jingle, then a quiet loop; a draw has none. The Hero's line follows a few seconds in.
  useEffect(() => {
    if (result.winner === undefined) return;
    const won = result.winner === squad;
    void gameAudio.loadMusic("ending").then(() => gameAudio.startEnding(won));
    const timer = setTimeout(() => {
      if (heroRef.current) gameAudio.playMoment("matchEnd", heroRef.current, won);
    }, END_VOICE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      gameAudio.stopEnding();
    };
  }, [result.winner, squad]);
  return (
    <section className="end-screen" aria-label="Match result" data-testid="end-screen">
      <p className="label">Match result</p>
      <h1>{headline(result, squad)}</h1>
      <p data-testid="end-reason">{reasonText(result, squad)}</p>
      <p data-testid="end-round">Round {result.round}</p>
      <button type="button" onClick={onPlayAgain}>
        Play again
      </button>
      <p className="seed" data-testid="end-seed">
        Seed {seed}
      </p>
    </section>
  );
}
