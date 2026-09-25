# INTEGRATIONS — TARGET AND KNOWN BASELINE

RECON is authoritative for current source status. Prior project documentation indicated:
- Tripay: implemented
- Xendit: implemented
- Stripe: implemented
- YouTube embed: implemented
- Zoom: configuration-only / runtime missing
- Google Meet: configuration-only / runtime missing
- RajaOngkir: missing
- OpenRoute: missing
- Redis: target not yet fully realized

## Rules
1. Never trust provider choice/amount from frontend when server settings/business rules own the decision.
2. External HTTP details belong behind provider/service boundaries.
3. Use timeouts, safe error mapping, secure credentials, and mocked tests.
4. Provider outages must not corrupt local transactional state.
5. RajaOngkir shipping and OpenRoute routing are separate concerns.
