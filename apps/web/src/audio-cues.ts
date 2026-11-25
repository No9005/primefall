import { AttackFailReason, EventKind, type GridPosition, type HeroClass, type MatchEvent } from "game-core";
import { type AudioCue, type AudioManifest, type CueOn, meets } from "./audio-manifest";
import { CUE_PRIORITY, OWN_SQUAD_BONUS, pickVariant } from "./audio-mix";
import { CLIP_SPEED } from "./clip-player";
import { type ClipName, clipOf } from "./hero-clips";
import { isFieldDamage, type PlaybackFrame, STEP_MS } from "./playback";
import { impactMs } from "./weapon-effects";

// Turns what the playback shows into the sounds to play. Pure code: it knows the manifests of the Heroes and the frames of
// the Resolution, and says "this sound, this Hero, this many milliseconds from now". Whether a sound really plays is up to
// the mix (`audio-mix.ts`), how it plays is up to the player (`audio.ts`).

/** One sound to start `startMs` from now. */
export interface SoundRequest {
  kind: "voice" | "sfx";
  heroClass: HeroClass;
  heroId: string;
  /** The key in `assets` of the Hero's manifest. */
  assetId: string;
  startMs: number;
  priority: number;
  /** Where it comes from on the board, to tell how far the player is from it; absent for a sound that is not on the board. */
  tile?: GridPosition;
}

export interface PlanContext {
  manifestOf: (heroClass: HeroClass) => AudioManifest | undefined;
  classOf: (heroId: string) => HeroClass | undefined;
  /** A Hero of the player's Squad. */
  isOwn: (heroId: string) => boolean;
  /** The player's Squad may hear this Hero: an own Hero, or an enemy that the Squad sees (Fog of War, ADR 0005). */
  isHeard: (heroId: string) => boolean;
  tileOf: (heroId: string) => GridPosition | undefined;
  random: () => number;
  /** The last variant picked per Hero and cue, to avoid the same twice in a row. */
  lastPick: Map<string, string>;
  /** Reduced motion plays no clips, so the sounds of a frame all start with the frame. */
  immediate?: boolean;
}

/** The Hero that played the card of an event, or undefined when the Squad is not told (a Pull of an unseen caster). */
function casterOf(event: MatchEvent): string | undefined {
  if (event.kind === EventKind.Pull) return event.casterId;
  if (event.kind === EventKind.ShieldGained) return event.casterId ?? event.heroId;
  return event.heroId;
}

const CARD_EVENTS: ReadonlySet<EventKind> = new Set([
  EventKind.AttackHit,
  EventKind.AttackFailed,
  EventKind.SlowApplied,
  EventKind.MarkedApplied,
  EventKind.HiddenGained,
  EventKind.CoverPlaced,
  EventKind.AreaRevealed,
  EventKind.FieldPlaced,
  EventKind.AreaBlasted,
  EventKind.ShieldGained,
  EventKind.Pull,
  EventKind.Charged,
]);

/** How fast a clip runs in real time: a Walk keeps the pace of the steps, every other clip runs at `CLIP_SPEED`. */
function paceOf(heroClass: HeroClass, clip: ClipName | undefined): number {
  if (clip === undefined) return CLIP_SPEED;
  const { perStep, durationMs } = clipOf(heroClass, clip);
  return perStep ? durationMs / 2 / STEP_MS : CLIP_SPEED;
}

const DEFAULT_FIRE_MS = 620;
/** The pause between the first line of a Hero and its second. */
const AFTER_FIRST_LINE_MS = 250;

export interface Source {
  heroId: string;
  heroClass: HeroClass;
  tile: GridPosition | undefined;
}

class Planner {
  readonly requests: SoundRequest[] = [];

  constructor(private readonly ctx: PlanContext) {}

