# START HERE

1. Copy this package into the project root.
2. Commit the governance documents before implementation changes.
3. Run Stage 0 with Qwen 3.7 Flash exactly once to populate `RECON-BASELINE.md` and `FILE-MAP.md`.
4. Human reviews/locks RECON.
5. Execute IMP packages sequentially unless dependencies justify another order.
6. Muse implements; DeepSeek reviews diff; Claude/Codex are escalation lanes.
7. Never repeat full recon after lock.

## Minimal Qwen Stage-0 prompt
Read `AGENTS.md`, `docs/governance/*`, `docs/architecture/*`, existing README/blueprint/architecture/integrations docs, source structure, routes, migrations/config, and tests. Perform ONE repository recon. Populate `docs/implementation/RECON-BASELINE.md` and `FILE-MAP.md` with evidence-backed actual state. Do not implement. Do not loop SQL/log commands. Mark `RECON_STATUS=LOCKED` only after the baseline is complete, then STOP.

## Minimal Muse prompt
Read `AGENTS.md`, the locked RECON/FILE-MAP, and the active IMP. Implement only that IMP using minimum sufficient context. Run targeted tests then required regression. Follow NO-LOOP policy. Return changed files/tests/results/risks and STOP.

## Minimal DeepSeek prompt
Review the active IMP implementation using the IMP, git diff, and test evidence. Do not re-audit the repository. Return evidence-backed CRITICAL/HIGH/MEDIUM/LOW findings with file, impact, and exact remediation; or `VERDICT=PASS`. STOP.

## Escalation
Claude: architecture/business ambiguity. Codex: difficult engineering/cross-file/security-sensitive remediation. Supply only the escalation package defined in governance.
