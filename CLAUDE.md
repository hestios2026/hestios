# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HestiOS** — Management system for Hesti Rossmann GmbH (construction company, Kirchheim unter Teck, DE).
Trilingual: Romanian (default), German, English via i18next.

## Running the Project

### Prerequisites
Docker must be running (PostgreSQL, MinIO, Redis via docker-compose).

```bash
# Start services
cd docker && docker-compose up -d

# Backend (port 8002)
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8002

# Frontend (port 5175)
cd frontend
/Users/alexandrudumitrache/nodejs/bin/node node_modules/.bin/vite --port 5175
```

### First-time setup
```bash
cd backend && source .venv/bin/activate
pip install -r requirements.txt
python seed.py   # creates admin + 17 Kostenstellen + 5 suppliers + price list
```

**Admin credentials:** `admin@hesti-rossmann.de` / `HestiAdmin2024!`

### Database
PostgreSQL at `localhost:5432`, database `hestios`, user `hestios`, password `hestios_dev_2024`.
Tables created automatically on backend startup via `Base.metadata.create_all()`.

## Architecture

### Backend (FastAPI + SQLAlchemy + PostgreSQL)
- `main.py` — app entry point, CORS, router registration; `redirect_slashes=False` (critical — prevents 307 redirects that drop Authorization headers)
- `app/core/` — `database.py` (SQLAlchemy engine + get_db), `security.py` (bcrypt + JWT HS256, 8h expiry), `config.py` (Pydantic Settings from .env)
- `app/models/` — ORM models: `user`, `site`, `cost`, `equipment`, `employee`, `hausanschluss`, `supplier`
- `app/api/` — route handlers: `auth`, `users`, `sites`, `equipment`, `employees`, `hausanschluss`, `settings`
- `seed.py` — idempotent seeding script

### Frontend (React 18 + TypeScript + Vite)
- No React Router — page switching via `useState` in `App.tsx` (`setPage`)
- `src/api/client.ts` — axios with baseURL `/api`; request interceptor adds Bearer token; 401 response dispatches `window.dispatchEvent(new Event('hestios:logout'))` instead of hard reload
- `src/hooks/useAuth.ts` — reads/writes localStorage (`hestios_token`, `hestios_user`); listens for `hestios:logout` event
- `src/i18n/` — translations in `ro.ts`, `de.ts`, `en.ts`; language persisted in localStorage
- Inline CSS throughout (no CSS framework); sidebar theme `#1e3a8a`
- Vite proxy: `/api` → `http://localhost:8002`

### Key Rules
- **All API calls must have trailing slash** (e.g. `/sites/`, `/equipment/`). Without it, FastAPI returns 404 due to `redirect_slashes=False`.
- **bcrypt pinned to 4.0.1** in requirements.txt — newer versions break passlib.
- Non-directors see only their assigned sites (`manager_id == current.id`).

## Data Model Highlights

### Sites / Kostenstellen
- `is_baustelle: bool` — False for internal overhead (KST 100–199), True for construction sites (KST 200+, not divisible by 100)
- `total_costs` is computed on the fly in the API (not stored)
- `GET /api/sites/?baustellen_only=true` — returns only construction sites

### User Roles (6)
`director` | `projekt_leiter` | `polier` | `sef_santier` | `callcenter` | `aufmass`

### Kostenstellen structure
- `x00` codes (100, 200, 300…) = overhead or client-level parent entries
- Sub-codes with city names (310 "Geodesia Ulm", 410 "Fiber Export Kaufering"…) = actual Baustellen

## Modules Status

| Module         | Backend | Frontend | Notes |
|----------------|---------|----------|-------|
| Auth           | ✓       | ✓        |       |
| Șantiere       | ✓       | ✓        | Costs, materials, programări tabs |
| Utilaje        | ✓       | ✓        | Movement history |
| Angajați (HR)  | ✓       | ✓        | Full Arbeitsvertrag fields |
| Programări     | ✓       | ✓        | Daily list at 20:00 — channel TBD |
| Utilizatori    | ✓       | ✓        | Director-only |
| Setări         | ✓       | ✓        | Company info + notification config |
| Achiziții      | ✓       | ✓        | Suppliers + price lists + purchase orders (pending→approved→sent) |
| Facturare      | —       | —        | Placeholder |
| Documente      | —       | —        | Placeholder |
| Rapoarte       | —       | —        | Placeholder — **Programări must be included** |

## Pending / Important Notes
- **Notificări zilnice 20:00** — canal de notificare (WhatsApp Business API / Telegram bot / email SMTP) de configurat; ora setabilă din Setări
- **Aplicația de raportare** — secțiunea Programări trebuie inclusă și acolo, filtrată per șantier/echipă
- **Deploy** — Hetzner Cloud CPX31, Docker Compose + Nginx; se face după ce aplicația e parțial gata local
- **DATEV export** — planificat pentru modulul de facturare
- **PDF contracte** — python-docx + WeasyPrint, template Arbeitsvertrag german
