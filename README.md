# SchoolEx by Muse

A complete **offline** school management system with a real backend and database, built by Muse from Masood's original SCHOOLEX-project frontend.

## What's inside

- **Frontend** — the original React 19 + Vite + TypeScript + Tailwind app (`src/`): students, staff, classes, attendance, fees & challans, payroll, ledger, exams with DMCs / marks sheets / gazettes, ID cards
- **Backend** — Express server (`server/`) bound to 127.0.0.1 only, REST API under `/api/`
- **Database** — real SQLite file (better-sqlite3) with tables for students, staff, classes, attendance, payments, ledger, exams, exam marks and settings; a fresh install starts completely empty and there is no built-in or sample data anywhere in the app — the database only ever contains data you enter yourself
- **Desktop shell** — Electron (`electron/`) so it runs as an installed Windows app, fully offline; database lives in the per-user app data folder and survives reinstalls
- Backup / restore of the database from inside the app (`/api/backup`, `/api/restore`)

## Run it (development)

```bash
npm install
npm run server        # backend + built frontend on 127.0.0.1
npm run start:desktop # Electron desktop app
npm run test:smoke    # smoke tests (health, empty start, CRUD, backup, persistence, reset)
```

## Build the Windows installer

On a Windows PC with **Node.js LTS (v24)** installed:

```bash
npm install
npm run dist:win
```

This produces `release\SchoolEx Setup 1.0.0.exe` (NSIS installer). See `INSTALL_WINDOWS.md` for the full walkthrough.

## Notes

- Student/staff avatar images (`src/assets/images/`, `public/assets/`) are binary files and may be added on top of this snapshot if missing.
- Test fixtures for `npm run test:smoke` / `npm run test:payroll` live under `scripts/` only and are inserted through the normal API; `scripts/` is not part of the packaged app, so no fixture data can ever ship in the installer.
