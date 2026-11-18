# Carehouse deployment checklist

Deploy only after the chosen Pages project name is approved and available.

1. The D1 database `carehouse` has been provisioned and verified. Use the ID committed in `wrangler.toml`.
2. Confirm the Pages project is `carehouse` and keep D1 binding `DB` pointing at the committed database ID.
3. Apply all migrations to that exact new database with `wrangler d1 migrations apply <database-name> --remote`.
4. Generate a new random secret of at least 32 characters using a secret manager. Configure it as the Pages production secret `ENCRYPTION_KEY`. Do not reuse a test key and do not print or commit it.
5. Build with `npm ci && npm run build` and deploy `out` with Pages Functions from this repository. Ensure the production D1 binding `DB` is present.
6. Check `/api/session` returns 401 when signed out, not an HTML page or server error.
7. Start a private demo, verify all modules load, create/edit a fictional patient, reload and verify persistence. Check Arabic and mobile.
8. Create a private account with a generated password through a secure collection flow, if an owner account is wanted. Public signup creates a separate fictional workspace, never a global hospital administrator.
9. Confirm role restrictions, signed records, payment totals and audit events on the live deployment. No real patient data.
10. Keep encrypted D1 exports and the encryption key backed up separately. Key rotation is not implemented and must be planned before any real deployment.

## Rollback

The initial migrations are additive. Roll back application code to the previous known-good deployment without deleting data. Do not reverse migrations or replace an encryption key without a verified backup and recovery plan. Never delete production data to clear test rate limits.

## Free-tier limits

Database storage, row operations, function requests and CPU budgets are finite. Each new demo seeds approximately 100 records. This release has per-IP authentication throttling, not a global anti-abuse system or automated expired-workspace purge. Watch free-tier use. Do not enable paid plans without explicit approval.
