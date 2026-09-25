# IMP-002 — LMS Gap Closure

## In scope
Only gaps confirmed by locked RECON: free-course enrollment; paid-enrollment integrity; published-course edit lifecycle; Course Level if confirmed missing+required; enrollment/certificate idempotency; progress/quiz completion edge cases.

## Preserve
Course→Section→Lesson, moderation, instructor ownership, quiz engine, progress, certificate, payment→enrollment.

## Out of scope
Live class (IMP-006), CMS, shipping/routing.

## Acceptance
Business rules are explicit, backend-enforced, backward compatible, and covered by targeted tests plus required regression.
