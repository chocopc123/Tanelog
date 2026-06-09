import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver };

// ブラウザかつ対応環境でのみ Analytics を安全に初期化
export const analyticsPromise = isSupported().then((supported) => {
  if (supported) {
    return getAnalytics(app);
  }
  return null;
}).catch((err) => {
  console.warn("Analytics initialization skipped or failed:", err);
  return null;
});
