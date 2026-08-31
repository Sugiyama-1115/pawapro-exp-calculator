/** E2E-11 結果のエクスポート（FR-R-07）。 */
import type { Download } from "@playwright/test";
import { expect, test } from "../fixtures";
import { addAbility, openTab, setBase } from "../helpers";

async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

test("E2E-11 結果CSVとプランJSONを保存できる", async ({ page }) => {
  await page.getByTestId("plan-name").fill("出力テスト");

  await openTab(page, "base");
  await setBase(page, "velocity", 130, 133);

  await openTab(page, "special");
  await addAbility(page, "奪三振", "strikeout");
  await addAbility(page, "ドクターK", "doctor_k");
  await page.getByTestId("gold-hint-doctor_k").selectOption("1");

  await openTab(page, "breaking");
  await page.getByTestId("breaking-mode-aggregate").click();
  for (const key of ["muscle", "agility", "technique", "breaking", "mental"]) {
    await page.getByTestId(`breaking-aggregate-${key}`).fill("20");
  }

  await openTab(page, "result");
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-result-csv").click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^result_出力テスト_\d{8}_\d{6}\.csv$/);

  const csv = await readDownload(csvDownload);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  expect(lines[0]).toBe(
    "category,id,display_name,detail,source,muscle,agility,technique,breaking,mental",
  );
  expect(lines.filter((line) => line.startsWith("subtotal,"))).toHaveLength(4);
  expect(lines.filter((line) => line.startsWith("total,"))).toHaveLength(1);

  const [planDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-plan-json").click(),
  ]);
  expect(planDownload.suggestedFilename()).toMatch(/^plan_出力テスト_\d{8}_\d{6}\.json$/);
  const envelope = JSON.parse(await readDownload(planDownload)) as {
    format: string;
    plan: { name: string };
  };
  expect(envelope.format).toBe("pawapro-exp-calculator/plan");
  expect(envelope.plan.name).toBe("出力テスト");
});
