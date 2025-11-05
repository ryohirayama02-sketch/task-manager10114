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

---

## 🔗 Firebase Storage CORS 設定

Angular アプリから Firebase Storage へファイルをアップロードする際に CORS エラーが発生する場合は、以下の手順で CORS 設定を行ってください。

### 📋 CORS エラーの症状

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/v0/b/kensyu10114.appspot.com/o?...'
from origin 'http://localhost:4200' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check
```

### 🔧 CORS 設定手順

#### 1. Google Cloud SDK のインストール確認

CORS 設定を行うには、Google Cloud SDK がインストールされている必要があります。

```bash
# インストール確認
gsutil -m ls

# インストール済みの場合: gs://... で始まる一覧が表示されます
# インストール未済みの場合: 以下からインストール
# https://cloud.google.com/sdk/docs/install
```

#### 2. Google Cloud 認証

```bash
gcloud auth login
```

初回実行時は、ブラウザが開いて Google アカウントでのログインが要求されます。

#### 3. CORS 設定ファイルの確認

プロジェクトルートに `cors.json` ファイルが存在することを確認してください。

内容:
```json
[
  {
    "origin": [
      "http://localhost:4200",
      "http://localhost:8080",
      "https://kensyu10114.web.app"
    ],
    "method": [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "HEAD"
    ],
    "responseHeader": [
      "Content-Type",
      "x-goog-resumable",
      "Authorization",
      "Access-Control-Allow-Origin"
    ],
    "maxAgeSeconds": 3600
  }
]
```

#### 4. CORS 設定を Firebase Storage バケットに適用

```bash
# バケット名確認
gsutil cors get gs://kensyu10114.appspot.com

# CORS 設定の適用
gsutil cors set cors.json gs://kensyu10114.appspot.com

# 適用確認（設定が表示されれば成功）
gsutil cors get gs://kensyu10114.appspot.com
```

### ✅ CORS 設定が正常に適用された場合

- ブラウザの OPTIONS (Preflight) リクエストに対して、Firebase Storage が正しいヘッダーを返すようになります
- ファイルアップロードが正常に動作します

```
Access-Control-Allow-Origin: http://localhost:4200
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, HEAD
Access-Control-Allow-Headers: Content-Type, x-goog-resumable, Authorization, Access-Control-Allow-Origin
```

### ⚠️ CORS 設定時の注意事項

1. **バケット名の確認**: 設定ファイルで誤ったバケット名を指定しないようご注意ください
2. **本番環境**: 本番環境への配署後は、`cors.json` の `origin` に本番 URL（`https://kensyu10114.web.app` など）が含まれていることを確認してください
3. **キャッシュ**: ブラウザでキャッシュされている場合は、キャッシュをクリアしてから再度試してください