"""
Seed script — creates admin user + imports Kostenstellen + suppliers from collected data.
Run once: python seed.py
"""
import sys
sys.path.insert(0, ".")
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.site import Site, SiteStatus
from app.models.supplier import Supplier, SupplierPrice
from app.models import user, site, cost, supplier, equipment, employee, hausanschluss  # noqa

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Admin user ────────────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "admin@hesti-rossmann.de").first():
    admin = User(
        email="admin@hesti-rossmann.de",
        full_name="Administrator",
        hashed_password=hash_password("HestiAdmin2024!"),
        role=UserRole.DIRECTOR,
        language="de",
    )
    db.add(admin)
    print("✓ Admin user created: admin@hesti-rossmann.de / HestiAdmin2024!")

# ── Kostenstellen ─────────────────────────────────────────────────────────────
kostenstellen = [
    ("100", "Hesti Allgemein", "Hesti Rossmann"),
    ("110", "Büro", "Hesti Rossmann"),
    ("120", "Schulungen allgemein", "Hesti Rossmann"),
    ("130", "Fuhrpark Büro", "Hesti Rossmann"),
    ("140", "Fuhrpark Baustelle", "Hesti Rossmann"),
    ("150", "Werkzeug allgemein", "Hesti Rossmann"),
    ("160", "Arbeitskleidung", "Hesti Rossmann"),
    ("200", "Constructel", "Constructel"),
    ("300", "Geodesia", "Geodesia"),
    ("310", "Geodesia Ulm", "Geodesia"),
    ("320", "Geodesia Stuttgart 1. Polygon", "Geodesia"),
    ("400", "Fiber Export", "Fiber Export"),
    ("410", "Fiber Export Kaufering", "Fiber Export"),
    ("420", "Fiber Export Nürnberg Ziegelstein", "Fiber Export"),
    ("430", "Fiber Export Nürnberg St. Jobst", "Fiber Export"),
    ("500", "Axians", "Axians"),
    ("510", "Axians Bad Windsheim", "Axians"),
]
for ks, name, client in kostenstellen:
    if not db.query(Site).filter(Site.kostenstelle == ks).first():
        db.add(Site(kostenstelle=ks, name=name, client=client))
print(f"✓ {len(kostenstellen)} Kostenstellen imported")

# ── Suppliers ─────────────────────────────────────────────────────────────────
suppliers_data = [
    ("Eberle Hald", "Adam.Stanek@eberle-hald.de", "Dirk.Denneler@eberle-hald.de"),
    ("Niklaus Baugeräte", "n.roth@niklaus-baugeraete.de", None),
    ("Würth", "marc.distler@wuerth.com", None),
    ("HKL", "bastian.beck@hkl24.com", None),
    ("Förch", "philipp.neujahr@foerch.de", None),
]
supplier_objs = {}
for name, email, email2 in suppliers_data:
    s = db.query(Supplier).filter(Supplier.name == name).first()
    if not s:
        s = Supplier(name=name, email=email, email2=email2)
        db.add(s)
        db.flush()
    supplier_objs[name] = s
print(f"✓ {len(suppliers_data)} suppliers imported")

