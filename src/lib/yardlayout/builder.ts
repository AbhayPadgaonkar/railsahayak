import {
  LineDirection,
  SignalAspect,
  YardBlock,
  YardLabel,
  YardLine,
  YardSchema,
  YardSection,
} from "./schema";

export interface BuiltSegment {
  id: string;
  d: string;
  connectedTo: string[];
  isBlock?: boolean;
  lineId?: string;
  direction?: LineDirection;
  turnoutId?: string;
}

export interface BuiltSignal {
  id: string;
  name: string;
  lineId: string;
  x: number;
  y: number;
  state: SignalAspect;
}

export interface BuiltZone {
  id: string;
  lineId: string;
  blockId?: string;
  segmentIds: string[];
}

export interface BuiltLine {
  id: string;
  y: number;
  direction: LineDirection;
  from_x: number;
  to_x: number;
}

export interface BuiltBlock {
  id: string;
  next_blocks: string[];
  spans: { lineId: string; from_x: number; to_x: number }[];
}

export interface BuiltYard {
  stationId: string;
  stationName: string;
  viewBox: string;
  segments: BuiltSegment[];
  signals: BuiltSignal[];
  zones: BuiltZone[];
  lines: BuiltLine[];
  blocks: BuiltBlock[];
  labels: YardLabel[];
}

const within = (x: number, line: YardLine) =>
  x >= Math.min(line.from_x, line.to_x) && x <= Math.max(line.from_x, line.to_x);

