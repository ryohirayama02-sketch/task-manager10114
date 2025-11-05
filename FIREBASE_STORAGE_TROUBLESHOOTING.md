# Firebase Storage アップロードハング問題 - 診断ガイド

## 🚨 問題の症状
- ファイルアップロード中にスピナーが止まらない
- コンソールにエラーが表示されない
- Promise が `pending` のまま resolve されない

---

## ✅ 修正済みの項目

### 1. **Storage.rules ファイルの作成** ✓
- **問題**: Firebase Storage のセキュリティルールが定義されていませんでした
- **解決**: `storage.rules` ファイルを作成しました
- **確認場所**: プロジェクトルートの `storage.rules`
- **デプロイ**: `firebase deploy --only storage` で適用してください

### 2. **firebase.json に storage 設定を追加** ✓
```json
"storage": {
  "rules": "storage.rules"
}
```

### 3. **Comprehensive Logging を追加** ✓
`src/app/services/project-attachment.service.ts` に以下のログを追加：
- ファイルアップロード開始時のログ
- Storage インスタンス初期化確認
- uploadBytes 前後のログ
- getDownloadURL 前後のログ
- エラー発生時の詳細ログ

---

## 🔍 トラブルシューティング手順

### ステップ 1: ブラウザコンソールを確認
1. デベロッパーツール（F12）を開く
2. Console タブを確認
3. 以下の段階的なログを探す：
   ```
   [uploadAttachment] Starting upload for file: ...
   [uploadAttachment] Storage path: ...
   [uploadAttachment] Starting uploadBytes...
   [uploadAttachment] uploadBytes completed successfully
   [uploadAttachment] Starting getDownloadURL...
   ```

### ステップ 2: ログから問題個所を特定
| ログが止まる箇所 | 原因の可能性 | 対応 |
|---|---|---|
| `Starting upload` より前 | Service 初期化失敗 | 🔹 下記「ステップ 3」参照 |
| `uploadBytes` 呼び出し直後 | Storage ルール違反 | 🔹 下記「ステップ 4」参照 |
| `getDownloadURL` 呼び出し直後 | ネットワーク遅延 | 🔹 タイムアウト設定確認 |

### ステップ 3: Storage インスタンス初期化確認

**確認項目**: `src/main.ts` に以下が含まれているか
```typescript
import { provideStorage, getStorage } from '@angular/fire/storage';

bootstrapApplication(AppComponent, {
  providers: [
    // ...
    provideStorage(() => getStorage()),
  ],
}).catch((err) => console.error(err));
```

✅ **現在の状態**: 設定済み

### ステップ 4: Firebase Storage セキュリティルール確認

**現在のルール** (`storage.rules`):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**確認項目**:
1. ✅ ユーザーがログインしているか
   - DevTools Console で実行:
   ```javascript
   const { getAuth } = await import('@angular/fire/auth');
   const auth = getAuth();
   console.log('Current user:', auth.currentUser);
   ```

2. ✅ セキュリティルールが Firebase に適用されているか
   - Firebase Console > Storage > Rules タブで確認

3. 🚨 デプロイが必要な場合:
   ```bash
   firebase deploy --only storage
   ```

### ステップ 5: contentType 問題の確認

ブラウザコンソールで:
```javascript
console.log('Resolved contentType:', file.type || 'application/octet-stream');
```

✅ **修正済み**: 以下の安全な処理が追加されています
```typescript
const contentType = file.type && file.type.trim() !== '' 
  ? file.type 
  : 'application/octet-stream';
```

### ステップ 6: ネットワーク通信確認

DevTools の Network タブで:
1. アップロード中に `firebaseapp.com` への通信を確認
2. 通信がハングしていないか確認
3. 応答時間が異常に長くないか確認

---

## 🛠 開発環境のデバッグ方法

### Option 1: Firebase Storage Emulator を使用（推奨）