  /**
   * Plays the voice and the effects of a cue. `baseMs` is when the clip of the Hero starts, `pace` how fast it runs;
   * `impact` says where and when a shot arrives, for the effects that sound at the impact.
   */
  emit(cue: AudioCue, who: Source, baseMs: number, pace: number, options: { impact?: { atMs: number; tile: GridPosition | undefined }; voice?: boolean } = {}): void {
    const manifest = this.ctx.manifestOf(who.heroClass);
    if (!manifest) return;
    const own = this.ctx.isOwn(who.heroId);
    const bonus = own ? OWN_SQUAD_BONUS : 0;
    const at = (atMs: number) => (this.ctx.immediate ? 0 : baseMs + Math.max(0, atMs) / pace);
    const key = (kind: string) => `${who.heroId}:${cue.on}:${cue.card ?? ""}:${cue.when ? JSON.stringify(cue.when) : ""}:${kind}`;
    const pick = (variants: string[], slot: string) => {
      const chosen = pickVariant(variants, this.ctx.lastPick.get(key(slot)), this.ctx.random);
      if (chosen !== undefined) this.ctx.lastPick.set(key(slot), chosen);
      return chosen;
    };
    const voices = options.voice === false ? [] : [cue.voice, cue.voiceLater];
    // A second line of a Hero (the last words) never starts before its first line has ended.
    let firstEndsMs = 0;
    voices.forEach((voice, index) => {
      if (!voice || (voice.chance !== undefined && this.ctx.random() >= voice.chance)) return;
      const assetId = pick(voice.play, `voice${index}`);
      if (assetId === undefined) return;
      const startMs = Math.max(at(voice.atMs ?? 0), index === 0 ? 0 : firstEndsMs + AFTER_FIRST_LINE_MS);
      if (index === 0) firstEndsMs = startMs + (manifest.assets[assetId]?.durationMs ?? 0);
      this.requests.push({ kind: "voice", heroClass: who.heroClass, heroId: who.heroId, assetId, startMs, priority: CUE_PRIORITY[cue.on].voice + bonus, ...(who.tile && { tile: who.tile }) });
    });
    (cue.sfx ?? []).forEach((sfx, index) => {
      if (sfx.atImpact && !options.impact) return;
      const assetId = pick(sfx.play, `sfx${index}`);
      if (assetId === undefined) return;
      const tile = sfx.atImpact ? options.impact?.tile : who.tile;
      const startMs = sfx.atImpact ? at(0) + (this.ctx.immediate ? 0 : options.impact!.atMs) : at(sfx.atMs ?? 0);
      this.requests.push({ kind: "sfx", heroClass: who.heroClass, heroId: who.heroId, assetId, startMs, priority: CUE_PRIORITY[cue.on].sfx + bonus, ...(tile && { tile }) });
    });
  }

  source(heroId: string): Source | undefined {
    const heroClass = this.ctx.classOf(heroId);
    if (heroClass === undefined) return undefined;
    const tile = this.ctx.tileOf(heroId);
    return { heroId, heroClass, tile };
  }

  cueOf(heroClass: HeroClass, on: CueOn, matches: (cue: AudioCue) => boolean = () => true): AudioCue | undefined {
    return this.ctx.manifestOf(heroClass)?.cues.find((cue) => cue.on === on && matches(cue));
  }
}

/** The sounds of one frame of the Resolution: what its Heroes do, what hits whom, who walks, and who falls. */
export function planFrame(frame: PlaybackFrame, ctx: PlanContext): SoundRequest[] {
  const planner = new Planner(ctx);
  planCardPlays(frame, planner, ctx);
  planReactions(frame, planner, ctx);
  planMovement(frame, planner, ctx);

  planFalls(frame, planner, ctx);
  planQuietMoments(frame, planner, ctx);
  planCoverCrumbling(frame, planner);
  return planner.requests;
}

/** An Exhausted Hero: its line, the collapse, and its last words. */
function planFalls(frame: PlaybackFrame, planner: Planner, ctx: PlanContext): void {
  for (const heroId of frame.exhausted) {
    const who = ctx.isHeard(heroId) ? planner.source(heroId) : undefined;
    const cue = who && planner.cueOf(who.heroClass, "exhausted");
    if (who && cue) planner.emit(cue, who, (frame.delays[heroId] ?? 0) / CLIP_SPEED, paceOf(who.heroClass, "exhausted"));
  }
}

/** A Wait, and the end of Hidden (unless the clip of the shot or the hit has the shimmer in its own cue). */
function planQuietMoments(frame: PlaybackFrame, planner: Planner, ctx: PlanContext): void {
  for (const event of frame.events) {
    if (event.kind !== EventKind.HiddenEnded && event.kind !== EventKind.Wait) continue;
    const who = ctx.isHeard(event.heroId) ? planner.source(event.heroId) : undefined;
    const clip = frame.clips[event.heroId];
    if (!who || (event.kind === EventKind.HiddenEnded && (clip === "longHidden" || clip === "hitHidden"))) continue;
    const cue = planner.cueOf(who.heroClass, event.kind === EventKind.Wait ? "waitPlayed" : "hiddenEnded");
    if (cue) planner.emit(cue, who, 0, paceOf(who.heroClass, clip));
  }
}

/** The Hero that plays a card: its line and its effects, once per card and Hero in a frame (an Urban Renewal has many events). */
function planCardPlays(frame: PlaybackFrame, planner: Planner, ctx: PlanContext): void {
  const done = new Set<string>();
  for (const event of frame.events) {
    if (!CARD_EVENTS.has(event.kind) || isFieldDamage(event)) continue;
    const caster = casterOf(event);
    if (caster === undefined || !ctx.isHeard(caster)) continue;
    const who = planner.source(caster);
    if (!who) continue;
    const key = `${caster}:${event.card ?? event.kind}`;
    if (done.has(key)) continue;
    done.add(key);
    const cue = cardCueOf(planner, who.heroClass, event);
    if (!cue) continue;
    const clip = frame.clips[caster];
    const hit = frame.events.find((candidate) => candidate.kind === EventKind.AttackHit && candidate.heroId === caster && candidate.card === event.card && candidate.targetId !== undefined);
    const fire = clip === undefined ? DEFAULT_FIRE_MS : clipOf(who.heroClass, clip).fireMs ?? DEFAULT_FIRE_MS;
    const impact = hit ? { atMs: impactMs(hit.card, hit.distance, fire) / CLIP_SPEED, tile: ctx.tileOf(hit.targetId!) } : undefined;
    planner.emit(cue, who, 0, paceOf(who.heroClass, clip), impact ? { impact } : {});
  }
}

