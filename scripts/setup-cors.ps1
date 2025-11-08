# Firebase Storage CORS Configuration Setup Script for Windows PowerShell
# このスクリプトは、Firebase Storage に CORS 設定を適用します

$ErrorActionPreference = "Stop"

$BUCKET_NAME = "gs://kensyu10114.appspot.com"
$CORS_FILE = "cors.json"

# カラー出力用
$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$NC = "`e[0m"

Write-Host ""
Write-Host "$($BLUE)===============================================$($NC)" -NoNewline
Write-Host "$($BLUE)Firebase Storage CORS Configuration Setup$($NC)" -NoNewline
Write-Host "$($BLUE)===============================================$($NC)"
Write-Host ""

# 1. Google Cloud SDK のインストール確認
Write-Host "$($YELLOW)[1/4]$($NC) Google Cloud SDK のインストール確認..."
try {
    $gsutil = & gsutil -v 2>&1
    Write-Host "$($GREEN)✓ gsutil がインストールされています$($NC)"
} catch {
    Write-Host "$($RED)❌ gsutil が見つかりません$($NC)"
    Write-Host "以下のリンクから Google Cloud SDK をインストールしてください:"
    Write-Host "https://cloud.google.com/sdk/docs/install"
    exit 1
}
Write-Host ""

# 2. CORS ファイルの確認
Write-Host "$($YELLOW)[2/4]$($NC) CORS 設定ファイルの確認..."
if (-Not (Test-Path $CORS_FILE)) {
    Write-Host "$($RED)❌ $CORS_FILE ファイルが見つかりません$($NC)"
    Write-Host "プロジェクトルートに cors.json ファイルを配置してください"
    exit 1
}
Write-Host "$($GREEN)✓ $CORS_FILE ファイルが見つかりました$($NC)"
Write-Host ""

# 3. Google Cloud 認証確認
Write-Host "$($YELLOW)[3/4]$($NC) Google Cloud 認証確認..."
try {
    $authOutput = & gcloud auth list 2>&1
    if ($authOutput -match "ACTIVE") {
        Write-Host "$($GREEN)✓ Google Cloud に認証済みです$($NC)"
    } else {
        throw "Not authenticated"
    }
} catch {
    Write-Host "$($RED)❌ Google Cloud に認証されていません$($NC)"
    Write-Host "以下のコマンドで認証してください:"
    Write-Host "gcloud auth login"
    exit 1
}
Write-Host ""

# 4. CORS 設定の適用
Write-Host "$($YELLOW)[4/4]$($NC) CORS 設定を Firebase Storage に適用中..."
Write-Host "バケット: $BUCKET_NAME"
Write-Host ""

try {
    & gsutil cors set $CORS_FILE $BUCKET_NAME
    Write-Host "$($GREEN)✓ CORS 設定が正常に適用されました$($NC)"
    Write-Host ""
    
    # 確認表示
    Write-Host "$($BLUE)現在の CORS 設定:$($NC)"
    & gsutil cors get $BUCKET_NAME
    Write-Host ""
    
    Write-Host "$($GREEN)===============================================$($NC)"
    Write-Host "$($GREEN)セットアップが完了しました！$($NC)"
    Write-Host "$($GREEN)===============================================$($NC)"
    Write-Host ""
    Write-Host "ファイルアップロードが正常に動作するようになります。"
    Write-Host "ブラウザのキャッシュをクリアしてから確認してください。"
} catch {
    Write-Host "$($RED)❌ CORS 設定の適用に失敗しました$($NC)"
    Write-Host "エラー内容: $_"
    Write-Host ""
    Write-Host "以下を確認してください:"
    Write-Host "1. バケット名が正しいか"
    Write-Host "2. cors.json ファイルの形式が正しいか"
    Write-Host "3. Google Cloud の権限が十分か"
    exit 1
}






