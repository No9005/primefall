import { MatchEndReason, type MatchResult, PRIME_ZONE_WIN_RESOLUTIONS, SquadId, VICTORY_POINTS_TO_WIN } from "game-core";
import { endTexts, type Role } from "./attack-defend";

interface EndScreenProps {
  result: MatchResult;
  /** The player's Squad. */
  squad: SquadId;
  seed: number;
  /** The player's role in Attack and Defend; none in the classic mode. */
  role?: Role;
  /** The Round limit of the match's mode. */
  roundLimit: number;
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
      return `${own ? "Your Squad" : "The enemy Squad"} controlled the Prime Zone for ${PRIME_ZONE_WIN_RESOLUTIONS} consecutive Resolutions.`;
    case MatchEndReason.VictoryPoints:
      return `${own ? "Your Squad" : "The enemy Squad"} reached ${VICTORY_POINTS_TO_WIN} Victory Points. ${scoreText(result, squad)}`;
    case MatchEndReason.AllHeroesExhausted:
      if (result.winner === undefined) return "All Heroes of both Squads are Exhausted.";
      return `All Heroes of ${own ? "the enemy Squad" : "your Squad"} are Exhausted.`;
    case MatchEndReason.DefenceHeld:
      return `${own ? "Your Squad" : "The enemy Squad"} held the defence until the Round limit.`;
    case MatchEndReason.RoundLimit: {
      const enemy = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
      const tiebreak = result.scores && result.scores[squad] === result.scores[enemy] && result.cardTotals;
      const cards = tiebreak ? ` Equal scores: cards not in the Exile, you ${result.cardTotals![squad]}, enemy ${result.cardTotals![enemy]}.` : "";
      return `Round Limit reached. ${scoreText(result, squad)}${cards}`;
    }
  }
}

function scoreText(result: MatchResult, squad: SquadId): string {
  const enemy = squad === SquadId.Left ? SquadId.Right : SquadId.Left;
  return result.scores ? `Victory Points: you ${result.scores[squad]}, enemy ${result.scores[enemy]}.` : "";
}

export function EndScreen({ result, squad, seed, role, roundLimit, onPlayAgain }: EndScreenProps) {
  if (role) {
    const texts = endTexts(result, role, roundLimit);
    return (
      <section className="end-screen ad-end" aria-label="Match result" data-testid="end-screen">
        <p className={`ad-you-were ${role}`}>{texts.youWere}</p>
        <h1 className={texts.headline === "VICTORY" ? "victory" : "defeat"}>{texts.headline}</h1>
        <p className="ad-reason" data-testid="end-reason">
          {texts.reason}
        </p>
        <p className="ad-detail" data-testid="end-round">
          {texts.detail}
        </p>
        <button type="button" onClick={onPlayAgain}>
          Play again
        </button>
        <p className="seed" data-testid="end-seed">
          seed {seed}
        </p>
      </section>
    );
  }
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
