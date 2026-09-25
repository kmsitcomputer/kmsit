# BUSINESS FLOWS

## LMS course lifecycle
`Instructor → Draft → build curriculum → Submit → Pending → Admin moderation → Published or Rejected → revision/resubmit`.

Material edits to already-published courses require an explicit lifecycle rule in IMP-002; do not invent behavior before RECON confirms current implementation.

## Free course
Target: `Student → free course → backend eligibility → Enrollment → active course access`. Do not create fake zero-value payment solely to grant enrollment.

## Paid course
`Student → Order → Payment → provider → verified webhook → idempotency → Paid → Enrollment → access → earnings/notification/audit as applicable`.

## Learning
`Active enrollment → lessons → lesson progress → required quiz → server-side scoring → completion eligibility → certificate`. Certificate issuance must be idempotent.

## CMS
Baseline: `Create/Edit → Draft → Preview → Publish → Public API → React`. RECON must identify which CMS resources currently support this. Editorial approval/version history are not assumed unless approved.

## Commerce physical
Target: `Cart → destination → shipping provider → courier/service/cost → order snapshot → payment → stock confirmation → fulfillment`.

## Commerce digital
`Cart/Order → verified payment → DigitalDelivery → license/download → active/revoked controls`.

## Instructor finance
`Paid eligible order → auditable ledger → available balance → withdrawal request → admin processing → completed/rejected`.
