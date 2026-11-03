# Coding standards (read by the reviewer)

The review agent judges every pull request against this file, `CLAUDE.md`, the ADRs, `GLOSSARY.md` and the specs. This file holds only **judgement calls**. Anything a program can check belongs in code instead (lint, types, tests, CI), because a check is deterministic and an agent's verdict is not. The implementing agent is not required to read this file.

## Tests

- **A test asserts what its name claims.** The name, the setup and the assertions describe the same behaviour. A determinism test replays real inputs (not empty ones) and compares the full result; a test called "stays valid when re-checked" re-checks what it says. A weak or off-name test is a **fail**, not a remark.
- **An existing assertion is only loosened or removed with a reason.** The pull request must say why the rule the assertion checked was wrong. Loosening an assertion to turn a failing test green is a **defect to report**: in #138 a fairness assertion was loosened and a real AI freeze (#147) hid behind it.
- **Test through the public interface** (for the simulation: the Match Simulation seam), not internals (`CLAUDE.md`, step 5).

Not here, because lint enforces them: `console.log` and `.only`/`.skip` in tests (`eslint.config.js`).
