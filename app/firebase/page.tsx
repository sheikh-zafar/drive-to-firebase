"use client"
import { useState, FormEvent } from 'react';
import Head from 'next/head';

interface TransferResult {
  name: string;
  status: 'success' | 'error';
  size?: number;
  firebasePath?: string;
  error?: string;
}

interface TransferResponse {
  message: string;
  totalFiles: number;
  results: TransferResult[];
}

export default function Home() {
  const [folderUrl, setFolderUrl] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [destinationPath, setDestinationPath] = useState<string>('audio-files');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<TransferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderIdOrUrl: folderUrl,
          accessToken,
          destinationPath,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to transfer files');
      }
      
      setResults(data as TransferResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>Google Drive to Firebase Storage Transfer</title>
      </Head>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <h1 className="text-2xl font-bold mb-5 text-center">
            Transfer Audio Files from Google Drive to Firebase
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Google Drive Folder URL or ID
              </label>
              <input
                type="text"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Google OAuth Access Token
              </label>
              <input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                You&apos;ll need to authenticate your app separately to get this token
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Firebase Destination Path
              </label>
              <input
                type="text"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isLoading ? 'Transferring...' : 'Start Transfer'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="mt-6">
              <h2 className="text-lg font-medium text-gray-900">Results</h2>
              <p className="mt-2 text-sm text-gray-500">
                Successfully transferred {results.results.filter(r => r.status === 'success').length} of {results.totalFiles} files.
              </p>

              <div className="mt-4 overflow-hidden bg-gray-50 shadow sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {results.results.map((file, index) => (
                    <li key={index} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            file.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {file.status}
                          </p>
                        </div>
                      </div>
                      {file.status === 'success' && (
                        <div className="mt-2 flex justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              Path: {file.firebasePath}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            {file.size ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
                          </div>
                        </div>
                      )}
                      {file.status === 'error' && (
                        <div className="mt-2">
                          <p className="text-sm text-red-500">{file.error}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}