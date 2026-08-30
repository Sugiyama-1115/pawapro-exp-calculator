/**
 * ゲームデータのロード（fetch → parse → validate → index）。
 * 致命的な取得失敗・検証失敗のみ AppError を投げ、呼び出し元のストアが捕捉する（07_error_spec.md §4）。
 */
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { BreakingCacheRow, SenseMode } from "@/domain/models/ability";
import type { GameDataSet } from "@/domain/models/gameData";
import type { ParsedCsv } from "../csv/csvParser";
import { parseCsv, stripBom } from "../csv/csvParser";
import type { CsvKind } from "../csv/schemas";
import { CSV_FILE_NAMES, CSV_KINDS } from "../csv/schemas";
import type { ValidatedGameData } from "../csv/validators";
import { validateDataSet } from "../csv/validators";
import { buildGameDataSet, mergeBreakingCache } from "./indexBuilder";

/** games.json の1エントリ（02_architecture.md §5）。 */
export interface GameDefinition {
  id: string;
  displayName: string;
  directory: string;
  bundled: boolean;
  note: string;
}

export interface GamesManifest {
  games: GameDefinition[];
  defaultGameId: string;
}

/** fetch の最小インターフェース。テストではスタブを差し込む。 */
export interface CsvResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type CsvFetcher = (url: string) => Promise<CsvResponse>;

export const GAMES_MANIFEST_FILE = "data/games.json";

const defaultFetcher: CsvFetcher = (url) => fetch(url);

function defaultBaseUrl(): string {
  const env = import.meta.env as { BASE_URL?: string } | undefined;
  return env?.BASE_URL ?? "./";
}

function normalizeBase(base: string): string {
  if (base === "") return "./";
  return base.endsWith("/") ? base : `${base}/`;
}

/** CSV の配置先URL。GitHub Pages のサブパス配信に耐えるため base 相対で組み立てる。 */
export function dataUrl(directory: string, kind: CsvKind, baseUrl?: string): string {
  const base = normalizeBase(baseUrl ?? defaultBaseUrl());
  return `${base}data/${directory}/${CSV_FILE_NAMES[kind]}`;
}

export interface LoadOptions {
  fetcher?: CsvFetcher;
  baseUrl?: string;
}

export async function loadGamesManifest(options: LoadOptions = {}): Promise<GamesManifest> {
  const fetcher = options.fetcher ?? defaultFetcher;
  const base = normalizeBase(options.baseUrl ?? defaultBaseUrl());
  const url = `${base}${GAMES_MANIFEST_FILE}`;
  const text = await fetchText(fetcher, url);
  if (text === null) {
    throw new AppError(
      ERROR_CODES.CSV_FILE_MISSING,
      `games.json が見つかりません。public/data/ を確認してください。`,
      { url },
    );
  }
  try {
    return JSON.parse(stripBom(text)) as GamesManifest;
  } catch {
    throw new AppError(ERROR_CODES.INVALID_CSV, `games.json の形式が不正です。`, { url });
  }
}

export interface LoadGameDataOptions extends LoadOptions {
  /** インポートで上書きされた種別（種別単位の全置換）。 */
  overrides?: Partial<ValidatedGameData>;
  /** 変化球共通キャッシュへのユーザー追記分（追記マージ）。 */
  breakingCache?: { senseMode: SenseMode; rows: BreakingCacheRow[] }[];
}

/**
 * 1ゲーム分のデータを読み込み GameDataSet を返す。
 * 呼び出しごとに新しいインデックスを構築するため、前ゲームのデータは残らない。
 */
export async function loadGameData(
  game: GameDefinition,
  options: LoadGameDataOptions = {},
): Promise<GameDataSet> {
  const fetcher = options.fetcher ?? defaultFetcher;
  const overrides = options.overrides ?? {};

  const fetched = await Promise.all(
    CSV_KINDS.map(async (kind): Promise<[CsvKind, ParsedCsv | null]> => {
      if (overrides[kind] !== undefined) return [kind, null];
      const text = await fetchText(fetcher, dataUrl(game.directory, kind, options.baseUrl));
      return [kind, text === null ? null : parseCsv(text)];
    }),
  );

  const files: Partial<Record<CsvKind, ParsedCsv>> = {};
  let fetchedAny = false;
  for (const [kind, parsed] of fetched) {
    if (!parsed) continue;
    files[kind] = parsed;
    fetchedAny = true;
  }

  // bundled: false のゲームで1ファイルも配置されていない場合は案内に切り替える
  if (!game.bundled && !fetchedAny && Object.keys(overrides).length === 0) {
    throw new AppError(
      ERROR_CODES.GAME_DATA_NOT_DEPLOYED,
      `このゲームのデータが配置されていません。CSVをインポートしてください。`,
      { gameId: game.id, directory: game.directory },
    );
  }

  const validation = validateDataSet(files, { directory: game.directory, overrides });
  if (validation.data === null) {
    const first = validation.issues[0];
    // 検証に失敗した場合はインデックスを構築せずロードを中止する
    throw new AppError(first?.code ?? ERROR_CODES.INVALID_CSV, first?.message ?? "", {
      issues: validation.issues,
      omittedCount: validation.omittedCount,
      gameId: game.id,
    });
  }

  const gameData = buildGameDataSet(game.id, validation.data);
  for (const entry of options.breakingCache ?? []) {
    mergeBreakingCache(gameData, entry.senseMode, entry.rows);
  }
  return gameData;
}

async function fetchText(fetcher: CsvFetcher, url: string): Promise<string | null> {
  try {
    const response = await fetcher(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    // 取得できなかったことのみが情報。CSV_FILE_MISSING として上位で扱う
    return null;
  }
}
