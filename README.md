# Announcement Management and SMS Broadcasting System

Full-stack system built from your DFD, database design (ERD/schema), and UI designs.

Database: MySQL (XAMPP)

## What's included

- Database: MySQL schema (Users, Classes, Class_Enrollments, Announcements, Comments, Announcement_Attachments, SMS_Logs).
- Backend: Node.js + Express API (JWT auth), users, classes, announcements, comments, SMS logging stub.
- Frontend: Login, role-based dashboards (Admin, Instructor, Student), Users Management, Class Management, Profile, announcements feed, pinned announcements, stats (Admin).

## Quick start (XAMPP + Node)

1. Start XAMPP
   - Start MySQL in the XAMPP Control Panel.

2. Install dependencies (run in the `server` folder)

```powershell
cd "c:\Users\edenm\OneDrive\Documents\coding\Announcement Management and SMS Broadcasting System\server"
npm install
```

3. Configure database and SMS (optional)
   - Copy `server/env.example` to `server/.env` and change if needed.
   - Database defaults: DB_HOST=localhost, DB_USER=root, DB_PASSWORD= (empty), DB_NAME=announcement_management_db
   - **SMS gateway** (when Admin posts a school-wide announcement, SMS is sent to all students with a phone number): set `SMS_GATEWAY_URL` (e.g. `http://<device_local_ip>:8080/message`), `SMS_GATEWAY_USER`, and `SMS_GATEWAY_PASSWORD` in `.env`. Phone numbers are sent in the gateway’s expected format (e.g. +1 for 10-digit US numbers).

4. Create database and seed (this resets the DB)

```powershell
npm run init-db
```

5. Start the server

```powershell
npm start
```

6. Open the app
   - http://localhost:3000/login.html
   - Admin: admin1 / password123
   - Instructor: instructor1 / password123
   - Student: GLP012103 / password123 (Student ID is the username)

## Project structure (key files)

- database/schema.sql (MySQL schema used by init-db)
- server/
  - index.js (Express server)
  - db.js (MySQL pool + helpers)
  - scripts/init-db.js (creates DB, runs schema, seeds data)
  - routes/ (auth, users, classes, announcements)
  - env.example (copy to .env)
- login.html (login screen)
- index.html (app shell after login)
- app.js (frontend API/auth helpers)
- dashboard-app.js (role-based UI + routing)
- styles.css

## Features by role

- Admin: Dashboard (announcements + stats), create school-wide announcements (SMS log stub), Users Management, Class Management, Profile.
- Instructor: Dashboard (create announcement, feed, pinned), Classes list in sidebar, Profile.
- Student: Dashboard (announcements feed, pinned), My Classes in sidebar, Profile.

SMS broadcasting is stubbed: creating a school-wide announcement inserts rows into `sms_logs`; you can later connect a real SMS gateway (e.g. Twilio).

## Troubleshooting

- npm install doesn't work
  - Run it inside the `server` folder (where `package.json` is).
  - In PowerShell, do not use `&&` (use two lines, or `;`).

- node is not recognized
  - Install Node.js (LTS) from https://nodejs.org and restart the terminal.

- ECONNREFUSED / DB connection errors
  - Start MySQL in XAMPP first.

