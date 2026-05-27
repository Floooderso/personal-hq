# Personal HQ

A fully local, responsive personal management web app. No cloud dependencies — all data stays on your machine.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TypeScript (strict) |
| State | Zustand |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Node.js, Express 4 |
| Database | SQLite via better-sqlite3 |
| Styling | CSS custom properties (DM Sans / DM Mono) |

## Modules

- **Dashboard** — stats, activity feed, monthly spend chart, bank suggestions
- **Subscriptions** — track recurring payments, generate PDF Kündigung letters, run Playwright cancellation scripts
- **Shops** — card/table view with favicon fetching, bank spend matching
- **Projects** — Kanban board (Ideas → Done), markdown notes, subtasks, GitHub integration
- **Social Media** — track all your platforms in one table
- **Automations** — trigger n8n, Make, Zapier webhooks or run custom scripts with SSE log output
- **Finances** — invoice tracker, CSV export, charts, FinTS bank transaction matching
- **Settings** — profile, integrations (Bank FinTS, IMAP, n8n), categories, data import/export

## Setup

### Prerequisites

- Node.js ≥ 18
- Windows Build Tools (for `better-sqlite3` native compilation):
  ```
  npm install -g windows-build-tools
  ```
  Or install **Visual Studio Build Tools** with C++ workload.

### Install & run

```bash
cd personal-hq
npm install
npm run dev
```

Frontend → http://localhost:5173  
Backend → http://localhost:3001

The database auto-creates and seeds example data on first run.

### Optional: Playwright (cancel automation scripts)

```bash
npx playwright install chromium
```

### Bank Integration (FinTS/HBCI)

```bash
npm install fints
```

Requires a German bank that supports FinTS 3.0. Configure BLZ, username, and PIN in Settings. All credentials are encrypted with AES-256-GCM using PBKDF2 key derivation.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+K` | Global search |
| `N` | New record (on list pages) |
| `Escape` | Close any open panel/modal |

## Security

- Bank PIN and IMAP password stored AES-256-GCM encrypted
- PBKDF2 with 100,000 iterations, random 32-byte salt
- PIN held in memory only during FinTS session
- `open()` URL validated against protocol allowlist and RFC-1918 block

## Data

All data is stored in `data/personal-hq.db` (SQLite). Export everything via Settings → Data Management → Export.
