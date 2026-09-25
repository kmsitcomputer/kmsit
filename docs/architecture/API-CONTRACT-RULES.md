# API CONTRACT RULES

- Public application API remains under `/api/v1/`.
- Do not change existing response shapes/status semantics accidentally.
- Breaking changes require explicit approval and versioning analysis.
- Validate all mutations server-side.
- Authentication may use existing same-origin cookie/session behavior with Sanctum/bearer support as implemented; do not replace it without an approved requirement.
- Authorization and ownership are enforced on the backend.
- Pagination and error formats should follow existing contracts discovered by RECON.
