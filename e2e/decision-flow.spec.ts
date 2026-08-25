import { test, expect, Page, request } from "@playwright/test";

const SESSION_KEY = "railsahayak_session";
const API_URL = "http://127.0.0.1:8000";

type Session = {
  token: string;
  controller_id: string;
  name: string;
  section: string;
};

const login = async (): Promise<Session> => {
  const req = await request.newContext({ baseURL: API_URL });
  const resp = await req.post("/login", {
    data: { controller_id: "CCG-VR", password: "ccgvr123" },
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

test("blocks unauthenticated users and redirects to login", async ({ page }) => {
  await page.goto("/train-management");
  await expect
    .poll(async () => page.url())
    .toContain("/login");
});

test("gates authenticated users into the train management page", async ({
  page,
}) => {
  const session = await login();
  await injectSession(page, session);
  await page.goto("/train-management");
  await expect(page.getByRole("heading", { name: "Train Management" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Decision" })).toBeEnabled();
});

test("runs a decision for the default trains and renders the outcome", async ({
  page,
}) => {
  const session = await login();
  await injectSession(page, session);
  await page.goto("/train-management");

  await expect(page.getByText("Train #1 — Section A")).toBeVisible();
  await expect(page.getByText("Train #2 — Section A")).toBeVisible();

  await page.getByRole("button", { name: "Run Decision" }).click();
  await expect(page.getByText("Decision Output")).toBeVisible({ timeout: 15_000 });

  // Default GREEN + clear block on the ordering line should be ALLOWED
  await expect(page.getByText(/ALLOWED/).first()).toBeVisible();
  await expect(page.getByText(/Max \d+ km\/h/).first()).toBeVisible();
});

test("shows an error banner when the decision backend fails", async ({
  page,
}) => {
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

  // Un-route and run again to prove the error clears and results render
  await page.unroute("**/decision");
  await page.getByRole("button", { name: "Run Decision" }).click();
  await expect(page.getByText("Decision Output")).toBeVisible({ timeout: 15_000 });
});

test("dashboard renders the yard legend and switches stations via the picker", async ({
  page,
}) => {
  const session = await login();
  await injectSession(page, session);
  await page.goto("/dashboard?station=st_a1");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Track Free")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Decision GO")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Decision HOLD")).toBeVisible({ timeout: 15_000 });

  const stationPicker = page.getByRole("combobox");
  await expect(stationPicker).toBeVisible({ timeout: 15_000 });
  await expect(stationPicker).toHaveValue("st_a1", { timeout: 15_000 });

  await stationPicker.selectOption("st_a2");
  await expect
    .poll(async () => new URL(page.url()).searchParams.get("station"))
    .toBe("st_a2");
});