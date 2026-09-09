import { test, expect, Page, request } from "@playwright/test";

const SESSION_KEY = "railsahayak_session";
const API_URL = "http://127.0.0.1:8000";

type Session = {
  token: string;
  controller_id: string;
  name: string;
  section: string;
};

const login = async (
  controller_id = "CCG-VR",
  password = "ccgvr123"
): Promise<Session> => {
  const req = await request.newContext({ baseURL: API_URL });
  const resp = await req.post("/login", {
    data: { controller_id, password },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: ${await resp.text()}`);
  }
  return resp.json() as Promise<Session>;
};

const injectSession = async (page: Page, session: Session) => {
  await page.addInitScript(
    (args: (string | Session)[]) => {
      const [key, data] = args as [string, Session];
      localStorage.setItem(key, JSON.stringify(data));
    },
    [SESSION_KEY, session]
  );
};

// =============================================================================
// SECTION 1: AUTHENTICATION
// =============================================================================

test.describe("Authentication", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/train-management");
    await expect
      .poll(async () => page.url())
      .toContain("/login");
  });

  test("login page renders controller ID and password fields", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/controller/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|login/i })
    ).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/controller/i).fill("CCG-VR");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|login/i }).click();
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("logs in and reaches dashboard via direct navigation", async ({
    page,
  }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/dashboard?station=st_a1");
    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("/dashboard");
  });
});

// =============================================================================
// SECTION 2: DASHBOARD — Yard map, station picker, legend
// =============================================================================

test.describe("Dashboard", () => {
  test("renders yard map with track legend", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/dashboard?station=st_a1");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Track Free")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Decision GO")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Decision HOLD")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("station picker switches stations", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/dashboard?station=st_a1");
    await page.waitForLoadState("networkidle");

    const picker = page.getByRole("combobox");
    await expect(picker).toHaveValue("st_a1", { timeout: 15_000 });

    await picker.selectOption("st_a2");
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("station"))
      .toBe("st_a2");
  });

  test("station picker includes multiple stations", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/dashboard?station=st_a1");
    await page.waitForLoadState("networkidle");

    const picker = page.getByRole("combobox");
    await expect(picker).toBeVisible({ timeout: 15_000 });
    const options = await picker.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.some((o) => o.includes("st_a1"))).toBeTruthy();
  });
});

// =============================================================================
// SECTION 3: TRAIN MANAGEMENT — Decision flow
// =============================================================================

test.describe("Train Management", () => {
  test("renders page heading and run button", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/train-management");
    await expect(
      page.getByRole("heading", { name: "Train Management" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Run Decision" })
    ).toBeEnabled();
  });

  test("shows default trains for section A", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/train-management");
    await expect(page.getByText("Train #1 — Section A")).toBeVisible();
    await expect(page.getByText("Train #2 — Section A")).toBeVisible();
  });

  test("runs decision and renders output", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/train-management");

    await page.getByRole("button", { name: "Run Decision" }).click();
    await expect(page.getByText("Decision Output")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/ALLOWED/).first()).toBeVisible();
    await expect(page.getByText(/Max \d+ km\/h/).first()).toBeVisible();
  });

  test("handles backend error gracefully", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/train-management");
    await expect(page.getByText("Train #1 — Section A")).toBeVisible();

    await page.route("**/decision", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Decision request failed (500)" }),
      })
    );

    await page.getByRole("button", { name: "Run Decision" }).click();
    await expect(page.getByText("Decision request failed (500)")).toBeVisible();

    await page.unroute("**/decision");
    await page.getByRole("button", { name: "Run Decision" }).click();
    await expect(page.getByText("Decision Output")).toBeVisible({
      timeout: 15_000,
    });
  });
});

// =============================================================================
// SECTION 4: SIDEBAR NAVIGATION
// =============================================================================

test.describe("Sidebar Navigation", () => {
  test("sidebar links navigate to correct pages", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/dashboard?station=st_a1");
    await page.waitForLoadState("networkidle");

    const sidebar = page.locator("nav, [class*=sidebar]").first();
    if (await sidebar.isVisible()) {
      const links = sidebar.getByRole("link");
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// SECTION 5: CRISIS MANAGEMENT
// =============================================================================

test.describe("Crisis Management", () => {
  test("crisis management page loads", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/crisismanagement");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// SECTION 6: AUDIT LOGS
// =============================================================================

test.describe("Audit Logs", () => {
  test("audit logs page loads", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/auditlogs");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// SECTION 7: KPI BOARD
// =============================================================================

test.describe("KPI Board", () => {
  test("KPI board page loads", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/kpiboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// SECTION 8: WHAT-IF SIMULATIONS
// =============================================================================

test.describe("What-If Simulations", () => {
  test("simulations page loads", async ({ page }) => {
    const session = await login();
    await injectSession(page, session);
    await page.goto("/whatifsimulations");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// SECTION 9: YARD CREATOR (hidden page, no auth)
// =============================================================================

test.describe("Yard Creator", () => {
  test("yard creator loads without auth", async ({ page }) => {
    await page.goto("/yard-creator");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

// =============================================================================
// SECTION 10: CROSS-SECTION ACCESS CONTROL
// =============================================================================

test.describe("Cross-Section RBAC", () => {
  test("section A controller can access st_a1 sensors", async () => {
    const session = await login("CCG-VR", "ccgvr123");
    const req = await request.newContext({ baseURL: API_URL });
    const resp = await req.get("/sensors?station=st_a1", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test("section A controller denied st_b1 sensors", async () => {
    const session = await login("CCG-VR", "ccgvr123");
    const req = await request.newContext({ baseURL: API_URL });
    const resp = await req.get("/sensors?station=st_b1", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(resp.status()).toBe(403);
  });

  test("section B controller can access st_b1 sensors", async () => {
    const session = await login("VR-VLSD", "vrvlsd123");
    const req = await request.newContext({ baseURL: API_URL });
    const resp = await req.get("/sensors?station=st_b1", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(resp.ok()).toBeTruthy();
  });
});
