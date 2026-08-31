/**
 * 特殊能力の検索（05_ui_spec.md §5.1）。
 * 検索対象・表示順はすべてゲームデータから組み立て、能力名をコードに書かない。
 */
import { useMemo, useState } from "react";
import type { GameDataSet } from "@/domain/models/gameData";
import type { PlayerType } from "@/domain/models/ability";

export type AbilityKind = "blue" | "gold";
export type KindFilter = "all" | AbilityKind;

/** 一覧の表示上限（05_ui_spec.md §5.1）。 */
export const PICKER_LIMIT = 50;
/** 投手プランで野手専用能力に付ける注記。 */
export const FIELDER_ONLY_NOTE = "(野手専用)";
export const FIELDER_DIVIDER_LABEL = "ここから野手専用";

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "blue", label: "青特" },
  { value: "gold", label: "金特" },
];

export interface PickerEntry {
  kind: AbilityKind;
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  /** 「青特(binary)」「金特」など、種別の表示ラベル。 */
  typeLabel: string;
  /** 金特の前提となる青特の表示名。 */
  prereqNames: string[];
  /** 投手プランにおける野手専用能力。表示順とラベルの分岐に使う。 */
  fielderOnly: boolean;
}

/** 野手専用グループを後ろに送るための並び順キー（05_ui_spec.md §5.1）。 */
export function fielderGroupOf(playerType: PlayerType, planType: PlayerType): number {
  return planType === "pitcher" && playerType === "fielder" ? 1 : 0;
}

function matches(query: string, displayName: string, abilityId: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    displayName.toLowerCase().includes(needle) || abilityId.toLowerCase().includes(needle)
  );
}

/**
 * 検索結果を組み立てる。表示上限は適用せず、全件を並び順どおりに返す。
 * 野手プランでは投手専用能力を除外し、投手プランでは全能力を対象とする（FR-BL-09）。
 */
export function buildPickerEntries(
  gameData: GameDataSet,
  planType: "pitcher" | "fielder",
  query: string,
  kindFilter: KindFilter,
): PickerEntry[] {
  const entries: { entry: PickerEntry; order: number }[] = [];

  const accept = (playerType: PlayerType): boolean =>
    planType === "pitcher" ? true : playerType !== "pitcher";

  let order = 0;
  if (kindFilter !== "gold") {
    for (const meta of gameData.blueIndex.values()) {
      order += 1;
      if (!accept(meta.playerType)) continue;
      if (!matches(query, meta.displayName, meta.abilityId)) continue;
      entries.push({
        order,
        entry: {
          kind: "blue",
          abilityId: meta.abilityId,
          displayName: meta.displayName,
          playerType: meta.playerType,
          typeLabel: `青特(${meta.abilityType})`,
          prereqNames: [],
          fielderOnly: fielderGroupOf(meta.playerType, planType) === 1,
        },
      });
    }
  }
  if (kindFilter !== "blue") {
    for (const meta of gameData.goldIndex.values()) {
      order += 1;
      if (!accept(meta.playerType)) continue;
      if (!matches(query, meta.displayName, meta.abilityId)) continue;
      const prereqNames = (gameData.goldPrereq.get(meta.abilityId) ?? []).map(
        (prereq) =>
          gameData.blueIndex.get(prereq.lowerBlueId)?.displayName ?? prereq.lowerBlueId,
      );
      entries.push({
        order,
        entry: {
          kind: "gold",
          abilityId: meta.abilityId,
          displayName: meta.displayName,
          playerType: meta.playerType,
          typeLabel: "金特",
          prereqNames,
          fielderOnly: fielderGroupOf(meta.playerType, planType) === 1,
        },
      });
    }
  }

  return entries
    .sort((a, b) => {
      const ga = fielderGroupOf(a.entry.playerType, planType);
      const gb = fielderGroupOf(b.entry.playerType, planType);
      if (ga !== gb) return ga - gb;
      // グループ内は 青特 → 金特 の順とし、同種はデータの登録順を保つ
      if (a.entry.kind !== b.entry.kind) return a.entry.kind === "blue" ? -1 : 1;
      return a.order - b.order;
    })
    .map((wrapped) => wrapped.entry);
}

export interface AbilityPickerProps {
  gameData: GameDataSet;
  planType: "pitcher" | "fielder";
  selectedBlueIds: ReadonlySet<string>;
  selectedGoldIds: ReadonlySet<string>;
  onAdd(kind: AbilityKind, abilityId: string): void;
}

export function AbilityPicker({
  gameData,
  planType,
  selectedBlueIds,
  selectedGoldIds,
  onAdd,
}: AbilityPickerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const entries = useMemo(
    () => buildPickerEntries(gameData, planType, query, kindFilter),
    [gameData, planType, query, kindFilter],
  );
  const shown = entries.slice(0, PICKER_LIMIT);
  const omittedCount = entries.length - shown.length;
  const dividerIndex = shown.findIndex((entry) => entry.fielderOnly);

  return (
    <section className="picker" data-testid="ability-picker">
      <div className="picker-controls">
        <label htmlFor="ability-search-input">検索</label>
        <input
          id="ability-search-input"
          type="search"
          data-testid="ability-search"
          placeholder="能力名 または ID"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <label htmlFor="ability-kind-filter-input">種別</label>
        <select
          id="ability-kind-filter-input"
          data-testid="ability-kind-filter"
          value={kindFilter}
          onChange={(event) => {
            setKindFilter(event.target.value as KindFilter);
          }}
        >
          {KIND_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="picker-results" data-testid="picker-results">
        {shown.map((entry, index) => {
          const selected =
            entry.kind === "blue"
              ? selectedBlueIds.has(entry.abilityId)
              : selectedGoldIds.has(entry.abilityId);
          return (
            <li key={`${entry.kind}-${entry.abilityId}`}>
              {/* 野手専用グループの直前に区切りを置く（投手プランのみ発生する） */}
              {index === dividerIndex && dividerIndex > 0 && (
                <p className="picker-divider" data-testid="picker-fielder-divider">
                  {FIELDER_DIVIDER_LABEL}
                </p>
              )}
              <span data-testid={`picker-name-${entry.abilityId}`}>
                {entry.displayName}
                {entry.fielderOnly ? FIELDER_ONLY_NOTE : ""}
              </span>
              <span className="picker-type">{entry.typeLabel}</span>
              {entry.prereqNames.length > 0 && (
                <span className="picker-prereq">前提: {entry.prereqNames.join(" / ")}</span>
              )}
              <button
                type="button"
                data-testid={`ability-add-${entry.abilityId}`}
                disabled={selected}
                onClick={() => {
                  onAdd(entry.kind, entry.abilityId);
                }}
              >
                {selected ? "追加済み" : "+ 追加"}
              </button>
            </li>
          );
        })}
      </ul>
      {omittedCount > 0 && (
        <p className="picker-omitted" data-testid="picker-omitted">
          他 {omittedCount} 件
        </p>
      )}
    </section>
  );
}
