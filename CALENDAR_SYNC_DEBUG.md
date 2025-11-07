# カレンダー同期デバッグ手順

期日が11/7のタスクが「11/7終日」として正しくGoogleカレンダーに追加されるか確認する手順です。

## 📋 確認手順

### 1. コードをデプロイする

まず、修正したコードをFirebase Cloud Functionsにデプロイします。

```bash
# functionsディレクトリに移動
cd functions

# ビルド（TypeScriptをコンパイル）
npm run build

# デプロイ
npm run deploy

# または、ルートディレクトリから
firebase deploy --only functions
```

デプロイが完了したら、次のステップに進みます。

---

### 2. ブラウザのコンソールログを確認する

#### 2-1. ブラウザの開発者ツールを開く

1. アプリケーションをブラウザで開く
2. **F12キー**を押すか、**右クリック > 検証**で開発者ツールを開く
3. **Console（コンソール）**タブを選択

#### 2-2. タスクを作成してカレンダー連携を有効にする

1. タスク作成画面で以下を設定：
   - **タスク名**: テストタスク
   - **期日**: 2024-11-07（または任意の日付）
   - **カレンダー連携**: ✅ チェックを入れる
2. **保存**ボタンをクリック

#### 2-3. ブラウザコンソールで確認するログ

以下のログが表示されることを確認します：

```
🔄 Google認証フローを開始します...
📊 送信パラメータ: {
  taskName: "テストタスク",
  dueDate: "2024-11-07",  ← ここを確認（YYYY-MM-DD形式であること）
  userAccessToken: "***"
}
📡 Firebase Cloud Functions を呼び出します...
✅ Cloud Functions レスポンス: { success: true, ... }
```

**確認ポイント：**
- `dueDate`が`"2024-11-07"`のようなYYYY-MM-DD形式になっているか
- エラーメッセージが表示されていないか

---

### 3. Firebase Cloud Functionsのログを確認する

#### 3-1. Firebase CLIでログを確認する方法

ターミナルで以下のコマンドを実行：

```bash
# リアルタイムでログを監視（最新のログから表示）
firebase functions:log

# 特定の関数のログのみを表示
firebase functions:log --only addTaskToCalendar

# 最新の50件のログを表示
firebase functions:log --limit 50
```

#### 3-2. Firebase Consoleでログを確認する方法

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択
3. 左メニューから **Functions（関数）** を選択
4. **Logs（ログ）** タブを選択
5. 最新のログを確認

#### 3-3. 確認すべきログの内容

以下のログが順番に表示されることを確認します：

```
📨 受け取ったパラメータ: {
  taskName: "テストタスク",
  dueDate: "2024-11-07",  ← 入力値
  hasUserAccessToken: true
}
✅ バリデーション成功
🔑 OAuth2クライアントにアクセストークンを設定しました
📅 日時変換結果: {
  inputDate: "2024-11-07",  ← 元の値
  dateOnly: "2024-11-07",  ← 時刻除去後の値
  startDate: "2024-11-07",  ← 開始日
  endDate: "2024-11-08"     ← 終了日（翌日）
}
📝 イベントリソース: {
  "summary": "テストタスク（期日：2024-11-07）",
  "description": "タスク: テストタスク\n期日: 2024-11-07",
  "start": {
    "date": "2024-11-07"  ← dateのみ（dateTimeやtimeZoneがない）
  },
  "end": {
    "date": "2024-11-08"   ← dateのみ（dateTimeやtimeZoneがない）
  }
}
🔍 イベント検証: {
  startHasDate: true,
  startHasDateTime: false,  ← falseであること
  startHasTimeZone: false,  ← falseであること
  endHasDate: true,
  endHasDateTime: false,    ← falseであること
  endHasTimeZone: false    ← falseであること
}
✅ Google Calendar API レスポンス: {
  eventId: "...",
  status: 200,
  start: {
    date: "2024-11-07"  ← dateのみ（dateTimeがない）
  },
  end: {
    date: "2024-11-08"  ← dateのみ（dateTimeがない）
  },
  allDay: true  ← trueであること
}
```

**重要な確認ポイント：**

1. ✅ `dateOnly`が正しく`"2024-11-07"`形式になっているか
2. ✅ `startDate`と`endDate`が正しく設定されているか（`endDate`は`startDate`の翌日）
3. ✅ イベントオブジェクトに`dateTime`や`timeZone`が含まれていないか
4. ✅ Google Calendar APIのレスポンスで`allDay: true`になっているか
5. ✅ レスポンスの`start`と`end`に`date`のみが含まれ、`dateTime`が含まれていないか

