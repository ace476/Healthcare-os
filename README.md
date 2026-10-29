# Family Healthcare OS

A responsive family-care coordination prototype with a sign-in screen, account creation, session-based authentication, and a family dashboard for sample appointments, medications, care-team contacts, and members.

## Run locally

1. Install Node.js (18 or newer recommended).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

## Demo sign-in

Use **Explore the family dashboard** on the login screen, or use this sample account:

- Email: `admin@demo.com`
- Password: `admin123`

The sample data is fictional. New accounts are created in server memory for this prototype.

## What's included

- Responsive sign-in and account creation screens
- Server-side session cookie with HttpOnly and SameSite=Lax settings
- Password hashing with Node.js scrypt
- Protected healthcare API routes that require a signed-in session
- Family overview, sample medication schedule, appointments, and care team
- Forms for adding a sample family member and appointment
- Mobile-friendly dashboard navigation

## Important security and product limitations

**This is a prototype, not a production-ready healthcare service. Do not enter real patient data or use it for clinical decisions.**

- User accounts, sample health records, and session data are held in memory and are lost when the server restarts. The sample family data is shared by all signed-in accounts.
- The default session secret is only for local development. Set a long, random `SESSION_SECRET` in your environment before any hosted testing. Never commit secrets.
- The default Express session MemoryStore is not suitable for production. Use a persistent, production-grade session store and database.
- Before handling real health data, implement per-user/family authorization, secure account recovery, email verification, rate limiting, CSRF protections appropriate to the deployment, audit logging, backups, monitoring, and a privacy/security review. Configure HTTPS and secure cookies at the hosting layer.
- Google/Apple sign-in and email-based password reset are visual placeholders and are not connected to identity providers or an email service.

## Project structure

- `server.js` — Express app, session authentication, and in-memory sample API
- `public/index.html` — public landing page with top navigation and login button
- `public/login.html` — separate sign-in, account creation, and dashboard experience
- `public/app.js` — authentication flow and dashboard interactions
- `public/styles.css` — responsive landing page, login, and dashboard styling

## Tech stack

- Node.js and Express
- express-session
- Vanilla JavaScript, HTML, and CSS
