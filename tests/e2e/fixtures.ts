/**
 * E2E共通フィクスチャ（13_e2e_test_spec.md §1）。
 * - 各テストの開始前に IndexedDB を全消去し、初期状態から始める。
 * - 全テストで外部ドメインへのリクエストを検知して失敗させる（E2E-10 / 06_persistence_spec.md §7）。
 * - `window.confirm` は既定でOKを返す。拒否したいテストは `rejectDialogs` を使う。
 */
import { test as base, expect, type Page } from "@playwright/test";

export const APP_ORIGIN = "http://localhost:5173";
/** 06_persistence_spec.md §1 の DB名。 */
export const DB_NAME = "pawapro-exp-calculator";

/** 同一オリジン・データURL以外は外部通信とみなす。 */
function isExternal(url: string): boolean {
  return !(
    url.startsWith(APP_ORIGIN) ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url === "about:blank"
  );
}

/**
 * アプリのJSを動かさない同一オリジンの静的ファイル上で DB を消す。
 * アプリを開いた状態では接続が張られており deleteDatabase が blocked になるため。
 */
export async function clearIndexedDb(page: Page): Promise<void> {
  await page.goto("/data/games.json");
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          resolve();
        };
        request.onblocked = () => {
          resolve();
        };
      }),
    DB_NAME,
  );
}

/** ロードが完了しタブ操作が可能になるまで待つ（05_ui_spec.md §3.1）。 */
export async function waitAppReady(page: Page): Promise<void> {
  await expect(page.getByTestId("tab-base")).toBeEnabled({ timeout: 30_000 });
}

export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await waitAppReady(page);
}

export const test = base.extend<{ externalRequests: string[]; appReady: void }>({
  externalRequests: [
    async ({ page }, use) => {
      const external: string[] = [];
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (isExternal(url)) {
          external.push(url);
          await route.abort();
          return;
        }
        await route.continue();
      });
      page.on("dialog", (dialog) => {
        void dialog.accept();
      });
      await use(external);
      expect(external, "外部ドメインへのリクエストが発生しました").toEqual([]);
    },
    { auto: true },
  ],

  appReady: [
    async ({ page, externalRequests }, use) => {
      void externalRequests;
      await clearIndexedDb(page);
      await openApp(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
