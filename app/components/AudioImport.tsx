"use client"
import React, { useState, ChangeEvent } from 'react';

interface AudioFile {
  name: string;
  url: string;
  status: string;
}

interface ImportResponse {
  success: boolean;
  message: string;
  files: AudioFile[];
}

const AudioImport: React.FC = () => {
  const [folderId, setFolderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
  
    try {
      const response = await fetch('/api/import-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId }),
      });
  
      const text = await response.text();
  
      if (!text) throw new Error('No response from server');
  
      const data: ImportResponse = JSON.parse(text);
  
      if (!response.ok) {
        throw new Error(data.message || 'Failed to import audio files');
      }
  
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFolderId(e.target.value);
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-4">Import Audio from Google Drive</h1>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">
          Google Drive Folder ID:
          <input
            type="text"
            value={folderId}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="Enter Google Drive folder ID"
          />
        </label>
        <p className="text-sm text-gray-500 mt-1">
          You can find the folder ID in the URL when you open the folder in Google Drive
        </p>
      </div>

      <button
        onClick={handleImport}
        disabled={isLoading || !folderId}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isLoading ? 'Importing...' : 'Import Audio Files'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Import Results</h2>
          <p className="text-green-600">{result.message}</p>

          <div className="mt-2 max-h-60 overflow-y-auto">
            <ul className="list-disc pl-5">
              {result.files.map((file, index) => (
                <li key={index}>
                  {file.name} - <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">View</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioImport;
