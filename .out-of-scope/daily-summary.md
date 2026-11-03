# Daily summary by a timer

This project does not send a regular summary (for example every evening: what happened, what is open for the owner) that is started by a timer.

## Why this is out of scope

A summary at a fixed time needs something that starts by itself at that time. We tried timers for the software factory and dropped them:

- GitHub does not start scheduled workflows reliably (they are delayed, skipped under load, and switched off in quiet repositories).
- Events caused by the workflow's own token start no further workflows, so a chain that relies on one run triggering the next can stall at every hand-over.
- A job that exists only to wake the pipeline is one more thing to watch, which is the opposite of what the owner needs.

The thing a summary should give, the current list of what depends on the owner, is better served by a page that is always up to date: the owner dashboard (#176), fed by the labels `needs-human-merge` and `needs-human` and, later, the owner brief of each pull request (#179). A summary on top would repeat what the dashboard shows and cost a timer.

See `docs/process/status.md`, section "Tried and dropped" (timers and an event chain of several workflows).

## Prior requests

- #174: "Owner workflow", idea 5 (a daily summary at a fixed time)
