#!/usr/bin/env python3
"""Turn the prospect workbook into CSV files the existing importer accepts.

Management maintains the prospect base as an Excel workbook, one sheet per
business category, and TrackRoster imports CSV. This converts the former into
the latter and does nothing else: no deduplication, no normalisation beyond
what CSV requires, and no writes to the database. Everything that decides what
happens to a row — validation, duplicate detection, preview, commit, the import
report — stays in the application's own import pipeline, which is tested.

Two things about the workbook drive the whole mapping:

  * The category is the *sheet*, not a column. The seven sheets are exactly the
    seven values of the establishment_category enum, so a row's category is
    known from where it lives rather than from parsing its name. That is why
    there is no substring rule here matching "gendarmerie" or "commissariat".

  * There are two different column layouts. `Prospection` carries 68 columns
    including coordinates; the other six carry 42 and no coordinates. Each
    field below therefore lists every header that has meant it, and the first
    one present wins.

Written in Python because the repository's toolchain has no xlsx reader and an
.xlsx is a zip of XML, which the standard library opens without installing
anything. It is deliberately the only Python in the repository, and it is a
one-way data tool rather than part of the application.

    python3 scripts/convert-prospect-workbook.py <workbook.xlsx> <output-dir>
"""

from __future__ import annotations

import csv
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Sheet name -> establishment_category enum value (migration 0081).
CATEGORIES = {
    "Prospection": "prospection",
    "Justice et enquêtes": "justice_enquetes",
    "Santé": "sante",
    "Asile et social": "asile_social",
    "Douanes et ONAF": "douanes_onaf",
    "CRA": "cra",
    "Prescripteurs": "prescripteurs",
}

# CSV column -> the workbook headers that have meant it, best first.
FIELDS = {
    "external_reference": ["ID TrackRoster"],
    "name": ["Établissement", "Établissement / unité"],
    "address_line1": ["Adresse géographique", "Adresse publiée"],
    "postal_code": ["Code postal"],
    "city": ["Commune"],
    "phone": ["Téléphone public", "Téléphones publics"],
    "website": ["Site internet"],
    "latitude": ["Latitude"],
    "longitude": ["Longitude"],
    "contact_email": ["E-mail public", "E-mail public de la fiche"],
}

# The importer's header contract (apps/api/src/imports/import-preview.constants.ts).
HEADERS = [
    "external_reference",
    "name",
    "address_line1",
    "postal_code",
    "city",
    "country_code",
    "phone",
    "website",
    "latitude",
    "longitude",
    "contact_name",
    "contact_job_title",
    "contact_email",
    "contact_phone",
    "is_primary",
    "category",
]


def read_workbook(path: Path) -> dict[str, list[dict[str, str]]]:
    archive = zipfile.ZipFile(path)

    shared: list[str] = []
    if "xl/sharedStrings.xml" in archive.namelist():
        for item in ET.fromstring(archive.read("xl/sharedStrings.xml")).iter(f"{NS}si"):
            shared.append("".join(node.text or "" for node in item.iter(f"{NS}t")))

    rels = {
        node.get("Id"): node.get("Target")
        for node in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels")).iter()
        if node.get("Id")
    }

    sheets: dict[str, list[dict[str, str]]] = {}
    for sheet in ET.fromstring(archive.read("xl/workbook.xml")).iter(f"{NS}sheet"):
        target = (rels.get(sheet.get(f"{RNS}id")) or "").lstrip("/").replace("xl/", "")
        member = f"xl/{target}"
        if member not in archive.namelist():
            continue

        rows: list[dict[str, str]] = []
        for row in ET.fromstring(archive.read(member)).iter(f"{NS}row"):
            cells: dict[str, str] = {}
            for cell in row.iter(f"{NS}c"):
                match = re.match(r"[A-Z]+", cell.get("r") or "")
                if not match:
                    continue
                value_node = cell.find(f"{NS}v")
                inline = cell.find(f"{NS}is")
                if cell.get("t") == "s" and value_node is not None:
                    value = shared[int(value_node.text)]
                elif inline is not None:
                    value = "".join(node.text or "" for node in inline.iter(f"{NS}t"))
                else:
                    value = value_node.text if value_node is not None else None
                if value not in (None, ""):
                    cells[match.group(0)] = value
            rows.append(cells)
        sheets[sheet.get("name")] = rows
    return sheets


def clean(value: str | None) -> str:
    """Collapse whitespace. Everything else is the importer's business."""
    return re.sub(r"\s+", " ", value).strip() if value else ""


EMAIL = re.compile(r"^[^@\s;,]+@[^@\s;,]+\.[A-Za-z]{2,}$")


