"""واجهة HTTP للمحرك. العمليات /solve و/repair و/diagnose تأتي في الخطوتين 3 و4."""

from fastapi import FastAPI
from ortools.sat.python import cp_model
from pydantic import BaseModel

from solver import __version__

app = FastAPI(title="Hissas Solver", version=__version__)


class Health(BaseModel):
    status: str
    version: str
    cp_sat: bool


def cp_sat_available() -> bool:
    """يتحقق أن CP-SAT يعمل فعلا بحل نموذج تافه."""
    model = cp_model.CpModel()
    x = model.new_bool_var("x")
    model.add(x == 1)
    status = cp_model.CpSolver().solve(model)
    return bool(status == cp_model.OPTIMAL)


@app.get("/health")
def health() -> Health:
    return Health(status="ok", version=__version__, cp_sat=cp_sat_available())
