"use client";

import { useState, useRef, useCallback } from "react";
import type {
  YardSchema,
  YardLine,
  YardSignal,
  YardTurnout,
} from "@/lib/yardlayout/schema";
import { buildYardLayout } from "@/lib/yardlayout/builder";

type Tool =
  | "select"
  | "add_up_main"
  | "add_dn_main"
  | "add_up_loop"
  | "add_dn_loop"
  | "add_signal_ow"
  | "add_signal_home"
  | "add_signal_starter"
  | "add_signal_adv"
  | "add_signal_loop_starter"
  | "add_signal_loop_exit"
  | "add_turnout"
  | "add_block_boundary";

type SignalType = "ow" | "home" | "starter" | "adv" | "loop_starter" | "loop_exit";

const SIGNAL_NAMES: Record<SignalType, string> = {
  ow: "Outer Warner",
  home: "Home",
  starter: "Starter",
  adv: "Adv Starter",
  loop_starter: "Loop Starter",
  loop_exit: "Loop Exit",
};

const SECTIONS = [
  { id: "A", name: "Section A", controller: "CCG-VR", stations: ["st_a1", "st_a2"] },
  { id: "B", name: "Section B", controller: "VR-VLSD", stations: ["st_b1", "st_b2"] },
  { id: "C", name: "Section C", controller: "VR-BL", stations: ["st_c1", "st_c2"] },
] as const;

const GRID = 100;
const CANVAS_W = 1000;
const CANVAS_H = 408;

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function defaultYard(): YardSchema {
  return {
    station_id: "st_new",
    station_name: "New Station",
    canvas: { width: CANVAS_W, height: CANVAS_H },
    lines: [],
    turnouts: [],
    signals: [],
    blocks: [],
    sections: [],
    labels: [],
  };
}

