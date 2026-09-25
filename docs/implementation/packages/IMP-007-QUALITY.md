# IMP-007 — Quality & Final Gate

## In scope
- frontend automated tests for critical flows/helpers/state confirmed by RECON
- TypeScript/build quality
- evidence-based bundle/code-splitting work
- evidence-based query/cache optimization
- final security/regression gate across accumulated IMP diffs
- documentation reconciliation

## Rule
No performance optimization without evidence. Do not perform a fresh full repository audit; compare accumulated changes against the locked baseline and approved IMPs.
