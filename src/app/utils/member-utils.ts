/**
 * メンバーユーティリティ関数
 * UID → displayName のマッピング処理を共通化
 */

export interface Member {
  id?: string;
  uid?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

/**
 * メンバーのUID（またはID）から表示名を取得
 * @param uid メンバーのUID/ID
 * @param members メンバー配列
 * @returns 表示名、見つからない場合は '(不明)' を返す
 */
export function getMemberName(uid: string | null | undefined, members: Member[] | undefined): string {
  if (!uid || !members || members.length === 0) {
    return '(不明)';
  }

  // idまたはuidでマッチするメンバーを探す
  const member = members.find((m) => m.id === uid || m.uid === uid);

  if (member) {
    return member.displayName || member.name || '(不明)';
  }

  return '(不明)';
}

/**
 * 複数の担当者UID から表示名の配列を取得
 * @param uids UIDの配列
 * @param members メンバー配列
 * @returns 表示名の配列
 */
export function getMemberNames(uids: string[] | undefined, members: Member[] | undefined): string[] {
  if (!uids || !members) {
    return [];
  }

  // デバッグ: 各UIDのマッチング結果を確認
  const results = uids.map((uid) => {
    const name = getMemberName(uid, members);
    if (name === '(不明)') {
      console.warn(`⚠️ [getMemberNames] UID "${uid}" に対応するメンバーが見つかりません`);
      console.warn(`   - members:`, members.map(m => ({ id: m.id, uid: m.uid, name: m.name })));
    }
    return name;
  });

  return results.filter((name) => name !== '(不明)');
}

/**
 * 複数の担当者UID から表示名を カンマ区切りで取得
 * @param uids UIDの配列
 * @param members メンバー配列
 * @param separator 区切り文字（デフォルト: ', '）
 * @returns カンマ区切りの表示名、該当者なしの場合は '未設定' を返す
 */
export function getMemberNamesAsString(
  uids: string[] | undefined,
  members: Member[] | undefined,
  separator: string = ', '
): string {
  const names = getMemberNames(uids, members);
  return names.length > 0 ? names.join(separator) : '未設定';
}
