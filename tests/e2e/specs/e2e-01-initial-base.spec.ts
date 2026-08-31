/** E2E-01 初回起動〜基礎能力の計算（FR-D-01, FR-B-01〜03, FR-R-01）。 */
import { expect, test } from "../fixtures";
import { expectStatus, expectSummary, openTab, setBase } from "../helpers";

test("E2E-01 初回起動から基礎能力の必要経験点が確定する", async ({ page }) => {
  await expect(page.getByTestId("game-select")).toHaveValue("sample2024");

  await openTab(page, "base");
  await setBase(page, "velocity", 130, 133);
  await setBase(page, "control", 40, 41);

  await expectSummary(page, {
    muscle: "32",
    agility: "0",
    technique: "20",
    breaking: "0",
    mental: "3",
    total: "55",
  });
  await expectStatus(page, "確定");
});
