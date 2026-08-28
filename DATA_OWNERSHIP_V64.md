# CAP Delivery 6.4 — Data ownership

CAP is the operational control layer for the Transit Point. It must not force duplicate data entry when another system is already the authoritative source.

## Source ownership

- Zucchetti HR: official HR data such as attendance, absence, leave and formal workforce records. CAP may record verification/freshness but does not replace HR.
- Excel / weekly planning: route planning, staffing plan and future operational schedule when supplied by the office. CAP stages, validates and imports it.
- CAP Delivery: live TP exceptions, uncovered routes, substitutions, vehicle issues, handover, shift closure, audit trail, fairness/workload and operational decisions.
- Driver delivery application: execution-of-delivery telemetry and driver-entered trip evidence. In particular temperature and vehicle odometer/km at departure and return are external evidence and must not be requested a second time in CAP.

## Driver-app telemetry rule

Fields such as:
- departure temperature
- return temperature
- departure odometer/km
- return odometer/km
- delivery completion/progress data

are EXTERNAL_READ_ONLY in CAP unless an authorised import/API is available. CAP may display last sync, source and anomalies, but must not invent or duplicate these values.

## Fail-closed rule

Missing external data is displayed as DATA GAP / NOT SYNCED, never as OK, zero or inferred availability.
