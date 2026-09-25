# FILE-MAP.md --- IMP-005 Replacement Section

> Replace only the existing IMP-005 section in
> `docs/implementation/FILE-MAP.md`. Do not alter IMP-001 through
> IMP-004.

## IMP-005 --- Local Delivery Routing, Google Maps Picker & OpenRoute Pricing

### Objective

Create a separate Local Delivery path: Google Maps selects destination
coordinates; OpenRoute supplies authoritative route distance; backend
applies runtime Dashboard eligibility and tariff rules. RajaOngkir
remains the independent expedition-pricing path.

### Architecture

`Google Maps Picker → coordinates → RouteManager → RouteProvider → OpenRouteProvider → actual distance → eligibility → Local Delivery pricing → final checkout revalidation`

### READ

-   AGENTS.md and required governance files
-   RECON-BASELINE.md
-   FILE-MAP.md
-   `packages/IMP-005-OPENROUTE-ROUTING.md`
-   existing order/shop/shipping/settings backend files needed for
    integration
-   existing checkout/settings/API/types frontend files
-   AppServiceProvider
-   existing provider/manager patterns only as references

### Backend CREATE/MODIFY Candidates

-   `backend/app/Contracts/RouteProvider.php`
-   `backend/app/Services/OpenRouteProvider.php`
-   `backend/app/Services/RouteManager.php`
-   small Local Delivery pricing/service class if separation is useful
-   `backend/config/route.php`
-   `backend/.env.production.example`
-   AppServiceProvider if binding is required
-   existing settings allowlist/controller/service
-   existing order/shop controller for quote/final revalidation
-   `backend/routes/api.php` only for minimum authenticated endpoints
    required
-   Order model for additive snapshot fields

### Frontend CREATE/MODIFY Candidates

Revised IMP-005 explicitly permits: - checkout page - Google Maps picker
component - API client/types - authorized Dashboard settings page -
static verification script - generated frontend build artifact refreshed
by normal build

Do not redesign unrelated UI.

### Migration

One additive migration is permitted/expected if needed for Local
Delivery order snapshot.

Potential fields: - delivery method/type - destination
latitude/longitude - route distance meters - minimal justified routing
audit fields

Prefer existing `shipping_cost` as the final authoritative amount.

Never fresh/reset/wipe/drop.

### Runtime Dashboard Settings

Resolve from persisted settings at request time: - enabled - store
name - store latitude/longitude - minimum distance km - minimum fee -
additional rate/km - maximum distance km - safe profile if
configurable - allowed area if implemented

Changes must apply without config rebuild/restart.

### Static Env/Config

Use for OpenRoute API key, base URL, connect/request timeout and safe
provider defaults. Never expose OpenRoute secret to frontend.

### Locked Pricing Contract

`actual_km = route_distance_meters / 1000`

If `actual_km <= min_km`: `cost = min_fee`

Else: `excess_km = actual_km - min_km`

Round ONLY excess with HALF-UP: - fraction \< 0.5 → down - fraction \>=
0.5 → up

`cost = min_fee + rounded_excess_km * rate_per_km`

Use integer money arithmetic.

### Maximum Distance

Maximum distance is runtime Dashboard configuration.

Eligibility uses actual OpenRoute distance before tariff rounding:
`actual_km <= maximum_distance_km`.

### Service Area

Do not hard-code Bandung Raya. If reliable existing administrative data
supports it, allowed configured area may be an additional gate.
Otherwise enforce maximum distance and escalate rather than invent
geofencing.

### Authoritative Boundary

Frontend may submit destination coordinates. Backend owns route lookup,
actual distance, maximum-distance decision, tariff settings, rounding,
shipping price and final checkout revalidation.

Ignore/recompute client-supplied distance, eligibility and Local
Delivery price.

### Tests

Create/extend tests for: - OpenRoute auth/request/coordinate order -
coordinate/profile validation -
timeout/connection/4xx/5xx/malformed/no-route - minimum-fee boundaries -
excess .49 down and .50 up - actual maximum-distance enforcement -
runtime setting changes - tampered distance/cost ignored - final
checkout revalidation - provider failure creates no Local Delivery
order - order snapshot - RajaOngkir expedition regression - digital
checkout regression - payment total regression

Use mocked HTTP.

### Frontend Verification

Run TypeScript, existing static verification, and production build. No
new frontend test framework solely for IMP-005 unless already planned.

### Do Not Expand

Do not expand into LMS, CMS, Live Class, unrelated payment internals,
RajaOngkir pricing redesign, tracking/AWB/pickup, Shipping Delivery API,
Google Directions pricing, unrelated tables, or IMP-006.

### Baseline

`233 passed / 1720 assertions`

### Definition of Done

Routing abstraction, picker, Dashboard runtime settings, locked tariff
formula, actual-distance maximum gate, final backend revalidation,
additive historical snapshot, RajaOngkir/digital/payment regressions,
provider security tests, frontend verification, no destructive
migration, no unresolved blocker, IMP-006 not started.
