import { google } from 'googleapis';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Google Drive API credentials interface
interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

// Request body interface
interface TransferRequestBody {
  folderIdOrUrl: string;
  accessToken: string;
  destinationPath?: string;
}

interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string | number;
}

interface FileTransferResult {
  name: string;
  status: 'success' | 'error';
  size?: number;
  firebasePath?: string;
  error?: string;
}

interface TransferResponse {
  message: string;
  totalFiles: number;
  results: FileTransferResult[];
}

// Firebase configuration
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Google Drive API credentials
const credentials: GoogleCredentials = {
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uri
);

// Route handler
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { folderIdOrUrl, accessToken, destinationPath = '' } = body as TransferRequestBody;

    if (!folderIdOrUrl || !accessToken) {
      return new Response(JSON.stringify({ message: 'Missing required parameters' }), {
        status: 400,
      });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderId = folderIdOrUrl.includes('/')
      ? folderIdOrUrl.match(/[-\w]{25,}/)?.[0] || folderIdOrUrl
      : folderIdOrUrl;

    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'audio/' or mimeType contains 'application/octet-stream')`,
      fields: 'files(id, name, mimeType, size)',
    });

    const files = response.data.files as GoogleDriveFile[];
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ message: 'No audio files found in the specified folder' }), {
        status: 404,
      });
    }

    const transferResults: FileTransferResult[] = [];
    const tempDir = path.join(os.tmpdir(), 'gdrive-transfers');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const file of files) {
      try {
        if (!file.name || !file.id) {
          throw new Error(`File missing required properties: ${JSON.stringify(file)}`);
        }

        const fileName = file.name;
        const dest = fs.createWriteStream(path.join(tempDir, fileName));
        const fileRes = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        );

        await new Promise<void>((resolve, reject) => {
          fileRes.data
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err))
            .pipe(dest);
        });

        const fileBuffer = fs.readFileSync(path.join(tempDir, fileName));
        const storageRef = ref(storage, `${destinationPath}/${fileName}`);
        await uploadBytes(storageRef, fileBuffer);

        fs.unlinkSync(path.join(tempDir, fileName));

        transferResults.push({
          name: fileName,
          status: 'success',
          size: parseInt(file.size as string, 10),
          firebasePath: `${destinationPath}/${fileName}`,
        });
      } catch (error) {
        transferResults.push({
          name: file.name as string,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const responsePayload: TransferResponse = {
      message: 'Transfer completed',
      totalFiles: files.length,
      results: transferResults,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      message: 'Failed to transfer files',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
