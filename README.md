# Family Healthcare OS

Family Healthcare OS is a centralized healthcare management platform built to help families manage records, medication schedules, appointments, and doctor coordination in one place.

This repository contains a working starter web app for the product concept, designed to help you validate the product idea and build a foundation for future expansion.

## Features

- Family member dashboard
- Shared family code and member profiles
- Medication tracking
- Appointment list
- Doctor directory
- Basic API layer for future backend integration

## Running the app

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`

## Project structure

- `server.js` – Express server and in-memory API
- `public/index.html` – UI shell
- `public/app.js` – Frontend logic
- `public/styles.css` – App styling

## Suggested next steps

- Add user authentication and family access control
- Store records in a database (MongoDB, PostgreSQL, or Supabase)
- Add prescription and lab report uploads
- Add medication reminders and appointment notifications
- Add role-based access for doctors and caregivers

## Tech stack

- Node.js
- Express
- Vanilla JavaScript frontend

