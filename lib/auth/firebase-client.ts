'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0]!;
    return _app;
  }
  _app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return _app;
}

export function getFirebaseClientAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(ensureApp());
  return _auth;
}
