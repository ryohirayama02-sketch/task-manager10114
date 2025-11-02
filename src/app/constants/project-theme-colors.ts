/**
 * 候補として利用できるプロジェクトのテーマカラー一覧。
 * ステータスカラーと重ならない淡いトーンを選択しています。
 */
export const PROJECT_THEME_COLORS: readonly string[] = [
  '#fde4ec', // soft pink
  '#ffe6dc', // light peach
  '#ffedd6', // warm apricot
  '#fff8e4', // pale yellow
  '#eef6da', // fresh lime
  '#e4f4e8', // mint green
  '#dcf3f0', // muted teal
  '#def3ff', // baby blue
  '#e6e9f9', // gentle periwinkle
  '#ece6f8', // lavender
] as const;

const LEGACY_THEME_COLOR_MAP: Record<string, string> = {
  '#f8bbd0': '#fde4ec',
  '#ffccbc': '#ffe6dc',
  '#ffe0b2': '#ffedd6',
  '#fff9c4': '#fff8e4',
  '#dcedc8': '#eef6da',
  '#c8e6c9': '#e4f4e8',
  '#b2dfdb': '#dcf3f0',
  '#b3e5fc': '#def3ff',
  '#c5cae9': '#e6e9f9',
  '#d1c4e9': '#ece6f8',
};

export const DEFAULT_PROJECT_THEME_COLOR = PROJECT_THEME_COLORS[0];

export type ProjectThemeColor = (typeof PROJECT_THEME_COLORS)[number];

/**
 * プロジェクトに設定されたテーマカラーを解決するヘルパー。
 * themeColor または color プロパティが設定されていない場合はデフォルト色を返す。
 */
export function resolveProjectThemeColor(
  projectLike?: { themeColor?: string | null; color?: string | null }
): string {
  if (!projectLike) {
    return DEFAULT_PROJECT_THEME_COLOR;
  }
  const rawColor = projectLike.themeColor || projectLike.color;
  if (!rawColor) {
    return DEFAULT_PROJECT_THEME_COLOR;
  }
  return LEGACY_THEME_COLOR_MAP[rawColor] || rawColor;
}