def first_email(value: str) -> str:
    """The first usable address out of a cell that may hold several.

    Public directories list a whole service's mailboxes in one field, separated
    by semicolons. The importer validates the address and rejects the entire row
    when it fails, so passing the raw cell through drops 97 real establishments
    over a field that is optional to begin with. Taking the first valid address
    keeps the establishment and keeps a usable contact; the rest stay in the
    workbook, which remains the system of record until the base is loaded.
    """
    for candidate in re.split(r"[;,]", clean(value)):
        candidate = candidate.strip()
        if EMAIL.match(candidate):
            return candidate
    return ""


def first_phone(value: str) -> str:
    """Same treatment for a cell holding several published numbers."""
    parts = [part.strip() for part in re.split(r"[;/]", clean(value)) if part.strip()]
    return parts[0] if parts else ""


def coordinate(value: str) -> str:
    """Keep a coordinate only when it is actually a number."""
    text = clean(value).replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return ""
    return text if -180 <= number <= 180 else ""


CONTRACT = Path(__file__).resolve().parents[1] / "apps/api/src/imports/import-preview.constants.ts"


def assert_headers_match_the_importer() -> None:
    """Fail loudly if the importer's column contract has moved.

    HEADERS below has to equal IMPORT_HEADERS in the API, or the importer
    rejects the file outright with "Unsupported CSV columns" — after someone has
    already converted 14,000 rows. Reading the contract rather than restating it
    means the two cannot drift silently.
    """
    if not CONTRACT.exists():
        print(f"warning: cannot find {CONTRACT}; header contract unverified")
        return

    block = re.search(r"IMPORT_HEADERS = \[(.*?)\] as const;", CONTRACT.read_text(), re.S)
    if not block:
        print("warning: IMPORT_HEADERS not found; header contract unverified")
        return

    expected = re.findall(r"'([a-z0-9_]+)'", block.group(1))
    if sorted(expected) != sorted(HEADERS):
        missing = sorted(set(expected) - set(HEADERS))
        extra = sorted(set(HEADERS) - set(expected))
        raise SystemExit(
            "the importer's column contract has changed; update HEADERS in this script\n"
            f"  missing here: {missing}\n  not accepted by the importer: {extra}"
        )


def convert(workbook: Path, out_dir: Path) -> int:
    assert_headers_match_the_importer()

    sheets = read_workbook(workbook)
    out_dir.mkdir(parents=True, exist_ok=True)

    grand_total = 0
    print(f"{'category':18s} {'rows':>6s} {'named':>6s} {'ref':>6s} {'geo':>6s}  file")

    for sheet_name, category in CATEGORIES.items():
        rows = [row for row in sheets.get(sheet_name, []) if row]
        if not rows:
            print(f"{category:18s} {'—':>6s}  sheet missing")
            continue

        # The first wide row is the header; the banner rows above it are prose.
        header_index = next((i for i, row in enumerate(rows) if len(row) > 20), None)
        if header_index is None:
            print(f"{category:18s} {'—':>6s}  no header row found")
            continue

        header = {clean(v): k for k, v in rows[header_index].items()}
        column = {
            field: next((header[label] for label in labels if label in header), None)
            for field, labels in FIELDS.items()
        }

        written = named = referenced = located = 0
        destination = out_dir / f"{category}.csv"

        with destination.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=HEADERS)
            writer.writeheader()

            for row in rows[header_index + 1 :]:
                get = lambda field: clean(row.get(column[field])) if column[field] else ""

                name = get("name")
                if not name:
                    # The importer rejects a nameless row anyway; not writing it
                    # keeps the import report about real problems.
                    continue

                latitude = coordinate(get("latitude"))
                longitude = coordinate(get("longitude"))
                email = first_email(get("contact_email"))

                writer.writerow(
                    {
                        "external_reference": get("external_reference"),
                        "name": name,
                        "address_line1": get("address_line1"),
                        "postal_code": get("postal_code"),
                        "city": get("city"),
                        "country_code": "FR",
                        "phone": first_phone(get("phone")),
                        "website": get("website"),
                        "latitude": latitude,
                        "longitude": longitude,
                        "contact_name": "",
                        "contact_job_title": "",
                        # The public address of the establishment, which has no
                        # email column of its own; it becomes its first contact.
                        "contact_email": email,
                        "contact_phone": "",
                        "is_primary": "true" if email else "",
                        "category": category,
                    }
                )

                written += 1
                named += 1
                referenced += 1 if get("external_reference") else 0
                located += 1 if latitude and longitude else 0

        grand_total += written
        print(f"{category:18s} {written:6d} {named:6d} {referenced:6d} {located:6d}  {destination.name}")

    print(f"\n{grand_total} rows written to {out_dir}")
    return grand_total


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
