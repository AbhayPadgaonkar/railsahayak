import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DecisionPanel from "./decisionpanel";
import type { DecisionResult } from "@/lib/api";
import { lineInfo, makeSchema } from "@/test/helpers";
import { getSession } from "@/lib/auth";

const getDecision = vi.fn();
const getSections = vi.fn();
const getYardSchema = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => null),
}));

vi.mock("@/lib/api", () => ({
  getDecision: (...args: unknown[]) => getDecision(...args),
  getSections: (...args: unknown[]) => getSections(...args),
  getYardSchema: (...args: unknown[]) => getYardSchema(...args),
}));

describe("DecisionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSections.mockResolvedValue(lineInfo);
    getYardSchema.mockResolvedValue(makeSchema());
  });

  const happyResult: DecisionResult = {
    decisions: [
      {
        train_id: "UP-101",
        allow_movement: true,
        allowed_actions: ["PROCEED", "TCPASS"],
        max_speed: 100,
        reasons: ["Signal GREEN | block clear"],
      },
    ],
    optimized_order: [
      { train_id: "UP-101", order: 0, reason: "earlier arrival" },
      { train_id: "DN-202", order: 1 },
    ],
  };

  it("loads sections and seeds two default train cards", async () => {
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #1 — Section A")).toBeInTheDocument();
    });
    expect(screen.getByText("Train #2 — Section A")).toBeInTheDocument();
    const trainIds = screen.getAllByLabelText("Train ID");
    expect(trainIds).toHaveLength(2);
    const add = screen.getByRole("button", { name: "+ Add Train" });
    expect(add).toBeEnabled();
  });

  it("adds and removes train cards", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #2 — Section A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "+ Add Train" }));
    expect(await screen.findByText("Train #3 — Section A")).toBeInTheDocument();

    const firstCard = screen.getByText("Train #1 — Section A").closest("div")!;
    const removeButtons = within(firstCard).getAllByRole("button", {
      name: "Remove",
    });
    await user.click(removeButtons[0]);
    await waitFor(() => {
      expect(screen.queryByText("Train #3 — Section A")).not.toBeInTheDocument();
    });
    expect(screen.getAllByLabelText("Train ID")).toHaveLength(2);
  });

  it("auto-selects the next block when a different block is picked", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #1 — Section A")).toBeInTheDocument();
    });

    const blockSelects = screen.getAllByLabelText("Block");
    const nextSelects = screen.getAllByLabelText("Next Block");
    expect(blockSelects[0]).toHaveValue("ST_A1_AB");

    // ST_A1_BC is the tail block -> choosing it clears the next block link
    await user.selectOptions(blockSelects[0], "ST_A1_BC");
    await waitFor(() => {
      expect(blockSelects[0]).toHaveValue("ST_A1_BC");
    });
    expect(nextSelects[0]).toHaveValue("");

    // Choosing ST_A1_AB again auto-fills its single downstream block
    await user.selectOptions(blockSelects[0], "ST_A1_AB");
    await waitFor(() => {
      expect(nextSelects[0]).toHaveValue("ST_A1_BC");
    });
  });

  it("builds the exact payload from train edits and parsed context", async () => {
    getDecision.mockResolvedValue(happyResult);
    const user = userEvent.setup();
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #1 — Section A")).toBeInTheDocument();
    });

    const trainIds = screen.getAllByLabelText("Train ID");
    await user.type(trainIds[0], "UP-101");

    const occupied = screen.getByLabelText(
      /Occupied Lines \(comma-separated, block\|line\)/i
    );
    await user.type(occupied, " ST_A1_BC|UP_MAIN , ");
    const turnoutInput = screen.getByLabelText(/Occupied Turnouts/i);
    await user.type(turnoutInput, "T1_ST_A1");
    const disaster = screen.getByRole("checkbox", {
      name: /Disaster \/ emergency mode active/i,
    });
    await user.click(disaster);

    await user.click(screen.getByRole("button", { name: "Run Decision" }));

    await waitFor(() => {
      expect(getDecision).toHaveBeenCalledTimes(1);
    });
    const payload = getDecision.mock.calls[0][0] as {
      trains: { train_id: string }[];
      context: {
        occupied_lines: string[];
        occupied_turnouts: string[];
        fouling_segments: string[];
        disaster_active: boolean;
      };
    };
    expect(payload.trains).toHaveLength(2);
    expect(payload.trains[0].train_id).toBe("UP-101");
    expect(payload.context.occupied_lines).toEqual(["ST_A1_BC|UP_MAIN"]);
    expect(payload.context.occupied_turnouts).toEqual(["T1_ST_A1"]);
    expect(payload.context.fouling_segments).toEqual([]);
    expect(payload.context.disaster_active).toBe(true);
  });

  it("renders ALLOWED/HOLD badges, chips, reasons and optimized order", async () => {
    getDecision.mockResolvedValue(happyResult);
    const user = userEvent.setup();
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #1 — Section A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Run Decision" }));

    await waitFor(() => {
      expect(screen.getByText("Decision Output")).toBeInTheDocument();
    });
    expect(screen.getByText("ALLOWED")).toBeInTheDocument();
    expect(screen.getByText("PROCEED")).toBeInTheDocument();
    expect(screen.getByText("TCPASS")).toBeInTheDocument();
    expect(screen.getByText("Max 100 km/h")).toBeInTheDocument();
    expect(screen.getByText("Signal GREEN | block clear")).toBeInTheDocument();
    expect(screen.getByText("Optimized Precedence Order")).toBeInTheDocument();
    expect(screen.getByText("earlier arrival")).toBeInTheDocument();
  });

  it("shows an error banner on rejection then clears it on the next run", async () => {
    getDecision.mockRejectedValueOnce(new Error("Decision request failed (500)"));
    const user = userEvent.setup();
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Train #1 — Section A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Run Decision" }));
    await waitFor(() => {
      expect(screen.getByText("Decision request failed (500)")).toBeInTheDocument();
    });

    getDecision.mockResolvedValue(happyResult);
    await user.click(screen.getByRole("button", { name: "Run Decision" }));
    await waitFor(() => {
      expect(screen.getByText("Decision Output")).toBeInTheDocument();
    });
    expect(screen.queryByText("Decision request failed (500)")).not.toBeInTheDocument();
  });

  it("defaults to and locks the controller's assigned section", async () => {
    const session = {
      token: "token-vrvlsd",
      controller_id: "VR-VLSD",
      name: "R. Patil",
      section: "VR-VLSD",
    };
    (getSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue(session);
    render(<DecisionPanel />);
    await waitFor(() => {
      expect(screen.getByLabelText("Section")).toHaveValue("SEC_B");
    });
    expect(screen.getByLabelText("Section")).toBeDisabled();
  });
});