function validate(schema: YardSchema): void {
  const lineIds = new Set<string>();
  for (const line of schema.lines) {
    if (lineIds.has(line.id)) {
      throw new Error(`Duplicate line id "${line.id}"`);
    }
    lineIds.add(line.id);
    if (line.from_x === line.to_x) {
      throw new Error(`Line "${line.id}" has zero length`);
    }
  }

  const requireLine = (id: string, ctx: string): YardLine => {
    const line = schema.lines.find((l) => l.id === id);
    if (!line) throw new Error(`${ctx} references unknown line "${id}"`);
    return line;
  };

  const turnoutIds = new Set<string>();
  for (const t of schema.turnouts) {
    if (turnoutIds.has(t.id)) {
      throw new Error(`Duplicate turnout id "${t.id}"`);
    }
    turnoutIds.add(t.id);
    const from = requireLine(t.from_line, `Turnout "${t.id}"`);
    const to = requireLine(t.to_line, `Turnout "${t.id}"`);
    if (t.from_line === t.to_line) {
      throw new Error(`Turnout "${t.id}" cannot connect line "${t.from_line}" to itself`);
    }
    if (!within(t.from_x, from)) {
      throw new Error(`Turnout "${t.id}" from_x ${t.from_x} is outside line "${from.id}"`);
    }
    if (!within(t.to_x, to)) {
      throw new Error(`Turnout "${t.id}" to_x ${t.to_x} is outside line "${to.id}"`);
    }
  }

  const signalIds = new Set<string>();
  for (const s of schema.signals) {
    if (signalIds.has(s.id)) {
      throw new Error(`Duplicate signal id "${s.id}"`);
    }
    signalIds.add(s.id);
    const line = requireLine(s.line, `Signal "${s.id}"`);
    if (!within(s.at_x, line)) {
      throw new Error(`Signal "${s.id}" at_x ${s.at_x} is outside line "${line.id}"`);
    }
  }

  const blockIds = new Set<string>();
  const blockById = new Map<string, YardBlock>();
  if (!schema.blocks?.length) {
    throw new Error("Yard must define at least one block");
  }
  for (const b of schema.blocks) {
    if (blockIds.has(b.id)) {
      throw new Error(`Duplicate block id "${b.id}"`);
    }
    blockIds.add(b.id);
    blockById.set(b.id, b);
    if (!b.lines?.length) {
      throw new Error(`Block "${b.id}" has no line spans`);
    }
    for (const span of b.lines) {
      const line = requireLine(span.line, `Block "${b.id}" span`);
      if (span.from_x >= span.to_x) {
        throw new Error(`Block "${b.id}" span on "${span.line}" has zero or negative length`);
      }
      if (!within(span.from_x, line) || !within(span.to_x, line)) {
        throw new Error(`Block "${b.id}" span on "${span.line}" is outside the line`);
      }
    }
  }

  // next_blocks may reference blocks declared later in the schema, so validate
  // every reference only after all block ids are registered.
  for (const b of schema.blocks) {
    for (const nb of b.next_blocks ?? []) {
      if (!blockIds.has(nb) && nb !== b.id) {
        throw new Error(`Block "${b.id}" next_blocks references unknown block "${nb}"`);
      }
    }
  }

  const sectionIds = new Set<string>();
  for (const z of schema.sections ?? []) {
    if (sectionIds.has(z.id)) {
      throw new Error(`Duplicate section id "${z.id}"`);
    }
    sectionIds.add(z.id);
    const line = requireLine(z.line, `Section "${z.id}"`);
    if (z.from_x >= z.to_x) {
      throw new Error(`Section "${z.id}" has zero or negative length`);
    }
    if (!within(z.from_x, line) || !within(z.to_x, line)) {
      throw new Error(`Section "${z.id}" range is outside line "${z.line}"`);
    }
    const block = blockById.get(z.block);
    if (!block) {
      throw new Error(`Section "${z.id}" references unknown block "${z.block}"`);
    }
    const span = block.lines.find((s) => s.line === z.line);
    if (!span) {
      throw new Error(`Section "${z.id}" block "${z.block}" has no span on line "${z.line}"`);
    }
    if (z.from_x < span.from_x || z.to_x > span.to_x) {
      throw new Error(`Section "${z.id}" extends beyond block "${z.block}" span on "${z.line}"`);
    }
  }

  // Tiling invariant: each (block, line) span must be exactly covered by non-overlapping sections
  const sectionsBySpan = new Map<string, YardSection[]>();
  for (const z of schema.sections ?? []) {
    const key = `${z.block}|${z.line}`;
    sectionsBySpan.set(key, [...(sectionsBySpan.get(key) ?? []), z]);
  }
  for (const b of schema.blocks) {
    for (const span of b.lines) {
      const parts = sectionsBySpan.get(`${b.id}|${span.line}`) ?? [];
      const sorted = [...parts].sort((a, b) => a.from_x - b.from_x);
      let cursor = span.from_x;
      for (const part of sorted) {
        if (part.from_x < cursor) {
          throw new Error(`Sections overlap for block "${b.id}" on "${span.line}"`);
        }
        if (part.from_x > cursor) {
          throw new Error(`Gap in section coverage for block "${b.id}" on "${span.line}" (missing x=${cursor})`);
        }
        cursor = part.to_x;
      }
      if (cursor !== span.to_x) {
        throw new Error(
          `Incomplete section coverage for block "${b.id}" on "${span.line}" (ends at ${cursor}, expected ${span.to_x})`
        );
      }
    }
  }
}

