"""
Demo seed — populates all modules with realistic fictitious data.
Run: python seed_demo.py
Idempotent: safe to re-run (skips existing records).
"""
import sys
sys.path.insert(0, ".")

from datetime import date, datetime, timedelta
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.site import Site, SiteStatus
from app.models.cost import Cost, CostCategory, MaterialLog
from app.models.supplier import Supplier, SupplierPrice, PurchaseOrder, PurchaseOrderItem
from app.models.equipment import Equipment, EquipmentStatus, EquipmentMovement
from app.models.employee import Employee, ContractType
from app.models.hausanschluss import Hausanschluss, HausanschlussStatus
from app.models.aufmass import AufmassEntry
from app.models.facturare import Invoice, InvoiceItem
from app.models import (  # noqa – ensure all tables exist
    user, site, cost, supplier, equipment, employee, hausanschluss, aufmass, facturare, document
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def d(s):
    return date.fromisoformat(s)

def dt(s):
    return datetime.fromisoformat(s)

# ── Users ──────────────────────────────────────────────────────────────────────
users_data = [
    ("admin@hesti-rossmann.de", "Administrator",          "HestiAdmin2024!", UserRole.DIRECTOR,       "de"),
    ("ion.popescu@hesti.de",    "Ion Popescu",             "Test1234!",       UserRole.PROJEKT_LEITER, "ro"),
    ("mihai.stan@hesti.de",     "Mihai Stan",              "Test1234!",       UserRole.PROJEKT_LEITER, "ro"),
    ("stefan.nagy@hesti.de",    "Stefan Nagy",             "Test1234!",       UserRole.POLIER,         "ro"),
    ("andrei.rus@hesti.de",     "Andrei Rusu",             "Test1234!",       UserRole.POLIER,         "ro"),
    ("lucia.marin@hesti.de",    "Lucia Marinescu",         "Test1234!",       UserRole.SEF_SANTIER,    "ro"),
    ("elena.ioana@hesti.de",    "Elena Ionescu",           "Test1234!",       UserRole.CALLCENTER,     "ro"),
    ("maria.dobre@hesti.de",    "Maria Dobrinescu",        "Test1234!",       UserRole.CALLCENTER,     "ro"),
    ("radu.aufmass@hesti.de",   "Radu Dumitrescu",         "Test1234!",       UserRole.AUFMASS,        "ro"),
]
user_objs = {}
for email, name, pw, role, lang in users_data:
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(email=email, full_name=name, hashed_password=hash_password(pw), role=role, language=lang)
        db.add(u)
        db.flush()
    user_objs[email] = u
print(f"✓ {len(users_data)} users")

admin   = user_objs["admin@hesti-rossmann.de"]
pl_ion  = user_objs["ion.popescu@hesti.de"]
pl_mihai = user_objs["mihai.stan@hesti.de"]
polier1 = user_objs["stefan.nagy@hesti.de"]
polier2 = user_objs["andrei.rus@hesti.de"]
sef     = user_objs["lucia.marin@hesti.de"]
cc1     = user_objs["elena.ioana@hesti.de"]
aufmass_user = user_objs["radu.aufmass@hesti.de"]

# ── Sites – update with real details ──────────────────────────────────────────
site_updates = {
    "100": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "110": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "120": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "130": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "140": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "150": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "160": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "200": dict(is_baustelle=False, status=SiteStatus.FINISHED, budget=0),
    "300": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "310": dict(is_baustelle=True,  status=SiteStatus.ACTIVE,   budget=185000,
                address="Einsteinstraße 12, 89073 Ulm",
                manager_id=None, start_date=dt("2024-03-01"), end_date=dt("2025-06-30")),
    "320": dict(is_baustelle=True,  status=SiteStatus.ACTIVE,   budget=210000,
                address="Hauptstraße 88, 70173 Stuttgart",
                manager_id=None, start_date=dt("2024-06-15"), end_date=dt("2025-09-30")),
    "400": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "410": dict(is_baustelle=True,  status=SiteStatus.ACTIVE,   budget=95000,
                address="Industriestraße 4, 86916 Kaufering",
                manager_id=None, start_date=dt("2025-01-10"), end_date=dt("2025-08-31")),
    "420": dict(is_baustelle=True,  status=SiteStatus.FINISHED, budget=145000,
                address="Ziegelsteinstraße 55, 90411 Nürnberg",
                manager_id=None, start_date=dt("2024-02-01"), end_date=dt("2024-12-20")),
    "430": dict(is_baustelle=True,  status=SiteStatus.ACTIVE,   budget=128000,
                address="St.-Jobst-Str. 22, 90491 Nürnberg",
                manager_id=None, start_date=dt("2025-02-01"), end_date=dt("2025-11-30")),
    "500": dict(is_baustelle=False, status=SiteStatus.ACTIVE, budget=0),
    "510": dict(is_baustelle=True,  status=SiteStatus.ACTIVE,   budget=76000,
                address="Rothenburger Straße 9, 91438 Bad Windsheim",
                manager_id=None, start_date=dt("2025-03-01"), end_date=dt("2025-10-31")),
}
site_objs = {}
for ks, upd in site_updates.items():
    s = db.query(Site).filter(Site.kostenstelle == ks).first()
    if s:
        # assign managers
        if ks in ("310", "320"):
            upd["manager_id"] = pl_ion.id
        elif ks in ("410", "430", "510"):
            upd["manager_id"] = pl_mihai.id
        elif ks in ("420",):
            upd["manager_id"] = pl_ion.id
        for k, v in upd.items():
            setattr(s, k, v)
        site_objs[ks] = s
db.flush()
print("✓ Sites updated")

# ── Equipment ─────────────────────────────────────────────────────────────────
equipment_data = [
    ("Bagger Volvo EC220E",         "EQ-2021-001", "utilaj",  "Volvo",     "EC220E",   2021, EquipmentStatus.ACTIVE,      "310", dt("2025-09-01"), dt("2025-04-15")),
    ("Minibagger Kubota U27-4",     "EQ-2019-002", "utilaj",  "Kubota",    "U27-4",    2019, EquipmentStatus.ACTIVE,      "410", dt("2025-12-01"), dt("2025-07-10")),
    ("Transporter Mercedes Sprinter","VAN-2022-003","vehicul", "Mercedes",  "Sprinter", 2022, EquipmentStatus.ACTIVE,      "320", dt("2025-11-01"), dt("2025-06-30")),
    ("Transporter Ford Transit",    "VAN-2020-004","vehicul",  "Ford",      "Transit",  2020, EquipmentStatus.MAINTENANCE, None,  dt("2025-08-01"), dt("2025-03-28")),
    ("Lkw MAN TGM 18.290",          "VAN-2018-005","vehicul",  "MAN",       "TGM 18.290",2018,EquipmentStatus.ACTIVE,     "430", dt("2026-02-01"), dt("2025-05-15")),
    ("Rüttelplatte Wacker DPU6555", "EQ-2020-006","unealta",  "Wacker",    "DPU6555",  2020, EquipmentStatus.ACTIVE,      "510", None,             None),
    ("Pressluftbohrmaschine Hilti", "EQ-2023-007","unealta",  "Hilti",     "TE 1000",  2023, EquipmentStatus.ACTIVE,      "320", None,             None),
    ("Betonmischer 350L",           "EQ-2017-008","unealta",  "Altrad",    "ETL350",   2017, EquipmentStatus.RETIRED,     None,  None,             None),
    ("Anhänger 3.5t",               "TRL-2022-009","vehicul",  "Humbaur",   "HS 353018",2022,EquipmentStatus.ACTIVE,      "410", None,             None),
    ("Lichtmast LED 4x18W",         "EQ-2021-010","unealta",  "Petzl",     "NOAS LED", 2021, EquipmentStatus.ACTIVE,      "430", None,             None),
]
eq_objs = {}
for name, serial, cat, brand, model, year, status, site_ks, svc_due, itp_due in equipment_data:
    eq = db.query(Equipment).filter(Equipment.serial_number == serial).first()
    if not eq:
        site_id = site_objs[site_ks].id if site_ks else None
        eq = Equipment(
            name=name, serial_number=serial, category=cat, brand=brand, model=model,
            year=year, status=status, current_site_id=site_id,
            service_due=svc_due, itp_due=itp_due
        )
        db.add(eq)
    eq_objs[serial] = eq
db.flush()
print(f"✓ {len(equipment_data)} equipment")

# ── Equipment movements ────────────────────────────────────────────────────────
movements = [
    ("EQ-2021-001", None, "310", dt("2024-03-05"), "Mobilizat la șantier Geodesia Ulm"),
    ("VAN-2022-003", None, "320", dt("2024-06-20"), "Repartizat Stuttgart"),
    ("EQ-2019-002", "320", "410", dt("2025-01-12"), "Transfer la Kaufering"),
    ("VAN-2020-004", "430", None, dt("2025-03-15"), "Retras pentru service prelungit"),
]
for serial, from_ks, to_ks, moved_at, notes in movements:
    eq = eq_objs.get(serial)
    if not eq:
        continue
    from_id = site_objs[from_ks].id if from_ks else None
    to_id   = site_objs[to_ks].id   if to_ks   else None
    exists = db.query(EquipmentMovement).filter(
        EquipmentMovement.equipment_id == eq.id,
        EquipmentMovement.notes == notes
    ).first()
    if not exists:
        db.add(EquipmentMovement(
            equipment_id=eq.id, from_site_id=from_id, to_site_id=to_id,
            moved_by=admin.id, moved_at=moved_at, notes=notes
        ))
print(f"✓ {len(movements)} equipment movements")

# ── Employees ─────────────────────────────────────────────────────────────────
employees_data = [
    ("Florin",    "Brătianu",   "1988-04-12", "București",      "RO", 1, "Tiefbauer",        ContractType.UNBEFRISTET, "2022-03-01", 14.73, 1850),
    ("Cosmin",    "Dănilă",     "1991-07-22", "Iași",           "RO", 2, "Tiefbauer",        ContractType.UNBEFRISTET, "2023-01-15", 14.73, 1850),
    ("Gheorghe",  "Munteanu",   "1979-11-03", "Cluj-Napoca",    "RO", 1, "Bauhelfer",        ContractType.UNBEFRISTET, "2021-05-10", 13.90, 1750),
    ("Vasile",    "Ciobanu",    "1985-02-28", "Suceava",        "RO", 1, "Leitungstiefbauer",ContractType.UNBEFRISTET, "2022-09-01", 15.50, 1950),
    ("Petru",     "Dumitru",    "1993-08-17", "Timișoara",      "RO", 0, "Bauhelfer",        ContractType.BEFRISTET,   "2025-01-20", 13.90, 1750),
    ("Ionuț",     "Constantin", "1990-05-06", "Brăila",         "RO", 1, "Tiefbauer",        ContractType.UNBEFRISTET, "2023-06-01", 14.73, 1850),
    ("Marian",    "Popa",       "1986-09-19", "Ploiești",       "RO", 1, "Polier",           ContractType.UNBEFRISTET, "2020-04-01", 17.50, 2200),
    ("Daniel",    "Ionescu",    "1994-03-11", "Galați",         "RO", 0, "Bauhelfer",        ContractType.MINIJOB,     "2025-02-01", 13.50, 0),
    ("Cristian",  "Luca",       "1982-12-01", "Bacău",          "RO", 1, "Tiefbauer",        ContractType.UNBEFRISTET, "2019-08-15", 15.00, 1900),
    ("Alexandru", "Neagu",      "1997-06-25", "Constanța",      "RO", 0, "Bauhelfer",        ContractType.BEFRISTET,   "2025-03-01", 13.90, 1750),
    ("Bogdan",    "Radu",       "1989-10-30", "Pitești",        "RO", 0, "Tiefbauer",        ContractType.UNBEFRISTET, "2022-11-01", 14.73, 1850),
    ("Liviu",     "Stoica",     "1975-01-14", "Craiova",        "RO", 1, "Leitungstiefbauer",ContractType.UNBEFRISTET, "2018-03-01", 16.00, 2050),
]
for vorname, nachname, geb, geburtsort, nat, kinder_anz, taetigkeit, ctype, arbeitsbeginn, lohn, tariflohn in employees_data:
    exists = db.query(Employee).filter(
        Employee.vorname == vorname, Employee.nachname == nachname
    ).first()
    if not exists:
        db.add(Employee(
            vorname=vorname, nachname=nachname,
            geburtsdatum=d(geb), geburtsort=geburtsort,
            nationalitaet=nat,
            kinder=(kinder_anz > 0), kinder_anzahl=kinder_anz,
            taetigkeit=taetigkeit,
            contract_type=ctype,
            arbeitsbeginn=d(arbeitsbeginn),
            lohngruppe=2 if lohn >= 15 else 1,
            tariflohn=lohn,
            bauzuschlag=0.72,
            steuerklasse=2 if kinder_anz > 0 else 1,
            krankenkasse="TK – Techniker Krankenkasse",
            is_active=True,
        ))
print(f"✓ {len(employees_data)} employees")

# ── Costs ─────────────────────────────────────────────────────────────────────
costs_data = [
    # (ks, category, description, amount, currency, invoice_ref, supplier, date_str)
    ("310", "manopera",     "Lohnkosten März 2025",             12400, "EUR", "LK-310-03/25",  None,              "2025-03-31"),
    ("310", "manopera",     "Lohnkosten Februar 2025",          11850, "EUR", "LK-310-02/25",  None,              "2025-02-28"),
    ("310", "materiale",    "Kabelrohr DN110 – 500m",           3840,  "EUR", "EH-24031",      "Eberle Hald",     "2025-03-10"),
    ("310", "materiale",    "Sand BIS 0/2 – 80t",               2240,  "EUR", "KM-28712",      "Köster Materialien","2025-03-05"),
    ("310", "utilaje",      "Baggermiete Volvo EC220E März",    4200,  "EUR", "HKL-88441",     "HKL",             "2025-03-31"),
    ("310", "combustibil",  "Diesel März – Sprinter + Bagger",  980,   "EUR", "BP-22031",      "BP Tankstelle",   "2025-03-31"),
    ("310", "transport",    "LKW-Fuhren Sand/Erde",             1150,  "EUR", "TR-0315",       "Müller Transport","2025-03-20"),
    ("320", "manopera",     "Lohnkosten März 2025",             13600, "EUR", "LK-320-03/25",  None,              "2025-03-31"),
    ("320", "materiale",    "Schutzrohr FZR 50mm – 2000m",     5600,  "EUR", "EH-24098",      "Eberle Hald",     "2025-03-12"),
    ("320", "materiale",    "Splitt 8/16 – 120t",               3120,  "EUR", "KM-28819",      "Köster Materialien","2025-03-08"),
    ("320", "utilaje",      "Rüttelplatte Miete Feb–März",      620,   "EUR", "NK-5512",       "Niklaus Baugeräte","2025-03-28"),
    ("320", "combustibil",  "Diesel März – Fuhrpark",           1240,  "EUR", "BP-22098",      "BP Tankstelle",   "2025-03-31"),
    ("410", "manopera",     "Lohnkosten März 2025",             8200,  "EUR", "LK-410-03/25",  None,              "2025-03-31"),
    ("410", "materiale",    "Kabelduktrohre D63 – 1000m",      2950,  "EUR", "EH-24112",      "Eberle Hald",     "2025-03-14"),
    ("410", "combustibil",  "Diesel März",                      620,   "EUR", "BP-22115",      "BP Tankstelle",   "2025-03-31"),
    ("430", "manopera",     "Lohnkosten März 2025",             9400,  "EUR", "LK-430-03/25",  None,              "2025-03-31"),
    ("430", "materiale",    "Lehrrohre PE-Flex 40mm",           1870,  "EUR", "EH-24125",      "Eberle Hald",     "2025-03-15"),
    ("430", "subcontractori","Fugarbeiten Pflaster",             6800,  "EUR", "SC-430-001",    "Pflasterbau Hess","2025-03-18"),
    ("510", "manopera",     "Lohnkosten März 2025",             6100,  "EUR", "LK-510-03/25",  None,              "2025-03-31"),
    ("510", "materiale",    "Kabelkanal 110x75 – 300m",        1540,  "EUR", "EH-24130",      "Eberle Hald",     "2025-03-16"),
    ("420", "manopera",     "Lohnkosten Dez 2024 (abgeschlossen)",14200,"EUR","LK-420-12/24", None,              "2024-12-31"),
    ("420", "materiale",    "Restmaterial Nürnberg ZS",         3200,  "EUR", "EH-23998",      "Eberle Hald",     "2024-12-15"),
    ("110", "alte",         "Bürobedarf März",                  280,   "EUR", "BED-0325",      "Staples",         "2025-03-05"),
    ("110", "alte",         "Telefonkosten Q1 2025",            415,   "EUR", "TEL-Q1/25",     "Telekom",         "2025-03-31"),
    ("140", "combustibil",  "Diesel Tankkarte Fuhrpark Büro",   890,   "EUR", "BP-22200",      "BP Tankstelle",   "2025-03-31"),
]
for ks, cat, desc, amount, currency, ref, sup, date_str in costs_data:
    s = site_objs.get(ks)
    if not s:
        continue
    exists = db.query(Cost).filter(
        Cost.site_id == s.id, Cost.description == desc
    ).first()
    if not exists:
        db.add(Cost(
            site_id=s.id, category=CostCategory(cat),
            description=desc, amount=amount, currency=currency,
            invoice_ref=ref, supplier=sup,
            date=dt(date_str), recorded_by=admin.id
        ))
print(f"✓ {len(costs_data)} costs")

# ── Material logs ─────────────────────────────────────────────────────────────
materials = [
    ("310", "Kabelrohr DN110",          500,  "m",   "2025-03-10"),
    ("310", "Sand BIS 0/2",             80,   "t",   "2025-03-05"),
    ("310", "Kabelmuffenset 4-polig",   24,   "buc", "2025-03-12"),
    ("320", "Schutzrohr FZR 50mm",      2000, "m",   "2025-03-12"),
    ("320", "Splitt 8/16",              120,  "t",   "2025-03-08"),
    ("410", "Kabelduktrohre D63",       1000, "m",   "2025-03-14"),
    ("410", "Sandsack 25Kg",            80,   "buc", "2025-03-20"),
    ("430", "Lehrrohre PE-Flex 40mm",   850,  "m",   "2025-03-15"),
    ("510", "Kabelkanal 110x75",        300,  "m",   "2025-03-16"),
]
for ks, material, qty, unit, date_str in materials:
    s = site_objs.get(ks)
    if not s:
        continue
    exists = db.query(MaterialLog).filter(
        MaterialLog.site_id == s.id, MaterialLog.material == material
    ).first()
    if not exists:
        db.add(MaterialLog(
            site_id=s.id, material=material, quantity=qty, unit=unit,
            recorded_by=admin.id, date=dt(date_str)
        ))
print(f"✓ {len(materials)} material logs")

# ── Hausanschluss ─────────────────────────────────────────────────────────────
hausanschluss_data = [
    ("Weber, Karl",       "+49 731 4421882", "karl.weber@web.de",      "Schillerstr. 14",    "Ulm",         "89073", "Fiber", HausanschlussStatus.DONE,        dt("2025-02-12 08:00"), "310"),
    ("Maier, Anna",       "+49 711 2234567", "a.maier@gmx.de",         "Friedrichstr. 33",   "Stuttgart",   "70174", "Fiber", HausanschlussStatus.DONE,        dt("2025-03-05 09:00"), "320"),
    ("Schulze, Bernd",    "+49 731 5551234", None,                     "Blaubeurer Str. 7",  "Ulm",         "89077", "Fiber", HausanschlussStatus.SCHEDULED,   dt("2025-04-10 08:00"), "310"),
    ("Hoffmann, Gisela",  "+49 731 8882211", "g.hoffmann@t-online.de", "Neue Str. 22",       "Ulm",         "89073", "Gas",   HausanschlussStatus.SCHEDULED,   dt("2025-04-11 10:00"), "310"),
    ("Müller, Frank",     "+49 8191 44321",  "f.mueller@gmail.com",    "Hauptstr. 55",       "Kaufering",   "86916", "Fiber", HausanschlussStatus.IN_PROGRESS, dt("2025-03-20 07:30"), "410"),
    ("Braun, Ines",       "+49 9128 33211",  None,                     "Ziegelstein 8",      "Nürnberg",    "90411", "Fiber", HausanschlussStatus.DONE,        dt("2025-01-22 08:00"), "430"),
    ("Koch, Heinz",       "+49 9128 55442",  "h.koch@web.de",          "Buchenbühl 12",      "Nürnberg",    "90489", "Power", HausanschlussStatus.NEW,         None,                   "430"),
    ("Richter, Sandra",   "+49 9841 22190",  "s.richter@gmx.de",       "Rothenburger Str. 18","Bad Windsheim","91438","Fiber",HausanschlussStatus.SCHEDULED,  dt("2025-04-14 08:00"), "510"),
    ("Fischer, Werner",   "+49 9841 56789",  None,                     "Am Marktplatz 3",    "Bad Windsheim","91438","Fiber",HausanschlussStatus.NEW,         None,                   "510"),
    ("Krause, Petra",     "+49 711 9988776", "p.krause@yahoo.de",      "Hölderlinplatz 5",   "Stuttgart",   "70193", "Fiber", HausanschlussStatus.CANCELLED,  None,                   "320"),
    ("Zimmermann, Olaf",  "+49 731 6611220", None,                     "Listenhammer Str. 3","Ulm",         "89079", "Fiber", HausanschlussStatus.NEW,         None,                   "310"),
    ("Wagner, Helga",     "+49 731 2200449", "h.wagner@web.de",        "Kornhausplatz 2",    "Ulm",         "89073", "Gas",   HausanschlussStatus.SCHEDULED,  dt("2025-04-16 09:30"), "310"),
]
for cn, phone, email, addr, city, zip_, ctype, status, sched, site_ks in hausanschluss_data:
    exists = db.query(Hausanschluss).filter(
        Hausanschluss.client_name == cn, Hausanschluss.address == addr
    ).first()
    if not exists:
        site_id = site_objs[site_ks].id if site_ks else None
        db.add(Hausanschluss(
            client_name=cn, client_phone=phone, client_email=email,
            address=addr, city=city, zip_code=zip_,
            connection_type=ctype, status=status,
            scheduled_date=sched,
            assigned_site_id=site_id,
            assigned_team_id=polier1.id,
            created_by=cc1.id,
        ))
print(f"✓ {len(hausanschluss_data)} Hausanschluss entries")

# ── Purchase orders ────────────────────────────────────────────────────────────
sup_eberle  = db.query(Supplier).filter(Supplier.name == "Eberle Hald").first()
sup_wuerth  = db.query(Supplier).filter(Supplier.name == "Würth").first()
sup_hkl     = db.query(Supplier).filter(Supplier.name == "HKL").first()
sup_foerch  = db.query(Supplier).filter(Supplier.name == "Förch").first()
sup_niklaus = db.query(Supplier).filter(Supplier.name == "Niklaus Baugeräte").first()

orders_data = [
    {
        "site_ks": "310", "status": "sent", "notes": "Ausrüstung für neue Kolonne Ulm",
        "created_at": dt("2025-02-28"), "approved_at": dt("2025-03-01"),
        "items": [
            (sup_eberle, "2x Schubkarre",                "set", 1, 213.62),
            (sup_eberle, "4x Schaufel mit Stiel Holsteiner","set",1, 61.04),
            (sup_eberle, "2x Bauhelm gelb",              "set", 2, 19.04),
            (sup_wuerth, "1x Schraubendreher Set",       "set", 2, 9.52),
        ]
    },
    {
        "site_ks": "320", "status": "approved", "notes": "Sicherheitsausrüstung Stuttgart",
        "created_at": dt("2025-03-10"), "approved_at": dt("2025-03-11"),
        "items": [
            (sup_eberle, "25x Absperrung rot/weiß 2m",  "set", 1, 2625.0),
            (sup_eberle, "29x Absperrfuß",              "set", 1, 548.39),
            (sup_eberle, "6x Lampen gelb Batterie",     "set", 1, 148.56),
        ]
    },
    {
        "site_ks": "410", "status": "pending", "notes": "Werkzeug Kaufering Neustart",
        "created_at": dt("2025-03-18"), "approved_at": None,
        "items": [
            (sup_wuerth, "1x Wasserwaage 60cm",         "buc", 3, 6.84),
            (sup_wuerth, "1x Wasserwaage 120cm",        "buc", 2, 13.98),
            (sup_foerch, "1x Handstampfer 18/12",       "buc", 1, 48.7),
        ]
    },
    {
        "site_ks": "430", "status": "sent", "notes": "Mietgeräte Nürnberg St.Jobst",
        "created_at": dt("2025-03-05"), "approved_at": dt("2025-03-06"),
        "items": [
            (sup_hkl,    "1x Längenmessrad",            "buc", 2, 145.0),
            (sup_niklaus,"Rüttelplatte Wacker DPU3050", "buc", 1, 420.0),
        ]
    },
]

for od in orders_data:
    s = site_objs.get(od["site_ks"])
    if not s:
        continue
    # idempotency: check by notes
    existing = db.query(PurchaseOrder).filter(PurchaseOrder.notes == od["notes"]).first()
    if existing:
        continue
    total = sum(qty * up for _, _, _, qty, up in od["items"])
    order = PurchaseOrder(
        site_id=s.id, requested_by=pl_ion.id if od["site_ks"] in ("310","320","420") else pl_mihai.id,
        status=od["status"], total_amount=total, notes=od["notes"],
        created_at=od["created_at"], approved_at=od["approved_at"]
    )
    db.add(order)
    db.flush()
    for sup_obj, product, unit, qty, up in od["items"]:
        if not sup_obj:
            continue
        db.add(PurchaseOrderItem(
            order_id=order.id, supplier_id=sup_obj.id,
            product_name=product, quantity=qty, unit=unit,
            unit_price=up, total_price=qty * up,
            email_sent=(od["status"] == "sent")
        ))
print(f"✓ {len(orders_data)} purchase orders")

# ── Aufmaß entries ─────────────────────────────────────────────────────────────
aufmass_entries = [
    # (ks, date, position, description, unit, qty, unit_price, status)
    ("310", "2025-02-28", "1.1", "Erdaushub Kabelgraben b=0.40m, t=0.80m",           "m",   850, 12.50, "approved"),
    ("310", "2025-02-28", "1.2", "Sandeinbettung 0/2, 10cm Dicke",                   "m",   850,  3.20, "approved"),
    ("310", "2025-02-28", "1.3", "Kabelrohr DN110 liefern u. verlegen",               "m",   820, 18.50, "approved"),
    ("310", "2025-03-15", "1.4", "Erdaushub Kabelgraben b=0.40m, t=0.80m",           "m",   620, 12.50, "submitted"),
    ("310", "2025-03-15", "1.5", "Sandeinbettung 0/2, 10cm Dicke",                   "m",   620,  3.20, "submitted"),
    ("310", "2025-03-31", "1.6", "Kabelrohr DN110 liefern u. verlegen",               "m",   600, 18.50, "draft"),
    ("320", "2025-03-01", "2.1", "Grabenherstellung Schutzrohr FZR 50mm",             "m",   1200, 9.80, "approved"),
    ("320", "2025-03-01", "2.2", "Schutzrohr FZR 50mm liefern u. verlegen",          "m",   1180, 14.20, "approved"),
    ("320", "2025-03-20", "2.3", "Grabenherstellung Schutzrohr FZR 50mm",             "m",   800,  9.80, "submitted"),
    ("320", "2025-03-20", "2.4", "Verdichtung Hinterfüllung mit Splitt 8/16",        "m",   800,  4.50, "submitted"),
    ("410", "2025-02-15", "3.1", "Erdaushub Kabelduktrohre D63",                     "m",   650, 11.20, "approved"),
    ("410", "2025-02-15", "3.2", "Kabelduktrohre D63 liefern u. verlegen",           "m",   630, 16.80, "approved"),
    ("410", "2025-03-10", "3.3", "Erdaushub Kabelduktrohre D63",                     "m",   420, 11.20, "submitted"),
    ("430", "2025-02-20", "4.1", "Grabenherstellung Leerrohre PE-Flex",               "m",   520,  9.80, "approved"),
    ("430", "2025-02-20", "4.2", "Leerrohre PE-Flex 40mm liefern u. verlegen",       "m",   500, 13.40, "approved"),
    ("430", "2025-03-05", "4.3", "Pflasterarbeiten Deckschicht wiederherstellen",     "m²",  310, 28.50, "approved"),
    ("430", "2025-03-25", "4.4", "Grabenherstellung Leerrohre PE-Flex",               "m",   380,  9.80, "draft"),
    ("510", "2025-03-05", "5.1", "Kabelkanalverlegung 110x75",                        "m",   280, 22.00, "approved"),
    ("510", "2025-03-05", "5.2", "Mauerwerköffnung u. Schließen",                     "buc", 14, 85.00, "approved"),
    ("510", "2025-03-18", "5.3", "Kabelkanalverlegung 110x75",                        "m",   150, 22.00, "submitted"),
]
aufmass_objs = []
for ks, date_str, pos, desc, unit, qty, up, status in aufmass_entries:
    s = site_objs.get(ks)
    if not s:
        continue
    exists = db.query(AufmassEntry).filter(
        AufmassEntry.site_id == s.id, AufmassEntry.position == pos,
        AufmassEntry.description == desc
    ).first()
    if not exists:
        ae = AufmassEntry(
            site_id=s.id, date=d(date_str), position=pos, description=desc,
            unit=unit, quantity=qty, unit_price=up, total_price=round(qty * up, 2),
            recorded_by=aufmass_user.id, status=status
        )
        db.add(ae)
        aufmass_objs.append((ae, ks, pos))
db.flush()
print(f"✓ {len(aufmass_entries)} Aufmaß entries")

# ── Invoices ───────────────────────────────────────────────────────────────────
# Recalculate year-based counter fresh
def next_invoice_number(year):
    from sqlalchemy import extract, func as sqlfunc
    count = db.query(sqlfunc.count(Invoice.id)).filter(
        extract("year", Invoice.created_at) == year
    ).scalar() or 0
    return f"RE-{year}-{count + 1:04d}"

invoices_data = [
    {
        "site_ks": "310", "client_name": "Geodesia GmbH", "status": "paid",
        "client_address": "Technologiepark 8, 89079 Ulm",
        "client_email": "rechnungen@geodesia.de",
        "issue_date": d("2025-01-31"), "due_date": d("2025-02-28"),
        "paid_at": dt("2025-02-20"),
        "items": [
            ("1.1", "Erdaushub Kabelgraben b=0.40m, t=0.80m",    "m",   420, 12.50),
            ("1.2", "Sandeinbettung 0/2, 10cm Dicke",             "m",   420,  3.20),
            ("1.3", "Kabelrohr DN110 liefern u. verlegen",         "m",   400, 18.50),
        ]
    },
    {
        "site_ks": "310", "client_name": "Geodesia GmbH", "status": "paid",
        "client_address": "Technologiepark 8, 89079 Ulm",
        "client_email": "rechnungen@geodesia.de",
        "issue_date": d("2025-02-28"), "due_date": d("2025-03-31"),
        "paid_at": dt("2025-03-18"),
        "items": [
            ("1.1", "Erdaushub Kabelgraben b=0.40m, t=0.80m",    "m",   850, 12.50),
            ("1.2", "Sandeinbettung 0/2, 10cm Dicke",             "m",   850,  3.20),
            ("1.3", "Kabelrohr DN110 liefern u. verlegen",         "m",   820, 18.50),
        ]
    },
    {
        "site_ks": "320", "client_name": "Geodesia GmbH", "status": "sent",
        "client_address": "Technologiepark 8, 89079 Ulm",
        "client_email": "rechnungen@geodesia.de",
        "issue_date": d("2025-03-05"), "due_date": d("2025-04-05"),
        "items": [
            ("2.1", "Grabenherstellung Schutzrohr FZR 50mm",      "m",  1200,  9.80),
            ("2.2", "Schutzrohr FZR 50mm liefern u. verlegen",    "m",  1180, 14.20),
        ]
    },
    {
        "site_ks": "430", "client_name": "Fiber Export GmbH", "status": "paid",
        "client_address": "Speditionsstraße 3, 40221 Düsseldorf",
        "client_email": "buchhaltung@fiber-export.de",
        "issue_date": d("2025-02-28"), "due_date": d("2025-03-31"),
        "paid_at": dt("2025-03-25"),
        "items": [
            ("4.1", "Grabenherstellung Leerrohre PE-Flex",         "m",   520,  9.80),
            ("4.2", "Leerrohre PE-Flex 40mm liefern u. verlegen",  "m",   500, 13.40),
            ("4.3", "Pflasterarbeiten Deckschicht wiederherstellen","m²",  310, 28.50),
        ]
    },
    {
        "site_ks": "410", "client_name": "Fiber Export GmbH", "status": "paid",
        "client_address": "Speditionsstraße 3, 40221 Düsseldorf",
        "client_email": "buchhaltung@fiber-export.de",
        "issue_date": d("2025-02-28"), "due_date": d("2025-03-31"),
        "paid_at": dt("2025-03-22"),
        "items": [
            ("3.1", "Erdaushub Kabelduktrohre D63",                "m",   650, 11.20),
            ("3.2", "Kabelduktrohre D63 liefern u. verlegen",      "m",   630, 16.80),
        ]
    },
    {
        "site_ks": "510", "client_name": "Axians GmbH", "status": "sent",
        "client_address": "Konrad-Zuse-Ring 21, 68163 Mannheim",
        "client_email": "invoice@axians.de",
        "issue_date": d("2025-03-10"), "due_date": d("2025-04-10"),
        "items": [
            ("5.1", "Kabelkanalverlegung 110x75",                  "m",   280, 22.00),
            ("5.2", "Mauerwerköffnung u. Schließen",               "buc",  14, 85.00),
        ]
    },
    {
        "site_ks": "310", "client_name": "Geodesia GmbH", "status": "draft",
        "client_address": "Technologiepark 8, 89079 Ulm",
        "client_email": "rechnungen@geodesia.de",
        "issue_date": d("2025-03-31"), "due_date": d("2025-04-30"),
        "items": [
            ("1.4", "Erdaushub Kabelgraben b=0.40m, t=0.80m",    "m",   620, 12.50),
            ("1.5", "Sandeinbettung 0/2, 10cm Dicke",             "m",   620,  3.20),
        ]
    },
]

inv_counter = {}
for inv_data in invoices_data:
    year = inv_data["issue_date"].year
    inv_counter[year] = inv_counter.get(year, 0) + 1
    inv_number = f"RE-{year}-{inv_counter[year]:04d}"

    existing = db.query(Invoice).filter(Invoice.invoice_number == inv_number).first()
    if existing:
        continue

    s = site_objs.get(inv_data["site_ks"])
    subtotal = sum(qty * up for _, _, _, qty, up in inv_data["items"])
    vat_rate = 19.0
    vat_amount = round(subtotal * vat_rate / 100, 2)
    total = round(subtotal + vat_amount, 2)

    inv = Invoice(
        invoice_number=inv_number,
        site_id=s.id if s else None,
        client_name=inv_data["client_name"],
        client_address=inv_data.get("client_address"),
        client_email=inv_data.get("client_email"),
        issue_date=inv_data["issue_date"],
        due_date=inv_data.get("due_date"),
        status=inv_data["status"],
        subtotal=subtotal,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total=total,
        payment_ref=f"Rechnung {inv_number}",
        created_by=admin.id,
        paid_at=inv_data.get("paid_at"),
    )
    db.add(inv)
    db.flush()
    for pos, desc, unit, qty, up in inv_data["items"]:
        db.add(InvoiceItem(
            invoice_id=inv.id, position=pos, description=desc,
            unit=unit, quantity=qty, unit_price=up, total_price=round(qty * up, 2)
        ))

print(f"✓ {len(invoices_data)} invoices")

db.commit()
db.close()
print("\n✅ Demo seed complete.")
print("   Users:")
print("   admin@hesti-rossmann.de / HestiAdmin2024!")
print("   ion.popescu@hesti.de / Test1234!  (Projekt Leiter)")
print("   stefan.nagy@hesti.de / Test1234!  (Polier)")
print("   elena.ioana@hesti.de / Test1234!  (Callcenter)")
print("   radu.aufmass@hesti.de / Test1234! (Aufmaß)")