export default function YardCreator() {
  const [yard, setYard] = useState<YardSchema>(defaultYard);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>("A");
  const [selectedStation, setSelectedStation] = useState<string>("st_a1");

  const getSvgCoords = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: snap((e.clientX - rect.left) * scaleX),
      y: snap((e.clientY - rect.top) * scaleY),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getSvgCoords(e);

      if (tool === "select") {
        setSelectedId(null);
        return;
      }

      if (tool.startsWith("add_") && (tool.includes("main") || tool.includes("loop"))) {
        setDragStart(pos);
        return;
      }

      if (tool.startsWith("add_signal_")) {
        const signalType = tool.replace("add_signal_", "") as SignalType;
        addSignal(pos, signalType);
        return;
      }

      if (tool === "add_turnout") {
        setDragStart(pos);
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, getSvgCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStart) return;
      const pos = getSvgCoords(e);
      setPreviewLine({ x1: dragStart.x, y1: dragStart.y, x2: pos.x, y2: pos.y });
    },
    [dragStart, getSvgCoords]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const pos = getSvgCoords(e);

      if (dragStart && (tool.includes("main") || tool.includes("loop"))) {
        const fromX = Math.min(dragStart.x, pos.x);
        const toX = Math.max(dragStart.x, pos.x);
        if (toX - fromX >= GRID) {
          addLine(fromX, toX, tool);
        }
        setDragStart(null);
        setPreviewLine(null);
        return;
      }

      if (dragStart && tool === "add_turnout") {
        addTurnout(dragStart, pos);
        setDragStart(null);
        setPreviewLine(null);
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragStart, tool, getSvgCoords]
  );

  function addLine(fromX: number, toX: number, t: Tool) {
    const idMap: Record<string, { id: string; dir: "UP" | "DN" | "COMMON"; y: number }> = {
      add_up_main: { id: "UP_MAIN", dir: "UP", y: 154 },
      add_dn_main: { id: "DN_MAIN", dir: "DN", y: 254 },
      add_up_loop: { id: "UP_LOOP", dir: "COMMON", y: 54 },
      add_dn_loop: { id: "DN_LOOP", dir: "COMMON", y: 354 },
    };
    const info = idMap[t];
    if (!info) return;
    if (yard.lines.find((l) => l.id === info.id)) return;

    const line: YardLine = {
      id: info.id,
      y: info.y,
      direction: info.dir,
      from_x: fromX,
      to_x: toX,
    };
    setYard((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  }

  function addSignal(pos: { x: number; y: number }, type: SignalType) {
    const line = findLineAt(pos.y);
    if (!line) return;

    const dir = line.direction === "DN" ? "DN" : "UP";
    const suffix = yard.station_id.toUpperCase().replace("ST_", "ST_");
    const id = `${SIGNAL_NAMES[type].replace(/\s/g, "_")}_${dir}_${suffix}`;
    if (yard.signals.find((s) => s.id === id)) return;

    const signal: YardSignal = {
      id,
      name: `${SIGNAL_NAMES[type]} ${dir}`,
      line: line.id,
      at_x: pos.x,
      initial_state: type === "ow" || type === "adv" ? "red" : "green",
    };
    setYard((prev) => ({ ...prev, signals: [...prev.signals, signal] }));
  }

  function addTurnout(from: { x: number; y: number }, to: { x: number; y: number }) {
    const fromLine = findLineAt(from.y);
    const toLine = findLineAt(to.y);
    if (!fromLine || !toLine || fromLine.id === toLine.id) return;

    const id = `T${yard.turnouts.length + 1}_${yard.station_id.toUpperCase()}`;
    const turnout: YardTurnout = {
      id,
      from_line: fromLine.id,
      from_x: from.x,
      to_line: toLine.id,
      to_x: to.x,
    };
    setYard((prev) => ({ ...prev, turnouts: [...prev.turnouts, turnout] }));
  }

  function findLineAt(y: number): YardLine | undefined {
    return yard.lines.find((l) => Math.abs(l.y - y) < 30);
  }

  function removeSelected() {
    if (!selectedId) return;
    setYard((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== selectedId),
      signals: prev.signals.filter((s) => s.id !== selectedId),
      turnouts: prev.turnouts.filter((t) => t.id !== selectedId),
      blocks: prev.blocks.filter((b) => b.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function validate() {
    const errors: string[] = [];
    if (yard.lines.length === 0) errors.push("No lines defined");
    if (!yard.lines.find((l) => l.id === "UP_MAIN")) errors.push("Missing UP_MAIN");
    if (!yard.lines.find((l) => l.id === "DN_MAIN")) errors.push("Missing DN_MAIN");
    for (const sig of yard.signals) {
      if (!yard.lines.find((l) => l.id === sig.line)) {
        errors.push(`Signal ${sig.id} references unknown line ${sig.line}`);
      }
    }
    for (const t of yard.turnouts) {
      if (!yard.lines.find((l) => l.id === t.from_line))
        errors.push(`Turnout ${t.id} references unknown from_line ${t.from_line}`);
      if (!yard.lines.find((l) => l.id === t.to_line))
        errors.push(`Turnout ${t.id} references unknown to_line ${t.to_line}`);
    }
    setValidation(errors);
    return errors.length === 0;
  }

  function exportJson() {
    if (!validate()) return;
    const json = JSON.stringify(yard, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${yard.station_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToServer() {
    if (!validate()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/yard/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(yard),
      });
      if (res.ok) {
        alert("Saved successfully");
      } else {
        const data = await res.json();
        alert(`Save failed: ${data.detail ?? res.statusText}`);
      }
    } catch (err) {
      alert(`Save failed: ${err}`);
    }
  }

  function importJson() {
    try {
      const parsed = JSON.parse(importText) as YardSchema;
      setYard(parsed);
      setShowImport(false);
      setImportText("");
    } catch {
      alert("Invalid JSON");
    }
  }

  let built;
  try {
    built = buildYardLayout(yard);
  } catch {
    built = null;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <h1 className="text-sm font-bold mr-4">Yard Layout Creator</h1>
        <label className="text-xs text-gray-400">Section:</label>
        <select
          className="bg-gray-800 text-xs px-2 py-1 rounded border border-gray-600"
          value={selectedSection}
          onChange={(e) => {
            const sec = SECTIONS.find((s) => s.id === e.target.value);
            setSelectedSection(e.target.value);
            if (sec) {
              setSelectedStation(sec.stations[0]);
              setYard((p) => ({ ...p, station_id: sec.stations[0], station_name: sec.name }));
            }
          }}
        >
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.controller})</option>
          ))}
        </select>
        <label className="text-xs text-gray-400 ml-2">Station:</label>
        <select
          className="bg-gray-800 text-xs px-2 py-1 rounded border border-gray-600"
          value={selectedStation}
          onChange={(e) => {
            setSelectedStation(e.target.value);
            setYard((p) => ({ ...p, station_id: e.target.value }));
          }}
        >
          {SECTIONS.find((s) => s.id === selectedSection)?.stations.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <input
          className="bg-gray-800 text-xs px-2 py-1 rounded border border-gray-600 w-40 ml-2"
          value={yard.station_name}
          onChange={(e) => setYard((p) => ({ ...p, station_name: e.target.value }))}
          placeholder="Station Name"
        />
        <div className="flex-1" />
        <button onClick={validate} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
          Validate
        </button>
        <button onClick={saveToServer} className="px-3 py-1 text-xs bg-green-700 rounded hover:bg-green-600">
          Save to Server
        </button>
        <button onClick={exportJson} className="px-3 py-1 text-xs bg-blue-700 rounded hover:bg-blue-600">
          Export JSON
        </button>
        <button onClick={() => setShowImport(true)} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
          Import JSON
        </button>
        <button onClick={() => setYard(defaultYard())} className="px-3 py-1 text-xs bg-red-800 rounded hover:bg-red-700">
          Clear
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Tools */}
        <div className="w-48 bg-gray-900 border-r border-gray-700 p-2 overflow-y-auto">
          <div className="text-xs font-bold text-gray-400 mb-2">TOOLS</div>
          {(
            [
              ["select", "Select"],
              ["add_up_main", "+ UP_MAIN"],
              ["add_dn_main", "+ DN_MAIN"],
              ["add_up_loop", "+ UP_LOOP"],
              ["add_dn_loop", "+ DN_LOOP"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${
                tool === t ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="text-xs font-bold text-gray-400 mt-3 mb-2">SIGNALS</div>
          {(
            [
              ["add_signal_ow", "Outer Warner"],
              ["add_signal_home", "Home"],
              ["add_signal_starter", "Starter"],
              ["add_signal_adv", "Adv Starter"],
              ["add_signal_loop_starter", "Loop Starter"],
              ["add_signal_loop_exit", "Loop Exit"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${
                tool === t ? "bg-green-600" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="text-xs font-bold text-gray-400 mt-3 mb-2">OTHER</div>
          <button
            onClick={() => setTool("add_turnout")}
            className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${
              tool === "add_turnout" ? "bg-yellow-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            + Turnout
          </button>
          <button
            onClick={() => setTool("add_block_boundary")}
            className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${
              tool === "add_block_boundary" ? "bg-purple-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            + Block Boundary
          </button>

          <div className="text-xs font-bold text-gray-400 mt-3 mb-2">SELECTED</div>
          {selectedId ? (
            <div className="text-xs text-gray-300">
              <div className="mb-1">{selectedId}</div>
              <button onClick={removeSelected} className="px-2 py-1 text-xs bg-red-700 rounded hover:bg-red-600">
                Delete
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500">None</div>
          )}
        </div>

        {/* Center - SVG Canvas */}
        <div className="flex-1 p-4 overflow-auto bg-gray-950">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="w-full h-full border border-gray-700 rounded bg-gray-900 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Grid */}
            {Array.from({ length: CANVAS_W / GRID + 1 }).map((_, i) => (
              <line key={`gv${i}`} x1={i * GRID} y1={0} x2={i * GRID} y2={CANVAS_H} stroke="#1e293b" strokeWidth="0.5" />
            ))}
            {Array.from({ length: CANVAS_H / GRID + 1 }).map((_, i) => (
              <line key={`gh${i}`} x1={0} y1={i * GRID} x2={CANVAS_W} y2={i * GRID} stroke="#1e293b" strokeWidth="0.5" />
            ))}

            {/* Lines */}
            {yard.lines.map((line) => (
              <g key={line.id} onClick={() => setSelectedId(line.id)}>
                <line
                  x1={line.from_x}
                  y1={line.y}
                  x2={line.to_x}
                  y2={line.y}
                  stroke={selectedId === line.id ? "#60a5fa" : "#22c55e"}
                  strokeWidth={4}
                  className="cursor-pointer"
                />
                <text x={line.from_x + 5} y={line.y - 8} fontSize="10" fill="#94a3b8">
                  {line.id}
                </text>
              </g>
            ))}

            {/* Turnouts */}
            {yard.turnouts.map((t) => {
              const fromLine = yard.lines.find((l) => l.id === t.from_line);
              const toLine = yard.lines.find((l) => l.id === t.to_line);
              if (!fromLine || !toLine) return null;
              return (
                <g key={t.id} onClick={() => setSelectedId(t.id)}>
                  <line
                    x1={t.from_x}
                    y1={fromLine.y}
                    x2={t.to_x}
                    y2={toLine.y}
                    stroke={selectedId === t.id ? "#facc15" : "#a16207"}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <text x={t.from_x + 3} y={Math.min(fromLine.y, toLine.y) - 5} fontSize="8" fill="#94a3b8">
                    {t.id}
                  </text>
                </g>
              );
            })}

            {/* Signals */}
            {yard.signals.map((sig) => {
              const line = yard.lines.find((l) => l.id === sig.line);
              if (!line) return null;
              const state = sig.initial_state;
              return (
                <g key={sig.id} onClick={() => setSelectedId(sig.id)}>
                  <rect x={sig.at_x - 4} y={line.y - 42} width={8} height={35} rx={2} fill="#4d4d4d" stroke="#555" strokeWidth="0.5" />
                  <circle cx={sig.at_x} cy={line.y - 33} r={2.5} fill={state === "red" ? "red" : "#330000"} />
                  <circle cx={sig.at_x} cy={line.y - 25} r={2.5} fill={state === "single_yellow" || state === "double_yellow" ? "#facc15" : "#332200"} />
                  <circle cx={sig.at_x} cy={line.y - 17} r={2.5} fill={state === "double_yellow" ? "#facc15" : "#332200"} />
                  <circle cx={sig.at_x} cy={line.y - 9} r={2.5} fill={state === "green" ? "limegreen" : "#002200"} />
                  <line x1={sig.at_x} y1={line.y - 7} x2={sig.at_x} y2={line.y} stroke="#555" strokeWidth="1.5" />
                  <text x={sig.at_x} y={line.y - 46} textAnchor="middle" fontSize="7" fill="#94a3b8">
                    {sig.name ?? sig.id}
                  </text>
                </g>
              );
            })}

            {/* Preview line during drag */}
            {previewLine && (
              <line
                x1={previewLine.x1}
                y1={previewLine.y1}
                x2={previewLine.x2}
                y2={previewLine.y2}
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            )}

            {/* Built preview */}
            {built?.segments.map((seg) => (
              <path
                key={`built-${seg.id}`}
                d={seg.d}
                stroke="#22c55e22"
                strokeWidth={6}
                fill="none"
                strokeDasharray={seg.isBlock ? "8 4" : "none"}
              />
            ))}
          </svg>
        </div>

        {/* Right Panel - Properties & Validation */}
        <div className="w-56 bg-gray-900 border-l border-gray-700 p-2 overflow-y-auto">
          <div className="text-xs font-bold text-gray-400 mb-2">SCHEMA</div>
          <div className="text-xs text-gray-300 space-y-1">
            <div>Lines: {yard.lines.length}</div>
            <div>Signals: {yard.signals.length}</div>
            <div>Turnouts: {yard.turnouts.length}</div>
            <div>Blocks: {yard.blocks.length}</div>
          </div>

          <div className="text-xs font-bold text-gray-400 mt-3 mb-2">VALIDATION</div>
          {validation.length === 0 ? (
            <div className="text-xs text-green-400">All checks pass</div>
          ) : (
            <div className="text-xs text-red-400 space-y-1">
              {validation.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          <div className="text-xs font-bold text-gray-400 mt-3 mb-2">YARD JSON</div>
          <pre className="text-[9px] text-gray-400 bg-gray-950 p-2 rounded overflow-auto max-h-96">
            {JSON.stringify(yard, null, 2)}
          </pre>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded p-4 w-[500px]">
            <div className="text-sm font-bold mb-2">Import Yard JSON</div>
            <textarea
              className="w-full h-64 bg-gray-950 text-xs text-gray-300 p-2 rounded border border-gray-600 font-mono"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste yard JSON here..."
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setShowImport(false)} className="px-3 py-1 text-xs bg-gray-700 rounded">
                Cancel
              </button>
              <button onClick={importJson} className="px-3 py-1 text-xs bg-blue-700 rounded">
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
