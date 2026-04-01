"""Shared Pydantic annotated types and sanitization helpers for input validation."""
import re
from typing import Annotated, Optional
from pydantic import StringConstraints, BeforeValidator


# ── Sanitizer helpers (applied before Pydantic validation) ───────────────────

def _to_lower(v: object) -> object:
    if isinstance(v, str):
        return v.strip().lower()
    return v


def _normalize_iban(v: object) -> object:
    if isinstance(v, str):
        return v.strip().replace(" ", "").upper()
    return v


def _normalize_bic(v: object) -> object:
    if isinstance(v, str):
        return v.strip().upper()
    return v


def _normalize_phone(v: object) -> object:
    """Strip everything except digits, +, -, space, (, )."""
    if isinstance(v, str):
        cleaned = re.sub(r"[^\d\+\-\s\(\)]", "", v.strip()).strip()
        return cleaned if cleaned else None
    return v


# ── Required string types ─────────────────────────────────────────────────────

Str20  = Annotated[str, StringConstraints(min_length=1, max_length=20,  strip_whitespace=True)]
Str100 = Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]
Str200 = Annotated[str, StringConstraints(min_length=1, max_length=200, strip_whitespace=True)]
Str300 = Annotated[str, StringConstraints(min_length=1, max_length=300, strip_whitespace=True)]

# ── Optional string types ─────────────────────────────────────────────────────

OptStr5   = Annotated[Optional[str], StringConstraints(max_length=5,   strip_whitespace=True)]
OptStr20  = Annotated[Optional[str], StringConstraints(max_length=20,  strip_whitespace=True)]
OptStr50  = Annotated[Optional[str], StringConstraints(max_length=50,  strip_whitespace=True)]
OptStr100 = Annotated[Optional[str], StringConstraints(max_length=100, strip_whitespace=True)]
OptStr200 = Annotated[Optional[str], StringConstraints(max_length=200, strip_whitespace=True)]
OptStr300 = Annotated[Optional[str], StringConstraints(max_length=300, strip_whitespace=True)]
OptStr500 = Annotated[Optional[str], StringConstraints(max_length=500, strip_whitespace=True)]
OptText   = Annotated[Optional[str], StringConstraints(max_length=4000, strip_whitespace=True)]

# ── Specialized types ─────────────────────────────────────────────────────────

EmailReq = Annotated[
    str,
    StringConstraints(min_length=5, max_length=254, strip_whitespace=True),
    BeforeValidator(_to_lower),
]
OptEmail = Annotated[
    Optional[str],
    StringConstraints(max_length=254, strip_whitespace=True),
    BeforeValidator(_to_lower),
]

OptPhone = Annotated[Optional[str], BeforeValidator(_normalize_phone)]
OptIBAN  = Annotated[Optional[str], StringConstraints(max_length=34), BeforeValidator(_normalize_iban)]
OptBIC   = Annotated[Optional[str], StringConstraints(max_length=11), BeforeValidator(_normalize_bic)]

# Password: 8–128 chars (hashed, so keep generous max)
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]

# ISO 4217 currency code
Currency = Annotated[str, StringConstraints(min_length=3, max_length=3, strip_whitespace=True, to_upper=True)]

# Language code (ro / en / de)
LangCode = Annotated[str, StringConstraints(min_length=2, max_length=5, strip_whitespace=True)]
