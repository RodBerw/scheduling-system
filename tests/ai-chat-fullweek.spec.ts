import { test, expect } from "@playwright/test";

/**
 * AI Chat tests against the seeded "Full Week" schedule.
 * Tests tool-calling reliability: modifying requirements, generating schedules,
 * replacing employees, and multi-step operations.
 */

/** Locate the Full Week schedule dynamically from the API */
async function getFullWeekId(
  page: import("@playwright/test").Page
): Promise<number> {
  const res = await page.request.get("http://localhost:3001/schedules");
  const schedules = (await res.json()) as { id: number; name: string }[];
  const fullWeek = schedules.find((s) => s.name === "Full Week");
  if (!fullWeek) throw new Error("Full Week schedule not found in seed data");
  return fullWeek.id;
}

/** Shift card locator — shift cards are TooltipTrigger elements containing role badges */
function shiftCards(page: import("@playwright/test").Page) {
  return page.locator('[class*="rounded-lg"][class*="cursor-pointer"][class*="text-xs"]').filter({
    hasText: /(MGR|COOK|WAIT|DISH)/,
  });
}

/** Send a chat message and wait for the AI response. Returns the reply text. */
async function chat(page: import("@playwright/test").Page, message: string) {
  const chatInput = page.getByLabel("Chat message");
  await chatInput.fill(message);
  await page.getByRole("button", { name: "Send message" }).click();

  // Wait for loading dots to appear and then disappear
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({
    timeout: 90_000,
  });

  // Grab the last assistant message
  const msgs = page.locator('[role="log"] > div.flex.justify-start');
  const last = msgs.last();
  await expect(last).toBeVisible({ timeout: 10_000 });
  return (await last.textContent()) || "";
}

/** Get the filled/open counts from the header stats bar */
async function getHeaderStats(page: import("@playwright/test").Page) {
  const statsText = await page
    .locator("header")
    .first()
    .textContent();
  const filledMatch = statsText?.match(/(\d+)\s*filled/);
  const openMatch = statsText?.match(/(\d+)\s*open/);
  return {
    filled: filledMatch ? parseInt(filledMatch[1]) : -1,
    open: openMatch ? parseInt(openMatch[1]) : -1,
  };
}

