import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";

// Firebase Admin SDK を初期化
admin.initializeApp();

// シークレットの定義
const sendgridApiKey = defineSecret("SENDGRID_API_KEY");
const sendgridFromEmail = defineSecret("SENDGRID_FROM_EMAIL");

// テスト通知を送信するCloud Function
export const sendTestEmail = onCall(
  {secrets: [sendgridApiKey, sendgridFromEmail]},
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です");
    }

    // SendGridの設定（改行文字を確実に除去）
    const rawApiKey = sendgridApiKey.value();
    const apiKey = rawApiKey
      .trim()
      .replace(/[\r\n\t\s]+/g, "")
      .replace(/\0/g, "");
    console.log("Raw API Key length:", rawApiKey.length);
    console.log(
      "Raw API Key chars:",
      rawApiKey
        .split("")
        .map((c) => c.charCodeAt(0))
        .slice(-10)
    );
    console.log("Cleaned API Key length:", apiKey.length);
    console.log("API Key starts with SG:", apiKey.startsWith("SG."));
    console.log("API Key ends with:", apiKey.slice(-5));

    // APIキーの検証
    if (!apiKey || !apiKey.startsWith("SG.")) {
      console.error("Invalid SendGrid API key");
      throw new HttpsError("internal", "SendGrid APIキーが無効です");
    }

    sgMail.setApiKey(apiKey);

    const {email} = request.data;

    if (!email) {
      throw new HttpsError("invalid-argument", "メールアドレスが必要です");
    }

    try {
      const rawFromEmail =
        sendgridFromEmail.value() || "noreply@taskmanager.com";
      const fromEmail = rawFromEmail
        .trim()
        .replace(/[\r\n\t\s]+/g, "")
        .replace(/\0/g, "");
      console.log("Sending email to:", email);
      console.log("From email:", fromEmail);

      // 送信者と受信者が同じ場合はエラー
      if (fromEmail === email) {
        throw new HttpsError(
          "invalid-argument",
          "送信者と受信者のメールアドレスが同じです"
        );
      }

      const msg = {
        to: email,
        from: fromEmail,
        subject: "【テスト通知】タスク管理アプリ",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
             margin: 0 auto;">
          <h2 style="color: #1976d2;">タスク管理アプリ</h2>
          <div style="background-color: #f5f5f5; padding: 20px; 
               border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">テスト通知</h3>
            <p style="color: #666; line-height: 1.6;">
              このメールは通知設定のテスト送信です。<br>
              メールが正常に受信できていることを確認してください。
            </p>
            <div style="background-color: #e8f5e8; padding: 15px; 
                 border-radius: 5px; margin: 15px 0;">
              <p style="color: #2e7d32; margin: 0;">
                ✅ 通知設定が正常に動作しています！
              </p>
            </div>
          </div>
          <p style="color: #999; font-size: 12px;">
            このメールはタスク管理アプリから自動送信されました。
          </p>
        </div>
      `,
      };

      console.log("Attempting to send email...");
      console.log("Message details:", JSON.stringify(msg, null, 2));
      console.log(
        "SendGrid API Key (first 10 chars):",
        apiKey.substring(0, 10)
      );
      console.log(
        "SendGrid API Key (last 10 chars):",
        apiKey.substring(apiKey.length - 10)
      );

      // SendGridの設定を確認
      console.log("SendGrid client configured:", !!sgMail);

      const [response] = await sgMail.send(msg);

      if (response && response.statusCode === 202) {
        console.log("✅ SendGrid送信成功: statusCode 202");
      } else {
        console.warn("⚠️ SendGrid送信応答:", response?.statusCode);
      }

      // テスト通知ログを記録（失敗しても関数全体を落とさない）
      await admin
        .firestore()
        .collection("notificationLogs")
        .add({
          userId: request.auth?.uid || "anonymous",
          type: "test_email_notification",
          channel: "email",
          status: "sent",
          message: "テスト通知送信",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((e) => {
          console.warn(
            "⚠️ Firestore sent-log failed (non fatal):",
            e?.message || e
          );
        });

      return {success: true, message: "テスト通知を送信しました"};
    } catch (error) {
      console.error("テストメール送信エラー:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // SendGridのエラー詳細を表示
      if (error && typeof error === "object" && "response" in error) {
        const sendgridError = error as {
          response?: { body?: unknown; headers?: unknown };
        };
        console.error("SendGrid Error Response:", sendgridError.response?.body);
        console.error(
          "SendGrid Error Headers:",
          sendgridError.response?.headers
        );
      }

      await admin
        .firestore()
        .collection("notificationLogs")
        .add({
          userId: request.auth?.uid || "anonymous",
          type: "test_email_notification",
          channel: "email",
          status: "failed",
          message: "テスト通知送信",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((e) => {
          console.warn(
            "⚠️ Firestore error-log failed (non fatal):",
            e?.message || e
          );
        });

      throw new HttpsError("internal", "テスト通知の送信に失敗しました");
    }
  }
);
