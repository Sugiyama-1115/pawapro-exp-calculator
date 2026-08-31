/** E2E-09 ゲームバージョン切替（FR-D-02, FR-D-05）。 */
import { test } from "../fixtures";
import { expectSummary, openTab, setBase } from "../helpers";

test("E2E-09 ゲームを切り替えると値が入れ替わり混ざらない", async ({ page }) => {
  await openTab(page, "base");
  await setBase(page, "velocity", 130, 131);
  await expectSummary(page, { muscle: "10", technique: "5", total: "15" });

  await page.getByTestId("game-select").selectOption("sample_alt");
  await expectSummary(page, { muscle: "30", technique: "15", total: "45" });

  await page.getByTestId("game-select").selectOption("sample2024");
  await expectSummary(page, { muscle: "10", technique: "5", total: "15" });
});
