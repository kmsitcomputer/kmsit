# CHANGE CONTROL

## Incremental-first
Prefer correction and extension over rewrite. Existing working LMS, CMS, Commerce, payment, reservation, certificate, and RBAC behavior must not be replaced merely for stylistic consistency.

## Scope control
Every implementation is an IMP package with: objective, in-scope, out-of-scope, dependencies, allowed/likely files from FILE-MAP, contracts, acceptance criteria, tests, risks, and DoD.

## Compatibility
Preserve `/api/v1` contracts unless an approved IMP explicitly changes them. Breaking changes require explicit human approval and versioning analysis.

## Documentation
When behavior/contract/architecture changes, update the relevant authoritative document in the same IMP. Do not rewrite historical findings to hide prior state.

## New features
Features not supported by locked requirements are `NEEDS_DECISION`; agents must not implement them opportunistically.
