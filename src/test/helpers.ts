import type { LineInfo, SensorSnapshot } from "@/lib/api";
import type { YardSchema } from "@/lib/yardlayout/schema";

export const lineInfo: LineInfo = {
  line_id: "PROTO_LINE",
  line_name: "Prototype Line",
  line_order: ["SEC_A", "SEC_B"],
  sections: [
    {
      section_id: "SEC_A",
      name: "Section A",
      controller_id: "ccg-vr",
      stations: ["st_a1"],
    },
  ],
};

export const makeSchema = (
  overrides: Partial<YardSchema> = {}
): YardSchema => ({
  station_id: "st_a1",
  station_name: "Section A - Station 1",
  canvas: { width: 600, height: 200 },
  lines: [
    { id: "UP_MAIN", y: 50, direction: "UP", from_x: 0, to_x: 600 },
    { id: "DN_MAIN", y: 100, direction: "DN", from_x: 0, to_x: 600 },
  ],
  turnouts: [],
  signals: [
    { id: "SIG_UP_1", name: "Home UP", line: "UP_MAIN", at_x: 200, initial_state: "green" },
    { id: "SIG_DN_1", name: "Home DN", line: "DN_MAIN", at_x: 400, initial_state: "red" },
  ],
  blocks: [
    {
      id: "ST_A1_AB",
      next_blocks: ["ST_A1_BC"],
      lines: [
        { line: "UP_MAIN", from_x: 0, to_x: 300 },
        { line: "DN_MAIN", from_x: 0, to_x: 300 },
      ],
    },
    {
      id: "ST_A1_BC",
      next_blocks: [],
      lines: [
        { line: "UP_MAIN", from_x: 300, to_x: 600 },
        { line: "DN_MAIN", from_x: 300, to_x: 600 },
      ],
    },
  ],
  sections: [
    { id: "TC_AB_UP", line: "UP_MAIN", from_x: 0, to_x: 300, block: "ST_A1_AB" },
    { id: "TC_BC_UP", line: "UP_MAIN", from_x: 300, to_x: 600, block: "ST_A1_BC" },
    { id: "TC_AB_DN", line: "DN_MAIN", from_x: 0, to_x: 300, block: "ST_A1_AB" },
    { id: "TC_BC_DN", line: "DN_MAIN", from_x: 300, to_x: 600, block: "ST_A1_BC" },
  ],
  labels: [{ text: "UP MAIN", x: 10, y: 40 }],
  ...overrides,
});

export const sensorSnapshot = (
  overrides: Partial<SensorSnapshot> = {}
): SensorSnapshot => ({
  station_id: "st_a1",
  zones: { TC_AB_UP: true },
  signals: {
    SIG_UP_1: "red",
    SIG_DN_1: "single_yellow",
  },
  trains: [
    {
      train_id: "UP-101",
      block_id: "ST_A1_AB",
      line_id: "UP_MAIN",
      allow_movement: true,
      max_speed: 100,
      signal_state: "GREEN",
    },
    {
      train_id: "DN-202",
      block_id: "ST_A1_BC",
      line_id: "DN_MAIN",
      allow_movement: false,
      max_speed: null,
      signal_state: "RED",
    },
  ],
  ...overrides,
});