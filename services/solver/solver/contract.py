# مولَّد من packages/shared/contract/solver.schema.json بـ scripts/gen-contract.sh — لا تعدّله يدويا.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class SchoolConfig(BaseModel):
    period_minutes: Annotated[int, Field(ge=30, le=90)]
    am_start: Annotated[str, Field(pattern="^([01]\\d|2[0-3]):[0-5]\\d$")]
    am_count: Annotated[int, Field(ge=0, le=8)]
    pm_start: Annotated[str, Field(pattern="^([01]\\d|2[0-3]):[0-5]\\d$")]
    pm_count: Annotated[int, Field(ge=0, le=8)]
    break_after_2nd_minutes: Annotated[int, Field(ge=0, le=60)]
    pairing_mode: Literal[1, 2]
    days: tuple[
        Literal["full", "am", "off"],
        Literal["full", "am", "off"],
        Literal["full", "am", "off"],
        Literal["full", "am", "off"],
        Literal["full", "am", "off"],
        Literal["full", "am", "off"],
    ]


class Subject(BaseModel):
    key: Annotated[str, Field(pattern="^[a-z0-9_]+$")]
    name: Annotated[str, Field(min_length=1)]
    short: Annotated[str, Field(min_length=1)]
    default_hours: Annotated[int, Field(ge=1, le=8)]
    hue: Annotated[int, Field(ge=0, le=359)]
    no_daily_cap: bool
    hard: bool
    prefer_double: bool


Id = Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]


Day = Annotated[int, Field(ge=0, le=5)]


Period = Annotated[int, Field(ge=0, le=15)]


class ClassHours(BaseModel):
    class_id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    hours: Annotated[int, Field(ge=1, le=8)]


class Placement(BaseModel):
    class_id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    subject: str
    index: Annotated[int, Field(ge=0, le=9007199254740991)]
    day: Annotated[int, Field(ge=0, le=5)]
    period: Annotated[int, Field(ge=0, le=15)]


class SolveOptions(BaseModel):
    time_limit_s: Annotated[float, Field(gt=0.0, le=120.0)] = 20
    random_seed: Annotated[int, Field(ge=0, le=9007199254740991)] = 0
    workers: Annotated[int, Field(ge=1, le=16)] = 8


class PrototypeMetrics(BaseModel):
    gaps: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    dups: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    tgaps: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    lone: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    split: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    unplaced: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    placed: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    total: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]


class MaxPossible(BaseModel):
    person_id: str
    need: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    max: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]


class SchoolClass(BaseModel):
    id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    name: Annotated[str, Field(min_length=1)]
    level_rank: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    subjects: list[str]


class Teacher(BaseModel):
    id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    person_id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    subject: str
    classes: list[ClassHours]


class Evaluation(BaseModel):
    metrics: PrototypeMetrics
    conflicts: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]
    quality: Annotated[int, Field(ge=-9007199254740991, le=9007199254740991)]


class Change(BaseModel):
    class_id: str
    subject: str
    from_: Annotated[tuple[Day, Period] | None, Field(alias="from")]
    to: tuple[Day, Period] | None
    add: bool | None = None
    del_: Annotated[bool | None, Field(alias="del")] = None


class DiagnoseResponse(BaseModel):
    reasons: list[str]
    max_possible: list[MaxPossible]
    forced_lone: list[str]
    conflicting_constraints: list[str]


class Person(BaseModel):
    id: Annotated[str, Field(pattern="^[A-Za-z0-9_.-]+$")]
    full_name: Annotated[str, Field(min_length=1)]
    present: bool
    shared: bool
    unavailable: list[tuple[Day, Period]]
    other_school: list[tuple[Day, Period]]


class SolveResponse(BaseModel):
    status: Literal["optimal", "feasible", "infeasible", "unknown"]
    placements: list[Placement]
    evaluation: Evaluation
    objective: float
    wall_time_s: float
    diagnose: list[str]


class RepairSolution(BaseModel):
    kind: Literal["min_change", "balanced", "best_quality"]
    placements: list[Placement]
    evaluation: Evaluation
    changes: list[Change]


class SchoolData(BaseModel):
    version: Literal[1]
    name: Annotated[str, Field(min_length=1)]
    config: SchoolConfig
    subjects: list[Subject]
    classes: list[SchoolClass]
    persons: list[Person]
    teachers: list[Teacher]
    locked_classes: list[Id]


class RepairRequest(BaseModel):
    school: SchoolData
    current: list[Placement]
    options: SolveOptions = Field(default_factory=lambda: SolveOptions())


class RepairResponse(BaseModel):
    before: Evaluation
    solutions: list[RepairSolution]


class DiagnoseRequest(BaseModel):
    school: SchoolData
    current: Annotated[list[Placement], Field(validate_default=True)] = []
    options: SolveOptions = Field(default_factory=lambda: SolveOptions())


class SolveRequest(BaseModel):
    school: SchoolData
    current: Annotated[list[Placement], Field(validate_default=True)] = []
    options: SolveOptions = Field(default_factory=lambda: SolveOptions())


class SolverContract(BaseModel):
    SolveRequest_1: Annotated[SolveRequest, Field(alias="SolveRequest")]
    SolveResponse_1: Annotated[SolveResponse, Field(alias="SolveResponse")]
    RepairRequest_1: Annotated[RepairRequest, Field(alias="RepairRequest")]
    RepairResponse_1: Annotated[RepairResponse, Field(alias="RepairResponse")]
    DiagnoseRequest_1: Annotated[DiagnoseRequest, Field(alias="DiagnoseRequest")]
    DiagnoseResponse_1: Annotated[DiagnoseResponse, Field(alias="DiagnoseResponse")]
