/**
 * E2E-10 外部通信が発生しないこと（06_persistence_spec.md §7）。
 * 検知そのものは全テスト共通のフィクスチャが行う。本シナリオでは全機能を一巡させる。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, waitAppReady } from "../fixtures";
import { addAbility, openTab, setBase, waitAutosave } from "../helpers";

test("E2E-10 一通り操作しても外部ドメインへ通信しない", async ({ page, externalRequests }) => {
  await page.getByTestId("plan-name").fill("通信検査");

  await openTab(page, "base");
  await setBase(page, "velocity", 130, 133);

  await openTab(page, "special");
  await addAbility(page, "奪三振", "strikeout");
  await addAbility(page, "ドクターK", "doctor_k");
  await page.getByTestId("gold-hint-doctor_k").selectOption("2");

  await openTab(page, "breaking");
  await page.getByTestId("breaking-composition-add").click();
  await page.getByTestId("breaking-composition-pitch-0").fill("slider");
  await page.getByTestId("breaking-mode-aggregate").click();
  for (const key of ["muscle", "agility", "technique", "breaking", "mental"]) {
    await page.getByTestId(`breaking-aggregate-${key}`).fill("10");
  }

  await openTab(page, "plan");
  await page.locator("details.csv-import-panel").evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  const configCsv = readFileSync(path.resolve("public/data/sample2024/config.csv"));
  await page.getByTestId("csv-import-config").setInputFiles({
    name: "config.csv",
    mimeType: "text/csv",
    buffer: configCsv,
  });
  await expect(page.getByTestId("csv-discard-config")).toBeVisible();

  await openTab(page, "result");
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-result-csv").click(),
  ]);
  expect(download[0].suggestedFilename()).toContain("result_");

  await page.getByTestId("open-plan-list").click();
  await expect(page.getByTestId("plan-list-dialog")).toBeVisible();
  await page.getByTestId("plan-list-close").click();

  await waitAutosave(page);
  await page.reload();
  await waitAppReady(page);

  expect(externalRequests).toEqual([]);
});
