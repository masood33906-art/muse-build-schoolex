# SchoolEx — Build & Install on Windows

SchoolEx is a fully offline, standalone Windows app: Electron shell + local
Express backend + SQLite database. No internet is needed after setup, and no
API keys are required for the core modules.

## Option A — Build the Windows installer (SchoolEx-Setup.exe)

Prerequisites (one-time, these need internet to install):
- Windows 10/11, 64-bit
- Node.js LTS (v22 or newer) from https://nodejs.org — includes npm

Steps:
1. Unzip `schoolex-portable.zip` (or copy the `app/` folder) to e.g. `C:\SchoolEx-src`
2. Open PowerShell / Command Prompt in that folder and run:

```bat
npm install
npm run dist:win
```

That single `dist:win` script builds the frontend and then runs
electron-builder for the NSIS target. On Windows the native SQLite module
(better-sqlite3) is rebuilt for Electron automatically — this is the step
that cannot cross-compile from Linux.

3. Find the installer at `release\SchoolEx Setup 1.0.0.exe`
4. Run it: choose an install folder (per-user install, no admin needed),
   and it creates Start-menu + desktop shortcuts and an uninstaller.

Your data is NOT in the install folder. The database lives at
`%APPDATA%\schoolex\schoolex.db` and survives reinstalls/upgrades.
Use the in-app Backup, or `GET /api/backup`, to export it.

## Option B — Run without installing (portable / development)

```bat
npm install
npm run build
npm run start:desktop
```

Or run just the backend + web UI in a browser:

```bat
npm install
npm run build
npm run server
```

then open the `http://127.0.0.1:<port>` address it prints
(set `SCHOOLEX_PORT=3737` beforehand for a fixed port, and
`SCHOOLEX_DB=C:\path\to\schoolex.db` for a custom database location).

## Verify the build

```bat
npm run test:smoke
```

Boots the server on a throwaway database and checks health, student
create/read, collections sync, backup download, and persistence across a
server restart. Expected: `SMOKE TEST: ALL PASS`.

## Notes
- The app binds to 127.0.0.1 only — nothing is exposed to your network.
- First run seeds the database from the original repo data
  (117 students, 28 staff, 19 classes — the repo's `INITIAL_*` arrays are
  empty; the `ARCHIVED_INITIAL_*` arrays hold the actual records).
- Uninstalling removes the program but leaves `%APPDATA%\schoolex` data
  in place; delete that folder manually for a complete removal.
