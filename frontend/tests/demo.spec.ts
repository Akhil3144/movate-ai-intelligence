import { test, expect } from "@playwright/test";

test("main demo: overview → source → chat → compare → editable saved plan", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Clarity for every decision." }),
  ).toBeVisible();
  await expect(page.getByText("12,000", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/overview-light.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "AI Agents & Solutions", exact: true })
    .click();
  await expect(page.getByText("13 matching agents")).toBeVisible();
  await page
    .getByRole("link", {
      name: "Training Reporting Agent",
      exact: true,
    })
    .click();
  await page.getByText("View original requirements", { exact: true }).click();
  await expect(page.getByText("Chris-S1-R3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ask AI about this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Movate AI" }),
  ).not.toBeEmpty();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Direct answer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Rules-based analysis", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore evidence & alternatives" })
    .click();
  await expect(
    page.getByRole("link", { name: /^QUERY-TRAINING / }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open interactive comparison" }).click();
  await expect(
    page.getByRole("heading", { name: "Three paths. One informed choice." }),
  ).toBeVisible();
  await expect(page.getByText("$6,480", { exact: true })).toBeVisible();
  await page.getByRole("slider", { name: "Adoption rate" }).fill("0");
  await expect(page.getByRole("slider", { name: "Adoption rate" })).toHaveValue("0");
  await expect(page.getByText("$0", { exact: true }).first()).toBeVisible();
  await page.getByRole("slider", { name: "Adoption rate" }).fill("100");
  await page
    .getByRole("button", { name: "Select this option", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create action plan", exact: true })
    .click();
  const savedTitle = "Verified pilot draft " + Date.now();
  await page
    .getByRole("textbox", { name: "Plan title", exact: true })
    .fill(savedTitle);
  await page
    .getByRole("textbox", { name: "Action plan content" })
    .fill(
      "Human-reviewed pilot draft. Validate baseline, run pilot, and review evidence before rollout.",
    );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved locally.")).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: savedTitle, exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("department navigation, HR access, theme, source mapping and exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/quality");
  await expect(page.getByText("2,200", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /AUD-/ }).first().click();
  await expect(page.getByRole("button", { name: "Close audit" })).toBeVisible();
  await page.getByRole("button", { name: "Close audit" }).click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "QA around completed training" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "HR", exact: true }).click();
  await expect(
    page.getByText("Restricted · HR Manager required"),
  ).toBeVisible();
  await expect(page.getByText("HRC-0001", { exact: true })).toHaveCount(0);
  await page.getByLabel("Demo persona").selectOption("HR Manager");
  await expect(page.getByText("HR Manager · masked access")).toBeVisible();
  await expect(
    page.getByText("Masked employee", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "../docs/screenshots/hr-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Data & Settings", exact: true })
    .click();
  await page.getByRole("tab", { name: "Source mapping" }).click();
  await expect(page.getByText("19", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "AI provider" }).click();
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download report", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "movate-summary-report.json",
  );
  expect(errors).toEqual([]);
});

test("filters, resumed chat, tour and responsive reduced-motion layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Program filter").selectOption("PRG-ACT");
  await expect(page.getByText("12,000", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Why are QA scores low for Activision?" })
    .click();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask follow-up" }).click();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Why are QA scores low for Activision?",
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct answer" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Take the demo tour" }).click();
  await expect(page.getByRole("dialog", { name: "Demo tour" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "AI Agents & Solutions" }),
  ).toBeVisible();
  for (let step = 0; step < 4; step++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Demo tour" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish tour", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Demo tour" })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Clarity for every decision." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/mobile-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Quality", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A better view of better service." }),
  ).toBeVisible();
});