```bash
# Firebase CLI をインストール
npm install -g firebase-tools

# Emulator の起動
firebase emulators:start

# Angular アプリの環境設定を確認
# src/environments/environment.ts に以下が必要:
# connectStorageEmulator(getStorage(), 'localhost', 9199)
```

### Option 2: デバッグモードでアップロード

コンソールで以下を実行:
```javascript
// service を注入して直接テスト
const { ProjectAttachmentService } = await import('./app/services/project-attachment.service');
// テストファイルを作成
const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
// サービスを手動でテスト
// await attachmentService.uploadAttachment('test-project', testFile);
```

---

## ❌ 一般的なエラーと解決策

### Error: "Permission denied"
**原因**: セキュリティルール違反
**解決**:
1. Firebase Console で現在のルールを確認
2. `request.auth != null` が設定されているか確認
3. ユーザーがログイン状態であるか確認
4. ルール変更後は `firebase deploy --only storage`

### Error: "UNAUTHENTICATED"
**原因**: ユーザーがログインしていない
**解決**:
1. アプリケーションにログイン機能がありますか？
2. ログイン後にアップロード機能を試してください

### Error: "Bucket not found" または "Cannot read property 'bucket'"
**原因**: Firebase 初期化失敗
**解決**:
1. `environment.ts` の Firebase 設定を確認
2. `.firebaserc` ファイルを確認
3. Firebase プロジェクトが正しく設定されているか確認

### Timeout (ネットワーク遅延)
**原因**: ネットワーク接続問題またはファイルサイズ
**解決**:
1. ファイルサイズが 5MB 以下か確認
2. ネットワーク接続を確認
3. Firebase のリージョン設定を確認

---

## 📋 デプロイチェックリスト

アップロード機能を本番環境にデプロイする前に:

- [ ] `storage.rules` ファイルが存在する
- [ ] `firebase.json` に storage ルール設定がある
- [ ] Firebase Console で Storage セキュリティルールを確認
- [ ] ルールが本番環境に適した内容か確認（開発用ルールを本番に適用しない）
- [ ] `firebase deploy --only storage` でルールをデプロイ
- [ ] ファイルアップロードテストを実施
- [ ] エラーハンドリングが適切に表示されるか確認

---

## 🔐 本番環境用推奨セキュリティルール

開発用ルール（現在の `storage.rules`）では、全ファイルへのアクセスを許可しています。
本番環境では、以下のような厳密なルールに変更してください：

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // プロジェクトごとのアクセス制御
    match /projects/{projectId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.size <= 5242880; // 5MB
      allow delete: if request.auth != null;
    }
    
    // その他のファイルはアクセス禁止
    match /{allPaths=**} {
      allow read, write, delete: if false;
    }
  }
}
```

---

## 📞 さらなるサポート

このガイドで問題が解決しない場合:

1. **ブラウザコンソールの完全なエラーメッセージをコピー**
2. **以下の情報を記録**:
   - Chrome DevTools > Network タブのリクエスト/レスポンス
   - Firebase Console > Storage > Rules
   - `firebase --version`
   - `npm list @angular/fire`
3. **プロジェクトの Firebase 設定を確認**:
   - `src/environments/environment.ts`
   - `.firebaserc`

---

## ✅ チェックリスト - 実施済み事項

- [x] Logging 追加: uploadAttachment() に詳細なコンソールログを追加
- [x] Error Handling: try/catch で例外をキャッチして詳細エラーを表示
- [x] contentType 安全性: file.type の null/undefined チェック追加
- [x] Storage 初期化確認: Storage インスタンスの存在チェック追加
- [x] storage.rules 作成: Firebase Storage セキュリティルール定義
- [x] firebase.json 更新: storage セクションを追加
- [x] UI Side: finally ブロックで isUploading = false を確実に実行（既にコード内にあり）

---

**最終ステップ**: Firebase Storage ルールをデプロイしてください。
```bash
firebase deploy --only storage
```

