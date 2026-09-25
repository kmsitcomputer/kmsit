# TESTING GATE

## Existing safety baseline
Preserve the existing backend regression suite. The source documentation previously reported 214 PHPUnit tests / 42 files; RECON must verify the current count rather than hard-code it as permanent truth.

## Per-change order
1. Run the smallest relevant targeted tests.
2. Diagnose failures; never loop unchanged commands.
3. When targeted tests pass, run the broader suite required by scope.
4. If frontend changed: TypeScript check and relevant frontend automated/static checks.
5. If production frontend assets changed: production build.
6. Review git diff for unrelated changes.

## Critical flows requiring strong coverage
- authentication/authorization/ownership
- free enrollment
- paid enrollment
- payment initiation/webhook/idempotency
- order fulfillment
- stock/voucher reservation and expiry
- quiz scoring/completion
- certificate eligibility/idempotency
- shipping calculations when introduced
- route provider boundary when introduced
- live-class provider boundary when introduced

## Review gate
DeepSeek reviews by diff. Findings require evidence, file, impact, and exact remediation. After remediation, verify only the prior findings plus tests affected; do not restart a full audit.
