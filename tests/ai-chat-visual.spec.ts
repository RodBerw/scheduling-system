import { test, expect } from "@playwright/test";

/**
 * Visual test — runs headed so you can watch the AI chat in real time.
 * Tests the full flow on the seeded "This Week" schedule.
 */

test.use({ launchOptions: { slowMo: 400 } });

test("Visual AI Chat — full interaction flow", async ({ page }) => {
  // Go to the seeded "This Week" schedule
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Restaurant Scheduler");

  // Click on "This Week" schedule
  const scheduleLink = page.locator("a", { hasText: "This Week" });
  await expect(scheduleLink).toBeVisible({ timeout: 10_000 });
  await scheduleLink.click();
  await page.waitForURL(/\/schedule\/\d+/, { timeout: 10_000 });

  // Verify chat panel is visible
  await expect(page.locator("text=AI Assistant")).toBeVisible({ timeout: 10_000 });
  const chatInput = page.getByLabel("Chat message");
  await expect(chatInput).toBeVisible();

  // ==========================================
  // TEST 1: Ask about the current schedule
  // ==========================================
  await chatInput.fill("What does the current schedule look like? How many shifts are filled?");
  await page.getByRole("button", { name: "Send message" }).click();

  // Wait for response
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

  const msgs = page.locator('[role="log"] > div:visible');
  let lastText = await msgs.last().textContent();
  console.log("\n=== TEST 1: Ask about schedule ===");
  console.log("Response:", lastText);
  expect(lastText!.length).toBeGreaterThan(20);

  // ==========================================
  // TEST 2: Ask to replace a specific employee
  // ==========================================
  await chatInput.fill("Replace the first cook on Monday morning");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

  lastText = await msgs.last().textContent();
  console.log("\n=== TEST 2: Replace employee ===");
  console.log("Response:", lastText);
  expect(lastText!.length).toBeGreaterThan(10);

  // ==========================================
  // TEST 3: Ask to modify requirements
  // ==========================================
  await chatInput.fill("Add 1 extra dishwasher on Friday evening");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

  lastText = await msgs.last().textContent();
  console.log("\n=== TEST 3: Modify requirements ===");
  console.log("Response:", lastText);
  expect(lastText!.length).toBeGreaterThan(10);

  // ==========================================
  // TEST 4: Regenerate schedule
  // ==========================================
  await chatInput.fill("Regenerate the entire schedule with these new requirements");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[role="status"]')).not.toBeVisible({ timeout: 90_000 });

  lastText = await msgs.last().textContent();
  console.log("\n=== TEST 4: Regenerate schedule ===");
  console.log("Response:", lastText);
  expect(lastText!.length).toBeGreaterThan(10);

  // Verify the response mentions generation
  const hasGenerate =
    lastText!.toLowerCase().includes("generat") ||
    lastText!.toLowerCase().includes("shift") ||
    lastText!.toLowerCase().includes("done");
  expect(hasGenerate).toBe(true);

  // Keep browser open for 5 seconds so the user can see the final state
  await page.waitForTimeout(5000);

  console.log("\n=== ALL VISUAL TESTS PASSED ===");
});