test.describe("AI Chat — Full Week Schedule", () => {
  test.beforeEach(async ({ page }) => {
    const id = await getFullWeekId(page);
    await page.goto(`/schedule/${id}`);
    await expect(page.locator("text=AI Assistant")).toBeVisible({
      timeout: 10_000,
    });
    // Wait for grid to load — shift cards contain role badges like MGR, COOK, etc.
    await expect(shiftCards(page).first()).toBeVisible({ timeout: 15_000 });
  });

  test("should answer a question about the current schedule without actions", async ({
    page,
  }) => {
    const reply = await chat(
      page,
      "How many shifts are currently unfilled?"
    );
    console.log("Reply (info question):", reply);

    // Should mention a number or "unfilled" — pure information, no tool call
    expect(reply.length).toBeGreaterThan(10);
    expect(
      /\d+/.test(reply) || reply.toLowerCase().includes("unfill")
    ).toBe(true);
  });

  test("should change requirements for a specific day and period", async ({
    page,
  }) => {
    const reply = await chat(
      page,
      "Change Monday morning to 3 cooks and 2 waiters"
    );
    console.log("Reply (change requirements):", reply);

    expect(reply.toLowerCase()).toMatch(/requirement|set|updated|done/);
  });

  test("should remove requirements by setting count to 0", async ({
    page,
  }) => {
    const reply = await chat(
      page,
      "Remove all dishwasher requirements from Sunday"
    );
    console.log("Reply (remove requirements):", reply);

    expect(reply.toLowerCase()).toMatch(/remov|set|requirement|done|0/);
  });

  test("should regenerate the schedule and update the grid", async ({
    page,
  }) => {
    const beforeStats = await getHeaderStats(page);
    console.log("Before generate:", beforeStats);

    const reply = await chat(page, "Regenerate the schedule");
    console.log("Reply (regenerate):", reply);

    expect(reply.toLowerCase()).toMatch(/generat|shift|schedule|done/);

    // Wait for grid to update
    await page.waitForTimeout(2000);

    const afterStats = await getHeaderStats(page);
    console.log("After generate:", afterStats);

    // Should have shifts
    expect(afterStats.filled + afterStats.open).toBeGreaterThan(0);
  });

  test("should replace a specific employee on a shift", async ({ page }) => {
    // Find an employee name from the grid to ask for replacement
    const firstShift = shiftCards(page).first();
    const shiftText = await firstShift.textContent();
    // Extract first name from the shift card
    const nameMatch = shiftText?.match(/^(\w+)/);
    const employeeName = nameMatch ? nameMatch[1] : "the cook";

    console.log("Will try to replace:", employeeName);

    const reply = await chat(
      page,
      `Replace ${employeeName} on their first shift`
    );
    console.log("Reply (replace):", reply);

    expect(reply.toLowerCase()).toMatch(
      /replac|swap|assign|done|could not|unfilled/
    );
  });

  test("should handle a multi-step request: set requirements + generate", async ({
    page,
  }) => {
    // Ask to set requirements AND generate in one message
    const reply = await chat(
      page,
      "Set Tuesday evening to 1 manager, 2 cooks, 3 waiters, 1 dishwasher, then generate the schedule"
    );
    console.log("Reply (multi-step):", reply);

    // Should mention both actions
    expect(reply.toLowerCase()).toMatch(/requirement|set/);
    expect(reply.toLowerCase()).toMatch(/generat|shift|schedule/);

    // Grid should have shifts after generation
    await page.waitForTimeout(2000);
    const shiftCount = await shiftCards(page).count();
    console.log("Shifts after multi-step:", shiftCount);
    expect(shiftCount).toBeGreaterThan(0);
  });

  test("should add weekend-specific requirements", async ({ page }) => {
    const reply = await chat(
      page,
      "Add 5 waiters on weekend evenings"
    );
    console.log("Reply (weekend requirements):", reply);

    expect(reply.toLowerCase()).toMatch(/requirement|set|weekend|done/);
  });

  test("should handle batch replacement for an employee across multiple shifts", async ({
    page,
  }) => {
    // First, find an employee who appears in multiple shifts
    const allShifts = shiftCards(page);
    const count = await allShifts.count();

    // Collect employee names from first few shifts
    const names: string[] = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await allShifts.nth(i).textContent();
      const match = text?.match(/^(\w+)/);
      if (match && match[1] !== "Open") names.push(match[1]);
    }

    // Find a name that appears more than once
    const freq = names.reduce(
      (acc, n) => ({ ...acc, [n]: (acc[n] || 0) + 1 }),
      {} as Record<string, number>
    );
    const repeatedName = Object.entries(freq).find(([, c]) => c > 1)?.[0];
    const targetName = repeatedName || names[0] || "the first cook";

    console.log("Batch replace target:", targetName);

    const reply = await chat(
      page,
      `Replace ${targetName} on all their shifts`
    );
    console.log("Reply (batch replace):", reply);

    expect(reply.toLowerCase()).toMatch(
      /replac|batch|process|shift|done|could not/
    );
  });

  test("should delete all shifts from a specific day", async ({ page }) => {
    const beforeCount = await shiftCards(page).count();
    console.log("Shifts before delete:", beforeCount);

    const reply = await chat(page, "Delete all shifts from Monday");
    console.log("Reply (delete day):", reply);

    expect(reply.toLowerCase()).toMatch(/delet|remov|done/);

    // Wait for grid to update
    await page.waitForTimeout(2000);

    const afterCount = await shiftCards(page).count();
    console.log("Shifts after delete:", afterCount);

    // Should have fewer shifts now
    expect(afterCount).toBeLessThan(beforeCount);
  });

  test("should delete shifts filtered by day and period", async ({ page }) => {
    const beforeCount = await shiftCards(page).count();

    const reply = await chat(
      page,
      "Delete all Tuesday morning shifts"
    );
    console.log("Reply (delete day+period):", reply);

    expect(reply.toLowerCase()).toMatch(/delet|remov|done/);

    await page.waitForTimeout(2000);
    const afterCount = await shiftCards(page).count();
    console.log("Shifts after delete:", afterCount);

    expect(afterCount).toBeLessThan(beforeCount);
  });

  test("should assign a specific employee to a shift", async ({ page }) => {
    const reply = await chat(
      page,
      "Assign the first available cook to an unfilled shift, or if there are no unfilled shifts, assign any cook to the first Monday morning shift"
    );
    console.log("Reply (assign):", reply);

    expect(reply.toLowerCase()).toMatch(/assign|done/);
  });

  test("should unassign an employee from shifts", async ({ page }) => {
    const reply = await chat(
      page,
      "Unassign whoever is working the first Monday morning shift"
    );
    console.log("Reply (unassign):", reply);

    expect(reply.toLowerCase()).toMatch(/unassign|remov|done|unfill/);
  });

  test("should delete shifts for a role on a specific day", async ({
    page,
  }) => {
    const reply = await chat(
      page,
      "Delete all cook shifts from Wednesday"
    );
    console.log("Reply (delete role+day):", reply);

    expect(reply.toLowerCase()).toMatch(/delet|remov|done/);
  });
});
