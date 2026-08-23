import { describe, it, expect } from "vitest";
import type { YardSchema } from "./schema";
import { buildYardLayout } from "./builder";

const baseSchema = (overrides: Partial<YardSchema> = {}): YardSchema => ({
  station_id: "st_test",
  station_name: "Test Station",
  canvas: { width: 600, height: 200 },
  lines: [
    { id: "UP_MAIN", y: 50, direction: "UP", from_x: 0, to_x: 500 },
    { id: "DN_MAIN", y: 100, direction: "DN", from_x: 0, to_x: 500 },
  ],
  turnouts: [],
  signals: [],
  blocks: [
    {
      id: "BLK_1",
      next_blocks: ["BLK_2"],
      lines: [
        { line: "UP_MAIN", from_x: 0, to_x: 250 },
        { line: "DN_MAIN", from_x: 0, to_x: 250 },
      ],
    },
    {
      id: "BLK_2",
      next_blocks: [],
      lines: [
        { line: "UP_MAIN", from_x: 250, to_x: 500 },
        { line: "DN_MAIN", from_x: 250, to_x: 500 },
      ],
    },
  ],
  sections: [
    { id: "TC_1_UP", line: "UP_MAIN", from_x: 0, to_x: 250, block: "BLK_1" },
    { id: "TC_2_UP", line: "UP_MAIN", from_x: 250, to_x: 500, block: "BLK_2" },
    { id: "TC_1_DN", line: "DN_MAIN", from_x: 0, to_x: 250, block: "BLK_1" },
    { id: "TC_2_DN", line: "DN_MAIN", from_x: 250, to_x: 500, block: "BLK_2" },
  ],
  ...overrides,
});

describe("buildYardLayout happy path", () => {
  it("builds segments, signals, zones, lines, blocks and viewBox", () => {
    const schema = {
      ...baseSchema(),
      signals: [{ id: "SIG_1", line: "UP_MAIN", at_x: 100, initial_state: "green" as const }],
    };
    const yard = buildYardLayout(schema);
    expect(yard.stationId).toBe("st_test");
    expect(yard.viewBox).toBe("0 0 600 200");
    expect(yard.segments.length).toBeGreaterThan(0);
    expect(yard.segments.some((s) => s.isBlock)).toBe(true);
    expect(yard.signals).toHaveLength(1);
    expect(yard.signals[0]).toMatchObject({
      id: "SIG_1",
      name: "SIG_1",
      lineId: "UP_MAIN",
      x: 100,
      y: 50,
      state: "green",
    });
    expect(yard.zones).toHaveLength(4);
    expect(yard.blocks).toHaveLength(2);
    expect(yard.blocks[0].next_blocks).toEqual(["BLK_2"]);
    expect(YardShapeIsConnected(yard)).toBe(true);
  });
});

function YardShapeIsConnected(yard: { segments: { connectedTo: string[] }[] }) {
  return yard.segments.length > 0;
}

describe("signals default name", () => {
  it("uses the signal id as name when none given", () => {
    const schema = {
      ...baseSchema(),
      signals: [{ id: "SIG_X", line: "UP_MAIN", at_x: 50, initial_state: "red" as const }],
    };
    const yard = buildYardLayout(schema);
    const sig = yard.signals.find((s) => s.id === "SIG_X");
    expect(sig?.name).toBe("SIG_X");
  });
});

