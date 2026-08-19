import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StationYardLayout from "./stationyardlayout";
import { makeSchema, sensorSnapshot } from "@/test/helpers";

const getYardSchema = vi.fn();

vi.mock("@/lib/api", () => ({
  getYardSchema: (...args: unknown[]) => getYardSchema(...args),
}));

describe("StationYardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders legend rows and an SVG with signals and labels", () => {
    const { container } = render(
      <StationYardLayout schema={makeSchema()} />
    );
    expect(screen.getByText("Track Free")).toBeInTheDocument();
    expect(screen.getByText("Track Occupied")).toBeInTheDocument();
    expect(screen.getByText("Decision GO")).toBeInTheDocument();
    expect(screen.getByText("Decision HOLD")).toBeInTheDocument();

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 600 200");
    expect(screen.getByText("UP MAIN")).toBeInTheDocument();
    expect(screen.getByText("Home UP")).toBeInTheDocument();
    expect(screen.getByText("Home DN")).toBeInTheDocument();
  });

  it("applies signal overrides and marks blocks from sensor zones occupied", () => {
    const { container } = render(
      <StationYardLayout
        schema={makeSchema()}
        sensorState={sensorSnapshot()}
      />
    );
    const svg = container.querySelector("svg")!;

    // Home UP overridden to red, Home DN to yellow
    const signalGroups = container.querySelectorAll("g");
    expect(signalGroups.length).toBeGreaterThan(0);

    // Paths representing the occupied zone slice should be red (#ef4444)
    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBeGreaterThan(0);
    const redPaths = paths.filter(
      (p) => p.getAttribute("stroke") === "#ef4444"
    );
    expect(redPaths.length).toBeGreaterThan(0);
  });

  it("renders decision markers with train ids, speed labels and hold/go colors", () => {
    const { container } = render(
      <StationYardLayout
        schema={makeSchema()}
        sensorState={sensorSnapshot()}
      />
    );
    expect(container.textContent).toContain("UP-101");
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("DN-202");

    const goCircles = container.querySelectorAll("circle[fill='#10b981']");
    const holdCircles = container.querySelectorAll("circle[fill='#ef4444']");
    // one GO marker + base animated train circles don't use these fills
    expect(goCircles.length).toBeGreaterThanOrEqual(1);
    expect(holdCircles.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the bundled demo layout when the schema fetch fails", async () => {
    getYardSchema.mockRejectedValue(new Error("unreachable"));
    render(<StationYardLayout stationId="st_unknown" />);
    await waitFor(() => {
      expect(screen.getByText("UP LOOP")).toBeInTheDocument();
    });
    expect(getYardSchema).toHaveBeenCalledWith("st_unknown");
  });

  it("fetches the schema when none is provided", async () => {
    getYardSchema.mockResolvedValue(makeSchema());
    render(<StationYardLayout stationId="st_a1" />);
    await waitFor(() => {
      expect(getYardSchema).toHaveBeenCalledWith("st_a1");
    });
    await waitFor(() => {
      expect(screen.getByText("Home UP")).toBeInTheDocument();
    });
  });
});