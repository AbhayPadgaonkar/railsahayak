import "@testing-library/jest-dom/vitest";

// Yard rendering uses requestAnimationFrame for the demo train loop and SVG
// path measurement APIs that jsdom does not implement. Stub them so component
// tests render deterministically without animation or layout queries.
globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

const patchPathMeasurement = (proto: object) => {
  Object.defineProperty(proto, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
  Object.defineProperty(proto, "getPointAtLength", {
    configurable: true,
    value: () => ({ x: 0, y: 0 }),
  });
};

const pathConstructors: unknown[] = [
  globalThis.SVGPathElement,
  globalThis.SVGElement,
  globalThis.Element,
].filter(Boolean);
for (const maybeProto of pathConstructors) {
  const proto = (maybeProto as { prototype: object }).prototype;
  try {
    patchPathMeasurement(proto);
  } catch {
    // prototype may be frozen in exotic environments - ignore
  }
}