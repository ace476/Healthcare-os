# Healthcare OS

A family-care coordination prototype with Supabase authentication, a family dashboard, appointments, medications, care-team contacts, and health tracking.

## Run locally

1. Install Node.js 18 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express server:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

The current application connects to the configured Supabase project. The browser uses a Supabase **publishable** key, which is designed to be public; never put a Supabase service-role or secret key in browser code.

## Authentication and data access

- Supabase Auth handles sign-up, sign-in, and email-based password recovery.
- Express verifies bearer tokens with Supabase Auth before serving protected API routes.
- The authenticated user token is forwarded to Postgres so row-level security remains active.
- Family data tables use RLS policies based on family membership and caregiver roles.
- A private database audit log records metadata about inserts, updates, and deletes. It deliberately does not store health values or free-text medical details.

## Medical documents

The `medical-records` Supabase Storage bucket is private and has file-size and MIME-type restrictions. **Hosted upload and download endpoints are deliberately disabled** until the complete authorization, malware/content inspection, retention, and recovery workflow is implemented. Do not upload real patient information.

## Important security and product limitations

**This is a prototype, not a production-ready healthcare service. Do not enter real patient data or use it for clinical decisions.**

- The GitHub repository is public. Do not commit credentials, private keys, database passwords, patient records, or environment files.
- Supabase leaked-password protection is currently disabled. The signup API performs a server-side compromised-password check, but that check is not enforced by Supabase Auth itself and is not applied to the password-recovery update flow.
- Signup throttling currently uses an in-memory per-instance counter. This is not a reliable distributed rate limiter for serverless deployments. Configure a platform-level rate limit and verify Supabase Auth rate limits before production.
- Browser sessions use browser storage. A production deployment should review session lifetime, MFA, XSS defenses, and recovery settings.
- A baseline set of HTTP security headers is configured. A strict Content Security Policy has not yet been deployed because external CDN origins need to be consolidated and tested.
- Audit events are stored in a private schema and are not exposed through the application UI. Monitoring and alerting still need a persistent operational workflow.
- The Supabase organization is on the Free plan, which does not include automatic database backups. Manual off-site database exports and separate Storage-object backups are required; restore testing has not been performed.
- The application has not undergone a formal penetration test, cross-family authorization test suite, clinical safety review, or privacy/compliance assessment.

Use synthetic data only until these controls are completed and independently verified.

## Project structure

- `server.js` — Express API, Supabase token verification, and protected routes
- `public/` — landing page, sign-in, dashboard, and feature pages
- `public/supabase-config.js` — browser Supabase URL and publishable key
- `supabase/migrations/` — database schema and security migrations

## Tech stack

- Node.js and Express
- Supabase Auth and PostgreSQL with RLS
- Supabase Storage (private bucket; application uploads are disabled)
- Vanilla JavaScript, HTML, and CSS
