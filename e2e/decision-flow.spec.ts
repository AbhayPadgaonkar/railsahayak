import { test, expect, Page } from "@playwright/test";

const SESSION_KEY = "railsahayak_session";

const injectSession = async (page: Page) => {
  await page.addInitScript(
    ([key]) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          token: "test-token",
          controller_id: "ccg-vr",
          name: "CCG-VR",
          section: "Section A",
        })
      );
    },
    [SESSION_KEY]
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
  await injectSession(page);
  await page.goto("/train-management");
  await expect(page.getByRole("heading", { name: "Train Management" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Decision" })).toBeEnabled();
});

test("runs a decision for the default trains and renders the outcome", async ({
  page,
}) => {
  await injectSession(page);
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
  await injectSession(page);
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
  await injectSession(page);
  await page.goto("/dashboard?station=st_a1");

  await expect(page.getByText("Track Free")).toBeVisible();
  await expect(page.getByText("Decision GO")).toBeVisible();
  await expect(page.getByText("Decision HOLD")).toBeVisible();

  await expect(page.getByRole("combobox")).toHaveValue("st_a1");
  await page.getByRole("combobox").selectOption("st_a2");
  await expect
    .poll(async () => new URL(page.url()).searchParams.get("station"))
    .toBe("st_a2");
});