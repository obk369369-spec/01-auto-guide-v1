"""Tool1 verified-data regression contract recovered from historical user feedback.

This is a production guard for the real Tool1 repository. It does not rebuild the
stable guide UI. It blocks synthetic/unverified report payloads before guide output
and defines the one-click feedback event contract used by the central feedback loop.
"""
from __future__ import annotations

from urllib.parse import urlparse

REQUIRED_REPORT_FIELDS = (
    "title_en",
    "title_ko",
    "publisher",
    "publication_date",
    "pages",
    "list_price",
    "supply_price",
    "report_link",
    "toc",
)

SYNTHETIC_TOKENS = (
    "example.com",
    "worldic placeholder",
    "market report 1",
    "market report 2",
    "market report 3",
    "market report 4",
    "market report 5",
)

ALLOWED_FEEDBACK_AREAS = {
    "TITLE.EN",
    "TITLE.KO",
    "META.PUBLISHER",
    "META.DATE",
    "META.PAGES",
    "META.PRICE",
    "META.SUPPLY_PRICE",
    "LINK.TEXT",
    "TOC.TEXT",
}


def _text(value):
    return str(value or "").strip()


def validate_report_payload(payload):
    """A report may enter the guide only when every production field is verified.

    `verified_fields` must explicitly contain every required field; absence is HOLD,
    not an invitation to invent data.
    """
    missing = [k for k in REQUIRED_REPORT_FIELDS if not _text(payload.get(k))]
    verified = set(payload.get("verified_fields") or ())
    unverified = [k for k in REQUIRED_REPORT_FIELDS if k not in verified]

    haystack = " ".join(_text(payload.get(k)).casefold() for k in REQUIRED_REPORT_FIELDS)
    synthetic_hits = [token for token in SYNTHETIC_TOKENS if token in haystack]

    link = _text(payload.get("report_link"))
    parsed = urlparse(link) if link else None
    invalid_link = bool(link) and parsed.scheme not in {"http", "https"}

    if missing or unverified or synthetic_hits or invalid_link:
        return {
            "state": "HOLD",
            "error_hash": "TOOL001_REAL_REPORT_VERIFICATION_GATE",
            "missing": sorted(missing),
            "unverified": sorted(unverified),
            "synthetic_hits": synthetic_hits,
            "invalid_link": invalid_link,
        }
    return {
        "state": "PASS",
        "error_hash": None,
        "missing": [],
        "unverified": [],
        "synthetic_hits": [],
        "invalid_link": False,
    }


def validate_customer_context(customer):
    """Customer-targeted guide generation requires explicit, verified context."""
    required = ("customer_id", "organization", "actual_duty", "context_source")
    missing = [k for k in required if not _text(customer.get(k))]
    if not customer.get("actual_duty_verified", False):
        missing.append("actual_duty_verified")
    if missing:
        return {
            "state": "HOLD",
            "error_hash": "TOOL001_CUSTOMER_CONTEXT_UNVERIFIED",
            "missing": sorted(set(missing)),
        }
    return {"state": "PASS", "error_hash": None, "missing": []}


def validate_guide_candidate(customer, reports):
    """No guide PASS unless customer context and every included report pass."""
    customer_result = validate_customer_context(customer)
    if customer_result["state"] != "PASS":
        return {"state": "HOLD", "customer": customer_result, "reports": []}

    report_results = [validate_report_payload(r) for r in reports]
    if not reports or any(x["state"] != "PASS" for x in report_results):
        return {"state": "HOLD", "customer": customer_result, "reports": report_results}
    return {"state": "PASS", "customer": customer_result, "reports": report_results}


def build_feedback_event(*, guide_id, report_link, area_id, observed_value, corrected_value, note=""):
    """One click -> one structured correction event; no whole-chat context merge."""
    if area_id not in ALLOWED_FEEDBACK_AREAS:
        return {
            "state": "HOLD",
            "error_hash": "TOOL001_UNKNOWN_FEEDBACK_AREA",
            "area_id": area_id,
        }
    if not _text(guide_id) or not _text(report_link) or not _text(corrected_value):
        return {
            "state": "HOLD",
            "error_hash": "TOOL001_FEEDBACK_EVENT_INCOMPLETE",
            "area_id": area_id,
        }
    return {
        "state": "PASS",
        "classification": "CORRECTION",
        "target": "TOOL001",
        "guide_id": _text(guide_id),
        "report_link": _text(report_link),
        "area_id": area_id,
        "observed_value": _text(observed_value),
        "corrected_value": _text(corrected_value),
        "note": _text(note),
    }


def run_fixtures():
    customer = {
        "customer_id": "C-001",
        "organization": "Verified Org",
        "actual_duty": "verified duty",
        "context_source": "official source",
        "actual_duty_verified": True,
    }
    report = {
        "title_en": "Verified Market Report",
        "title_ko": "검증된 시장보고서",
        "publisher": "Verified Publisher",
        "publication_date": "2026-05",
        "pages": "250",
        "list_price": "USD 4,500",
        "supply_price": "KRW verified quote",
        "report_link": "https://publisher.example/verified-report",
        "toc": "1. Scope\n2. Market\n3. Companies",
        "verified_fields": REQUIRED_REPORT_FIELDS,
    }

    assert validate_report_payload(report)["state"] == "PASS"

    missing = dict(report); missing["pages"] = ""
    assert validate_report_payload(missing)["error_hash"] == "TOOL001_REAL_REPORT_VERIFICATION_GATE"

    unverified = dict(report); unverified["verified_fields"] = tuple(k for k in REQUIRED_REPORT_FIELDS if k != "list_price")
    assert "list_price" in validate_report_payload(unverified)["unverified"]

    synthetic = dict(report); synthetic["report_link"] = "https://example.com/report-1"
    assert validate_report_payload(synthetic)["state"] == "HOLD"

    bad_link = dict(report); bad_link["report_link"] = "javascript:fake"
    assert validate_report_payload(bad_link)["invalid_link"] is True

    assert validate_customer_context(customer)["state"] == "PASS"
    bad_customer = dict(customer); bad_customer["actual_duty_verified"] = False
    assert validate_customer_context(bad_customer)["state"] == "HOLD"

    assert validate_guide_candidate(customer, [report])["state"] == "PASS"
    assert validate_guide_candidate(customer, [synthetic])["state"] == "HOLD"
    assert validate_guide_candidate(customer, [])["state"] == "HOLD"

    feedback = build_feedback_event(
        guide_id="G-001",
        report_link=report["report_link"],
        area_id="META.DATE",
        observed_value="2025-05",
        corrected_value="2026-05",
        note="publisher page correction",
    )
    assert feedback["state"] == "PASS" and feedback["classification"] == "CORRECTION"

    bad_feedback = build_feedback_event(
        guide_id="G-001",
        report_link=report["report_link"],
        area_id="UNKNOWN",
        observed_value="x",
        corrected_value="y",
    )
    assert bad_feedback["error_hash"] == "TOOL001_UNKNOWN_FEEDBACK_AREA"

    return "PASS: 12 deterministic Tool1 verified-data/feedback fixtures"


if __name__ == "__main__":
    print(run_fixtures())
