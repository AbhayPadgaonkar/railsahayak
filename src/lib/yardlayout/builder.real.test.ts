import { describe, it, expect } from "vitest";
import demoYard from "@/config/yards/demo_yard.json";
import { buildYardLayout } from "./builder";

describe("buildYardLayout against bundled demo schema", () => {
  it("builds the demo yard without throwing", () => {
    const yard = buildYardLayout(demoYard as never);
    expect(yard.segments.length).toBeGreaterThan(0);
    expect(yard.zones.length).toBeGreaterThan(0);
  });
});