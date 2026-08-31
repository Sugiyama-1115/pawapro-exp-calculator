/**
 * コツLvのセレクト（05_ui_spec.md §5.2・§5.3）。0〜5・既定値 0。
 * 段数はゲーム固有の値ではなく仕様上の固定範囲のため定数で持つ。
 */
export const HINT_LEVELS = [0, 1, 2, 3, 4, 5] as const;

export interface HintLevelSelectProps {
  value: number;
  onChange(hintLevel: number): void;
  label: string;
  testId?: string;
  id?: string;
}

export function HintLevelSelect({
  value,
  onChange,
  label,
  testId,
  id,
}: HintLevelSelectProps): JSX.Element {
  return (
    <select
      id={id}
      aria-label={label}
      data-testid={testId}
      value={value}
      onChange={(event) => {
        onChange(Number.parseInt(event.target.value, 10));
      }}
    >
      {HINT_LEVELS.map((level) => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </select>
  );
}
