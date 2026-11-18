# Carehouse

A bilingual hospital operations application with a white-and-teal interface, encrypted fictional records and database-backed workflows.

> Demonstration only. Do not enter real patient information or use this application for diagnosis, treatment, prescribing, insurance processing or other clinical decisions. This project is not certified for healthcare regulatory compliance.

## Modules

- Dashboard with live workspace totals, appointment activity, department activity, stock and billing alerts.
- Patients: registration, identifiers, allergies, chronic conditions, emergency contacts, clinical timeline and encrypted document uploads.
- Appointments: doctor schedules, overlap protection, status tracking, rescheduling, daily calendar, downloadable calendar events with a 30-minute reminder.
- EMR: encounters, diagnosis, clinical notes, treatment, prescriptions, vitals and follow-up dates. Signed encounters are immutable.
- Doctors and staff: specialties, shifts, working days, departments, license references and linked activity.
- Departments: service information, capacity, location and leads.
- Inpatient care: bed grid, admissions, discharge to cleaning, and transactional patient transfers.
- Pharmacy: stock, reorder levels, expiry, suppliers and dispensing against signed encounters.
- Lab and radiology: requests, priorities, sample processing, reports and results.
- Billing and insurance: invoices, balances, payment history and claim tracking.
- Human resources: attendance, shifts, leave and payroll with net-pay calculation.
- Reports: role-scoped charts, date filters, CSV export and browser print/PDF.

## Stack

Next.js App Router static export, React, TypeScript, Tailwind CSS, Hono and Cloudflare D1. Runs on Cloudflare Pages Functions. No paid service is required. Service quotas still apply.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
# Create a local encryption secret without printing it.
node -e "require('fs').writeFileSync('.dev.vars','ENCRYPTION_KEY='+require('crypto').randomBytes(48).toString('hex'))"
npm run db:local
npm run build
npm run preview
```

Open the local address printed by Wrangler. Each demo session starts a separate fictional hospital workspace. A private account persists across logins and can create team accounts. Never reuse a real password in a demo account.

## Test

```sh
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

Browser tests cover patient CRUD/persistence, version conflicts, signed-record protection, payment limits, transfers and discharge, dispensing, appointment conflicts, RBAC, CSRF, workspace isolation, team login and session revocation, document upload/download, every module, RTL and mobile layout.

Repeated test runs may hit the deliberate 30-auth-attempt/15-minute limit. A fresh local test database avoids this. Never disable the production rate limit for tests.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md). The D1 database `carehouse` is bound as `DB` in `wrangler.toml`. `ENCRYPTION_KEY` is a required secret, never a committed value. Back up both the D1 database and key before changes. Losing the key means losing the encrypted records.

## Security model and limits

- HTTP-only, same-site session cookies, secure in HTTPS deployments; 8-hour sessions.
- PBKDF2-SHA256 password hashes with per-user random salts, 100,000 iterations, and 12-character minimum passwords.
- AES-256-GCM application-level encryption of record payloads and uploaded documents.
- Server-side role checks, field redaction and workspace scoping on reads/writes.
- CSRF tokens and origin checks on mutations, authentication throttling, request-size limits, CSP and safe document downloads.
- Append-only application audit log for sign-in, authorized list reads, record views, changes, workflows and document access.
- Optimistic concurrency checks, SQL overlap constraints and guarded transactional bed transfers.
- Document uploads are restricted to PDF/PNG/JPEG, checked by MIME and file signature, max 128 KB and 10 files/patient. Files download as attachments and are not rendered inline. There is no malware scanner.
- Retention is a configurable **review policy**, not automatic deletion. No clinical records are silently purged.

This is a working demonstration, not a production hospital system. It does not include verified-email delivery, password recovery, MFA, Google SSO, SMS/email dispatch, PACS/DICOM, HL7/FHIR integration, insurer submission, card processing, tax-compliant payroll, key rotation, certified immutable audit storage, automated backups, disaster-recovery validation or independent penetration testing. Calendar reminders require the user to import the event into a calendar. Payments and claims are internal demonstration records only. Staff performance is visible as linked activity, not a clinical quality score. Real deployment requires legal, clinical and security review.

### Dependency status

The production dependency audit is clean at initial release. Build/test tooling has a transitive picomatch ReDoS advisory. Do not feed untrusted glob patterns to development tooling or expose the development server to the internet. The deployed application serves compiled assets and Pages Functions, not the Next.js development server.

## Photos

Real photographs are used for the healthcare welcome panels. No patient photographs are attached to fictional identities.

