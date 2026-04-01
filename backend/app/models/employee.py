from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Enum, Date
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class ContractType(str, enum.Enum):
    UNBEFRISTET = "unbefristet"
    BEFRISTET   = "befristet"
    MINIJOB     = "minijob"


class Employee(Base):
    __tablename__ = "employees"

    id                      = Column(Integer, primary_key=True, index=True)
    # Personal
    vorname                 = Column(String(100), nullable=False)
    nachname                = Column(String(100), nullable=False)
    geburtsdatum            = Column(Date, nullable=False)
    geburtsort              = Column(String(100))
    adresse                 = Column(String(300))
    heimatadresse           = Column(String(300))     # home country address (for A1)
    geburtsname             = Column(String(100))     # maiden name / Geburtsname
    geschlecht              = Column(String(20))      # männlich / weiblich / divers / unbestimmt
    email                   = Column(String(200))
    plz                     = Column(String(10))      # Postleitzahl
    nationalitaet           = Column(String(100))
    familienstand           = Column(String(50))
    kinder                  = Column(Boolean, default=False)
    kinder_anzahl           = Column(Integer, default=0)
    kinder_pflegev          = Column(Integer, default=0)  # Kinder unter 25 für Pflegeversicherung (Auskunft)
    konfession              = Column(String(50))
    schulabschluss          = Column(String(100))
    berufsausbildung        = Column(String(200))
    beschaeftigungsart      = Column(String(100), default="Hauptbeschäftigung")
    telefon                 = Column(String(30))      # mobile — used for WhatsApp
    vorherige_krankenkasse  = Column(String(100))     # für BKK Mitgliedsantrag
    # Reisedokumente & A1
    reisepassnummer         = Column(String(20))
    reisepass_ablauf        = Column(Date)
    a1_bescheinigung_nr     = Column(String(50))
    a1_gueltig_von          = Column(Date)
    a1_gueltig_bis          = Column(Date)
    # Angajare
    arbeitsbeginn           = Column(Date, nullable=False)
    taetigkeit              = Column(String(100), default="Bauarbeiter")
    erlernter_beruf         = Column(String(100))
    lohngruppe              = Column(Integer, default=1)
    tariflohn               = Column(Float, nullable=False)
    bauzuschlag             = Column(Float, default=0.72)
    contract_type           = Column(Enum(ContractType), default=ContractType.UNBEFRISTET)
    stunden_pro_woche       = Column(Float, default=40.0)
    probezeit_end           = Column(Date)
    befristung_bis          = Column(Date)            # only if BEFRISTET
    kuendigungsdatum        = Column(Date)
    ueberstunden_saldo      = Column(Float, default=0.0)
    # Urlaub & Qualifikationen
    urlaubsanspruch_tage    = Column(Integer, default=30)
    fuehrerschein_klassen   = Column(String(50))      # e.g. "B, C1, C1E"
    fuehrerschein_ablauf    = Column(Date)
    g25_untersuchung_bis    = Column(Date)            # Eignung Fahrer/Maschinen (DGUV)
    erste_hilfe_bis         = Column(Date)
    # Soziales & SOKA-BAU
    soka_bau_nr             = Column(String(30))
    notfallkontakt_name     = Column(String(100))
    notfallkontakt_telefon  = Column(String(30))
    # Financiar
    iban                    = Column(String(34))
    bic                     = Column(String(11))
    kreditinstitut          = Column(String(100))
    krankenkasse            = Column(String(100))
    sozialversicherungsnr   = Column(String(20))
    steuer_id               = Column(String(20))
    steuerklasse            = Column(Integer, default=1)
    rentenversicherungsnr   = Column(String(20))
    personalnummer          = Column(String(20))
    # Status
    is_active               = Column(Boolean, default=True)
    notes                   = Column(Text)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())
