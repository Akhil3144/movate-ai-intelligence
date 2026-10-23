import { test, expect } from "@playwright/test";
const agents = [
  ["OPP-001", "Training Reporting Agent"],
  ["OPP-002", "Training Effectiveness Agent"],
  ["OPP-003", "Trainer Performance Agent"],
  ["OPP-004", "Customer Support Agent"],
  ["OPP-005", "Sales Lead Optimization Agent"],
  ["OPP-006", "Product Troubleshooting Agent"],
  ["OPP-007", "Self-Service & Demand Triage Agent"],
  ["OPP-008", "QA Reporting Automation Agent"],
  ["OPP-009", "Sales Quality Verification Agent"],
  ["OPP-010", "QA Workflow Integration Agent"],
  ["OPP-011", "HR Disciplinary Workflow Agent"],
  ["OPP-012", "HR Onboarding Agent"],
  ["OPP-013", "Employee Engagement Agent"],
];
const sections = [
  "Original Movate Problem",
  "AI Agent Objective",
  "Relevant Synthetic Data",
  "Agent Workflow",
  "Generated Results and Recommendations",
  "Solution Comparison and Action Plan",
];
for (const [id, name] of agents) {
  test(`${id}: Explore Agent opens ${name} and runs its local workflow`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (
        r.url().startsWith("http") &&
        !r.url().startsWith("http://127.0.0.1:")
      )
        external.push(r.url());
    });
    const definition = await (await request.get("/api/agents/" + id)).json();
    await page.goto("/agents");
    await expect(
      page.getByText("13 matching agents", { exact: true }),
    ).toBeVisible();
    const card = page.locator(`[data-agent-id="${id}"]`);
    await expect(
      card.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(card.getByText(id, { exact: true })).toBeVisible();
    await card
      .getByRole("link", { name: "Explore Agent: " + name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("/agents/" + id + "$"));
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    for (const section of sections)
      await expect(
        page.getByRole("heading", { name: section, exact: true }),
      ).toBeVisible();
    expect(await page.locator(".agent-original-problem").textContent()).toBe(
      definition.primary_problem,
    );
    await page
      .locator(".page-title")
      .getByRole("button", { name: "Run Agent", exact: true })
      .click();
    const results = page.getByTestId("agent-results");
    await expect(results).toBeVisible();
    if (id === "OPP-011") {
      await expect(
        results.getByText("Restricted · HR Manager required", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Demo persona").selectOption("HR Manager");
      await expect(page.getByTestId("agent-results")).toHaveCount(0);
      await page
        .locator(".page-title")
        .getByRole("button", { name: "Run Agent", exact: true })
        .click();
      await expect(
        page
          .getByTestId("agent-results")
          .getByText("Local run complete", { exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("agent-results")).not.toContainText("EMP-");
    } else
      await expect(
        results.getByText("Local run complete", { exact: true }),
      ).toBeVisible();
    await expect(
      page
        .getByTestId("agent-results")
        .getByRole("heading", {
          name: "What this demo does not establish",
          exact: true,
        }),
    ).toBeVisible();
    await expect(
      page.getByTestId("agent-results").locator(".metric"),
    ).not.toHaveCount(0);
    await expect(page.getByTestId("agent-results")).toContainText(
      "No external calls · No operational changes",
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test("agent result drafts remain editable and old comparison/source links redirect", async ({
  page,
}) => {
  await page.goto("/opportunities/OPP-001?compare=1");
  await expect(page).toHaveURL(/\/agents\/OPP-001\?compare=1/);
  await expect(
    page.getByRole("heading", {
      name: "Three paths. One informed choice.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("$6,480", { exact: true })).toBeVisible();
  await page.goto("/agents/OPP-012");
  await page
    .locator(".page-title")
    .getByRole("button", { name: "Run Agent", exact: true })
    .click();
  await expect(page.getByTestId("agent-results")).toContainText(
    "No overdue claim is made.",
  );
  await page
    .getByRole("button", {
      name: "Draft action plan from results",
      exact: true,
    })
    .click();
  const title = "Agent onboarding draft " + Date.now();
  await page
    .getByRole("textbox", { name: "Plan title", exact: true })
    .fill(title);
  await expect(
    page.getByRole("textbox", { name: "Action plan content", exact: true }),
  ).toContainText("OPP-012");
  await page
    .getByRole("textbox", { name: "Action plan content", exact: true })
    .fill(
      "Review missing documents and obtain authorized HR approval. No personnel action is automated.",
    );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved locally.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.goto("/opportunities/OPP-008?sources=1");
  await expect(page).toHaveURL(/\/agents\/OPP-008\?sources=1/);
  await expect(page.getByText("QA_CI-S2-R2", { exact: true })).toBeVisible();
});

test("agent filtering, scope resets, dark theme and mobile remain usable", async ({
  page,
}) => {
  await page.goto("/agents");
  await page
    .getByLabel("Search agents", { exact: true })
    .fill("Onboarding Agent");
  await expect(
    page.getByText("1 matching agents", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Explore Agent: HR Onboarding Agent",
      exact: true,
    })
    .click();
  await page
    .locator(".page-title")
    .getByRole("button", { name: "Run Agent", exact: true })
    .click();
  await expect(page.getByTestId("agent-results")).toBeVisible();
  await page
    .getByLabel("Program filter", { exact: true })
    .selectOption("PRG-ACT");
  await expect(page.getByTestId("agent-results")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "../docs/screenshots/agent-onboarding-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "AI Agents & Solutions", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/agents-mobile.png",
    fullPage: false,
  });
});
