# Loading the prospect base

How the group's prospect workbook becomes establishments in TrackRoster, what the
data actually contains, and what to expect when it is loaded.

## The source

`TrackRoster_Base_Prospection_Interpretes_France.xlsx` — **14,649 establishments**
across seven sheets, plus five operational sheets (Pilotage, Historique,
Consolidation, Campagnes, Mode emploi et sources) that are not imported.

**The category is the sheet, not a column.** The seven sheets are exactly the seven
values of the `establishment_category` enum added in migration 0081, so a row's
category comes from where it lives. There is no substring rule matching
"gendarmerie" or "commissariat" anywhere in the pipeline.

| Sheet               | Category           | Rows  |
| ------------------- | ------------------ | ----- |
| Prospection         | `prospection`      | 4,524 |
| Santé               | `sante`            | 4,351 |
| Asile et social     | `asile_social`     | 2,811 |
| Justice et enquêtes | `justice_enquetes` | 1,309 |
| Prescripteurs       | `prescripteurs`    | 1,086 |
| Douanes et ONAF     | `douanes_onaf`     | 540   |
| CRA                 | `cra`              | 28    |

**The priority population** management named — gendarmeries, commissariats, douanes,
CRA — is `prospection` + `douanes_onaf` + `cra` = **5,092 establishments**. The
`prospection` sheet's own segments confirm it: Brigade territoriale, Commissariat,
Brigade motorisée.

## Two layouts, one mapping

`Prospection` has 68 columns; the other six have 42 and different headers for the
same things (`Établissement / unité` rather than `Établissement`, `Adresse publiée`
rather than `Adresse géographique`, `Téléphones publics` rather than `Téléphone
public`). The converter lists every header that has meant each field and takes the
first one present, so neither layout is privileged.

**Only `Prospection` carries coordinates** — 4,503 of 4,524. The other 10,125 rows
have none, which matters for the map: it can show a third of the base until the rest
is geocoded, and postal code and commune are present everywhere as a fallback.

## Data quality, measured

Run through the application's own parser, not estimated:

|                            |                                   |
| -------------------------- | --------------------------------- |
| Rows                       | 14,649                            |
| Valid                      | **14,649**                        |
| Invalid                    | 0                                 |
| Duplicates within the file | 0                                 |
| Distinct `ID TrackRoster`  | 14,649 — **no duplicates at all** |
| With a category            | 14,649                            |
| With coordinates           | 4,503                             |
| Marked "Ne plus contacter" | 0                                 |

Coverage of the optional fields: phone ~93%, address ~98%, postal code ~98%,
website ~58%, public e-mail ~19%. `Douanes et ONAF` is the weak sheet — roughly
half its rows have no address or postal code.

**One normalisation the converter performs, deliberately.** 97 rows list several
mailboxes in one cell, separated by semicolons
(`ddets-direction@ain.gouv.fr; ddets-renseignements@ain.gouv.fr`). The importer
validates the address and rejects the **whole row** when it fails, so passing the
cell through unchanged dropped 97 real establishments over an optional field. The
converter takes the first valid address. The same applies to published phone
numbers. Nothing else is altered — validation, deduplication and the commit stay in
the application's import pipeline.

## Idempotency

Every row carries a stable `ID TrackRoster` (`SP-…`, `FI-…`, `DO-…`, `GN-…`,
`CRA-…`, `TR-…`, `PN-…`), mapped to `external_reference`. The database already has
a unique index on `(tenant_id, source, external_reference)`, so **re-importing the
same workbook updates rather than duplicates**. This is the property to verify after
any change to the converter: import twice, and the second run must create nothing.

## Running it

```bash
# 1. Convert. Writes one CSV per category; creates nothing in the database.
python3 scripts/convert-prospect-workbook.py \
  ~/Downloads/TrackRoster_Base_Prospection_Interpretes_France.xlsx \
  /tmp/trackroster-prospects
```

The script checks its own column list against `IMPORT_HEADERS` in
`apps/api/src/imports/import-preview.constants.ts` and refuses to run if the
importer's contract has moved — otherwise the mismatch would only surface after
converting 14,000 rows.

```bash
# 2. Preview, then commit, one category at a time, as an admin of the
#    receiving tenant. Each file is well under the 10,000-row import ceiling.
curl -sS -X POST "$API/imports/preview" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  --data-binary @<(jq -Rs '{csvContent: .}' /tmp/trackroster-prospects/cra.csv)
```

Start with `cra.csv` (28 rows): it exercises the whole path in a second and is
trivial to undo. Then the priority population — `prospection`, `douanes_onaf` — and
the rest afterwards. The admin import screen accepts the same files.

## Deciding where it goes

**Not yet decided, and not a decision for the import.** The development database
currently holds test fixtures from the integration suites, which is not where 14,649
real records belong. Before loading:

- which tenant and which of the five entities owns the base, given that the
  référentiel is shared and coordination is cross-entity;
- whether it lands in development first or straight into the environment the pilot
  will run on.

The converter and the pipeline are ready either way; only the destination is open.
