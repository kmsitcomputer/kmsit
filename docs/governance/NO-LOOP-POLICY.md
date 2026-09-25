# NO-LOOP POLICY

## Principle
A command is evidence, not a loop mechanism. Never repeat the same command hoping its result changes.

Applies especially to SQL, grep/find, tail/logs, migrations, tests, curl, database inspection, git commands, API calls, and build commands.

## Unexpected empty/zero result
If a command returns empty output, 0 rows, unexpected NULL, no matching log, no evidence, command failure, or unexpected schema/data:
1. STOP repeating it.
2. Diagnose the smallest relevant scope: environment → connection → database → schema/table/column → migration state → expected data → configuration → relevant code path.
3. Fix the root cause if safe and in scope, or document the blocking cause.
4. Verify once with a meaningful changed condition/evidence.
5. Continue.

## SQL rule
If SQL unexpectedly returns 0 rows, do not rerun unchanged. Confirm DB/environment/schema/data and application assumptions. Never fabricate production-like data merely to make a query pass; test fixtures are allowed only when explicitly appropriate.

## Log rule
Do not use endless `tail -f` or repeated `tail -n`. Verify correct file/environment/channel, reproduce the relevant action once if safe, inspect the new evidence, then proceed.

## Test rule
`FAIL → diagnose → change/fix → rerun`. Re-running an unchanged failing test without new evidence is prohibited.
