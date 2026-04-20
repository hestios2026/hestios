from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import (
    auth, users, sites, equipment, employees, hausanschluss,
    settings, achizitii, aufmass, reports, facturare, documents,
    daily_reports, notifications, webhooks, timesheets, contracts, lv,
)
from app.api import folders
from app.api import invoices
from app.api import situatii
from app.api import tagesbericht
from app.api import bauzeitenplan
from app.api import reclamatii
from app.api import folder_shares


def _run_migrations():
    """Idempotent schema migrations — runs at startup."""
    import logging
    from app.core.database import engine, Base
    from sqlalchemy import text
    # import all models so Base knows about them
    import app.models.user, app.models.site, app.models.cost, app.models.equipment
    import app.models.employee, app.models.hausanschluss, app.models.supplier
    import app.models.aufmass, app.models.facturare, app.models.document
    import app.models.notification, app.models.setting, app.models.lv
    import app.models.daily_report, app.models.timesheet, app.models.folder
    import app.models.tagesbericht, app.models.bauzeitenplan
    import app.models.reclamatie
    import app.models.document_version, app.models.folder_share
    logger = logging.getLogger(__name__)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"create_all skipped: {e}")
    migrations = [
        # Folder support
        "CREATE TABLE IF NOT EXISTS folders ("
        "  id SERIAL PRIMARY KEY,"
        "  name VARCHAR(200) NOT NULL,"
        "  parent_id INTEGER REFERENCES folders(id),"
        "  site_id INTEGER REFERENCES sites(id),"
        "  created_by INTEGER REFERENCES users(id),"
        "  created_at TIMESTAMPTZ DEFAULT NOW(),"
        "  description TEXT"
        ")",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id)",
        # Employee onboarding fields
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS geburtsname VARCHAR(100)",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS geschlecht VARCHAR(20)",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(200)",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS plz VARCHAR(10)",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS kinder_pflegev INTEGER DEFAULT 0",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS vorherige_krankenkasse VARCHAR(100)",
        # Billing config per site
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_name VARCHAR(200)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_address TEXT",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_vat_id VARCHAR(50)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_email VARCHAR(200)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_iban VARCHAR(34)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_bic VARCHAR(11)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS billing_bank VARCHAR(100)",
        "ALTER TABLE sites ADD COLUMN IF NOT EXISTS sicherheitseinbehalt_pct FLOAT DEFAULT 0",
        # Situatii de lucrari
        "CREATE TABLE IF NOT EXISTS situatii_lucrari ("
        "  id SERIAL PRIMARY KEY,"
        "  site_id INTEGER REFERENCES sites(id),"
        "  title VARCHAR(200) NOT NULL,"
        "  period_from DATE NOT NULL,"
        "  period_to DATE NOT NULL,"
        "  status VARCHAR(20) DEFAULT 'draft',"
        "  sent_at TIMESTAMPTZ,"
        "  approved_at TIMESTAMPTZ,"
        "  client_notes TEXT,"
        "  created_by INTEGER REFERENCES users(id),"
        "  created_at TIMESTAMPTZ DEFAULT NOW(),"
        "  updated_at TIMESTAMPTZ"
        ")",
        "ALTER TABLE aufmass_entries ADD COLUMN IF NOT EXISTS situatie_id INTEGER REFERENCES situatii_lucrari(id)",
        # Extended invoices
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'lucrari'",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS situatie_id INTEGER REFERENCES situatii_lucrari(id)",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sicherheitseinbehalt_pct FLOAT DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sicherheitseinbehalt_amount FLOAT DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sicherheitseinbehalt_released BOOLEAN DEFAULT FALSE",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sicherheitseinbehalt_release_date DATE",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount FLOAT DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE",
        # Extended invoice items
        "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS purchase_price FLOAT",
        "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS admin_fee_pct FLOAT",
        # Mobile PIN for users
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_pin VARCHAR(10)",
        # Tagesbericht (mobile field reports)
        "CREATE TABLE IF NOT EXISTS tagesbericht_entries ("
        "  id SERIAL PRIMARY KEY,"
        "  local_uuid VARCHAR(36) UNIQUE,"
        "  site_id INTEGER REFERENCES sites(id),"
        "  work_type VARCHAR(30) NOT NULL,"
        "  nvt_number VARCHAR(100),"
        "  created_by INTEGER REFERENCES users(id),"
        "  created_at TIMESTAMPTZ NOT NULL,"
        "  synced_at TIMESTAMPTZ DEFAULT NOW(),"
        "  data JSONB NOT NULL DEFAULT '{}'"
        ")",
        "CREATE TABLE IF NOT EXISTS tagesbericht_photos ("
        "  id SERIAL PRIMARY KEY,"
        "  entry_id INTEGER REFERENCES tagesbericht_entries(id) ON DELETE CASCADE,"
        "  category VARCHAR(50),"
        "  filename VARCHAR(200) NOT NULL,"
        "  s3_key VARCHAR(500) NOT NULL,"
        "  url TEXT,"
        "  taken_at TIMESTAMPTZ,"
        "  uploaded_at TIMESTAMPTZ DEFAULT NOW(),"
        "  file_size INTEGER"
        ")",
        # Pontaj (mobile time tracking)
        "CREATE TABLE IF NOT EXISTS team_assignments ("
        "  id SERIAL PRIMARY KEY,"
        "  team_lead_id INTEGER REFERENCES users(id) NOT NULL,"
        "  employee_id INTEGER REFERENCES employees(id) NOT NULL,"
        "  UNIQUE(team_lead_id, employee_id)"
        ")",
        "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ora_start VARCHAR(5)",
        "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ora_stop VARCHAR(5)",
        "ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS team_lead_id INTEGER REFERENCES users(id)",
        # Bauzeitenplan
        "CREATE TABLE IF NOT EXISTS bzp_projects ("
        "  id SERIAL PRIMARY KEY,"
        "  site_id INTEGER REFERENCES sites(id) NOT NULL,"
        "  name VARCHAR(300) NOT NULL,"
        "  firma VARCHAR(200),"
        "  baubeginn DATE,"
        "  bauende DATE,"
        "  created_at TIMESTAMPTZ DEFAULT NOW(),"
        "  updated_at TIMESTAMPTZ"
        ")",
        "CREATE TABLE IF NOT EXISTS bzp_rows ("
        "  id SERIAL PRIMARY KEY,"
        "  project_id INTEGER REFERENCES bzp_projects(id) ON DELETE CASCADE NOT NULL,"
        "  vorhaben_nr VARCHAR(50),"
        "  hk_nvt VARCHAR(100),"
        "  gewerk VARCHAR(50),"
        "  hh BOOLEAN DEFAULT FALSE,"
        "  hc BOOLEAN DEFAULT FALSE,"
        "  tb_soll_m FLOAT,"
        "  date_start DATE,"
        "  date_end DATE,"
        "  tb_ist_m FLOAT DEFAULT 0,"
        "  ha_gebaut INTEGER DEFAULT 0,"
        "  verzug_kw INTEGER DEFAULT 0,"
        "  bemerkung TEXT,"
        "  sort_order INTEGER DEFAULT 0,"
        "  is_group_header BOOLEAN DEFAULT FALSE,"
        "  color VARCHAR(20)"
        ")",
        "CREATE TABLE IF NOT EXISTS bzp_weekly ("
        "  id SERIAL PRIMARY KEY,"
        "  row_id INTEGER REFERENCES bzp_rows(id) ON DELETE CASCADE NOT NULL,"
        "  week_date DATE NOT NULL,"
        "  meters FLOAT DEFAULT 0,"
        "  note VARCHAR(200)"
        ")",
        # Reclamații (support tickets)
        "CREATE TABLE IF NOT EXISTS reclamatii ("
        "  id SERIAL PRIMARY KEY,"
        "  title VARCHAR(200) NOT NULL,"
        "  type VARCHAR(20) NOT NULL DEFAULT 'internal',"
        "  priority VARCHAR(10) NOT NULL DEFAULT 'normal',"
        "  status VARCHAR(15) NOT NULL DEFAULT 'open',"
        "  description TEXT NOT NULL,"
        "  resolution_notes TEXT,"
        "  site_id INTEGER REFERENCES sites(id),"
        "  assigned_to INTEGER REFERENCES users(id),"
        "  created_by INTEGER REFERENCES users(id) NOT NULL,"
        "  created_at TIMESTAMPTZ DEFAULT NOW(),"
        "  updated_at TIMESTAMPTZ,"
        "  resolved_at TIMESTAMPTZ"
        ")",
        # Document enhancements
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags VARCHAR(500)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
        # Document version history
        "CREATE TABLE IF NOT EXISTS document_versions ("
        "  id SERIAL PRIMARY KEY,"
        "  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE NOT NULL,"
        "  version INTEGER NOT NULL,"
        "  file_key VARCHAR(500) NOT NULL,"
        "  file_size BIGINT DEFAULT 0,"
        "  uploaded_by INTEGER REFERENCES users(id),"
        "  created_at TIMESTAMPTZ DEFAULT NOW(),"
        "  notes TEXT"
        ")",
        # Folder public share links
        "CREATE TABLE IF NOT EXISTS folder_shares ("
        "  id SERIAL PRIMARY KEY,"
        "  token VARCHAR(64) UNIQUE NOT NULL,"
        "  folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE NOT NULL,"
        "  label VARCHAR(200),"
        "  can_read BOOLEAN DEFAULT TRUE,"
        "  can_upload BOOLEAN DEFAULT FALSE,"
        "  can_delete BOOLEAN DEFAULT FALSE,"
        "  expires_at TIMESTAMPTZ,"
        "  created_by INTEGER REFERENCES users(id),"
        "  created_at TIMESTAMPTZ DEFAULT NOW()"
        ")",
    ]
    for sql in migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
        except Exception as e:
            logger.warning(f"Migration skipped: {e}")
    logger.info("Migrations applied")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        _run_migrations()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Migrations failed: {e}")
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"APScheduler failed to start: {e}")
    yield
    try:
        from app.services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title="HestiOS API",
    description="Hesti Rossmann GmbH — Management System",
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/api")
app.include_router(users.router,         prefix="/api")
app.include_router(sites.router,         prefix="/api")
app.include_router(equipment.router,     prefix="/api")
app.include_router(employees.router,     prefix="/api")
app.include_router(hausanschluss.router, prefix="/api")
app.include_router(settings.router,      prefix="/api")
app.include_router(achizitii.router,     prefix="/api")
app.include_router(aufmass.router,       prefix="/api")
app.include_router(reports.router,       prefix="/api")
app.include_router(facturare.router,     prefix="/api")
app.include_router(documents.router,     prefix="/api")
app.include_router(folders.router,       prefix="/api")
app.include_router(invoices.router,      prefix="/api")
app.include_router(daily_reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(webhooks.router,      prefix="/api")
app.include_router(timesheets.router,    prefix="/api")
app.include_router(contracts.router,     prefix="/api")
app.include_router(lv.router,            prefix="/api")
app.include_router(situatii.router,      prefix="/api")
app.include_router(tagesbericht.router,    prefix="/api")
app.include_router(bauzeitenplan.router,  prefix="/api")
app.include_router(reclamatii.router,     prefix="/api")
app.include_router(folder_shares.router,  prefix="/api")


@app.get("/")
def root():
    return {"status": "HestiOS API running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/health")
def health_api():
    return {"status": "ok", "service": "HestiOS API", "version": "1.0.0"}
