import { expect, test } from "@playwright/test";

test("bootstrap page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Absensi Sekolah");
  await expect(page.getByRole("heading", { level: 1, name: "ok" })).toBeVisible();
});

test("health endpoint is reachable through the same origin", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
