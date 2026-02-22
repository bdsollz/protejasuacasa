import { expect, test } from "@playwright/test";

test("navegação entre rotas principais", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /design system web/i })).toBeVisible();

  await page.getByRole("link", { name: "Form" }).click();
  await expect(page.getByRole("heading", { name: /formulário com validação/i })).toBeVisible();

  await page.getByRole("link", { name: "Componentes" }).click();
  await expect(page.getByRole("heading", { name: /botões/i })).toBeVisible();

  await page.getByRole("link", { name: "Config" }).click();
  await expect(page.getByRole("heading", { name: /tema/i })).toBeVisible();
});

test("foco via teclado", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /pular para conteúdo/i })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeFocused();
});
