# Simultaneous Planning and Resolution

Each round has a fixed planning timer with early commit. Both squads commit their commands simultaneously; neither squad can see the other’s final commands before committing.

After commitment, the game deterministically resolves all committed actions simultaneously. A Hero that becomes exhausted during resolution still completes its already committed action; Exhaustion takes effect after resolution.

Simultaneous, hidden planning prevents last-second reactions and makes commitment meaningful; deterministic resolution keeps matches reproducible and testable.
