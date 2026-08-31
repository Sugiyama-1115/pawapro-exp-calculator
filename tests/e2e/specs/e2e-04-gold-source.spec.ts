/** E2E-04 金特の実測と推定の区別（FR-G-06〜09）。 */
import { expect, test } from "../fixtures";
import { addAbility, expectItemExp, expectStatus, openTab, setPlayerType } from "../helpers";

test("E2E-04 出どころが実測・高信頼推定・推定で切り替わる", async ({ page }) => {
  await setPlayerType(page, "fielder");

  await openTab(page, "special");
  await addAbility(page, "アーチスト", "archartist");
  await page.getByTestId("gold-hint-archartist").selectOption("1");

  await openTab(page, "result");
  await expect(page.getByTestId("source-badge-gold-archartist")).toHaveText("実測");
  await expectItemExp(page, "gold", "archartist", {
    muscle: 100,
    agility: 10,
    technique: 50,
    breaking: 0,
    mental: 20,
  });

  await openTab(page, "special");
  await page.getByTestId("gold-hint-archartist").selectOption("2");

  await openTab(page, "result");
  await expect(page.getByTestId("source-badge-gold-archartist")).toHaveText("高信頼推定");
  await expectItemExp(page, "gold", "archartist", {
    muscle: 71,
    agility: 7,
    technique: 36,
    breaking: 0,
    mental: 14,
  });

  await setPlayerType(page, "pitcher");

  await openTab(page, "special");
  await addAbility(page, "ドクターK", "doctor_k");
  await page.getByTestId("gold-hint-doctor_k").selectOption("3");

  await openTab(page, "result");
  await expect(page.getByTestId("source-badge-gold-doctor_k")).toHaveText("推定");
  await expectItemExp(page, "gold", "doctor_k", {
    muscle: 28,
    agility: 0,
    technique: 57,
    breaking: 40,
    mental: 23,
  });
  await expectStatus(page, "推定含む");
});
