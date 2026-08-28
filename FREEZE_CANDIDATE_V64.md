# CAP Delivery 6.4 — Freeze Candidate

Validated on 2026-08-28.

Core boundaries:
- Zucchetti HR remains HR source.
- Excel/planning feeds staging + 7-day planning horizon.
- CAP owns Transit Point operational exceptions, audit, handover, shift closure and fairness.
- Driver application remains authoritative for delivery execution telemetry; departure/return temperature and odometer/km are external/read-only in CAP.
- Missing data is never inferred as OK.

Production promotion requires branch validation, main regression pass A+B, syntax/contract checks and Pages/backend publication success.
