import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("scan básico de acessibilidade", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (item) => item.impact === "serious" || item.impact === "critical"
  );

  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
});