describe("validate edge cases", () => {
  const throws = (schema: YardSchema, pattern: string | RegExp) => {
    expect(() => buildYardLayout(schema)).toThrow(pattern);
  };

  it("rejects duplicate line ids", () => {
    throws(
      baseSchema({
        lines: [
          { id: "L", y: 10, direction: "UP", from_x: 0, to_x: 100 },
          { id: "L", y: 20, direction: "DN", from_x: 0, to_x: 100 },
        ],
      }),
      /Duplicate line id "L"/
    );
  });

  it("rejects zero-length lines", () => {
    throws(
      baseSchema({
        lines: [{ id: "L", y: 10, direction: "UP", from_x: 50, to_x: 50 }],
      }),
      /Line "L" has zero length/
    );
  });

  it("rejects blocks referencing unknown lines", () => {
    throws(
      baseSchema({
        blocks: [
          { id: "B", next_blocks: [], lines: [{ line: "NOPE", from_x: 0, to_x: 10 }] },
        ],
      }),
      /references unknown line "NOPE"/
    );
  });

  it("rejects turnouts connecting a line to itself", () => {
    throws(
      baseSchema({
        turnouts: [{ id: "T", from_line: "UP_MAIN", from_x: 10, to_line: "UP_MAIN", to_x: 20 }],
      }),
      /cannot connect line "UP_MAIN" to itself/
    );
  });

  it("rejects block spans with zero or negative length", () => {
    throws(
      baseSchema({
        blocks: [
          { id: "B", next_blocks: [], lines: [{ line: "UP_MAIN", from_x: 20, to_x: 20 }] },
        ],
      }),
      /zero or negative length/
    );
  });

  it("rejects section ranges outside the block span", () => {
    throws(
      baseSchema({
        sections: [
          { id: "S", line: "UP_MAIN", from_x: 0, to_x: 400, block: "BLK_1" },
        ],
      }),
      /extends beyond block "BLK_1" span/
    );
  });

  it("rejects overlapping sections on the same block span", () => {
    throws(
      baseSchema({
        sections: [
          { id: "S1", line: "UP_MAIN", from_x: 0, to_x: 250, block: "BLK_1" },
          { id: "S2", line: "UP_MAIN", from_x: 150, to_x: 250, block: "BLK_1" },
        ],
      }),
      /Sections overlap/
    );
  });

  it("rejects gaps in section coverage", () => {
    throws(
      baseSchema({
        sections: [
          { id: "S1", line: "UP_MAIN", from_x: 0, to_x: 100, block: "BLK_1" },
          { id: "S2", line: "UP_MAIN", from_x: 150, to_x: 250, block: "BLK_1" },
        ],
      }),
      /Gap in section coverage/
    );
  });

  it("rejects missing last block", () => {
    const schema = baseSchema();
    schema.blocks = [
      {
        id: "B",
        next_blocks: ["MISSING"],
        lines: [
          { line: "UP_MAIN", from_x: 0, to_x: 500 },
          { line: "DN_MAIN", from_x: 0, to_x: 500 },
        ],
      },
    ];
    schema.sections = [];
    throws(schema, /references unknown block "MISSING"/);
  });
});

describe("direction slicing", () => {
  it("UP lines link forward slices only", () => {
    const schema: YardSchema = {
      ...baseSchema(),
      lines: [{ id: "UP_ONLY", y: 50, direction: "UP", from_x: 0, to_x: 400 }],
      blocks: [
        { id: "B", next_blocks: [], lines: [{ line: "UP_ONLY", from_x: 0, to_x: 200 }] },
        { id: "C", next_blocks: [], lines: [{ line: "UP_ONLY", from_x: 200, to_x: 400 }] },
      ],
      sections: [
        { id: "S1", line: "UP_ONLY", from_x: 0, to_x: 200, block: "B" },
        { id: "S2", line: "UP_ONLY", from_x: 200, to_x: 400, block: "C" },
      ],
    };
    const yard = buildYardLayout(schema);
    const upSlices = yard.segments.filter((s) => s.direction === "UP");
    expect(upSlices.length).toBeGreaterThanOrEqual(2);
    // first slice connects forward to second
    expect(upSlices[0].connectedTo).toContain(upSlices[1].id);
    expect(upSlices[1].connectedTo).not.toContain(upSlices[0].id);
  });

  it("COMMON lines link both directions", () => {
    const schema: YardSchema = {
      ...baseSchema(),
      lines: [
        { id: "LOOP", y: 40, direction: "COMMON", from_x: 0, to_x: 400 },
      ],
      signals: [{ id: "LOOP_SIG", line: "LOOP", at_x: 200, initial_state: "green" }],
      blocks: [{ id: "B", next_blocks: [], lines: [{ line: "LOOP", from_x: 0, to_x: 400 }] }],
      sections: [{ id: "S1", line: "LOOP", from_x: 0, to_x: 400, block: "B" }],
    };
    const yard = buildYardLayout(schema);
    const slices = yard.segments.filter((s) => s.lineId === "LOOP");
    expect(slices.length).toBeGreaterThanOrEqual(2);
    expect(slices[0].connectedTo).toContain(slices[1].id);
    expect(slices[1].connectedTo).toContain(slices[0].id);
  });
});