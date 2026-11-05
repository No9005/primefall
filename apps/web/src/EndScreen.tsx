import { MatchEndReason, type MatchResult, SquadId } from "game-core";

interface EndScreenProps {
  result: MatchResult;
  /** The player's Squad. */
  squad: SquadId;
  seed: number;
  onPlayAgain: () => void;
}

function headline(result: MatchResult, squad: SquadId): string {
  if (result.winner === undefined) return "Draw";
  return result.winner === squad ? "Victory" : "Defeat";
}

function reasonText(result: MatchResult, squad: SquadId): string {
  const own = result.winner === squad;
  switch (result.reason) {
    case MatchEndReason.PrimeZoneHeld:
      return `${own ? "Your Squad" : "The enemy Squad"} controlled the Prime Zone for 3 consecutive Resolutions.`;
    case MatchEndReason.AllHeroesExhausted:
      if (result.winner === undefined) return "All Heroes of both Squads are Exhausted.";
      return `All Heroes of ${own ? "the enemy Squad" : "your Squad"} are Exhausted.`;
    case MatchEndReason.DefenceHeld:
      return `${own ? "Your Squad" : "The enemy Squad"} held the defence until the Round limit.`;
    case MatchEndReason.RoundLimit: {
      const enemy = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
      return `Round Limit reached. Cards in all Decks: you ${result.deckTotals[squad]}, enemy ${result.deckTotals[enemy]}.`;
    }
  }
}

export function EndScreen({ result, squad, seed, onPlayAgain }: EndScreenProps) {
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
