import { readFileSync } from "node:fs";
import { test, expect, request as requestFactory } from "@playwright/test";

test("browser-local chats/drafts survive reload, separate contexts, and API remains protected", async ({
  page,
  browser,
  request,
}) => {
  await page.goto("/assistant");
  await expect(
    page.getByText("BROWSER-ONLY CONVERSATIONS", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message Movate AI" })
    .fill("Analyze QA for Activision from 2026-08-01 to 2026-08-31");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Analyze QA for Activision from 2026-08-01 to 2026-08-31",
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ask follow-up", exact: true })
    .click();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Generate action plan", exact: true })
    .last()
    .click();
  const title = "Browser-specific review " + Date.now();
  await page
    .getByRole("textbox", { name: "Plan title", exact: true })
    .fill(title);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved locally.", { exact: true })).toBeVisible();
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect((await request.get("/api/chats")).json()).resolves.toEqual([]);
  const clean = await requestFactory.newContext({ httpCredentials: undefined });
  const unauthenticated = await clean.get(new URL("/api/overview", page.url()).toString());
  expect(unauthenticated.status()).toBe(401);
  await clean.dispose();
  const second = await browser.newContext({
    httpCredentials: JSON.parse(
      readFileSync(process.env.MOVATE_PREVIEW_CREDENTIALS!, "utf8"),
    ),
  });
  const secondPage = await second.newPage();
  await secondPage.goto(page.url().replace("/reports", "/assistant"));
  await expect(
    secondPage.getByText("BROWSER-ONLY CONVERSATIONS", { exact: true }),
  ).toBeVisible();
  expect(await secondPage.locator(".chat-history-item").count()).toBe(0);
  await second.close();
});

test("SPA refreshes, unknown API JSON errors and hosted read-only data settings", async ({
  page,
  request,
}) => {
  await page.goto("/agents/OPP-008");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "QA Reporting Automation Agent",
      exact: true,
    }),
  ).toBeVisible();
  const missing = await request.get("/api/not-a-route");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toContain("json");
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Import & revalidate" }),
  ).toBeDisabled();
  const importResult = await request.post("/api/data/import", { data: {} });
  expect(importResult.status()).toBe(405);
  await page.getByRole("tab", { name: "Source mapping" }).click();
  await expect(page.getByText("19", { exact: true })).toBeVisible();
});