/** The cue of a card event: the card's own, else the basic attack for an Attack, else the Shield for a Shield. */
function cardCueOf(planner: Planner, heroClass: HeroClass, event: MatchEvent): AudioCue | undefined {
  const own = event.card === undefined ? undefined : planner.cueOf(heroClass, "cardPlayed", (candidate) => candidate.card === event.card);
  if (own) return own;
  if (event.kind === EventKind.AttackHit || event.kind === EventKind.AttackFailed) return planner.cueOf(heroClass, "attack");
  return event.kind === EventKind.ShieldGained ? planner.cueOf(heroClass, "shieldGained") : undefined;
}

/** The Hero that is hit (the cry and the impact on it), or whose Full Cover holds. */
function planReactions(frame: PlaybackFrame, planner: Planner, ctx: PlanContext): void {
  const hits = new Map<string, { damage: number; absorbed: number }>();
  for (const event of frame.events) {
    if (event.kind === EventKind.AttackHit && event.targetId !== undefined) {
      const total = hits.get(event.targetId) ?? { damage: 0, absorbed: 0 };
      hits.set(event.targetId, { damage: total.damage + (event.damage ?? 0), absorbed: total.absorbed + (event.absorbed ?? 0) });
    }
    if (event.kind === EventKind.AttackFailed && event.reason === AttackFailReason.FullCover) planFullCover(event, planner, ctx);
  }
  for (const [targetId, total] of hits) planHit(frame, targetId, total, planner, ctx);
}

/** The Hero whose Full Cover held. */
function planFullCover(event: MatchEvent, planner: Planner, ctx: PlanContext): void {
  if (event.targetId === undefined || !ctx.isHeard(event.targetId)) return;
  const who = planner.source(event.targetId);
  const cue = who && planner.cueOf(who.heroClass, "attackFailed", (candidate) => candidate.reason === "fullCover");
  if (who && cue) planner.emit(cue, who, 0, CLIP_SPEED);
}

/** The cry and the impact of a Hero that was hit: by how much it was hurt, and whether the Hero was Hidden. */
function planHit(frame: PlaybackFrame, targetId: string, { damage, absorbed }: { damage: number; absorbed: number }, planner: Planner, ctx: PlanContext): void {
  const who = ctx.isHeard(targetId) ? planner.source(targetId) : undefined;
  if (!who) return;
  const clip = frame.clips[targetId];
  const cue = planner.cueOf(
    who.heroClass,
    "attackHit",
    (candidate) => candidate.asTarget === true && Boolean(candidate.whileHidden) === (clip === "hitHidden") && meets(damage, candidate.when?.damage) && meets(absorbed, candidate.when?.absorbed),
  );
  // An Exhausted Hero has its own cry; its Exhausted cue plays the rest.
  if (cue) planner.emit(cue, who, (frame.delays[targetId] ?? 0) / CLIP_SPEED, paceOf(who.heroClass, clip), { voice: clip !== "exhausted" });
}

/** A step lands once per frame; a Move that ends on Cover is a Hero taking cover. */
function planMovement(frame: PlaybackFrame, planner: Planner, ctx: PlanContext): void {
  for (const [heroId, clip] of Object.entries(frame.clips)) {
    if (clip !== "walk" && clip !== "takeCover" && clip !== "takeCoverFull") continue;
    if (!ctx.isHeard(heroId)) continue;
    const who = planner.source(heroId);
    const cue = who && planner.cueOf(who.heroClass, clip === "walk" ? "step" : "moveEndedOnCover");
    if (who && cue) planner.emit(cue, who, 0, paceOf(who.heroClass, clip));
  }
}

/** Placed Cover that goes because a fourth was placed crumbles: the sound of the Hero that placed the new one (Tilly). */
function planCoverCrumbling(frame: PlaybackFrame, planner: Planner): void {
  const crumbled = frame.coverEdits.find((edit) => edit.kind === "destroyed" && edit.scorch === false);
  const placed = frame.events.find((event) => event.kind === EventKind.CoverPlaced);
  if (!crumbled || !placed) return;
  const who = planner.source(placed.heroId);
  const cue = who && planner.cueOf(who.heroClass, "coverCrumbled");
  if (who && cue) planner.emit(cue, { ...who, tile: crumbled.tile }, 0, CLIP_SPEED);
}

/** The cue of a moment outside the Resolution: the Hero Select, a Pitch, the end of the match. */
export function planMoment(on: "heroSelected" | "hangarAct" | "cardPitched" | "matchEnd", who: Source, ctx: PlanContext, won?: boolean): SoundRequest[] {
  const planner = new Planner(ctx);
  const cue = planner.cueOf(who.heroClass, on, (candidate) => candidate.won === undefined || candidate.won === won);
  // The Hero Select sheet runs in real time; a Pitch and the end of the match have nothing to follow.
  if (cue) planner.emit(cue, who, 0, 1);
  return planner.requests;
}
