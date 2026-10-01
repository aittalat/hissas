/**
 * JSON مقروء ومختصر: الكائنات والمصفوفات التي كل قيمها بسيطة تُكتب في سطر واحد
 * (خانة، ساعة موضوعة، مؤشرات)، والباقي بمسافة بادئة. يجعل فروق git صغيرة.
 */
type Scalar = null | boolean | number | string;
type Json = Scalar | Json[] | { [k: string]: Json };

const isScalar = (v: Json): v is Scalar => v === null || typeof v !== 'object';
const isScalarOrSlot = (v: Json): boolean =>
  isScalar(v) || (Array.isArray(v) && v.length <= 4 && v.every(isScalar));
const isLeaf = (v: Json[] | { [k: string]: Json }): boolean =>
  (Array.isArray(v) ? v : Object.values(v)).every(isScalarOrSlot);

function inline(v: Json): string {
  if (isScalar(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  return `{ ${Object.entries(v)
    .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
    .join(', ')} }`;
}

function format(v: Json, pad: string): string {
  if (isScalar(v)) return JSON.stringify(v);
  if (isLeaf(v) && inline(v).length <= 120) return inline(v);
  const inner = pad + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x) => inner + format(x, inner)).join(',\n')}\n${pad}]`;
  }
  const entries = Object.entries(v);
  if (!entries.length) return '{}';
  return `{\n${entries
    .map(([k, x]) => `${inner}${JSON.stringify(k)}: ${format(x, inner)}`)
    .join(',\n')}\n${pad}}`;
}

export function stringifyCompact(value: unknown): string {
  return format(JSON.parse(JSON.stringify(value)) as Json, '') + '\n';
}
