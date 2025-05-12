import { google } from 'googleapis';
import admin from 'firebase-admin';
import { createRouter } from 'next-connect';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import type { NextApiRequest, NextApiResponse } from 'next';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../../../sheikh-zafar-audio.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'audios-ea425.appspot.com', // Corrected domain (.app → .com)
  });
}

// Set up API router
const router = createRouter<NextApiRequest, NextApiResponse>();
router.use(cors());

// Main POST handler
router.post(async (req, res) => {
  try {
    // Google Drive API setup
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), '../../../sheikh-zafar-audio.json'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Get folder ID from request or fallback
    const folderId : string = req.body?.folderId || '1hvSHh3goZrulS9uowYuhjQP7AQ1wvs5a';

    // List audio files in the folder
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'audio/' and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });

    const files = listRes.data.files || [];

    if (files.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No audio files found in the folder.',
        files: [],
      });
    }

    const bucket = admin.storage().bucket();
    const uploadedFiles: {
      name: string;
      url: string;
      status: string;
    }[] = [];

    for (const file of files) {
        if (!file.name || typeof file.name !== 'string') {
            throw new Error('Invalid file name');
          }
      const destPath = path.join(os.tmpdir(), file.name);
      const dest = fs.createWriteStream(destPath);

      // Download from Drive
      const downloadRes = await drive.files.get(
        { fileId: file.id!, alt: 'media' },
        { responseType: 'stream' }
      );
      await pipeline(downloadRes.data as any, dest);

      // Upload to Firebase Storage
      await bucket.upload(destPath, {
        destination: `audio/${file.name}`,
        public: true,
        metadata: {
          contentType: file.mimeType || 'audio/mpeg',
        },
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/audio/${encodeURIComponent(file.name)}`;

      uploadedFiles.push({
        name: file.name,
        url: publicUrl,
        status: 'uploaded',
      });

      fs.unlinkSync(destPath); // Clean up temp file
    }

    return res.status(200).json({
      success: true,
      message: `Uploaded ${uploadedFiles.length} audio file(s) to Firebase.`,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('Error importing audio files:', error);
    return res.status(500).json({
        success: false,
        message: 'Something went wrong',
        files: [],
      });
  }
});

// Export router handler
export default router.handler();

// Disable body parser to handle streaming
export const config = {
  api: {
    bodyParser: true,
  },
};
