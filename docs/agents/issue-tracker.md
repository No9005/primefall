# Issue tracker: GitHub

Issues and specs live as GitHub issues in `No9005/primefall`. Use `gh` or the `mcp__github__*` tools; file issues only into this repository.

## Cloud sessions

In Claude Code cloud sessions `gh` is 2.89 and GitHub GraphQL is blocked, so `gh issue create --blocked-by`, `--parent`, `--add-sub-issue` and `gh repo view` do not work. Use the REST API (`gh api repos/No9005/primefall/...`) or the MCP tools.

## Operations

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies), or `gh api -X POST repos/No9005/primefall/issues -f title=... -f body=... -f 'labels[]=ready-for-agent'`.
- **Read**: `gh issue view <n> --json number,title,body,labels,comments`.
- **List**: `gh issue list --state open --json number,title,body,labels,comments` with `--label` / `--state` filters.
- **Comment / label / close**: `gh issue comment <n> --body "..."`, `gh issue edit <n> --add-label "..." / --remove-label "..."`, then `gh issue close <n>`. Post the explanation before closing; on an already closed issue the comment of `gh issue close --comment` is dropped.
- **Blocking** uses GitHub's native issue dependencies. Add an edge with the database id of the blocker (`gh api repos/No9005/primefall/issues/<n> --jq .id`, not the number): `gh api -X POST repos/No9005/primefall/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. A ticket is startable when every blocker is closed.
- **Count open blockers**: `gh api repos/No9005/primefall/issues/<n> --jq .issue_dependencies_summary.blocked_by` (0 means startable).
- **Sub-issue**: `gh api -X POST repos/No9005/primefall/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`. Without sub-issues, put `Part of #<parent>` at the top of the child body.

Pull requests are not a request surface (external PRs are not triaged as feature requests).

## When a skill says "publish to the issue tracker"

Create a GitHub issue. "Fetch the relevant ticket" means read it as above.

## Factory labels

Set by the software factory (`docs/agents/software-factory.md`); the owner sets `ready-for-agent` and `high-risk`.

| Label | Meaning |
|---|---|
| `agent-working` | An implement run is working on the issue |
| `needs-human` | On a pull request: the automated review failed twice. On an issue: an implement run ended without a pull request. No further automatic runs until the owner acts (on an issue: remove the label to retry) |
| `needs-human-merge` | High blast radius pull request waiting for the owner to review and merge |
| `blast-radius:low`, `blast-radius:high` | Class of a pull request |
| `high-risk` | Owner marks a ticket or pull request as high blast radius |
