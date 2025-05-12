import { initializeApp, cert, ServiceAccount, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';
import path from 'path';

const serviceAccount = require(path.resolve('firebase-admin-creds.json')) as ServiceAccount;

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'your-project-id.appspot.com',
  });
}

const bucket: Bucket = getStorage().bucket();

export { bucket };
