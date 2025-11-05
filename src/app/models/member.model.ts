export interface Member {
  id: string;
  name: string;
  email: string;
  photoURL?: string; // メンバーのプロフィール画像
  createdAt?: Date | string | any; // FirestoreのTimestampも許可
  updatedAt?: Date | string | any; // FirestoreのTimestampも許可
  displayName?: string; // Firebase Auth の displayName
}

export interface ProjectMember {
  memberId: string;
  memberName: string;
  memberEmail: string;
  role?: string; // プロジェクト内での役割（オプション）
}
