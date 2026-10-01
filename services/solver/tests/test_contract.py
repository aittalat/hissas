"""العقد المولَّد من zod يقبل بيانات السيناريوهات ويرفض الخاطئة."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from solver.contract import SchoolData, SolveRequest

FIXTURES = Path(__file__).resolve().parents[3] / "packages/shared/fixtures/scenarios"
SCENARIOS = sorted(FIXTURES.glob("*.json"))


def test_fixtures_exist() -> None:
    assert len(SCENARIOS) == 5


@pytest.mark.parametrize("path", SCENARIOS, ids=lambda p: p.stem)
def test_school_data_validates(path: Path) -> None:
    school = SchoolData.model_validate(json.loads(path.read_text())["school"])
    assert school.version == 1
    assert all(isinstance(d, int) for p in school.persons for d, _ in p.unavailable)


def test_solve_request_defaults() -> None:
    raw = json.loads(SCENARIOS[0].read_text())["school"]
    req = SolveRequest.model_validate({"school": raw})
    assert req.current == []
    assert (req.options.time_limit_s, req.options.random_seed, req.options.workers) == (20, 0, 8)


def test_rejects_invalid_day() -> None:
    raw = json.loads(SCENARIOS[0].read_text())["school"]
    raw["persons"][0]["unavailable"] = [[6, 0]]
    with pytest.raises(ValidationError):
        SchoolData.model_validate(raw)