---

### 4. Googleカレンダーで確認する

1. [Googleカレンダー](https://calendar.google.com/)にアクセス
2. 作成したイベントを確認
3. **期待される表示**:
   - ✅ 「11/7終日」または「11月7日（終日）」と表示される
   - ✅ 時刻が表示されない（「9:00」などが表示されない）
4. **問題がある場合の表示**:
   - ❌ 「11/7 9:00-11/8 9:00」のように時刻が表示される
   - ❌ 2日間にわたって表示される

---

### 5. 問題が発生した場合のトラブルシューティング

#### 問題1: `dateOnly`が正しく抽出されていない

**症状**: ログで`dateOnly`に時刻が含まれている

**確認**:
- `dueDate`の入力値が正しい形式か確認
- `dateOnly`の抽出ロジックが正しく動作しているか確認

**対処**:
- `dueDate`が`"2024-11-07T00:00:00.000Z"`のような形式の場合、`split('T')[0]`で正しく抽出されるはずです
- ログで`inputDate`と`dateOnly`の値を確認

#### 問題2: イベントオブジェクトに`dateTime`が含まれている

**症状**: ログで`startHasDateTime: true`または`endHasDateTime: true`が表示される

**確認**:
- イベントオブジェクトの作成部分を確認
- 他のコードがイベントオブジェクトを変更していないか確認

**対処**:
- イベントオブジェクトの型定義を確認
- `dateTime`や`timeZone`が含まれないように明示的に設定

#### 問題3: Google Calendar APIのレスポンスで`allDay: false`

**症状**: ログで`allDay: false`が表示される

**確認**:
- 送信したイベントオブジェクトを確認
- Google Calendar APIの仕様を確認

**対処**:
- イベントオブジェクトに`date`のみが含まれていることを確認
- `dateTime`や`timeZone`が含まれていないことを確認

#### 問題4: 警告ログが表示される

**症状**: `⚠️ 警告: イベントが時刻付きとして作成されました。`が表示される

**確認**:
- Google Calendar APIのレスポンスを確認
- `start.dateTime`や`end.dateTime`が含まれているか確認

**対処**:
- イベントオブジェクトの作成部分を再確認
- Google Calendar APIのドキュメントを確認

---

### 6. ログの保存方法

問題が発生した場合、ログを保存しておくと原因の特定に役立ちます。

#### ブラウザコンソールのログを保存

1. コンソールで右クリック
2. **Save as...**を選択
3. ログをファイルに保存

#### Firebase Functionsのログを保存

```bash
# ログをファイルに保存
firebase functions:log --limit 100 > calendar-sync-logs.txt
```

---

### 7. よくある質問

**Q: ログが表示されない場合は？**

A: 以下を確認してください：
- デプロイが完了しているか
- ブラウザのコンソールが開いているか
- Firebase Functionsのログが有効になっているか

**Q: `dueDate`が`undefined`になっている場合は？**

A: 以下を確認してください：
- タスク作成時に`dueDate`が正しく設定されているか
- `calendar.service.ts`で`dueDate`が正しく渡されているか

**Q: Google認証が失敗する場合は？**

A: 以下を確認してください：
- Google OAuthの設定が正しいか
- アクセストークンが有効か
- 必要なスコープが設定されているか

---

## 📝 チェックリスト

確認時に以下のチェックリストを使用してください：

- [ ] コードをデプロイした
- [ ] ブラウザのコンソールを開いた
- [ ] タスクを作成してカレンダー連携を有効にした
- [ ] `dueDate`がYYYY-MM-DD形式で送信されていることを確認した
- [ ] Firebase Functionsのログを確認した
- [ ] `dateOnly`が正しく抽出されていることを確認した
- [ ] `startDate`と`endDate`が正しく設定されていることを確認した
- [ ] イベントオブジェクトに`dateTime`や`timeZone`が含まれていないことを確認した
- [ ] Google Calendar APIのレスポンスで`allDay: true`になっていることを確認した
- [ ] Googleカレンダーで「11/7終日」として表示されていることを確認した

---

## 🔗 関連ファイル

- `functions/src/calendarSync.ts` - カレンダー同期の実装
- `src/app/services/calendar.service.ts` - カレンダーサービスの実装
- `src/app/components/task-create/task-create.component.ts` - タスク作成コンポーネント

