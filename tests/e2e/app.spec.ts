import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill("test@spendwise.local");
  await page.getByPlaceholder("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Yash." }),
  ).toBeVisible();
}
async function openCapture(page: Page) {
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .click();
}
test("natural language saves to SQL, supports edit, delete, undo, and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await openCapture(page);
  const text = `lunch 251 ${Date.now()}`;
  await page.getByLabel("What happened?").fill(text);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(
    page.getByText("Saved 1 transaction", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View or edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Transaction", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("275");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit transaction" }),
  ).not.toBeVisible();
  await page.getByRole("button").filter({ hasText: text }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button").filter({ hasText: text }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export filtered transactions" })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  expect(errors).toEqual([]);
});
test("ambiguity and provider failures retain the draft without saving", async ({
  page,
}) => {
  await login(page);
  await openCapture(page);
  await page.getByLabel("What happened?").fill("paid Ravi 2000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(page.getByText("One more detail")).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("paid Ravi 2000");
  await page.getByLabel("What happened?").fill("provider unavailable 250");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("draft is safe");
  await page.reload();
  await openCapture(page);
  await expect(page.getByLabel("What happened?")).toHaveValue(
    "provider unavailable 250",
  );
});
for (const type of ["Expense", "Income", "Investment", "Lending", "Transfer"])
  test(`manual ${type} can be saved`, async ({ page }) => {
    await login(page);
    await openCapture(page);
    await page.getByRole("button", { name: "Use form", exact: true }).click();
    await page.getByRole("combobox", { name: "Type", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(type, "i") }).click();
    await page.getByLabel("Amount (₹)", { exact: true }).fill("1500");
    await page.getByLabel("Note", { exact: true }).fill(`Manual ${type}`);
    if (type === "Lending")
      await page.getByLabel("Counterparty", { exact: true }).fill("Ravi");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Saved 1 transaction", { exact: true }),
    ).toBeVisible();
  });
test("all screens fit mobile widths and desktop without rendering errors", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  for (const width of [360, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/",
      "/transactions",
      "/insights",
      "/more",
      "/budgets",
      "/groups",
      "/categories",
      "/recurring",
      "/import",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} at ${width}`,
      ).toBeTruthy();
      expect(
        await page.locator('[role="alert"]').count(),
        `${route} failed to load`,
      ).toBe(0);
    }
  }
  expect(errors).toEqual([]);
});
test("recurring form creates an editable server schedule", async ({ page }) => {
  await login(page);
  await page.goto("/recurring");
  await page.getByRole("button", { name: "New recurring" }).click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("20000");
  await page.getByLabel("Note", { exact: true }).fill("Flat rent");
  await page
    .getByRole("button", { name: "Create schedule", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Flat rent" })).toBeVisible();
  await page
    .getByRole("button", { name: "Pause", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }).first(),
  ).toBeVisible();
});

test('budgets, group archiving, import review and PDF export remain usable',async({page})=>{
 await login(page);await page.goto('/budgets');await page.getByRole('button',{name:'New budget',exact:true}).click();await page.getByLabel('Amount (₹)',{exact:true}).fill('10000');await page.getByRole('button',{name:'Create',exact:true}).click();await expect(page.getByRole('button').filter({hasText:'All expenses'})).toBeVisible();await page.getByRole('button').filter({hasText:'All expenses'}).click();await expect(page.getByText('Six-period history')).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.goto('/groups');await page.getByRole('button',{name:'Add group',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Weekend test trip');await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('button',{name:'Archive Weekend test trip'}).click();await expect(page.getByRole('button',{name:'Restore Weekend test trip'})).toBeVisible();
 await page.goto('/import');await page.getByLabel('Statement text').fill('import lunch 377');await page.getByRole('button',{name:'Review transactions'}).click();await expect(page.getByRole('heading',{name:'Review 1 transactions'})).toBeVisible();await page.getByRole('button',{name:'Import 1 transactions'}).click();await expect(page.getByText('Import complete')).toBeVisible();const download=page.waitForEvent('download');await page.getByRole('button',{name:'PDF',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});

test('manual draft survives closing and reopening the sheet',async({page})=>{await login(page);await openCapture(page);await page.getByRole('button',{name:'Use form',exact:true}).click();await page.getByLabel('Amount (₹)',{exact:true}).fill('450');await page.getByLabel('Note',{exact:true}).fill('Unfinished groceries');await page.getByRole('button',{name:'Close',exact:true}).click();await openCapture(page);await expect(page.getByLabel('Amount (₹)',{exact:true})).toHaveValue('450');await expect(page.getByLabel('Note',{exact:true})).toHaveValue('Unfinished groceries');});
