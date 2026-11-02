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
| `FACTORY_ENABLED` | `true` / anything else | Kill switch: every factory job does nothing unless it is `true` |
| `BLAST_RADIUS_ENABLED` | `false` / anything else | Switch for the blast radius rating. Set `false` (for example while the basic MVP is built) and every pull request counts as low: no `blast-radius:*` label or comment, no `needs-human-merge`, and the merge gate may enable auto-merge for all of them. Unset or any other value keeps the rating on. Set it back (or delete the variable) when the basic MVP is done |
| `RETRO_EVERY` | positive integer / `0` | The retro task runs after every Nth merged agent pull request. Unset or invalid: 10. `0`: off |
| `AUTOMERGE_ENABLED` | `true` / anything else | Phase 0 (not `true`): a human merges every pull request. Phase 1: low blast radius pull requests get auto-merge |

The workflows create these labels when they are missing (also `factory-health`, for the issue "Factory health log" that the revive job writes to): `agent-working`, `needs-human`, `needs-human-merge`, `blast-radius:low`, `blast-radius:high`, `high-risk`.

**Early MVP mode, merging everything.** The variable only controls the factory. GitHub still enforces the code owner review from the ruleset for the paths in `.github/CODEOWNERS`. To let those pull requests merge without your review too, switch off "Require review from code owners" in the ruleset (or empty `.github/CODEOWNERS`) for the time being, and switch it back on when you set `BLAST_RADIUS_ENABLED` back. Together with `AUTOMERGE_ENABLED=true` a pull request then merges once CI, `agent-review` and the preview pass.

## 6. Start, pause, stop

- **Start:** label an unblocked issue `ready-for-agent`, or run Actions, "Factory implement", "Run workflow" with the issue number. To run the pipeline again for a pull request: Actions, "Factory pull request", "Run workflow", pull request number.
- **Pause:** set `FACTORY_ENABLED` to anything but `true`. Runs already in flight finish.
- **Stop for good:** delete the factory workflows or the secret `CLAUDE_CODE_OAUTH_TOKEN`. Starting agents by hand in a chat keeps working.
- **Phases:** start in phase 0. After about five pull requests without surprises, set `AUTOMERGE_ENABLED` to `true`.

## 7. Spending

The Claude Pro subscription has usage limits, not a money budget. Runs that use the subscription token count against those limits and fail when the limit is reached. Extra paid usage is optional and has its own monthly cap in the account's usage settings on claude.ai. With an API key instead of the subscription token, set limits per workspace in the Anthropic Console. A Pro plan can run out quickly under automation. Check the current limits and where the settings are today; they change.

## 8. First run checklist

These could not be tested without real runs; verify them on the first runs and fix the workflows if needed:

- The action accepts the `prompt` input and the options in `claude_args` (`--model`, `--effort medium`, `--max-turns`, `--allowedTools`), and the Actions copy of Claude Code knows `--effort`. Effort levels of the CLI: low, medium, high, xhigh, max.
- The agent runs git from the repository root. `git -C <path> …`, chained commands and heredoc scripts do not match the tool patterns and are denied (a run for #10 lost its work because its push used `git -C`); the prompts say so. If a run ends without a pull request, the comment on the issue lists the denied commands.
- The `--allowedTools` patterns match the commands the agent needs (a denied command shows up in the run log); the pattern `git push -u origin agent/*` accepts the agent's branch.
- Pull requests and pushes made by the agent start the CI and pipeline workflows. The implement run uses the Claude GitHub App token via the action; if events do not start, the workflows' manual start still works.
- The Claude action refuses to run when the workflow was started by a bot (for example the pull request that the agent opened itself); the workflows list `claude` and `github-actions` in `allowed_bots`, nothing else. If a run fails with "Workflow initiated by non-human actor", a bot name is missing there.
- After a rework, a passing review resolves the bot's fixed threads (with a reply that gives the reason) and collapses its earlier failed reviews. These are GraphQL calls with the workflow token and could not be tested outside Actions; check the run log of the review job for "Resolved thread" or "Could not tidy review threads".
- The review run writes a valid `review-result.json`. A pull request that changes a factory workflow, or a branch that is behind `main` in its workflow files, gets `agent-review: error` ("did not run"), because the Claude action refuses to run when the workflow differs from the default branch; update the branch with `main` and run the pipeline again.
- The retro task: after the first N merged agent pull requests (or "Factory retro", "Run workflow"), the run either opens a pull request `agent/retro-<n>` with changes tied to the pull requests that motivated them, or comments on the latest pull request that it found no repeated pattern. A change to a workflow prompt must arrive as text in the pull request body, because the agent cannot push workflow files.
- The Vercel status name matches the required check in the ruleset.
- After the first merge, closing the issue starts the next unblocked ticket.

## Single-run factory (`factory.yml`)

`factory.yml` takes one ticket from start to end in one workflow run (implement, review, rework once, merge gate, wait for auto-merge, close the issue) and then starts itself for the next ticket. It needs no timers and hands nothing over between workflows. It is started by the owner: label `ready-for-agent` set, label `needs-human` removed, an agent pull request merged, or "Run workflow" by hand (scans all tickets).

To switch from the older workflows to this one: set the repository variable `FACTORY_RUN_ENABLED` to `true` and `FACTORY_ENABLED` to `false` (both at once would run two pipelines). The retro workflow runs with either variable. The review and rework steps are composite actions in `.github/actions`, referenced from `main`.
