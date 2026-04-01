from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.core.validators import (
    Str100, OptStr50, OptStr100, OptStr200, OptStr300, OptText,
    OptPhone, OptIBAN, OptBIC,
)
from app.models.employee import Employee, ContractType
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/employees", tags=["employees"])


class EmployeeCreate(BaseModel):
    vorname: Str100
    nachname: Str100
    geburtsdatum: date
    geburtsort: Optional[OptStr100] = None
    geburtsname: Optional[OptStr100] = None
    geschlecht: Optional[OptStr50] = None
    email: Optional[OptStr200] = None
    plz: Optional[OptStr50] = None
    adresse: Optional[OptStr300] = None
    heimatadresse: Optional[OptStr300] = None
    nationalitaet: Optional[OptStr100] = None
    familienstand: Optional[OptStr50] = None
    kinder: bool = False
    kinder_anzahl: int = Field(default=0, ge=0, le=20)
    kinder_pflegev: int = Field(default=0, ge=0, le=20)
    konfession: Optional[OptStr50] = None
    schulabschluss: Optional[OptStr100] = None
    berufsausbildung: Optional[OptStr200] = None
    beschaeftigungsart: Str100 = "Hauptbeschäftigung"
    telefon: Optional[OptPhone] = None
    vorherige_krankenkasse: Optional[OptStr100] = None
    reisepassnummer: Optional[OptStr100] = None
    reisepass_ablauf: Optional[date] = None
    a1_bescheinigung_nr: Optional[OptStr50] = None
    a1_gueltig_von: Optional[date] = None
    a1_gueltig_bis: Optional[date] = None
    arbeitsbeginn: date
    taetigkeit: Str100 = "Bauarbeiter"
    erlernter_beruf: Optional[OptStr100] = None
    lohngruppe: int = Field(default=1, ge=1, le=9)
    tariflohn: float = Field(gt=0, le=999.99)
    bauzuschlag: float = Field(default=0.72, ge=0, le=99.99)
    contract_type: ContractType = ContractType.UNBEFRISTET
    stunden_pro_woche: float = Field(default=40.0, gt=0, le=60)
    probezeit_end: Optional[date] = None
    befristung_bis: Optional[date] = None
    urlaubsanspruch_tage: int = Field(default=30, ge=0, le=365)
    fuehrerschein_klassen: Optional[OptStr50] = None
    fuehrerschein_ablauf: Optional[date] = None
    g25_untersuchung_bis: Optional[date] = None
    erste_hilfe_bis: Optional[date] = None
    soka_bau_nr: Optional[OptStr100] = None
    notfallkontakt_name: Optional[OptStr100] = None
    notfallkontakt_telefon: Optional[OptPhone] = None
    iban: Optional[OptIBAN] = None
    bic: Optional[OptBIC] = None
    kreditinstitut: Optional[OptStr100] = None
    krankenkasse: Optional[OptStr100] = None
    sozialversicherungsnr: Optional[OptStr100] = None
    steuer_id: Optional[OptStr100] = None
    steuerklasse: int = Field(default=1, ge=1, le=6)
    rentenversicherungsnr: Optional[OptStr100] = None
    personalnummer: Optional[OptStr100] = None
    notes: Optional[OptText] = None


class EmployeeUpdate(BaseModel):
    vorname: Optional[Str100] = None
    nachname: Optional[Str100] = None
    adresse: Optional[OptStr300] = None
    heimatadresse: Optional[OptStr300] = None
    telefon: Optional[OptPhone] = None
    taetigkeit: Optional[Str100] = None
    lohngruppe: Optional[int] = Field(default=None, ge=1, le=9)
    tariflohn: Optional[float] = Field(default=None, gt=0, le=999.99)
    bauzuschlag: Optional[float] = Field(default=None, ge=0, le=99.99)
    stunden_pro_woche: Optional[float] = Field(default=None, gt=0, le=60)
    probezeit_end: Optional[date] = None
    befristung_bis: Optional[date] = None
    kuendigungsdatum: Optional[date] = None
    ueberstunden_saldo: Optional[float] = Field(default=None, ge=-9999, le=9999)
    urlaubsanspruch_tage: Optional[int] = Field(default=None, ge=0, le=365)
    fuehrerschein_klassen: Optional[OptStr50] = None
    fuehrerschein_ablauf: Optional[date] = None
    g25_untersuchung_bis: Optional[date] = None
    erste_hilfe_bis: Optional[date] = None
    soka_bau_nr: Optional[OptStr100] = None
    notfallkontakt_name: Optional[OptStr100] = None
    notfallkontakt_telefon: Optional[OptPhone] = None
    reisepassnummer: Optional[OptStr100] = None
    reisepass_ablauf: Optional[date] = None
    a1_bescheinigung_nr: Optional[OptStr50] = None
    a1_gueltig_von: Optional[date] = None
    a1_gueltig_bis: Optional[date] = None
    steuerklasse: Optional[int] = Field(default=None, ge=1, le=6)
    krankenkasse: Optional[OptStr100] = None
    vorherige_krankenkasse: Optional[OptStr100] = None
    kinder_pflegev: Optional[int] = Field(default=None, ge=0, le=20)
    email: Optional[OptStr200] = None
    plz: Optional[OptStr50] = None
    geburtsname: Optional[OptStr100] = None
    geschlecht: Optional[OptStr50] = None
    iban: Optional[OptIBAN] = None
    bic: Optional[OptBIC] = None
    kreditinstitut: Optional[OptStr100] = None
    is_active: Optional[bool] = None
    notes: Optional[OptText] = None


