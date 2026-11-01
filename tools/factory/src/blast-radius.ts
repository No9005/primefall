// Deterministic blast radius classification of a pull request (software factory, issue 26).
// Pure functions only: the CLI fetches data and applies the result.

export const BlastRadius = { Low: "low", High: "high" } as const;
export type BlastRadius = (typeof BlastRadius)[keyof typeof BlastRadius];

export interface BlastRadiusRules {
  highRiskLabel: string;
  /** Documentation (markdown) and agent files. */
  documentationAndAgentPaths: string[];
  /** The factory itself and tooling that enforces the project's rules or brings in dependencies. */
  factoryAndToolingPaths: string[];
  /** Business logic: how the game is resolved. Data, exports and tests are listed as exceptions. */
  businessLogicPaths: string[];
  businessLogicExceptions: string[];
  /** Optional size limits; a pull request is not high just because it is large unless these are set. */
  maxChangedLines?: number;
  maxChangedFiles?: number;
}

export interface ChangedFile {
  filename: string;
  additions: number;
  deletions: number;
}

export interface Classification {
  level: BlastRadius;
  reasons: string[];
}

/** Converts a glob (`**`, `*`, `?`) into an anchored regular expression. */
function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] as string;
    if (char === "*" && glob[i + 1] === "*") {
      const followedBySlash = glob[i + 2] === "/";
      source += followedBySlash ? "(?:.*/)?" : ".*";
      i += followedBySlash ? 2 : 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function pathMatchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

function firstMatch(path: string, globs: string[]): string | undefined {
  return globs.find((glob) => pathMatchesGlob(path, glob));
}

/** Rules in the order they are reported; any single one makes the pull request high. */
export function classifyPullRequest(input: { files: ChangedFile[]; labels: string[]; rules: BlastRadiusRules }): Classification {
  const { files, labels, rules } = input;
  const reasons: string[] = [];

  const groups: [string, string[], string[]][] = [
    ["documentation or agent files", rules.documentationAndAgentPaths, []],
    ["factory or tooling", rules.factoryAndToolingPaths, []],
    ["business logic", rules.businessLogicPaths, rules.businessLogicExceptions],
  ];
  for (const [name, globs, exceptions] of groups) {
    for (const { filename } of files) {
      if (firstMatch(filename, exceptions)) continue;
      const glob = firstMatch(filename, globs);
      if (glob) reasons.push(`Touches ${name}: \`${filename}\` (matches \`${glob}\`)`);
    }
  }

  const changedLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  if (rules.maxChangedLines !== undefined && changedLines > rules.maxChangedLines) reasons.push(`Changes ${changedLines} lines (limit ${rules.maxChangedLines})`);
  if (rules.maxChangedFiles !== undefined && files.length > rules.maxChangedFiles) reasons.push(`Changes ${files.length} files (limit ${rules.maxChangedFiles})`);
  if (labels.includes(rules.highRiskLabel)) reasons.push(`Carries the \`${rules.highRiskLabel}\` label`);

  return { level: reasons.length > 0 ? BlastRadius.High : BlastRadius.Low, reasons };
}

/**
 * The reviewer may raise the class but never lower it: an existing high label is kept
 * even when the deterministic rules alone would say low.
 */
export function keepHighWhenAlreadyHigh(computed: Classification, alreadyHigh: boolean): Classification {
  if (computed.level === BlastRadius.High || !alreadyHigh) return computed;
  return { level: BlastRadius.High, reasons: ["Raised to high earlier (by the reviewer or an owner) and kept"] };
}
