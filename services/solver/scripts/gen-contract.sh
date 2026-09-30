#!/usr/bin/env bash
# يولّد solver/contract.py (نماذج pydantic) من عقد المحرك في packages/shared.
# المصدر الوحيد للعقد هو zod؛ لا تعدّل contract.py يدويا.
#   pnpm --filter @hissas/shared contract:export && services/solver/scripts/gen-contract.sh
set -euo pipefail
cd "$(dirname "$0")/.."
uv run datamodel-codegen \
  --input ../../packages/shared/contract/solver.schema.json \
  --input-file-type jsonschema \
  --output solver/contract.py \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --use-standard-collections \
  --use-union-operator \
  --field-constraints \
  --use-double-quotes \
  --use-annotated \
  --use-title-as-name \
  --use-field-description \
  --use-schema-description \
  --enum-field-as-literal all \
  --disable-timestamp \
  --collapse-root-models \
  --strict-nullable \
  --formatters builtin \
  --custom-file-header '# مولَّد من packages/shared/contract/solver.schema.json بـ scripts/gen-contract.sh — لا تعدّله يدويا.'
# الأنواع البسيطة المسماة (Id، Day، Period): أسماء مستعارة بدل RootModel
uv run python - <<'PY'
import re
from pathlib import Path

p = Path("solver/contract.py")
src = p.read_text()
src = re.sub(
    r"class (\w+)\(RootModel\[(?:int|str)\]\):\n    root: (Annotated\[(?:int|str), Field\([^)]*\)\])\n",
    r"\1 = \2\n",
    src,
)
# options = {} ← قيمة افتراضية مبنية (mypy يرفض dict)
src = re.sub(r"options: .* = \{\}\n", "options: SolveOptions = Field(default_factory=lambda: SolveOptions())\n", src)
src = src.replace("from pydantic import BaseModel, Field, RootModel", "from pydantic import BaseModel, Field")
p.write_text(src)
PY
uv run ruff format solver/contract.py >/dev/null
uv run ruff check --fix solver/contract.py >/dev/null
