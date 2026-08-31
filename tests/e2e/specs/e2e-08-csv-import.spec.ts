/** E2E-08 CSVインポートと破棄（FR-D-06〜08）。 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test, waitAppReady } from "../fixtures";
import { addAbility, expectItemExp, openTab, setPlayerType, setSenseMode } from "../helpers";

const BLUE_CSV = path.resolve("public/data/sample2024/blue_abilities.csv");

/** muscle 列だけを写像した blue_abilities.csv を作る。他の列・行はそのまま保つ。 */
function mapMuscle(mapper: (value: number, dataRowIndex: number) => string): Buffer {
  const text = readFileSync(BLUE_CSV, "utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? "").split(",");
  const muscleIndex = header.indexOf("muscle");
  if (muscleIndex < 0) throw new Error("muscle 列が見つかりません。");

  let dataRowIndex = 0;
  const mapped = lines.map((line, index) => {
    if (index === 0 || line.trim() === "" || line.startsWith("#")) return line;
    const cells = line.split(",");
    const current = Number(cells[muscleIndex]);
    cells[muscleIndex] = mapper(current, dataRowIndex);
    dataRowIndex += 1;
    return cells.join(",");
  });
  return Buffer.from(`\uFEFF${mapped.join("\n")}`, "utf-8");
}

async function importBlueCsv(page: Page, content: Buffer): Promise<void> {
  await openTab(page, "plan");
  await page.locator("details.csv-import-panel").evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  await page.getByTestId("csv-import-blue_abilities").setInputFiles({
    name: "blue_abilities.csv",
    mimeType: "text/csv",
    buffer: content,
  });
}

const STANDARD = { muscle: 240, agility: 15, technique: 68, breaking: 0, mental: 8 };
const DOUBLED = { ...STANDARD, muscle: 480 };

test("E2E-08 CSVインポートの適用・維持・破棄・却下", async ({ page }) => {
  await setPlayerType(page, "fielder");
  await setSenseMode(page, "normal");
  await openTab(page, "special");
  await addAbility(page, "パワーヒッター", "power_hitter");

  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", STANDARD);

  await importBlueCsv(page, mapMuscle((value) => String(value * 2)));
  await expect(page.getByTestId("csv-discard-blue_abilities")).toBeVisible();
  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", DOUBLED);

  await page.reload();
  await waitAppReady(page);
  await openTab(page, "plan");
  await page.locator("details.csv-import-panel").evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  await expect(page.getByTestId("csv-discard-blue_abilities")).toBeVisible();
  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", DOUBLED);

  await openTab(page, "plan");
  await page.locator("details.csv-import-panel").evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  await page.getByTestId("csv-discard-blue_abilities").click();
  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", STANDARD);

  // 検証エラー（負値）を含むCSVは1件も適用しない
  await importBlueCsv(page, mapMuscle((value, index) => (index === 0 ? "-5" : String(value))));
  await expect(page.getByTestId("csv-import-error-panel")).toBeVisible();
  await expect(page.getByTestId("csv-discard-blue_abilities")).toHaveCount(0);
  await openTab(page, "result");
  await expectItemExp(page, "blue", "power_hitter", STANDARD);
});
