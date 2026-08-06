export type LineDirection = "UP" | "DN" | "COMMON";

export type SignalAspect = "red" | "yellow" | "green";

export interface YardCanvas {
  width: number;
  height: number;
}

export interface YardLine {
  id: string;
  y: number;
  direction: LineDirection;
  from_x: number;
  to_x: number;
}

export interface YardTurnout {
  id: string;
  from_line: string;
  from_x: number;
  to_line: string;
  to_x: number;
}

export interface YardSignal {
  id: string;
  name?: string;
  line: string;
  at_x: number;
  initial_state: SignalAspect;
}

export interface YardBlockBoundary {
  at_x: number;
  lines: string[];
}

export interface YardLabel {
  text: string;
  x: number;
  y: number;
}

export interface YardSchema {
  station_id: string;
  station_name: string;
  canvas: YardCanvas;
  lines: YardLine[];
  turnouts: YardTurnout[];
  signals: YardSignal[];
  block_boundaries?: YardBlockBoundary[];
  labels?: YardLabel[];
}
