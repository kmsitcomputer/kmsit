# AGENTS.md — KMSIT LMS + CMS + E-Commerce

## Purpose
This file is the single entry point for AI coding agents working on this existing project.

## Baseline
- React 18 + TypeScript frontend (preserve existing UI unless scope requires change)
- Laravel 13 backend
- MySQL 8
- REST API `/api/v1`
- Single-domain deployment
- Modular monolith
- Redis is the target cache/queue infrastructure
- Existing LMS + CMS + Commerce
- Existing Tripay/Xendit/Stripe payment abstraction

## Authority order
1. Human instruction / approved implementation package
2. `AGENTS.md`
3. `docs/governance/*`
4. `docs/architecture/*`
5. Locked `docs/implementation/RECON-BASELINE.md` and `FILE-MAP.md`
6. Current implementation package under `docs/implementation/packages/`
7. Existing README/blueprint/architecture documentation
8. Existing source behavior, when not conflicting with an approved rule

If sources conflict, do not silently choose. Record the conflict and follow the higher authority.

## Mandatory execution protocol
`RECON ONCE → IMPLEMENT BY FILE MAP → TARGETED TEST → REVIEW BY DIFF → REMEDIATE BY FINDING → VERIFY → CLOSE`

After RECON is locked, do not perform another repository-wide audit unless concrete evidence proves the baseline materially wrong.

## Agent roles
- Qwen 3.7 Flash: one-time reconnaissance and file map.
- Muse Contributor 1.3: primary implementation and targeted remediation.
- DeepSeek V4.1 Flash: evidence-based diff review and finding verification.
- Claude: architecture/business-rule escalation when ambiguity remains.
- Codex: engineering escalation for complex cross-file implementation, stubborn failures, migrations, or security-sensitive remediation.

Claude/Codex are optional escalation lanes, not mandatory passes for every package.

## Mandatory reading
Before work, read only the minimum relevant documents:
- `docs/governance/AI-IMPLEMENTATION-RULES.md`
- `docs/governance/NO-LOOP-POLICY.md`
- `docs/governance/TESTING-GATE.md`
- the active IMP specification
- locked RECON/FILE-MAP after Stage 0

Do not load the whole repository into context by default.

## Hard prohibitions
- No unnecessary rewrite.
- No repeated SQL/log/test command without diagnosis or changed evidence.
- No accidental `/api/v1` contract break.
- No trusting frontend for authorization, payment status, price, shipping fee, or privileged state.
- No direct provider coupling when an approved provider abstraction exists.
- No unrelated refactoring inside an IMP.
- No declaring completion with unresolved Critical/High findings.
