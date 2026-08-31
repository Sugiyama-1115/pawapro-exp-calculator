/** E2E-07 プランの保存・再読み込み・複製・削除（FR-P-02〜06）。 */
import type { Page } from "@playwright/test";
import { expect, test, waitAppReady } from "../fixtures";
import { expectSummary, openTab, setBase, waitAutosave } from "../helpers";

interface PlanRow {
  id: string;
  name: string;
}

async function readPlanRows(page: Page): Promise<PlanRow[]> {
  return page.locator('[data-testid^="plan-row-"]').evaluateAll((elements) =>
    elements.map((element) => ({
      id: (element.getAttribute("data-testid") ?? "").replace("plan-row-", ""),
      name: element.querySelector("th")?.textContent ?? "",
    })),
  );
}

async function openPlanList(page: Page): Promise<PlanRow[]> {
  await page.getByTestId("open-plan-list").click();
  await expect(page.getByTestId("plan-list-dialog")).toBeVisible();
  await expect(page.locator('[data-testid^="plan-row-"]').first()).toBeVisible();
  return readPlanRows(page);
}

test("E2E-07 プランが保存・複製・削除できる", async ({ page }) => {
  await page.getByTestId("plan-name").fill("エース候補A");
  await openTab(page, "base");
  await setBase(page, "velocity", 130, 133);
  await expectSummary(page, { total: "48" });

  await waitAutosave(page);
  await page.reload();
  await waitAppReady(page);

  await expect(page.getByTestId("plan-name")).toHaveValue("エース候補A");
  await openTab(page, "base");
  await expect(page.getByTestId("base-current-velocity")).toHaveValue("130");
  await expect(page.getByTestId("base-target-velocity")).toHaveValue("133");
  await expectSummary(page, { total: "48" });

  const before = await openPlanList(page);
  const original = before[0];
  expect(original).toBeDefined();
  if (!original) throw new Error("プランが保存されていません。");
  await page.getByTestId(`plan-duplicate-${original.id}`).click();

  await expect(page.locator('[data-testid^="plan-row-"]')).toHaveCount(2);
  const after = await readPlanRows(page);
  const copy = after.find((row) => row.name === "エース候補A のコピー");
  expect(copy).toBeDefined();
  if (!copy) throw new Error("複製されたプランが見つかりません。");

  await page.getByTestId(`plan-open-${copy.id}`).click();
  await expect(page.getByTestId("plan-list-dialog")).toHaveCount(0);
  await page.getByTestId("plan-name").fill("複製したプラン");
  await waitAutosave(page);

  await openPlanList(page);
  await page.getByTestId(`plan-open-${original.id}`).click();
  await expect(page.getByTestId("plan-name")).toHaveValue("エース候補A");

  await openPlanList(page);
  await page.getByTestId(`plan-delete-${copy.id}`).click();
  await expect(page.getByTestId(`plan-row-${copy.id}`)).toHaveCount(0);
  await page.getByTestId("plan-list-close").click();

  await waitAutosave(page);
  await page.reload();
  await waitAppReady(page);
  await openPlanList(page);
  await expect(page.getByTestId(`plan-row-${copy.id}`)).toHaveCount(0);
});
