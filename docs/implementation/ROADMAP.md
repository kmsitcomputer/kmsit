# IMPLEMENTATION ROADMAP

## Stage 0 — RECON ONCE
Owner: Qwen 3.7 Flash
Outputs: `RECON-BASELINE.md`, `FILE-MAP.md`. Then lock recon.

## IMP packages
1. IMP-001 — Architecture Hardening: Redis/cache/queue + targeted RBAC cleanup.
2. IMP-002 — LMS Gap Closure: free enrollment, published-course lifecycle, Course Level verification, idempotency/edge cases.
3. IMP-003 — CMS Gap Closure: reconcile baseline CMS features; safe draft/preview/publish; avoid duplicate content systems.
4. IMP-004 — Shipping: RajaOngkir provider abstraction and server-side shipping snapshot.
5. IMP-005 — Routing: OpenRoute provider abstraction, separate from shipping.
6. IMP-006 — Live Class: Zoom + Google Meet behind provider abstraction.
7. IMP-007 — Quality: frontend automated tests, evidence-based performance improvements, final regression/documentation reconciliation.

## Standard package loop
Muse implement → targeted tests → DeepSeek diff review → Muse remediation by finding if needed → tests → DeepSeek finding verification → close.

Claude/Codex enter only through escalation when useful.
