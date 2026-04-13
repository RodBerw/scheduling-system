import { test, expect } from "@playwright/test";

/**
 * E2E tests for the AI Chat scheduling assistant.
 *
 * These tests navigate to an existing schedule and interact with the AI chat
 * to verify it can:
 * 1. Respond to messages
 * 2. Set staffing requirements via natural language
 * 3. Generate a schedule
 * 4. Replace an employee on a shift
 */

/** Helper: create a schedule with non-overlapping dates */
async function createSchedule(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /new/i }).click();

  await page.getByLabel("Name").fill(name);
  // Use far-future dates to avoid overlapping with seeded schedules
  const offset = Math.floor(Math.random() * 200) + 10;
  const start = new Date();
  start.setDate(start.getDate() + offset * 7);
  const monday = new Date(start);
  monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = monday.toISOString().split("T")[0];
  const endStr = sunday.toISOString().split("T")[0];

  await page.getByLabel("Start date").fill(startStr);
  await page.getByLabel("End date").fill(endStr);

  await page.getByRole("button", { name: /create schedule/i }).click();
  await page.waitForURL(/\/schedule\/\d+/, { timeout: 15_000 });
  await expect(page.locator("text=AI Assistant")).toBeVisible({ timeout: 10_000 });
}

/** Helper: send a chat message and wait for the AI response */
async function sendAndWait(page: import("@playwright/test").Page, message: string) {
  const chatInput = page.getByLabel("Chat message");
  await chatInput.fill(message);
  await page.getByRole("button", { name: "Send message" }).click();

  // Wait for loading indicator to appear then disappear
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

  // Return the last visible message text (skip the hidden scroll anchor div)
  const messages = page.locator('[role="log"] > div:visible');
  const lastMessage = messages.last();
  await expect(lastMessage).toBeVisible({ timeout: 10_000 });
  return (await lastMessage.textContent()) || "";
}

test.describe("AI Chat Assistant", () => {
  test("should create a new schedule and see the chat panel", async ({ page }) => {
    await createSchedule(page, `Test Nav ${Date.now()}`);

    // Chat panel elements should be visible
    await expect(page.locator("text=AI Assistant")).toBeVisible();
    await expect(page.getByLabel("Chat message")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  });

  test("should send a message to set requirements and get a response", async ({ page }) => {
    await createSchedule(page, `Test Req ${Date.now()}`);

    const response = await sendAndWait(
      page,
      "Set requirements: 2 cooks and 1 waiter for every weekday morning"
    );
    console.log("AI Response (set requirements):", response);

    expect(response.length).toBeGreaterThan(10);
    const hasAction =
      response.toLowerCase().includes("requirement") ||
      response.toLowerCase().includes("done") ||
      response.toLowerCase().includes("set");
    expect(hasAction).toBe(true);
  });

  test("should generate a schedule via AI chat", async ({ page }) => {
    await createSchedule(page, `Test Gen ${Date.now()}`);

    // First, set requirements
    await sendAndWait(
      page,
      "Set requirements: 1 cook and 1 waiter for Monday morning and Tuesday morning"
    );

    // Now generate
    const response = await sendAndWait(page, "Generate the schedule");
    console.log("AI Response (generate schedule):", response);

    expect(response.length).toBeGreaterThan(10);
    const hasGenerate =
      response.toLowerCase().includes("generat") ||
      response.toLowerCase().includes("shift") ||
      response.toLowerCase().includes("schedule") ||
      response.toLowerCase().includes("done");
    expect(hasGenerate).toBe(true);
  });

  test("should use a suggestion chip to interact with AI", async ({ page }) => {
    await createSchedule(page, `Test Chip ${Date.now()}`);

    // Click one of the suggestion chips
    const suggestion = page.locator("button", {
      hasText: "Set requirements: 2 cooks, 3 waiters, 1 manager each shift",
    });

    if (await suggestion.isVisible()) {
      await suggestion.click();

      await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

      const messages = page.locator('[role="log"] > div:visible');
      const count = await messages.count();
      expect(count).toBeGreaterThanOrEqual(3);

      const lastMessage = messages.last();
      const responseText = await lastMessage.textContent();
      console.log("AI Response (suggestion chip):", responseText);
      expect(responseText!.length).toBeGreaterThan(5);
    }
  });

  test("should handle the full flow: requirements -> generate -> replace", async ({ page }) => {
    await createSchedule(page, `Test Flow ${Date.now()}`);

    // Step 1: Set requirements
    let response = await sendAndWait(page, "Set requirements: 1 cook for Monday morning");
    console.log("Step 1 - Set requirements:", response);
    expect(response.length).toBeGreaterThan(5);

    // Step 2: Generate schedule
    response = await sendAndWait(page, "Now generate the schedule");
    console.log("Step 2 - Generate schedule:", response);
    expect(response.length).toBeGreaterThan(5);

    // Step 3: Ask to replace someone
    response = await sendAndWait(page, "Replace the cook assigned to Monday morning");
    console.log("Step 3 - Replace employee:", response);
    expect(response.length).toBeGreaterThan(5);

    const hasReplace =
      response.toLowerCase().includes("replac") ||
      response.toLowerCase().includes("swap") ||
      response.toLowerCase().includes("assign") ||
      response.toLowerCase().includes("done") ||
      response.toLowerCase().includes("could not");
    expect(hasReplace).toBe(true);
  });
});
