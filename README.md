# DentSync

DentSync is a responsive, browser-based dental clinic management prototype. The
current app is a client-side implementation using HTML, CSS, and vanilla
JavaScript. It stores records in the browser so the main workflows can be
exercised without a backend.

> **Prototype only:** Do not enter real patient information. Browser storage is
> not encrypted, backed up, or protected by server-side access controls.

## Run locally

From the repository root, start a static file server:

```powershell
py -m http.server 8000 --directory src
```

Open <http://localhost:8000>. If `py` is unavailable, use
`python -m http.server 8000 --directory src`. Localhost enables the Web Crypto
API used for password hashing and the service worker used to cache the app
shell. Opening `src/index.html` directly does not enable service workers.

There are no package-install or build steps at present.

## Local test accounts

Each new browser profile creates these accounts. Select the matching role on
the login screen.

| Role | Email | Password |
|---|---|---|
| Dentist / Owner | `owner@dentsync.local` | `DentSyncOwner!2026` |
| Business Partner / Secretary | `secretary@dentsync.local` | `DentSyncSecretary!2026` |
| Dental Assistant | `assistant@dentsync.local` | `DentSyncAssistant!2026` |

These are public test credentials, also present in the client-side source. They
are not suitable for real accounts. Owners can create local users and reset
their passwords in Settings. Forgot-password help instructs users to contact
the clinic owner; no email reset is sent.

## Implemented in the frontend prototype

- Login with a role selector, role/account matching, local session restoration,
  logout, and PBKDF2 password hashing through Web Crypto.
- Role-specific navigation and screens:
  - **Dentist / Owner:** patients, medical information, calendar, billing, and
    user settings.
  - **Business Partner / Secretary:** patients, calendar, and billing, without
    medical, treatment, notes, or user-management screens.
  - **Dental Assistant:** read-only calendar and clinic supply/logistics
    information. Appointment management is not available to this role.
- Patient search by name, ID, or phone; patient list, duplicate check, profile
  tabs, editable contact/medical details, visit notes, and generated patient
  IDs.
- Week/day scheduling, today and previous/next navigation, appointment status
  actions, configurable buffers, and overlap checks.
- Per-patient treatment and payment ledgers, discounts, payment methods,
  clinic-wide outstanding balance summary, and browser print-to-PDF workflow.
- Local persistence for patients, appointments, billing, accounts, supplies,
  and preferences. Offline mode caches the app shell and disables data changes.
- Responsive layout rules for narrow and wide screens.

The app also starts with sample patient, treatment, supply, and appointment
records to make the workflows visible. Treat all of these as synthetic test
data.

## Current limitations

- Data is held in each browser's local storage. It is not shared across
  devices, encrypted at rest, synchronized, or backed up. Clearing browser data
  can permanently remove it.
- Role checks are client-side UI restrictions, not a security boundary. A user
  with browser access can inspect or change the app and its stored data.
- Default account passwords are embedded in client-side JavaScript.
- Offline mode is read-only; there is no offline edit queue or sync.
- Notifications are local UI notices only. Appointment confirmations are not
  sent to patients by email, SMS, or another messaging service.
- The print action uses the browser print dialog; users can select “Save as
  PDF.” It is not a generated, signed, or tax-compliant receipt.
- The billing screens are local ledgers, not a payment processor or accounting
  integration.
- Paper/PDA chart import, encoded-record verification, cloud hosting, cloud
  backups, database migrations, and the relational UML model are not
  implemented.

## Next progress

### Frontend

- [x] Replace or clearly separate the seeded patient and appointment fixtures
  from clinic data; provide a clean-clinic setup flow.
- [x] Finish the month-level calendar navigation/view and improve calendar
  accessibility, keyboard use, and notification affordances.
- [x] Add robust input and duplicate-record validation, including a documented
  match policy for names and birthdates.
- [x] Complete local data export/import with validation and a recovery flow
  before users rely on browser storage.
- [x] Build a PDA/chart-import interface and a record-by-record verification
  report.
- [x] Finalize patient forms and medical questionnaire fields against the
  approved wireframes and UML.
- [x] Refine receipt layout and confirm the print-to-PDF output with realistic
  ledger and payment data.
- [x] Add user-facing save/error states and data-recovery guidance for storage
  quota, browser restrictions, and corrupted local records.

### Quality Assurance (QA)

- [ ] Add automated unit, integration, and end-to-end tests; there is currently
  no test runner or CI test suite.
- [ ] Cover role mismatch, inactive accounts, account creation/reset, duplicate
  patients, patient edits, payment allocation/discounts, appointment conflicts
  and buffers, and persistence after reload.
- [ ] Verify assistants cannot access or change patient, billing, or user data,
  and confirm all role restrictions remain enforced after navigation and
  reload.
- [ ] Test offline/cache behavior, blocked storage, quota failures, malformed
  local data, backup/restore, and (after backend work) migration and sync
  failure recovery.
- [ ] Run responsive and accessibility checks on desktop, tablet, and phone;
  verify current iOS Safari and Android Chrome behavior.
- [ ] Run security and privacy reviews before any real clinical data is used.
- [ ] Perform clinic-user acceptance testing for the approved wireframes,
  treatment and payment workflows, receipt output, and imported records.
- [ ] Add CI gates and a release checklist once automated tests and backend
  environments exist.

## Project status

The current deliverable is a local interactive frontend prototype, not a
production dental information system. Backend, cloud, security, migration, and
formal QA items above remain prerequisites for production use.
