# 編集ログ画面の改善 - 変更内容の詳細表示化

## 📋 改善概要

編集ログ画面に表示される変更内容を改善しました。現在は複数の変更が1つのテキストに連結されていましたが、各変更を **個別に見やすく表示** できるようにしました。

### 改善前
```
タスク「タスク」を更新しました (ステータス: 未着手 → 作業中, 担当者: 不明 → 田中太郎, 期限: 2024-01-15 → 2024-01-20)
```

### 改善後
```
・ステータス：未着手 → 作業中
・担当者：不明 → 田中太郎
・期限：2024-01-15 → 2024-01-20
```

または

```
・担当者：「田中太郎」が追加されました
・タグ：「重要」が削除されました
```

---

## 🔧 技術的な変更

### 1. **モデル（Model）の拡張** 
**ファイル**: `src/app/models/task.model.ts`

#### 新しいインターフェース
```typescript
export interface ChangeDetail {
  field: string;           // 変更フィールド名（概要、担当者、タグなど）
  oldValue?: string;       // 変更前の値
  newValue?: string;       // 変更後の値
}
```

#### EditLog インターフェースの拡張
```typescript
export interface EditLog {
  // ... 既存フィールド ...
  changes?: ChangeDetail[];  // 個別の変更内容配列（新規フィールド）
}
```

**特徴**:
- 後方互換性を保つため、既存フィールドはそのまま保持
- 新しい `changes` フィールドで個別の変更を記録

---

### 2. **EditLogService の改善**
**ファイル**: `src/app/services/edit-log.service.ts`

#### logEdit メソッドの署名変更
```typescript
async logEdit(
  projectId: string,
  projectName: string,
  action: 'create' | 'update' | 'delete',
  changeDescription: string,
  taskId?: string,
  taskName?: string,
  oldValue?: string,
  newValue?: string,
  changes?: ChangeDetail[]  // 新規パラメータ
): Promise<void>
```

**変更内容**:
- Firestore記録時に `changes` フィールドをサポート
- `getRecentEditLogs()` と `getMoreEditLogs()` で `changes` フィールドを取得

---

### 3. **TaskService の改善**
**ファイル**: `src/app/services/task.service.ts`

#### updateTask メソッド の改善

**変更内容**:
- ステータス、優先度、担当者、期限、タスク名、説明、タグなどの変更を個別に ChangeDetail として記録
- タグの追加・削除を個別に記録
  - 追加：`newValue` のみ設定
  - 削除：`oldValue` のみ設定

**記録例**:
```typescript
changeDetails.push({
  field: '担当者',
  oldValue: '不明',
  newValue: '田中太郎',
});

// タグ追加
changeDetails.push({
  field: 'タグ',
  newValue: '重要',
});

// タグ削除
changeDetails.push({
  field: 'タグ',
  oldValue: '緊急',
});
```

#### updateTaskStatus メソッドの改善
- ChangeDetail配列を生成して `logEdit` に渡す

---

### 4. **ProjectService の改善**
**ファイル**: `src/app/services/project.service.ts`

#### updateTask メソッドの改善
- TaskService と同様に ChangeDetail配列を生成
- Kanban ビューなどからの更新時にも個別の変更を記録

---

### 5. **LogsComponent のロジック改善**
**ファイル**: `src/app/components/logs/logs.component.ts`

#### formatChangeDescription メソッドの改善
```typescript
formatChangeDescription(log: EditLog): string {
  // 個別の変更詳細がある場合はそれを使用
  if (log.changes && log.changes.length > 0) {
    return log.changes.map(change => this.formatChangeDetail(change)).join('');
  }
  // フォールバック：従来の方法
  // ...
}
```

#### 新しいメソッド：formatChangeDetail
```typescript
formatChangeDetail(change: any): string {
  // 個別の変更を整形して返す
  // - 変更前後がある場合：「〇〇 → ××」
  // - 追加の場合：「「××」が追加されました」
  // - 削除の場合：「「××」が削除されました」
}
```

