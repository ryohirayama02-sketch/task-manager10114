# Environment Setup Guide

このプロジェクトでは、Firebase API キーなどの機密情報を安全に管理するため、環境設定ファイルを GitHub に push しない設定になっています。

## 🔧 初回セットアップ手順

### 1. Environment ファイルの作成

テンプレートファイルをコピーして、実際の環境設定ファイルを作成します：

```bash
# 開発環境用
cp src/environments/environment.example.ts src/environments/environment.ts

# 本番環境用
cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
```

### 2. Firebase API キーの設定

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト「kensyu10114」を選択
3. プロジェクト設定 → 全般 → マイアプリ
4. 以下の情報をコピー：
   - API Key
   - App ID
   - Messaging Sender ID
   - Measurement ID

### 3. environment.ts を編集

```typescript
export const environment = {
  production: false,
  firebase: {
    projectId: "kensyu10114",
    appId: "YOUR_APP_ID_HERE",
    storageBucket: "kensyu10114.appspot.com",
    locationId: "asia-northeast1",
    apiKey: "YOUR_API_KEY_HERE", // ここに実際のAPIキーを入力
    authDomain: "kensyu10114.firebaseapp.com",
    messagingSenderId: "YOUR_SENDER_ID",
    measurementId: "YOUR_MEASUREMENT_ID",
  },
  apiBaseUrl: "",
};
```

### 4. environment.prod.ts も同様に編集

本番環境用のファイルも同じ情報で設定してください。

## ⚠️ 重要な注意事項

### ✅ やること

- ローカル環境でのみ `environment.ts` と `environment.prod.ts` を編集
- これらのファイルは `.gitignore` に追加済みなので、GitHub に push されません

### ❌ やってはいけないこと

- `environment.ts` や `environment.prod.ts` を直接 GitHub に push
- API キーをコード内にハードコーディング
- `.gitignore` から環境設定ファイルを削除

## 🔒 セキュリティ

- `environment.ts` と `environment.prod.ts` は `.gitignore` に追加済み
- テンプレートファイル（`.example.ts`）のみが GitHub に push されます
- 実際の API キーはローカル環境にのみ保存されます

## 🚀 アプリの起動

環境設定が完了したら、以下のコマンドでアプリを起動できます：

```bash
# 開発サーバー起動
ng serve

# ブラウザで開く
# http://localhost:4200
```

## 📝 チーム開発時

新しいメンバーがプロジェクトをクローンした場合：

1. このガイドに従って環境設定ファイルを作成
2. プロジェクト管理者から Firebase API キーを受け取る
3. 受け取った API キーを `environment.ts` に設定

## ❓ トラブルシューティング

### エラー: "Firebase API key is missing"

→ `environment.ts` に API キーが正しく設定されているか確認してください

### エラー: "process.env is not defined"

→ `process.env` を使わず、直接 API キーを文字列として設定してください

### GitHub に API キーを push してしまった場合

1. Firebase Console で古い API キーを削除
2. 新しい API キーを生成
3. ローカルの `environment.ts` を更新
4. GitHub のリポジトリ履歴から API キーを削除（必要に応じて）