def _emp_dict(e: Employee):
    return {
        "id": e.id,
        "vorname": e.vorname,
        "nachname": e.nachname,
        "geburtsdatum": e.geburtsdatum,
        "geburtsort": e.geburtsort,
        "adresse": e.adresse,
        "heimatadresse": e.heimatadresse,
        "nationalitaet": e.nationalitaet,
        "familienstand": e.familienstand,
        "kinder": e.kinder,
        "kinder_anzahl": e.kinder_anzahl,
        "konfession": e.konfession,
        "schulabschluss": e.schulabschluss,
        "berufsausbildung": e.berufsausbildung,
        "beschaeftigungsart": e.beschaeftigungsart,
        "geburtsname": e.geburtsname,
        "geschlecht": e.geschlecht,
        "email": e.email,
        "plz": e.plz,
        "telefon": e.telefon,
        "kinder_pflegev": e.kinder_pflegev,
        "vorherige_krankenkasse": e.vorherige_krankenkasse,
        "reisepassnummer": e.reisepassnummer,
        "reisepass_ablauf": e.reisepass_ablauf,
        "a1_bescheinigung_nr": e.a1_bescheinigung_nr,
        "a1_gueltig_von": e.a1_gueltig_von,
        "a1_gueltig_bis": e.a1_gueltig_bis,
        "arbeitsbeginn": e.arbeitsbeginn,
        "taetigkeit": e.taetigkeit,
        "erlernter_beruf": e.erlernter_beruf,
        "lohngruppe": e.lohngruppe,
        "tariflohn": e.tariflohn,
        "bauzuschlag": e.bauzuschlag,
        "contract_type": e.contract_type,
        "stunden_pro_woche": e.stunden_pro_woche,
        "probezeit_end": e.probezeit_end,
        "befristung_bis": e.befristung_bis,
        "kuendigungsdatum": e.kuendigungsdatum,
        "ueberstunden_saldo": e.ueberstunden_saldo,
        "urlaubsanspruch_tage": e.urlaubsanspruch_tage,
        "fuehrerschein_klassen": e.fuehrerschein_klassen,
        "fuehrerschein_ablauf": e.fuehrerschein_ablauf,
        "g25_untersuchung_bis": e.g25_untersuchung_bis,
        "erste_hilfe_bis": e.erste_hilfe_bis,
        "soka_bau_nr": e.soka_bau_nr,
        "notfallkontakt_name": e.notfallkontakt_name,
        "notfallkontakt_telefon": e.notfallkontakt_telefon,
        "iban": e.iban,
        "bic": e.bic,
        "kreditinstitut": e.kreditinstitut,
        "krankenkasse": e.krankenkasse,
        "sozialversicherungsnr": e.sozialversicherungsnr,
        "steuer_id": e.steuer_id,
        "steuerklasse": e.steuerklasse,
        "rentenversicherungsnr": e.rentenversicherungsnr,
        "personalnummer": e.personalnummer,
        "is_active": e.is_active,
        "notes": e.notes,
        "created_at": e.created_at,
    }


@router.get("/")
def list_employees(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    emps = db.query(Employee).order_by(Employee.nachname, Employee.vorname).all()
    return [_emp_dict(e) for e in emps]


@router.post("/", status_code=201)
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    emp = Employee(**body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _emp_dict(emp)


@router.get("/{emp_id}/")
def get_employee(emp_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Not found")
    return _emp_dict(emp)


@router.put("/{emp_id}/")
def update_employee(emp_id: int, body: EmployeeUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    db.commit()
    db.refresh(emp)
    return _emp_dict(emp)