**特徴**:
- 後方互換性：`changes` がない場合は従来の表示方法にフォールバック

---

### 6. **HTMLテンプレートの改善**
**ファイル**: `src/app/components/logs/logs.component.html`

#### 新しいマークアップ
```html
<div class="log-description">
  <strong>📋 変更内容:</strong>
  <div class="change-details">
    <!-- 個別の変更詳細を表示 -->
    <div *ngIf="log.changes && log.changes.length > 0">
      <div *ngFor="let change of log.changes" class="change-item">
        <span class="change-field">{{ change.field }}：</span>
        <span class="change-value" *ngIf="change.oldValue && change.newValue">
          {{ change.oldValue }} → {{ change.newValue }}
        </span>
        <span class="change-value" *ngIf="change.newValue && !change.oldValue">
          「{{ change.newValue }}」が追加されました
        </span>
        <span class="change-value" *ngIf="change.oldValue && !change.newValue">
          「{{ change.oldValue }}」が削除されました
        </span>
      </div>
    </div>
    <!-- フォールバック：従来の表示方法 -->
    <div *ngIf="!log.changes || log.changes.length === 0" class="legacy-description">
      {{ formatChangeDescription(log) }}
    </div>
  </div>
</div>
```

**特徴**:
- 個別の変更があれば、各変更ごとに行を分けて表示
- 古いログにも対応（フォールバック）

---

### 7. **CSSスタイルの追加**
**ファイル**: `src/app/components/logs/logs.component.css`

```css
/* 変更詳細のスタイル */
.change-details {
  margin-top: 8px;
  margin-left: 12px;
}

.change-item {
  display: block;
  margin: 6px 0;
  padding: 8px 12px;
  background-color: #ffffff;
  border-left: 3px solid #007bff;
  border-radius: 3px;
  font-size: 13px;
  line-height: 1.5;
}

.change-field {
  font-weight: 600;
  color: #333;
  margin-right: 6px;
}

.change-value {
  color: #495057;
  word-break: break-word;
}
```

**視覚的な改善**:
- 左端の青いボーダーで変更項目を強調
- 白背景で読みやすくする
- フィールド名を太字で表示

---

## 📊 新機能に対応する変更フィールド

以下のフィールドの変更を個別に記録します：

| フィールド | 説明 |
|-----------|------|
| ステータス | 未着手 ↔ 作業中 ↔ 完了 |
| 優先度 | 高 ↔ 中 ↔ 低 |
| 担当者 | 追加・変更・削除 |
| 期限 | 日付の変更 |
| タスク名 | タスク名の変更 |
| 説明 | 説明の更新 |
| タグ | タグの追加・削除（個別に記録）|

---

## 🔄 後方互換性

✅ **完全な後方互換性を保証**

- 既存の編集ログレコードも表示可能
- `changes` フィールドがない場合、従来の表示方法にフォールバック
- CSV出力も動作継続

---

## 🚀 使用方法

特別な対応は不要です。各タスク更新時に自動的に：

1. 変更内容が ChangeDetail配列として Firestore に記録される
2. ログ画面で個別の変更として見やすく表示される

---

## ✅ テスト方法

1. **タスク更新テスト**
   - タスク詳細画面でステータス、担当者などを変更
   - ログ画面で個別の変更が表示されることを確認

2. **複数変更テスト**
   - 複数フィールドを同時に変更
   - 各変更が別々の行として表示されることを確認

3. **タグ変更テスト**
   - タグを追加・削除
   - 「×が追加されました」「×が削除されました」と表示されることを確認

4. **フォールバックテスト**
   - 古いログレコード（changes フィールドなし）が正しく表示されることを確認

---

## 📝 注記

- Firestore インデックスの複合キー設定により、より高速なクエリが可能
- 今後、より詳細な変更追跡が必要な場合は、ChangeDetail の拡張が容易


