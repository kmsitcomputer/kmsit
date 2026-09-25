# IMP-005 — OpenRoute Routing

## Target
`RouteService → RouteProviderInterface → OpenRouteProvider`

## Scope
Only confirmed routing/location needs: coordinates, distance, route calculation. Keep courier pricing/shipping out of this service.

## Quality
Secure credentials, timeout/error handling, invalid-coordinate handling, malformed-response handling, provider/service tests with mocks.
