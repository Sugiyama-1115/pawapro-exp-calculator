/**
 * E2Eの共通操作。期待値は 11_unit_test_spec.md の標準フィクスチャから導かれる確定値であり、
 * ここに計算式を書かない（13_e2e_test_spec.md §5）。
 */
import { expect, type Page } from "@playwright/test";

export type TabId = "plan" | "base" | "special" | "breaking" | "result";
export type ExpKey = "muscle" | "agility" | "technique" | "breaking" | "mental";

/** ExpInline / ExpVectorTable の見出し（05_ui_spec.md §2.3）。 */
export const EXP_LABELS: Record<ExpKey, string> = {
  muscle: "筋力",
  agility: "敏捷",
  technique: "技術",
  breaking: "変化球",
  mental: "精神",
};

export async function openTab(page: Page, tab: TabId): Promise<void> {
  await page.getByTestId(`tab-${tab}`).click();
}

/** 選手種別の変更は確認ダイアログを伴う（05_ui_spec.md §3.2）。 */
export async function setPlayerType(page: Page, type: "pitcher" | "fielder"): Promise<void> {
  await openTab(page, "plan");
  await page.getByTestId(`player-type-${type}`).click();
  await expect(page.getByTestId(`player-type-${type}`)).toBeChecked();
}

export async function setSenseMode(page: Page, mode: "plus" | "normal"): Promise<void> {
  await openTab(page, "plan");
  await page.getByTestId(mode === "plus" ? "sense-plus" : "sense-normal").click();
}

export async function setBase(
  page: Page,
  abilityId: string,
  current: number | null,
  target: number | null,
): Promise<void> {
  if (current !== null) await page.getByTestId(`base-current-${abilityId}`).fill(String(current));
  if (target !== null) await page.getByTestId(`base-target-${abilityId}`).fill(String(target));
}

/** 検索してから追加する。検索欄を経由することで一覧の件数上限に依存しない。 */
export async function addAbility(page: Page, query: string, abilityId: string): Promise<void> {
  await page.getByTestId("ability-search").fill(query);
  await page.getByTestId(`ability-add-${abilityId}`).click();
}

/** ExpInline の表示内容を { 見出し: 値 } として読む。0 が省略される箇所では現れない。 */
export async function readExpInline(page: Page, testId: string): Promise<Record<string, number>> {
  const texts = await page.getByTestId(testId).locator("span").allTextContents();
  const values: Record<string, number> = {};
  for (const text of texts) {
    const matched = /^(\S+)\s+([\d,]+)$/.exec(text.trim());
    if (matched?.[1] !== undefined && matched[2] !== undefined) {
      values[matched[1]] = Number(matched[2].replace(/,/g, ""));
    }
  }
  return values;
}

/**
 * 内訳1行の必要経験点を検証する。計算結果タブの内訳は 0 のカテゴリを省略するため、
 * 期待値が 0 の項目は「表示されないこと」を意味する（05_ui_spec.md §7）。
 */
export async function expectItemExp(
  page: Page,
  category: string,
  id: string,
  expected: Record<ExpKey, number>,
): Promise<void> {
  const wanted: Record<string, number> = {};
  for (const [key, value] of Object.entries(expected)) {
    if (value !== 0) wanted[EXP_LABELS[key as ExpKey]] = value;
  }
  await expect
    .poll(() => readExpInline(page, `result-exp-${category}-${id}`), { timeout: 10_000 })
    .toEqual(wanted);
}

/** サマリーバーの5項目と合計（再計算は 200ms デバウンス）。 */
export async function expectSummary(
  page: Page,
  expected: Partial<Record<ExpKey | "total", string>>,
): Promise<void> {
  for (const [key, value] of Object.entries(expected)) {
    await expect(page.getByTestId(`summary-${key}`)).toHaveText(value, { timeout: 10_000 });
  }
}

export async function expectStatus(
  page: Page,
  label: "確定" | "推定含む" | "未完成",
): Promise<void> {
  await expect(page.getByTestId("summary-status")).toHaveText(label, { timeout: 10_000 });
}

/** 自動保存（500ms デバウンス）の完了を待つ。 */
export async function waitAutosave(page: Page): Promise<void> {
  await page.waitForTimeout(1_200);
}
