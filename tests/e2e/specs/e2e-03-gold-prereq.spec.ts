/** E2E-03 金特の前提自動追加と重複排除（FR-G-02, FR-G-04, FR-G-05）。 */
import { expect, test } from "../fixtures";
import { addAbility, expectItemExp, openTab, setPlayerType } from "../helpers";

test("E2E-03 下位青特が自動追加され手動指定と重複しない", async ({ page }) => {
  await setPlayerType(page, "fielder");

  await openTab(page, "special");
  await addAbility(page, "アーチスト", "archartist");

  await expect(page.getByTestId("blue-row-power_hitter")).toBeVisible();
  await expect(page.getByTestId("blue-auto-power_hitter")).toBeVisible();

  await page.getByTestId("gold-lower-hint-archartist").selectOption("2");
  await addAbility(page, "パワーヒッター", "power_hitter");
  await expect(page.getByTestId("blue-row-power_hitter")).toHaveCount(1);

  await page.getByTestId("blue-hint-power_hitter").selectOption("4");

  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", {
    muscle: 64,
    agility: 4,
    technique: 18,
    breaking: 0,
    mental: 2,
  });

  await openTab(page, "special");
  await page.getByTestId("gold-remove-archartist").click();

  await expect(page.getByTestId("gold-row-archartist")).toHaveCount(0);
  await expect(page.getByTestId("blue-row-power_hitter")).toBeVisible();
  await expect(page.getByTestId("blue-auto-power_hitter")).toHaveCount(0);
});
