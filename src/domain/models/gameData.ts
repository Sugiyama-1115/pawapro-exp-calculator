import type {
  BaseAbilityDef,
  BaseCostRow,
  BlueAbilityMeta,
  BlueAbilityRow,
  BreakingCacheRow,
  GoldAbilityMeta,
  GoldAbilityRow,
  GoldPrerequisite,
  HintRule,
} from "./ability";

export interface GameConfig {
  blueSensePlusMultiplier: number;
  blueNormalMultiplier: number;
  goldEstimateSearchMax: number;
}

export interface GameDataSet {
  gameId: string;
  config: GameConfig;

  baseDefs: Map<string, BaseAbilityDef>;
  baseDefList: BaseAbilityDef[];

  baseSensePlus: Map<string, BaseCostRow>;
  baseNormal: Map<string, BaseCostRow>;

  blue: Map<string, BlueAbilityRow>;
  blueIndex: Map<string, BlueAbilityMeta>;

  gold: Map<string, GoldAbilityRow>;
  goldByAbility: Map<string, GoldAbilityRow[]>;
  goldIndex: Map<string, GoldAbilityMeta>;

  goldPrereq: Map<string, GoldPrerequisite[]>;

  hintRules: Map<string, HintRule>;

  breakingSensePlus: Map<string, BreakingCacheRow>;
  breakingNormal: Map<string, BreakingCacheRow>;
}
