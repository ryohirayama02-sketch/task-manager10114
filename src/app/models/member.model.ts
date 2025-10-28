export interface Member {
  id?: string;
  name: string;
  email: string;
  createdAt?: Date | string | any; // FirestoreのTimestampも許可
  updatedAt?: Date | string | any; // FirestoreのTimestampも許可
}

export interface ProjectMember {
  memberId: string;
  memberName: string;
  memberEmail: string;
  role?: string; // プロジェクト内での役割（オプション）
}
