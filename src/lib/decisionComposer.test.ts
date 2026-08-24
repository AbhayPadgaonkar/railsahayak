import { describe, it, expect } from "vitest";
import type { YardSchema } from "@/lib/yardlayout/schema";
import {
  TRAIN_TYPES,
  SIGNAL_STATES,
  CONDITIONS,
  LINES,
  ORDERING_LINE,
  allowColor,
  buildDecisionRequest,
  buildStationModels,
  emptyTrain,
  num,
  parseCsvList,
} from "./decisionComposer";

describe("emptyTrain", () => {
  it("builds a PASSENGER train on the given block with defaults", () => {
    const t = emptyTrain("ST_A1_BC");
    expect(t).toEqual({
      train_id: "",
      train_type: "PASSENGER",
      block_id: "ST_A1_BC",
      line_id: "UP_MAIN",
      next_block_id: null,
      signal_state: "GREEN",
      sectional_speed: 100,
      scheduled_time: 1000,
      current_time: 1000,
      gradient: null,
      condition: null,
      has_written_authority: false,
    });
  });
});

describe("num", () => {
  it("maps empty string to 0", () => {
    expect(num("")).toBe(0);
  });
  it("parses numeric strings", () => {
    expect(num("42")).toBe(42);
    expect(num("12.5")).toBe(12.5);
  });
});

describe("allowColor", () => {
  it("maps allow movement to emerald, hold to red", () => {
    expect(allowColor(true)).toBe("text-emerald-400");
    expect(allowColor(false)).toBe("text-red-400");
  });
});

describe("parseCsvList", () => {
  it("splits, trims and drops empties", () => {
    expect(parseCsvList(" a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseCsvList("")).toEqual([]);
    expect(parseCsvList("   , ,")).toEqual([]);
  });
});

describe("constants", () => {
  it("exposes train types, signal states, conditions, lines and ordering line", () => {
    expect(TRAIN_TYPES).toContain("VANDE_BHARAT");
    expect(TRAIN_TYPES).toContain("GOODS");
    expect(SIGNAL_STATES).toEqual([
      "GREEN",
      "DOUBLE_YELLOW",
      "SINGLE_YELLOW",
      "RED",
      "DEFECTIVE",
    ]);
    expect(CONDITIONS).toEqual(["", "FOG", "STORM"]);
    expect(LINES).toEqual(["UP_MAIN", "UP_LOOP", "DN_MAIN"]);
    expect(ORDERING_LINE).toBe("UP_MAIN");
  });
});

const twoLineSchema = (
  id: string,
  blocks: { id: string; from_x: number; to_x: number }[],
  name?: string
): YardSchema => ({
  station_id: id,
  station_name: name ?? id,
  canvas: { width: 1000, height: 200 },
  lines: [
    { id: "UP_MAIN", y: 50, direction: "UP", from_x: 0, to_x: 800 },
    { id: "DN_MAIN", y: 100, direction: "DN", from_x: 0, to_x: 800 },
  ],
  turnouts: [],
  signals: [],
  blocks: blocks.map((b) => ({
    id: b.id,
    next_blocks: [],
    lines: [
      { line: "UP_MAIN", from_x: b.from_x, to_x: b.to_x },
      { line: "DN_MAIN", from_x: b.from_x, to_x: b.to_x },
    ],
  })),
});

describe("buildStationModels", () => {
  it("orders blocks along the ordering line and links intra-station next blocks", () => {
    const { models, blockNext } = buildStationModels([
      {
        station_id: "st_a1",
        schema: twoLineSchema("st_a1", [
          { id: "ST_A1_CD", from_x: 600, to_x: 800 },
          { id: "ST_A1_AB", from_x: 0, to_x: 300 },
          { id: "ST_A1_BC", from_x: 300, to_x: 600 },
        ]),
      },
    ]);
    expect(models).toHaveLength(1);
    expect(models[0].blocks).toEqual(["ST_A1_AB", "ST_A1_BC", "ST_A1_CD"]);
    expect(blockNext["ST_A1_AB"]).toEqual(["ST_A1_BC"]);
    expect(blockNext["ST_A1_BC"]).toEqual(["ST_A1_CD"]);
    expect(blockNext["ST_A1_CD"]).toEqual([]);
  });

  it("links the tail of one station to the head of the next", () => {
    const { blockNext } = buildStationModels([
      {
        station_id: "st_a1",
        schema: twoLineSchema("st_a1", [
          { id: "ST_A1_AB", from_x: 0, to_x: 300 },
          { id: "ST_A1_BC", from_x: 300, to_x: 600 },
        ]),
      },
      {
        station_id: "st_a2",
        schema: twoLineSchema("st_a2", [
          { id: "ST_A2_AB", from_x: 0, to_x: 300 },
          { id: "ST_A2_BC", from_x: 300, to_x: 600 },
        ]),
      },
    ]);
    expect(blockNext["ST_A1_BC"]).toEqual(["ST_A2_AB"]);
    expect(blockNext["ST_A2_AB"]).toEqual(["ST_A2_BC"]);
    expect(blockNext["ST_A2_BC"]).toEqual([]);
  });

  it("skips stations with a failed schema load", () => {
    const { models } = buildStationModels([
      {
        station_id: "st_a1",
        schema: twoLineSchema("st_a1", [
          { id: "ST_A1_AB", from_x: 0, to_x: 300 },
        ]),
      },
      { station_id: "st_bad", schema: null },
      {
        station_id: "st_c1",
        schema: twoLineSchema("st_c1", [
          { id: "ST_C1_AB", from_x: 0, to_x: 300 },
        ]),
      },
    ]);
    expect(models.map((m) => m.station_id)).toEqual(["st_a1", "st_c1"]);
  });
});

describe("buildDecisionRequest", () => {
  it("assembles trains and parsed context", () => {
    const req = buildDecisionRequest({
      trains: [emptyTrain("ST_A1_AB")],
      occupiedLines: " ST_A1_AB|UP_MAIN , ",
      occupiedTurnouts: "T1_ST_A1",
      foulingSegments: "",
      disasterActive: true,
    });
    expect(req.trains).toHaveLength(1);
    expect(req.context.occupied_lines).toEqual(["ST_A1_AB|UP_MAIN"]);
    expect(req.context.occupied_turnouts).toEqual(["T1_ST_A1"]);
    expect(req.context.fouling_segments).toEqual([]);
    expect(req.context.disaster_active).toBe(true);
  });
});