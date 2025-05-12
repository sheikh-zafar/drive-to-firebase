'use client';

import { useState, useEffect } from 'react';

export default function Page() {
  const [clientId, setClientId] = useState<string>('');
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isCodeExchanging, setIsCodeExchanging] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code && redirectUri && clientId) {
        exchangeCodeForToken(code);
      }
    }
  }, [redirectUri, clientId]);

  const generateAuthUrl = () => {
    if (!clientId || !redirectUri) {
      alert('Please provide both Client ID and Redirect URI');
      return;
    }

    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline`;

    setAuthUrl(url);
  };

  const exchangeCodeForToken = async (code: string) => {
    setIsCodeExchanging(true);
    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', 'YOUR_CLIENT_SECRET'); // Should be server-side
      params.append('code', code);
      params.append('redirect_uri', redirectUri);
      params.append('grant_type', 'authorization_code');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data = await response.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        throw new Error(data.error_description || 'Failed to get access token');
      }
    } catch (error) {
      alert(`Error exchanging code for token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCodeExchanging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <h1 className="text-2xl font-bold mb-5 text-center">Google OAuth Authentication</h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Google Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Redirect URI</label>
              <input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <button
              onClick={generateAuthUrl}
              className="w-full py-2 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Generate Auth URL
            </button>

            {authUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Auth URL Generated:</p>
                <div className="bg-gray-50 p-3 rounded-md">
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm break-all"
                  >
                    {authUrl}
                  </a>
                </div>
              </div>
            )}

            {isCodeExchanging && (
              <div className="flex justify-center">
                <p className="text-sm text-gray-700">Exchanging code for token...</p>
              </div>
            )}

            {accessToken && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">Access Token</h2>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm break-all">{accessToken}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(accessToken);
                    alert('Token copied to clipboard!');
                  }}
                  className="mt-2 px-3 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