# ── Price list from Preise Kolonnenaustattung.xlsx ────────────────────────────
prices = [
    # (product, unit, eberle_hald, niklaus, wuerth, hkl, foerch)
    ("2x Schubkarre",                    "set",  213.62, 198.0,  228.58, 204.0,  168.72),
    ("2x Kellen",                        "set",  23.28,  None,   8.22,   10.8,   6.94),
    ("2x Gummihammer simplex 60",        "set",  83.74,  84.0,   95.0,   70.0,   73.74),
    ("4x Schaufel mit Stiel Holsteiner", "set",  61.04,  54.0,   41.64,  42.08,  32.08),
    ("2x Kabelgrabschaufel mit Stiel",   "set",  15.3,   28.4,   26.2,   24.34,  18.12),
    ("1x Kreuzhacke mit Stiel 2.5Kg",   "buc",  21.3,   15.4,   13.61,  25.13,  14.95),
    ("1x Kreuzhacke mit Stiel 3.5Kg",   "buc",  24.6,   20.9,   15.97,  23.51,  15.48),
    ("1x Südharzer Besen 40cm",          "buc",  9.82,   None,   11.7,   14.5,   6.6),
    ("1x Südharzer Besen 60cm",          "buc",  12.52,  None,   13.8,   17.99,  7.34),
    ("1x Teerverteiler mit Stiel",       "buc",  53.69,  23.0,   33.66,  43.52,  32.03),
    ("1x Kapselgehörschutz",             "buc",  11.62,  20.5,   23.51,  22.0,   15.78),
    ("1x Brecheisen 1.50m",              "buc",  42.97,  None,   46.18,  28.65,  29.29),
    ("1x Wasserwaage 60cm",              "buc",  10.45,  21.6,   6.84,   9.33,   7.02),
    ("1x Wasserwaage 120cm",             "buc",  16.23,  36.0,   13.98,  14.73,  9.5),
    ("2x Kanister 20L metall grün",      "set",  57.28,  41.0,   50.84,  44.66,  46.56),
    ("1x Kanister 20L metall rot",       "buc",  30.26,  20.5,   25.42,  None,   None),
    ("1x Trichter mit Sieb",             "buc",  8.25,   8.3,    26.56,  None,   3.22),
    ("1x Schraubendreher Set",           "set",  36.75,  9.9,    9.52,   None,   26.03),
    ("1x Gabelschlüsselset",             "set",  79.44,  None,   96.65,  None,   35.33),
    ("2x Bauhelm gelb",                  "set",  19.04,  13.0,   12.64,  6.95,   7.56),
    ("2x Knieschoner",                   "set",  44.7,   31.0,   43.6,   16.6,   13.84),
    ("2x Eimer 20L",                     "set",  5.78,   5.0,    16.64,  1.45,   2.84),
    ("1x Kutter für Glasfaser",          "buc",  32.44,  None,   27.37,  35.22,  20.95),
    ("1x Rohrschneidezange",             "buc",  None,   31.5,   24.39,  73.15,  None),
    ("1x Messlatte",                     "buc",  31.19,  30.9,   132.17, 28.66,  43.0),
    ("1x Längenmessrad",                 "buc",  149.17, 109.0,  124.12, 145.0,  101.71),
    ("1x Plattenheber",                  "buc",  16.65,  49.0,   71.26,  46.48,  8.22),
    ("1x Pflasterzange Probst",          "buc",  97.52,  99.5,   None,   87.41,  None),
    ("1x Netz für Transporter 3x5m",     "buc",  60.3,   39.9,   50.86,  51.33,  22.16),
    ("2x Spanngurt 4m",                  "set",  24.3,   29.0,   15.9,   21.6,   10.5),
    ("3x Straßenmarkierung rot/gelb",    "set",  None,   19.5,   11.25,  11.34,  8.97),
    ("10x Klebeband grau Gewebeband",    "set",  55.5,   None,   116.9,  31.4,   34.9),
    ("25x Absperrung rot/weiß 2m",       "set",  2625.0, 2497.5, 2950.75,1657.5, None),
    ("29x Absperrfuß",                   "set",  548.39, 507.5,  758.93, 513.3,  None),
    ("10x Bake rot/weiß",                "set",  460.2,  495.0,  488.7,  175.5,  None),
    ("6x Lampen gelb Batterie",          "set",  148.56, 161.4,  221.7,  288.0,  None),
    ("2x Verkehrsschild Baustelle 123",  "set",  71.4,   58.0,   None,   76.0,   None),
    ("4x Klemme Verkehrsschild",         "set",  8.08,   7.2,    10.04,  8.48,   None),
    ("2x Stange Verkehrsschild 3.50m",   "set",  33.58,  30.0,   54.26,  38.0,   None),
    ("1x Schnur 50m Straßenbauer",       "buc",  8.7,    7.3,    7.34,   4.08,   None),
    ("1x Handstampfer 18/12",            "buc",  101.17, 78.0,   100.43, 56.0,   48.7),
]

supplier_name_map = {
    "Eberle Hald": 0, "Niklaus Baugeräte": 1, "Würth": 2, "HKL": 3, "Förch": 4
}

for product, unit, *supplier_prices in prices:
    for sup_name, price in zip(["Eberle Hald","Niklaus Baugeräte","Würth","HKL","Förch"], supplier_prices):
        if price is None:
            continue
        sup = supplier_objs.get(sup_name)
        if not sup or not sup.id:
            continue
        exists = db.query(SupplierPrice).filter(
            SupplierPrice.supplier_id == sup.id,
            SupplierPrice.product_name == product
        ).first()
        if not exists:
            db.add(SupplierPrice(supplier_id=sup.id, product_name=product, unit=unit, price=price))

print(f"✓ Price list imported")

db.commit()
db.close()
print("\n✅ Seed complete. Backend ready.")
print("   Login: admin@hesti-rossmann.de / HestiAdmin2024!")
