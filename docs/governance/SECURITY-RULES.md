# SECURITY RULES

1. Backend is the authorization source of truth; frontend visibility is not security.
2. Prefer Policies/Gates/permissions and ownership checks; migrate manual role checks incrementally where RECON identifies them.
3. Validate client input server-side.
4. Never trust frontend price, payment status, gateway selection, shipping amount, enrollment eligibility, or privileged state.
5. Payment webhooks require provider verification/signature and idempotency.
6. Preserve order/payment separation and transaction integrity.
7. Secrets stay in environment/server configuration; never expose private keys through editable settings APIs or Git.
8. Rich content must remain sanitized against unsafe scripts/event handlers.
9. Preserve CSRF protection for cookie-authenticated mutations and session revocation behavior.
10. Security fixes may expand scope only when a concrete Critical/High issue proves it necessary; document why.
