// このファイルはテンプレートです
// 実際の使用時は、このファイルをコピーして environment.prod.ts を作成し、
// 実際のFirebase APIキーを設定してください

export const environment = {
  production: true,
  firebase: {
    projectId: 'kensyu10114',
    appId: '1:XXXXXXXXXXXX:web:XXXXXXXXXXXX', // 実際のApp IDに置き換えてください
    storageBucket: 'kensyu10114.appspot.com',
    locationId: 'asia-northeast1',
    apiKey: 'YOUR_FIREBASE_API_KEY_HERE', // ここに実際のAPIキーを入力
    authDomain: 'kensyu10114.firebaseapp.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID', // 必要に応じて入力
    measurementId: 'YOUR_MEASUREMENT_ID', // 必要に応じて入力
  },
  apiBaseUrl: '',
};
