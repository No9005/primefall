# Coding standards (read by the reviewer)

The review agent judges every pull request against this file, `CLAUDE.md`, the ADRs, `GLOSSARY.md` and the specs. It holds the judgement calls that no check can enforce; anything mechanical belongs in lint, types or CI instead. The implementing agent is not required to read it.

## Tests

- **A test asserts what its name claims.** The name, the setup and the assertions describe the same behaviour. A determinism test replays real inputs (not empty ones) and compares the full result; a test called "stays valid when re-checked" re-checks what it says. A weak or off-name test is a **fail**, not a remark.
- **No leftover scratch work.** Debug tests, placeholder tests, `console.log`, `.only` and `.skip` do not stay in the diff. If one is there it is a **fail**.
- **Test through the public interface** (for the simulation: the Match Simulation seam), not internals (`CLAUDE.md`, step 5).
