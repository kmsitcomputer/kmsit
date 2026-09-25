# IMP-001 — Architecture Hardening

## Objective
Align runtime infrastructure with the approved target without rewriting working domains.

## In scope
- Redis cache target
- Redis queue target
- queue configuration/workers as appropriate to deployment
- identify safe async workloads
- incremental Policy/Gate/permission cleanup confirmed by RECON
- tests and operational documentation

## Out of scope
Payment rewrite; controller-wide service refactor; LMS/CMS feature additions; shipping/routing/live class.

## Constraints
Preserve `/api/v1`, session/Sanctum behavior, payment contracts, transactional correctness. Do not queue synchronous decisions that must complete atomically.

## Acceptance
Redis/cache/queue configuration is production-usable for supported deployment; targeted tests pass; required regression suite passes; no Critical/High review finding.
