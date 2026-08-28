# CAP Delivery 6.4 — Security & Premium hardening

Branch: `dev-cap-v64-security-premium`

Production remains on the frozen 6.4 snapshot until this branch passes isolated validation.

## Data ownership / minimization

- Driver-app telemetry (temperature, odometer, delivery evidence) is external read-only evidence and is not manually duplicated in CAP.
- Zucchetti remains the HR source of truth; CAP consumes operational status, not a duplicate HR dossier.
- Planning imports retain only fields required by CAP's operating model.
- Operational datasets must not be cached in persistent browser storage.
- Sensitive fields are rendered only where operationally necessary.

## Security controls targeted by this hardening

1. remove operational data snapshots from browser storage;
2. keep queued writes disabled across reloads;
3. upgrade SheetJS to the current authoritative browser build and reduce parser attack surface;
4. add an explicit privacy/trust state in the UI;
5. distinguish live authenticated data from unavailable/stale data;
6. preserve role-based write controls and avoid exposing admin surfaces to non-admins;
7. validate the whole upgrade twice before production promotion.

## Premium UX principles

- decision-first hierarchy, not developer-first diagnostics;
- clear trust/source badges;
- high-contrast critical states without visual noise;
- touch targets and safe-area handling for iOS/Android;
- concise operational language;
- no decorative metric that cannot be backed by a real source.
