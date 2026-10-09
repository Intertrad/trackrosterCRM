"""Validate the published planning snapshot without external dependencies."""

import json
from pathlib import Path


def verify():
    root = Path(__file__).resolve().parent
    data = json.loads((root / "backlog.json").read_text())
    mapping = json.loads((root / "github-issues.json").read_text())
    tickets = {ticket["key"]: ticket for ticket in data["tickets"]}
    assert len(tickets) == len(data["tickets"]) == 85, "Duplicate/missing ticket"
    assert set(mapping) == set(tickets) | {"TRACKING"}, "Publication incomplete"
    assert len({issue["number"] for issue in mapping.values()}) == len(mapping)
    for issue in mapping.values():
        expected = f"https://github.com/Intertrad/trackrosterCRM/issues/{issue['number']}"
        assert issue["url"] == expected, "Wrong repository or issue URL"

    apis = data["api_requirements"]
    pages = data["page_requirements"]
    assert len(apis) == len({(r["method"], r["path"]) for r in apis}) == 381
    assert len(pages) == len({r["id"] for r in pages}) == 190
    for row in apis:
        assert row["owner"] in tickets
        operation = row["method"] + " " + row["path"]
        assert operation in tickets[row["owner"]]["apis"], operation
        if row["path"].startswith(("/memberships", "/membership-scopes")):
            assert row["owner"] == "TR-110", "Profile prefix captured membership"
        if row["path"].startswith("/messages/"):
            owner = "TR-140" if row["path"].endswith("/attachments") else "TR-141"
            assert row["owner"] == owner, "Profile prefix captured message"
        if row["path"].startswith("/metadata/"):
            assert row["owner"] in {"TR-114", "TR-132"}
    for row in pages:
        assert row["owner"] in tickets
        assert row["id"] in tickets[row["owner"]]["pages"]
        for contribution in row.get("contributions", []):
            assert contribution["owner"] in tickets
            assert contribution["phase"] in {"P0", "P1", "P2"}
            assert contribution["scope"]
    assert sum(len(t["apis"]) for t in tickets.values()) == 381
    assert sum(len(t["pages"]) for t in tickets.values()) == 190

    active = set()
    visited = set()

    def visit(key):
        assert key not in active, f"Dependency cycle at {key}"
        if key in visited:
            return
        active.add(key)
        ticket = tickets[key]
        assert ticket["acceptance"] and ticket["refs"]
        for dependency in ticket["dependencies"]:
            assert dependency in tickets
            assert tickets[dependency]["phase"] <= ticket["phase"], (
                f"Later-phase dependency: {key} -> {dependency}"
            )
            visit(dependency)
        for child in ticket.get("children", []):
            assert tickets[child]["parent"] == key
            assert child in ticket["dependencies"]
        active.remove(key)
        visited.add(key)

    for key in tickets:
        visit(key)
    print("PASS: 85 tickets plus tracker; 381 APIs; 190 page/subflows; valid references")
    print("PASS: acyclic dependencies, phase order, epic children and publication URLs")


if __name__ == "__main__":
    verify()
