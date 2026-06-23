export const environment = {
  production: false,
  version: '1.0.6',
  firebase: {
    apiKey: "__PUBLIC_WEB_API_KEY__",
    authDomain: "__PROJECT__.firebaseapp.com",
    projectId: "__PROJECT__",
    storageBucket: "__PROJECT__.appspot.com",
    messagingSenderId: "__SENDER_ID__",
    appId: "__APP_ID__"
  },
  firebaseFunctionsUrl: "https://__REGION__-__PROJECT__.cloudfunctions.net",
  /** Optional: reCAPTCHA v3 site key for Firebase App Check (invisible bot protection). */
  appCheckRecaptchaSiteKey: "",
  disqusShortname: "__DISQUS_SHORTNAME__"
};
