import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// Firebase configuration - replace with your own
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDovXYb6jKKQSI43tIJLBxC95HnE2X2h4Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "audios-ea425.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "audios-ea425",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "audios-ea425.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "526215918629",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:526215918629:web:4633482e467c3525997bcc"
};

// Google Drive API credentials - replace with your own
const credentials: GoogleCredentials = {
  client_id: process.env.GOOGLE_CLIENT_ID || "1040821447247-c52u2msqnljrd5nlpn9vgtdab91kp1dh.apps.googleusercontent.com",
  client_secret: process.env.GOOGLE_CLIENT_SECRET || "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",
  redirect_uri: process.env.GOOGLE_REDIRECT_URI || "https://accounts.google.com/o/oauth2/auth"
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

// Request body interface
interface TransferRequestBody {
  folderIdOrUrl: string;
  accessToken: string;
  destinationPath?: string;
}

// Google Drive file interface
interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string | number;
}

// File transfer result interface
interface FileTransferResult {
  name: string;
  status: 'success' | 'error';
  size?: number;
  firebasePath?: string;
  error?: string;
}

// Transfer response interface
interface TransferResponse {
  message: string;
  totalFiles: number;
  results: FileTransferResult[];
}

// Error response interface
interface ErrorResponse {
  message: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransferResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { folderIdOrUrl, accessToken, destinationPath = '' } = req.body as TransferRequestBody;

    if (!folderIdOrUrl || !accessToken) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Set auth credentials
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Extract folder ID from URL if needed
    const folderId = folderIdOrUrl.includes('/')
      ? folderIdOrUrl.match(/[-\w]{25,}/)?.[0] || folderIdOrUrl
      : folderIdOrUrl;

    // Get all audio files from the Google Drive folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'audio/' or mimeType contains 'application/octet-stream')`,
      fields: 'files(id, name, mimeType, size)',
    });

    const files = response.data.files as GoogleDriveFile[];
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No audio files found in the specified folder' });
    }

    const transferResults: FileTransferResult[] = [];
    const tempDir = path.join(os.tmpdir(), 'gdrive-transfers');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Process each file
    for (const file of files) {
      try {
        // Make sure file name and ID are defined before proceeding
        if (!file.name || !file.id) {
          throw new Error(`File missing required properties: ${JSON.stringify(file)}`);
        }

        const fileName = file.name as string;
        
        // Download the file from Google Drive
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

        // Read the downloaded file (we've already checked that file.name exists)
        const fileBuffer = fs.readFileSync(path.join(tempDir, fileName));
        
        // Upload to Firebase Storage
        const storageRef = ref(storage, `${destinationPath}/${fileName}`);
        await uploadBytes(storageRef, fileBuffer);

        // Clean up the temp file
        fs.unlinkSync(path.join(tempDir, fileName));

        transferResults.push({
          name: fileName,
          status: 'success',
          size: parseInt(file.size as string, 10),
          firebasePath: `${destinationPath}/${file.name}`
        });
      } catch (error) {
        transferResults.push({
          name: file.name as string,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return res.status(200).json({
      message: 'Transfer completed',
      totalFiles: files.length,
      results: transferResults
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({
      message: 'Failed to transfer files',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}