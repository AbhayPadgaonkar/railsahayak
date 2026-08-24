import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YardLive from "./yardlive";
import { lineInfo, makeSchema, sensorSnapshot } from "@/test/helpers";

const routerReplace = vi.fn();
const getYards = vi.fn();
const getSections = vi.fn();
const getSensorSnapshot = vi.fn();
const getYardSchema = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/api", () => ({
  getYards: (...args: unknown[]) => getYards(...args),
  getSections: (...args: unknown[]) => getSections(...args),
  getSensorSnapshot: (...args: unknown[]) => getSensorSnapshot(...args),
  getYardSchema: (...args: unknown[]) => getYardSchema(...args),
}));

describe("YardLive", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/dashboard");
    getYards.mockResolvedValue([
      { station_id: "st_a1", station_name: "Section A - Station 1" },
      { station_id: "st_b9", station_name: "Legacy Yard" },
    ]);
    getSections.mockResolvedValue(lineInfo);
    getSensorSnapshot.mockResolvedValue(sensorSnapshot());
    getYardSchema.mockResolvedValue(makeSchema());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the validated station query param or falls back to the default", async () => {
    const { unmount } = render(<YardLive />);
    await waitFor(() => {
      expect(getYardSchema).toHaveBeenCalledWith("st_a1");
    });
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("st_a1");
    unmount();

    window.history.pushState({}, "", "/dashboard?station=St_B9");
    render(<YardLive />);
    await waitFor(() => {
      expect(getYardSchema).toHaveBeenCalledWith("st_b9");
    });
    expect(screen.getByRole("combobox")).toHaveValue("st_b9");
  });

  it("renders stations grouped by section plus an Other group", async () => {
    render(<YardLive />);
    await waitFor(() => {
      expect(screen.getByText("Section A - Station 1 (st_a1)")).toBeInTheDocument();
    });
    expect(screen.getByText("Legacy Yard (st_b9)")).toBeInTheDocument();
    const container = document.body;
    expect(
      container.querySelector('optgroup[label="Section A (ccg-vr)"]')
    ).not.toBeNull();
    expect(container.querySelector('optgroup[label="Other"]')).not.toBeNull();
  });

  it("polls the sensor snapshot on mount and on the interval", async () => {
    vi.useFakeTimers();
    render(<YardLive />);
    await vi.waitFor(() => {
      expect(getSensorSnapshot).toHaveBeenCalledWith("st_a1");
    });
    getSensorSnapshot.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(getSensorSnapshot).toHaveBeenCalledWith("st_a1");
  }, 10000);

  it("resets sensor state and re-polls when the station changes", async () => {
    const u = userEvent.setup();
    render(<YardLive />);
    await waitFor(() => {
      expect(getSensorSnapshot).toHaveBeenCalledWith("st_a1");
    });

    await u.selectOptions(screen.getByRole("combobox"), "st_b9");
    await waitFor(() => {
      expect(getSensorSnapshot).toHaveBeenCalledWith("st_b9");
    });
    expect(routerReplace).toHaveBeenCalledWith("/dashboard?station=st_b9");
  });

  it("keeps default station and retries when the snapshot fetch fails", async () => {
    getSensorSnapshot.mockRejectedValue(new Error("unreachable"));
    render(<YardLive />);
    await waitFor(() => {
      expect(getSensorSnapshot).toHaveBeenCalledWith("st_a1");
    });
    expect(screen.getByRole("combobox")).toHaveValue("st_a1");
  });
});