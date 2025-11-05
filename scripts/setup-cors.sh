#!/bin/bash

# Firebase Storage CORS Configuration Setup Script
# このスクリプトは、Firebase Storage に CORS 設定を適用します

set -e  # エラーで停止

BUCKET_NAME="gs://kensyu10114.appspot.com"
CORS_FILE="cors.json"

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}Firebase Storage CORS Configuration Setup${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# 1. Google Cloud SDK のインストール確認
echo -e "${YELLOW}[1/4]${NC} Google Cloud SDK のインストール確認..."
if ! command -v gsutil &> /dev/null; then
    echo -e "${RED}❌ gsutil が見つかりません${NC}"
    echo "以下のリンクから Google Cloud SDK をインストールしてください:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo -e "${GREEN}✓ gsutil がインストールされています${NC}"
echo ""

# 2. CORS ファイルの確認
echo -e "${YELLOW}[2/4]${NC} CORS 設定ファイルの確認..."
if [ ! -f "$CORS_FILE" ]; then
    echo -e "${RED}❌ $CORS_FILE ファイルが見つかりません${NC}"
    echo "プロジェクトルートに cors.json ファイルを配置してください"
    exit 1
fi
echo -e "${GREEN}✓ $CORS_FILE ファイルが見つかりました${NC}"
echo ""

# 3. Google Cloud 認証確認
echo -e "${YELLOW}[3/4]${NC} Google Cloud 認証確認..."
if ! gcloud auth list 2>/dev/null | grep -q "*"; then
    echo -e "${RED}❌ Google Cloud に認証されていません${NC}"
    echo "以下のコマンドで認証してください:"
    echo "gcloud auth login"
    exit 1
fi
echo -e "${GREEN}✓ Google Cloud に認証済みです${NC}"
echo ""

# 4. CORS 設定の適用
echo -e "${YELLOW}[4/4]${NC} CORS 設定を Firebase Storage に適用中..."
echo "バケット: $BUCKET_NAME"
echo ""

if gsutil cors set "$CORS_FILE" "$BUCKET_NAME"; then
    echo -e "${GREEN}✓ CORS 設定が正常に適用されました${NC}"
    echo ""
    
    # 確認表示
    echo -e "${BLUE}現在の CORS 設定:${NC}"
    gsutil cors get "$BUCKET_NAME"
    echo ""
    
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}セットアップが完了しました！${NC}"
    echo -e "${GREEN}===============================================${NC}"
    echo ""
    echo "ファイルアップロードが正常に動作するようになります。"
    echo "ブラウザのキャッシュをクリアしてから確認してください。"
else
    echo -e "${RED}❌ CORS 設定の適用に失敗しました${NC}"
    echo "以下を確認してください:"
    echo "1. バケット名が正しいか"
    echo "2. cors.json ファイルの形式が正しいか"
    echo "3. Google Cloud の権限が十分か"
    exit 1
fi
