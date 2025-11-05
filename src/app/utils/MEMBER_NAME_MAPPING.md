# メンバー名マッピング機能

## 概要
タスクカード、プロジェクト詳細、検索結果など、各画面で担当者がUID（Firebase Auth UIDなど）ではなく、メンバーの表示名（displayName）を表示するように統一されました。

## 実装内容

### 1. ユーティリティ関数 (`member-utils.ts`)
共通のメンバーUID → 表示名マッピング関数を提供：
- `getMemberName(uid, members)` - 単一のUIDから表示名を取得
- `getMemberNames(uids, members)` - 複数のUIDから表示名配列を取得
- `getMemberNamesAsString(uids, members, separator)` - 複数のUIDをカンマ区切りで取得

### 2. 修正対象コンポーネント

#### Kanban (`kanban.component.ts/html`)
- タスクカードの担当者表示を`getAssigneeName()`メソッドで変換
- HTML: `{{ task.assignee }}` → `{{ getAssigneeName(task.assignee) }}`

#### Calendar (`calendar.component.ts/html`)
- カレンダー上のタスク表示で担当者名を表示
- フィルタードロップダウンで担当者名を表示

#### Gantt (`gantt.component.ts/html`)
- ガントチャートの担当者列で名前を表示
- HTML: `[appTruncateOverflow]="task.assignee"` → `[appTruncateOverflow]="getAssigneeName(task.assignee)"`

#### Task Search (`task-search.component.ts/html`)
- 検索結果での担当者表示

#### Quick Tasks (`quick-tasks.component.ts/html`)
- クイックタスク一覧での担当者表示

#### Task Detail (`task-detail.component.ts/html`)
- タスク詳細画面での担当者表示
- 子タスクの担当者表示

### 3. 型安全性
すべてのメソッドは `string | null | undefined` を受け取るように修正され、TypeScript型エラーを回避しています。

## 使用方法

### コンポーネントで使用する場合

```typescript
import { getMemberName } from '../../utils/member-utils';

export class MyComponent {
  projectMembers: Member[] = []; // メンバー情報
  
  getDisplayName(uid: string) {
    return getMemberName(uid, this.projectMembers);
  }
}
```

### テンプレートで使用する場合

```html
<!-- 単一担当者 -->
<span>{{ getAssigneeName(task.assignee) }}</span>

<!-- 複数担当者 -->
<span>{{ getAssignedMembersDisplay() }}</span>
```

## メンバーデータ構造

```typescript
interface Member {
  id: string;           // メンバーID
  name?: string;        // メンバー名
  displayName?: string; // 表示名（優先）
  email?: string;       // メールアドレス
}
```

## 注意事項

- メンバー情報(`projectMembers`)が取得できていない場合は、デフォルトで「(不明)」と表示されます
- 複数の担当者がいる場合は、`getAssignedMembersDisplay()`メソッドで「、」区切りで表示されます
- すべてのコンポーネントでUID直接表示は廃止されています

## テスト方法

1. 各画面（Kanban、Calendar、Gantt等）を確認
2. タスクカードの担当者が英数字UID ではなく人間が読めるメンバー名で表示されていることを確認
3. 複数担当者がいる場合は「山本、大迫」のようにカンマ区切りで表示されていることを確認
