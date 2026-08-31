/** E2E-02 青特（binary / rank）の計算（FR-BL-01〜07）。 */
import { expect, test } from "../fixtures";
import { addAbility, expectItemExp, openTab, setPlayerType, setSenseMode } from "../helpers";

test("E2E-02 binary と rank の青特が計算される", async ({ page }) => {
  await setPlayerType(page, "fielder");
  await setSenseMode(page, "normal");

  await openTab(page, "special");
  await addAbility(page, "パワーヒッター", "power_hitter");
  await page.getByTestId("blue-hint-power_hitter").selectOption("2");

  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", {
    muscle: 120,
    agility: 7,
    technique: 34,
    breaking: 0,
    mental: 4,
  });

  await openTab(page, "special");
  await addAbility(page, "チャンス", "chance");
  await page.getByTestId("blue-current-chance").selectOption("D");
  await page.getByTestId("blue-target-chance").selectOption("A");
  await page.getByTestId("blue-hint-chance").selectOption("0");

  await openTab(page, "result");
  await expectItemExp(page, "blue", "chance", {
    muscle: 0,
    agility: 60,
    technique: 105,
    breaking: 0,
    mental: 375,
  });

  await openTab(page, "special");
  await page.getByTestId("blue-target-chance").selectOption("D");

  await openTab(page, "result");
  await expect(page.getByTestId("result-item-blue-chance")).toBeVisible();
  await expectItemExp(page, "blue", "chance", {
    muscle: 0,
    agility: 0,
    technique: 0,
    breaking: 0,
    mental: 0,
  });
});
