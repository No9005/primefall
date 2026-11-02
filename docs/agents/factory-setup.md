# Software factory: setup and operation

The design is in `docs/agents/software-factory.md`. Everything on this page is done by the repository owner; agents cannot change repository settings.

## 1. Make the repository public

Public repositories get branch rules and native auto-merge for free; the free plan does not offer them for private repositories. Before you switch: the repository contains no secrets (checked), commits carry only GitHub no-reply addresses, and everything in it (ADRs, specs, process notes, issues, comments) becomes readable by anyone. Settings, General, Danger Zone, Change visibility.

## 2. Claude access

1. Install the Claude GitHub App on this repository: https://github.com/apps/claude/installations/select_target.
2. Create a token in a terminal with Claude Code: `claude setup-token`. Store it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN` (Settings, Secrets and variables, Actions). Never put it in a file, issue or chat.
3. Settings, Actions, General: enable "Allow GitHub Actions to create and approve pull requests". Keep the default workflow permissions on read-only (the workflows request what they need).

## 3. Only the owner triages and merges

- Add no collaborators. Labels, closing issues and merging need write or triage access, which only you have. Everyone else can open issues and comment but cannot label or merge.
- Settings, Actions, General, "Fork pull request workflows from outside collaborators": require approval for all outside collaborators. Fork pull requests never receive secrets.
- Optional: Settings, Moderation, Interaction limits, to restrict who can comment for a period.
- The factory ignores label events from anyone but you and ignores pull requests that are not from an `agent/` branch of this repository.

## 4. Ruleset for `main`

Settings, Rules, Rulesets, New branch ruleset, target `main`, enforcement Active:

- Require a pull request before merging; require review from code owners (the file `.github/CODEOWNERS` assigns the high-risk paths to you, so only pull requests touching them need your approval).
- Require status checks: the CI job `check`, the status `agent-review`, and the Vercel preview status (use the exact name Vercel reports on a pull request).
- Require conversation resolution before merging.
- Block force pushes and deletions. Restrict direct pushes (everything goes through pull requests).
- Bypass list: only you. This is also how you merge your own pull requests, which never receive `agent-review`.
- Allow auto-merge: Settings, General, Pull Requests, "Allow auto-merge"; allow squash merging; optionally "Automatically delete head branches".

## 5. Variables and labels

Settings, Secrets and variables, Actions, Variables:

| Variable | Value | Meaning |
|---|---|---|
| `FACTORY_RUN_ENABLED` | `true` / anything else | Kill switch: the factory workflows do nothing unless it is `true` |
| `BLAST_RADIUS_ENABLED` | `false` / anything else | Switch for the blast radius rating. Set `false` (for example while the basic MVP is built) and every pull request counts as low: no `blast-radius:*` label or comment, no `needs-human-merge`, and the merge gate may enable auto-merge for all of them. Unset or any other value keeps the rating on. Set it back (or delete the variable) when the basic MVP is done |
| `RETRO_EVERY` | positive integer / `0` | The retro task runs after every Nth merged agent pull request. Unset or invalid: 10. `0`: off |
| `AUTOMERGE_ENABLED` | `true` / anything else | Phase 0 (not `true`): a human merges every pull request. Phase 1: low blast radius pull requests get auto-merge |

The workflows create the factory's labels when they are missing; their meaning is in `docs/agents/issue-tracker.md`.

**Early MVP mode, merging everything.** The variable only controls the factory. GitHub still enforces the code owner review from the ruleset for the paths in `.github/CODEOWNERS`. To let those pull requests merge without your review too, switch off "Require review from code owners" in the ruleset (or empty `.github/CODEOWNERS`) for the time being, and switch it back on when you set `BLAST_RADIUS_ENABLED` back. Together with `AUTOMERGE_ENABLED=true` a pull request then merges once CI, `agent-review` and the preview pass.

## 6. Start, pause, stop

- **Start:** label an unblocked issue `ready-for-agent`, remove `needs-human` from an issue, merge an agent pull request, or run Actions, "Factory", "Run workflow" (no input; it scans all tickets and then continues with the next ones on its own).
- **Pause:** set `FACTORY_RUN_ENABLED` to anything but `true`. A run in flight finishes its ticket, but starts no further one.
- **Stop for good:** delete the factory workflows or the secret `CLAUDE_CODE_OAUTH_TOKEN`. Starting agents by hand in a chat keeps working.
- **Phases:** start in phase 0. After about five pull requests without surprises, set `AUTOMERGE_ENABLED` to `true`.

## 7. Spending

The Claude Pro subscription has usage limits, not a money budget. Runs that use the subscription token count against those limits and fail when the limit is reached. Extra paid usage is optional and has its own monthly cap in the account's usage settings on claude.ai. With an API key instead of the subscription token, set limits per workspace in the Anthropic Console. A Pro plan can run out quickly under automation. Check the current limits and where the settings are today; they change.

## 8. Checks after a change to the workflows

The Claude action cannot be tested before a workflow is on `main` (it refuses workflow files that differ from the default branch). After merging a change, start "Factory" once and check the run:

- A denied command shows up in the comment on the issue (implement) or pull request (rework). Agents run git from the repository root, one command at a time (`CLAUDE.md`, "Software factory"); `--allowedTools` patterns must match exactly how agents formulate commands.
- The action refuses bot-started runs unless `allowed_bots` lists them (`claude,github-actions`); "Workflow initiated by non-human actor" means a name is missing.
- A review run writes a valid `review-result.json`; otherwise the status `agent-review: error` and a comment say it did not run.
- The Vercel status name matches the required check in the ruleset.