export function buildYardLayout(schema: YardSchema): BuiltYard {
  validate(schema);

  const segments: BuiltSegment[] = [];
  const byId = new Map<string, BuiltSegment>();

  const addSegment = (seg: BuiltSegment) => {
    segments.push(seg);
    byId.set(seg.id, seg);
  };

  const link = (a: string, b: string) => {
    const segA = byId.get(a);
    const segB = byId.get(b);
    if (!segA || !segB) return;
    if (!segA.connectedTo.includes(b)) segA.connectedTo.push(b);
    if (!segB.connectedTo.includes(a)) segB.connectedTo.push(a);
  };

  const lineSlices = new Map<string, BuiltSegment[]>();

  for (const line of schema.lines) {
    const anchors = new Set<number>([line.from_x, line.to_x]);

    for (const t of schema.turnouts) {
      if (t.from_line === line.id) anchors.add(t.from_x);
      if (t.to_line === line.id) anchors.add(t.to_x);
    }
    for (const s of schema.signals) {
      if (s.line === line.id) anchors.add(s.at_x);
    }
    for (const b of schema.blocks) {
      for (const span of b.lines) {
        if (span.line === line.id) {
          anchors.add(span.from_x);
          anchors.add(span.to_x);
        }
      }
    }
    for (const z of schema.sections ?? []) {
      if (z.line === line.id) {
        anchors.add(z.from_x);
        anchors.add(z.to_x);
      }
    }

    const sorted = [...anchors].sort((a, b) => a - b);
    const slices: BuiltSegment[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const x1 = sorted[i];
      const x2 = sorted[i + 1];
      if (x1 === x2) continue;

      const inBlock = schema.blocks.some((b) =>
        b.lines.some(
          (s) => s.line === line.id && x1 >= s.from_x && x2 <= s.to_x
        )
      );

      const seg: BuiltSegment = {
        id: `${line.id}__${slices.length}`,
        d: `M ${x1} ${line.y} L ${x2} ${line.y}`,
        connectedTo: [],
        lineId: line.id,
        direction: line.direction,
        ...(inBlock ? { isBlock: true } : {}),
      };
      addSegment(seg);
      slices.push(seg);
    }

    lineSlices.set(line.id, slices);

    for (let i = 0; i < slices.length - 1; i++) {
      if (line.direction === "UP") {
        slices[i].connectedTo.push(slices[i + 1].id);
      } else if (line.direction === "DN") {
        slices[i + 1].connectedTo.push(slices[i].id);
      } else {
        link(slices[i].id, slices[i + 1].id);
      }
    }
  }

  const slicesTouching = (lineId: string, x: number): BuiltSegment[] =>
    (lineSlices.get(lineId) ?? []).filter((seg) => {
      const nums = seg.d.match(/-?[\d.]+/g)!.map(Number);
      return nums[0] === x || nums[2] === x;
    });

  for (const t of schema.turnouts) {
    const fromLine = schema.lines.find((l) => l.id === t.from_line)!;
    const toLine = schema.lines.find((l) => l.id === t.to_line)!;

    const diverge: BuiltSegment = {
      id: `${t.id}_diverge`,
      d: `M ${t.from_x} ${fromLine.y} L ${t.to_x} ${toLine.y}`,
      connectedTo: [],
      turnoutId: t.id,
    };
    addSegment(diverge);

    for (const seg of [
      ...slicesTouching(t.from_line, t.from_x),
      ...slicesTouching(t.to_line, t.to_x),
    ]) {
      link(diverge.id, seg.id);
    }
  }

  const signals: BuiltSignal[] = schema.signals.map((s) => {
    const line = schema.lines.find((l) => l.id === s.line)!;
    return {
      id: s.id,
      name: s.name ?? s.id,
      lineId: line.id,
      x: s.at_x,
      y: line.y,
      state: s.initial_state,
    };
  });

  const zones: BuiltZone[] = (schema.sections ?? []).map((z) => {
    const segmentIds = (lineSlices.get(z.line) ?? [])
      .filter((seg) => {
        const nums = seg.d.match(/-?[\d.]+/g)!.map(Number);
        return nums[0] < z.to_x && nums[2] > z.from_x;
      })
      .map((seg) => seg.id);
    return { id: z.id, lineId: z.line, blockId: z.block, segmentIds };
  });

  return {
    stationId: schema.station_id,
    stationName: schema.station_name,
    viewBox: `0 0 ${schema.canvas.width} ${schema.canvas.height}`,
    segments,
    signals,
    zones,
    lines: schema.lines.map((l) => ({
      id: l.id,
      y: l.y,
      direction: l.direction,
      from_x: l.from_x,
      to_x: l.to_x,
    })),
    blocks: schema.blocks.map((b) => ({
      id: b.id,
      next_blocks: b.next_blocks ?? [],
      spans: b.lines.map((s) => ({
        lineId: s.line,
        from_x: s.from_x,
        to_x: s.to_x,
      })),
    })),
    labels: schema.labels ?? [],
  };
}
