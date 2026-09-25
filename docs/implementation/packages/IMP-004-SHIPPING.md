# IMP-004 — RajaOngkir Shipping

## Target
`ShippingService → ShippingProviderInterface → RajaOngkirProvider`

## Requirements
Destination lookup, courier/service lookup, server-side shipping calculation, shipping snapshot in order, physical/mixed-order rules confirmed by RECON, no shipping for purely digital orders, timeout/provider-error handling, secure credentials, mocked tests.

## Prohibitions
No RajaOngkir HTTP logic directly in OrderController. Never trust frontend shipping amount. Preserve stock/voucher reservation, order TTL, payment and digital delivery.
