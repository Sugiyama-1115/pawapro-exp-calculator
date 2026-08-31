/** E2E-05 変化球（一括入力）とキャッシュ再利用（FR-BR-02〜06）。 */
import type { Page } from "@playwright/test";
import { expect, test, waitAppReady } from "../fixtures";
import { expectStatus, expectSummary, openTab, waitAutosave } from "../helpers";

async function addPitch(
  page: Page,
  index: number,
  pitchType: string,
  level: number,
): Promise<void> {
  await page.getByTestId("breaking-composition-add").click();
  await page.getByTestId(`breaking-composition-pitch-${index}`).fill(pitchType);
  await page.getByTestId(`breaking-composition-level-${index}`).selectOption(String(level));
}

async function setStepKey(
  page: Page,
  seq: number,
  pitchType: string,
  fromLevel: number,
  totalBreakBefore: number,
  pitchCountBefore: number,
): Promise<void> {
  await page.getByTestId(`breaking-step-pitch-${seq}`).fill(pitchType);
  await page.getByTestId(`breaking-step-from-${seq}`).fill(String(fromLevel));
  await page.getByTestId(`breaking-step-total-${seq}`).fill(String(totalBreakBefore));
  await page.getByTestId(`breaking-step-count-${seq}`).fill(String(pitchCountBefore));
}

async function expectStepCost(
  page: Page,
  seq: number,
  cost: [number, number, number, number, number],
): Promise<void> {
  const keys = ["muscle", "agility", "technique", "breaking", "mental"] as const;
  for (const [index, key] of keys.entries()) {
    await expect(page.getByTestId(`breaking-step-cost-${seq}-${key}`)).toHaveValue(
      String(cost[index]),
      { timeout: 10_000 },
    );
  }
}

test("E2E-05 一括入力とステップ実測キャッシュが再利用される", async ({ page }) => {
  await openTab(page, "breaking");
  await addPitch(page, 0, "slider", 4);
  await addPitch(page, 1, "curve", 3);
  await addPitch(page, 2, "fork", 5);

  await expectStatus(page, "未完成");
  await openTab(page, "result");
  await expect(page.getByTestId("issue-list")).toContainText("BREAKING_DATA_MISSING");

  await openTab(page, "breaking");
  await page.getByTestId("breaking-mode-aggregate").click();
  await page.getByTestId("breaking-aggregate-muscle").fill("0");
  await page.getByTestId("breaking-aggregate-agility").fill("0");
  await page.getByTestId("breaking-aggregate-technique").fill("450");
  await page.getByTestId("breaking-aggregate-breaking").fill("1280");
  await page.getByTestId("breaking-aggregate-mental").fill("100");

  await expectSummary(page, { technique: "450", breaking: "1,280" });
  await openTab(page, "result");
  await expect(page.getByTestId("source-badge-breaking-aggregate")).toHaveText("手動入力");

  await openTab(page, "breaking");
  await page.getByTestId("breaking-mode-step").click();

  await page.getByTestId("breaking-step-add").click();
  await setStepKey(page, 1, "slider", 1, 1, 1);
  await expectStepCost(page, 1, [0, 0, 10, 50, 0]);
  await expect(page.getByTestId("breaking-step-source-1")).toHaveText("実測");

  await page.getByTestId("breaking-step-add").click();
  await setStepKey(page, 2, "slider", 1, 9, 1);
  await expect(page.getByTestId("breaking-step-issue-2")).toContainText("未登録", {
    timeout: 10_000,
  });
  // 未登録のステップを 0 として計上しないこと（FR-BR-05）
  await expectSummary(page, { technique: "10", breaking: "50" });

  await page.getByTestId("breaking-step-cost-2-muscle").fill("0");
  await page.getByTestId("breaking-step-cost-2-agility").fill("0");
  await page.getByTestId("breaking-step-cost-2-technique").fill("15");
  await page.getByTestId("breaking-step-cost-2-breaking").fill("70");
  await page.getByTestId("breaking-step-cost-2-mental").fill("0");
  await page.getByTestId("breaking-cache-register").click();
  await expect(page.getByTestId("breaking-cache-message")).toContainText("登録");

  await waitAutosave(page);
  await page.reload();
  await waitAppReady(page);

  await openTab(page, "breaking");
  await page.getByTestId("breaking-step-remove-2").click();
  await page.getByTestId("breaking-step-add").click();
  await setStepKey(page, 2, "slider", 1, 9, 1);
  await expectStepCost(page, 2, [0, 0, 15, 70, 0]);
  await expect(page.getByTestId("breaking-step-source-2")).toHaveText("実測");
});
