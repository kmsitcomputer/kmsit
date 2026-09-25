# AI IMPLEMENTATION RULES — LMS + CMS + E-COMMERCE

## Mode
Work on an EXISTING production-oriented project. This is not greenfield. Do not rewrite working architecture without proven necessity.

Current baseline: React 18 + TypeScript; Laravel 13; MySQL 8; REST `/api/v1`; single domain; modular monolith; existing backend tests; LMS + CMS + Commerce; Tripay/Xendit/Stripe abstraction. Redis is the target cache/queue infrastructure.

## Absolute workflow
`RECON ONCE → IMPLEMENT BY FILE MAP → TEST → REVIEW BY DIFF → REMEDIATE BY FINDING → TEST → CLOSE`

Never repeatedly rediscover the repository. Repository-wide audit is performed once.

## Context budget
- Recon: repository + authoritative docs, once.
- Implementation: IMP + file map + relevant files + relevant tests.
- Review: IMP + git diff + test evidence.
- Remediation: finding + affected files + relevant test.
- Escalation: problem statement + evidence + smallest relevant code slice.

## Change rule
Before changing code identify: affected contract, files, tests, compatibility risk. Make the smallest safe change. Do not refactor unrelated code. Do not rename public API contracts without necessity.

## Failure budget
For the same root problem, maximum normal remediation cycles: 2 genuine fixes. If still unresolved, stop blind trial-and-error and prepare an escalation package for Claude or Codex.

## Escalation package
Include objective, expected/actual behavior, architecture/business rule, affected files, relevant diff, failing test/error, commands already attempted, diagnosis performed, and remaining hypotheses. Do not send the full repository unless demonstrably necessary.

## Definition of Done
An IMP is complete only when specification is satisfied, targeted tests pass, required regression tests pass, TypeScript/build checks pass when affected, no unresolved Critical/High finding remains, relevant docs are updated, and git diff has no unrelated changes. Then stop; do not perform another general audit.
