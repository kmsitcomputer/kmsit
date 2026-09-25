# IMP-005 --- Local Delivery Routing, Google Maps Picker & OpenRoute Pricing

## Status

SCOPE REVISED / LOCKED FOR IMPLEMENTATION

## Target

Implement local delivery as a separate path:

`Google Maps Picker → customer coordinates → RouteManager → RouteProvider → OpenRouteProvider → authoritative route distance → eligibility → authoritative local-delivery price`

RajaOngkir remains the expedition-pricing path. OpenRoute MUST NOT
replace RajaOngkir pricing.

## In Scope

-   RouteProvider abstraction, OpenRouteProvider, RouteManager.
-   Google Maps picker for Local Delivery checkout.
-   Store coordinates configured from authorized Dashboard.
-   Runtime settings: enabled, minimum distance, minimum fee, rate/km,
    maximum distance, routing profile if exposed, and allowed service
    area if implemented.
-   Backend-authoritative routing, eligibility and price calculation.
-   Final checkout revalidation.
-   Additive order snapshot migration where required.
-   Dashboard and checkout UI needed for this flow.
-   Provider/pricing/security/regression tests.

## Out of Scope

-   Replacing RajaOngkir or changing its expedition pricing.
-   Frontend-authoritative distance/price.
-   Google Directions as pricing authority.
-   Tracking, AWB, pickup booking, Shipping Delivery API.
-   Hard-coded Bandung Raya or hard-coded maximum distance.

## Delivery Methods

Physical checkout may expose: 1. Expedition --- existing RajaOngkir
flow. 2. Local Delivery --- Google Maps destination coordinates,
OpenRoute route distance, backend eligibility and pricing.

Digital-only checkout remains shipping-free.

## Runtime Dashboard Settings

Persist and resolve at request time: - `local_delivery_enabled` -
`local_delivery_store_name` - `local_delivery_store_latitude` -
`local_delivery_store_longitude` -
`local_delivery_minimum_distance_km` - `local_delivery_minimum_fee` -
`local_delivery_rate_per_km` - `local_delivery_maximum_distance_km` -
safe routing profile if admin-configurable - allowed service areas if
implemented

Changes must apply to subsequent requests without `config:clear`,
`config:cache`, restart, or source changes.

Provider key/base URL/timeouts remain static env/config. Do not query DB
while config files are loaded.

## Google Maps Picker

Dashboard may use a picker for store coordinates. Checkout Local
Delivery uses a picker for customer destination.

Store and destination latitude/longitude are routing inputs. Textual
shipping address remains part of the order.

Frontend distance, eligibility, maximum distance and shipping price are
never authoritative.

## Coordinate Validation

Backend validates finite numeric latitude/longitude: - latitude:
-90..90 - longitude: -180..180

Never clamp or silently swap coordinates. Verify OpenRoute coordinate
ordering from official provider documentation.

## Routing Architecture

`RouteManager → RouteProvider → OpenRouteProvider`

Normalized application result: - `distance_meters` - `duration_seconds`
where used - geometry only if an actual consumer requires it

OpenRouteProvider must not contain local-delivery tariff logic.

## Maximum Distance

`local_delivery_maximum_distance_km` is a Dashboard runtime setting.

Eligibility uses ACTUAL OpenRoute distance before tariff rounding.

Example: maximum 30 km, actual 30.10 km → Local Delivery unavailable.

## LOCKED PRICING RULE

Dashboard configures: - minimum distance (`min_km`) - minimum fee
(`min_fee`) - additional tariff/km (`rate`) - maximum distance

Let `actual_km = route_distance_meters / 1000`.

If `actual_km <= min_km`: `cost = min_fee`

If `actual_km > min_km`: `excess_km = actual_km - min_km`

Round ONLY `excess_km` to a whole kilometer using HALF-UP: - fractional
part \< 0.5 → down - fractional part \>= 0.5 → up

Then: `cost = min_fee + (rounded_excess_km × rate)`

Use integer money arithmetic.

Example with min 3 km, minimum fee Rp10.000, rate Rp2.500/km:

     Actual   Excess   Rounded excess       Cost
  --------- -------- ---------------- ----------
    1.80 km      ---              ---   Rp10.000
    3.00 km      ---              ---   Rp10.000
    3.20 km     0.20                0   Rp10.000
    3.49 km     0.49                0   Rp10.000
    3.50 km     0.50                1   Rp12.500
    4.20 km     1.20                1   Rp12.500
    4.50 km     1.50                2   Rp15.000
    8.40 km     5.40                5   Rp22.500
    8.50 km     5.50                6   Rp25.000

Maximum-distance validation always uses actual distance, not rounded
excess.

## Service Area

Do not hard-code Bandung Raya as an immutable constant.

Where current data supports reliable administrative-area validation,
availability may require:
`allowed configured area AND actual route distance <= configured maximum`.

If reliable area validation would require speculative geofencing/new
dependencies, enforce maximum distance and escalate the area-gate detail
rather than inventing unreliable logic.

## Final Checkout Revalidation

Backend must recalculate/revalidate Local Delivery when creating the
order.

Never trust client-provided distance, rounded distance, eligibility,
tariff, or shipping cost.

Provider unavailable/timeout/no-route/malformed response/over-maximum
must fail safely and must not create a guessed or Rp0 Local Delivery
order.

## Order Snapshot

Use an additive migration for the minimum historical snapshot required
by the existing order model, such as: - delivery method/type -
destination latitude/longitude - route distance meters - minimal routing
audit fields if justified

Prefer the existing authoritative `shipping_cost` for the final shipping
amount rather than creating competing total fields.

No destructive migration and no `migrate:fresh`.

## OpenRoute Quality

-   backend-only key
-   Laravel HTTP client
-   bounded connect/request timeout
-   safe profile allowlist
-   coordinate validation
-   4xx/5xx/timeout/connection handling
-   malformed/no-route handling
-   normalized units
-   secret-safe errors
-   mocked tests; no live dependency

## Security Boundary

Google Maps selects location. OpenRoute computes route distance. Backend
decides eligibility and price.

The browser cannot override distance, maximum distance, minimum fee,
rate/km, eligibility or shipping cost.

## Regression Boundaries

Preserve IMP-004 RajaOngkir, digital checkout, mixed-cart behavior,
server-authoritative totals, payment total behavior, CMS and LMS.

## Acceptance Tests

Routing: - request/auth/coordinate order - coordinate validation -
profile allowlist - timeout/connection/4xx/5xx - malformed/no-route -
normalized distance/duration

Pricing: - below/exact minimum → minimum fee - excess .20/.49 → down -
excess .50/.80 → up - deterministic integer money

Maximum: - \<= maximum eligible - \> maximum ineligible even by
fraction - actual distance controls eligibility - runtime setting
changes work without config rebuild

Checkout/security: - tampered distance/cost/eligibility ignored - final
checkout revalidates - provider failure/over-maximum creates no Local
Delivery order

Snapshot: - coordinates and actual route distance preserved -
authoritative shipping cost preserved - later setting changes do not
mutate history

Regression: - RajaOngkir expedition works - digital checkout works -
payment total includes authoritative chosen delivery cost

## Baseline

Pre-IMP-005 backend regression baseline: `233 passed / 1720 assertions`.

## Definition of Done

All revised scope above is implemented and tested; frontend
type/static/build verification passes; no destructive migration; no
unresolved blocking finding; IMP-006 not started.
