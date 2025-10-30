/**
 * 候補として利用できるプロジェクトのテーマカラー一覧。
 * ステータスカラーと重ならない淡いトーンを選択しています。
 */
export const PROJECT_THEME_COLORS: readonly string[] = [
  '#f8bbd0', // soft pink
  '#ffccbc', // light peach
  '#ffe0b2', // warm apricot
  '#fff9c4', // pale yellow
  '#dcedc8', // fresh lime
  '#c8e6c9', // mint green
  '#b2dfdb', // muted teal
  '#b3e5fc', // baby blue
  '#c5cae9', // gentle periwinkle
  '#d1c4e9', // lavender
] as const;

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
  return (
    projectLike.themeColor ||
    projectLike.color ||
    DEFAULT_PROJECT_THEME_COLOR
  );
}
