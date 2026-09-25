# IMP-006 — Live Class

## Target
`LiveClassService → LiveClassProviderInterface → ZoomProvider | GoogleMeetProvider`

## Rules
LMS domain must not depend on provider-specific payloads. Separate internal live-class data from provider identifiers. Implement only confirmed lifecycle requirements (create/join/start/end/update/cancel as approved). Enforce authorization/ownership. Secure credentials. Mock external providers in tests.
