# メンバー情報の取得と画面反映の仕組み

## 概要

本アプリケーションでは、すべてのメンバーに固有のID（UID）が割り当てられており、各画面での表示や選択肢は、このIDを基準にメンバー名を取得・表示しています。これにより、メンバー管理画面で名前を変更しても、IDに紐づいた最新の名前情報が自動的に反映されます。

## データ構造

### タスクの担当者情報

```typescript
interface Task {
  assignedMembers?: string[];  // メンバーID（UID）の配列 ← 新形式（推奨）
  assignee: string;             // メンバー名の文字列（後方互換性のため）
}
```

- **`assignedMembers`**: メンバーID（例: `["6aNzjexMNLN6bZrXiqXC", "abc123..."]`）の配列
- **`assignee`**: メンバー名の文字列（例: `"田中太郎"` または `"田中太郎, 佐藤花子"`）

### メンバー情報

```typescript
interface Member {
  id: string;      // メンバーの固有ID（UID）
  name: string;    // メンバー名（カンマを含まない）
  email: string;   // メールアドレス
}
```

## メンバー情報の取得と表示の流れ

### 1. メンバー情報の読み込み

各コンポーネントでは、`MemberManagementService`を使用してメンバー一覧を取得します：

```typescript
this.memberService.getMembers().subscribe({
  next: (members) => {
    this.members = members;  // 全メンバーを保存
  }
});
```

### 2. メンバーIDから名前への変換

#### ユーティリティ関数（`member-utils.ts`）

```typescript
// 単一のメンバーIDから名前を取得
getMemberName(uid: string, members: Member[]): string

// 複数のメンバーIDから名前の配列を取得
getMemberNames(uids: string[], members: Member[]): string[]

// 複数のメンバーIDからカンマ区切りの文字列を取得
getMemberNamesAsString(uids: string[], members: Member[], separator: string): string
```

#### 使用例

```typescript
// assignedMembers（ID配列）から名前の文字列を生成
const display = getMemberNamesAsString(
  task.assignedMembers,  // メンバーIDの配列
  this.members,          // メンバー配列
  ', ',                  // 区切り文字
  this.languageService
);
```

### 3. 画面での表示

#### カンバン画面（`kanban.component.ts`）

```typescript
getTaskAssigneeDisplay(task: Task): string {
  // assignedMembers がある場合はそれを使用（IDベース）
  if (task.assignedMembers && task.assignedMembers.length > 0) {
    const display = getMemberNamesAsString(
      task.assignedMembers,
      this.members,
      ', ',
      this.languageService
    );
    return display === '未設定' ? '—' : display;
  }
  
  // assignedMembers がない場合は assignee から取得（後方互換性）
  // ...
}
```

#### タスク詳細画面（`task-detail.component.ts`）

```typescript
getAssignedMembersDisplay(): string {
  if (!this.taskData.assignedMembers || this.taskData.assignedMembers.length === 0) {
    return '—';
  }
  
  const display = getMemberNamesAsString(
    this.taskData.assignedMembers,
    this.projectMembers,
    ', ',
    this.languageService
  );
  
  return display === '未設定' ? '—' : display;
}
```

## 複数メンバーの判断方法

### ✅ 正しい方法（IDベース）

**`assignedMembers`配列の長さで判断**

```typescript
// 担当者の人数 = assignedMembers配列の長さ
const memberCount = task.assignedMembers?.length || 0;

// 各メンバーIDから名前を取得
task.assignedMembers.forEach((memberId) => {
  const member = members.find((m) => m.id === memberId);
  if (member) {
    // メンバー名を表示
  }
});
```

### ❌ 削除された方法（カンマ区切りベース）

**以前は以下のような方法で複数人を判断していましたが、すべて削除されました：**

```typescript
// ❌ 削除済み: メンバー名をカンマ区切りで分割
const names = member.name.split(',').map(n => n.trim());

// ❌ 削除済み: assigneeをカンマ区切りで分割して人数を判断
const assigneeNames = task.assignee.split(',');
const memberCount = assigneeNames.length;
```

**理由：**
- メンバー名にカンマを含めることはできない（バリデーションで禁止）
- IDベースの判断が正確で、メンバー名変更の影響を受けない

## メンバー名変更時の自動更新

### 仕組み

`MemberManagementService.updateMember()`でメンバー名を変更すると、以下の処理が自動的に実行されます：

1. **プロジェクトの`members`フィールドを更新**
   - プロジェクトの`members`フィールド（メンバー名のカンマ区切り文字列）に古いメンバー名が含まれている場合、新しいメンバー名に置き換え

2. **タスクの`assignee`フィールドを更新**
   - タスクの`assignee`フィールドに古いメンバー名が含まれている場合、新しいメンバー名に置き換え

### 実装

```typescript
// member-management.service.ts
async updateMember(memberId: string, memberData: Partial<Member>): Promise<void> {
  // 1. 古いメンバー名を取得
  const oldMemberName = /* ... */;
  
  // 2. メンバー情報を更新
  await updateDoc(memberRef, updateData);
  
  // 3. メンバー名が変更された場合、関連するプロジェクトとタスクを更新
  if (oldMemberName && memberData.name && oldMemberName !== memberData.name) {
    await this.updateRelatedProjectsAndTasks(memberId, oldMemberName, memberData.name);
  }
}
```

## 各画面での実装状況

### ✅ IDベースで実装済み

- **カンバン画面** (`kanban.component.ts`)
- **ガントチャート画面** (`gantt.component.ts`)
- **カレンダー画面** (`calendar.component.ts`)
- **クイックタスク画面** (`quick-tasks.component.ts`)
- **タスク詳細画面** (`task-detail.component.ts`)
- **プロジェクト詳細画面** (`project-detail.component.ts`)
- **タスク検索画面** (`task-search.component.ts`)
- **進捗管理画面** (`member-progress.component.ts`, `member-detail.component.ts`)

### 後方互換性のためのフォールバック

`assignedMembers`がない古いタスクデータに対しては、`assignee`フィールドからメンバー名を取得する処理が残っています。これは後方互換性のためです。

```typescript
// assignedMembers がない場合は assignee から最新のメンバー名を取得
if (!task.assignedMembers || task.assignedMembers.length === 0) {
  if (task.assignee) {
    // assignee からメンバー名を取得（後方互換性）
    const assigneeNames = task.assignee.split(',').map(name => name.trim());
    // ...
  }
}
```

## まとめ

- ✅ すべてのメンバーには固有のIDが割り当てられている
- ✅ 各画面の表示は、IDを基準にメンバー名を取得・表示している
- ✅ メンバー名変更時は、IDに紐づいた最新の名前情報が自動的に反映される
- ✅ 複数メンバーの判断は、`assignedMembers`配列の長さで行う（IDベース）
- ✅ カンマ区切りで複数人を判断する処理はすべて削除済み
- ✅ メンバー名変更時に、関連するプロジェクトとタスクが自動更新される

