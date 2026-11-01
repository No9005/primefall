import { describeRules } from "game-core";

/** The line the start page shows: proves the web app reads from the rules package. */
export function bannerText(): string {
  return describeRules();
}
