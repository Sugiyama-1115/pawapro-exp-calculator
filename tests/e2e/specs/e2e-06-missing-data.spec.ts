/** E2E-06 データ不足の検出（FR-B-06, FR-BR-05, FR-R-04）。 */
import { expect, test } from "../fixtures";
import { expectStatus, expectSummary, openTab, setBase } from "../helpers";

test("E2E-06 欠落した段階を 0 で補完しない", async ({ page }) => {
  await openTab(page, "base");
  await setBase(page, "velocity", 133, 135);

  await expectStatus(page, "未完成");
  // 134→135 の行が無い分は加算されない
  await expectSummary(page, { muscle: "12" });

  await openTab(page, "result");
  const issues = page.locator('[data-testid^="issue-item-"]');
  await expect(issues).toHaveCount(1);
  await expect(page.getByTestId("issue-list")).toContainText("BASE_DATA_MISSING");

  await openTab(page, "base");
  await setBase(page, "velocity", null, 134);

  await expectStatus(page, "確定");
  await openTab(page, "result");
  await expect(page.getByTestId("issue-list")).toHaveCount(0);
});
