import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

type Snapshot = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  password?: string;
  isPublic: boolean;
  viewCount: number;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      const response = await api.get('/snapshots/list');
      setSnapshots(response.data.snapshots || []);
    } catch (err) {
      setError('Failed to load snapshots');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleExtendSnapshot = async (snapshotId: string) => {
    try {
      await api.post(`/snapshots/${snapshotId}/extend`, { days: 7 });
      // Reload snapshots to get updated expiry dates
      loadSnapshots();
    } catch (err) {
      setError('Failed to extend snapshot');
      console.error(err);
    }
  };

  const handleExpireSnapshot = async (snapshotId: string) => {
    try {
      await api.post(`/snapshots/${snapshotId}/expire`);
      // Reload snapshots to get updated list
      loadSnapshots();
    } catch (err) {
      setError('Failed to expire snapshot');
      console.error(err);
    }
  };

  const handleRotatePassword = async (snapshotId: string) => {
    try {
      const response = await api.post(`/snapshots/${snapshotId}/rotate-password`);
      // Show the new password to the user
      alert(`New password: ${response.password}`);
    } catch (err) {
      setError('Failed to rotate password');
      console.error(err);
    }
  };

  const handleCopyUrl = async (snapshotId: string) => {
    try {
      const url = `${window.location.origin}/s/${snapshotId}`;
      await navigator.clipboard.writeText(url);
      // Show a brief success message
      setError(''); // Clear any existing errors
      // You could add a success state here if you want
    } catch (err) {
      setError('Failed to copy URL');
      console.error(err);
    }
  };

  const handleDownloadExtension = () => {
    // Download the VSIX file from the API
    const url = `${window.location.origin}/api/extensions/quickstage-0.0.1.vsix`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quickstage-0.0.1.vsix';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Show installation instructions after a short delay
    setTimeout(() => {
      setShowInstallInstructions(true);
    }, 1000);
  };

  const handleShowInstructions = () => {
    setShowInstallInstructions(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilExpiry = (expiryString: string) => {
    const expiry = new Date(expiryString);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days: number) => {
    if (days <= 1) return 'text-red-600';
    if (days <= 3) return 'text-orange-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your snapshots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">QuickStage</h1>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link
                to="/dashboard"
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/settings"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Settings
              </Link>
              
              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{user?.plan === 'pro' ? 'Pro' : 'Free'}</span>
                  <span className="text-gray-500 ml-2">Plan</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Welcome back!
                </h2>
                <p className="text-gray-600">
                  Manage your staged snapshots and create new ones from VS Code.
                </p>
                {user && (
                  <p className="text-sm text-gray-500 mt-2">
                    User ID: {user.uid.slice(0, 8)}... • Member since {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {user?.plan === 'free' && (
                <Link
                  to="/settings"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Go Pro
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Extension Download Section */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  QuickStage Extension
                </h2>
                <p className="text-gray-600 mb-4">
                  Download and install the QuickStage extension to start staging your projects directly from VS Code or Cursor.
                </p>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleDownloadExtension()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download Extension</span>
                  </button>
                  <button
                    onClick={() => handleShowInstructions()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>View Instructions</span>
                  </button>
                  <span className="text-sm text-gray-500">
                    Version 0.0.1 • VS Code & Cursor Compatible
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800 font-medium">Ready to Install</div>
                  <div className="text-xs text-blue-600">All systems operational</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Instructions Modal */}
        {showInstallInstructions && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Installation Instructions
                  </h3>
                  <button
                    onClick={() => setShowInstallInstructions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 1: Install the Extension</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <div>
                          <p className="text-sm text-gray-700">Open VS Code or Cursor</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <div>
                          <p className="text-sm text-gray-700">Press <code className="bg-gray-200 px-1 rounded text-xs">Ctrl+Shift+P</code> (Windows/Linux) or <code className="bg-gray-200 px-1 rounded text-xs">Cmd+Shift+P</code> (Mac) to open Command Palette</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <div>
                          <p className="text-sm text-gray-700">Type <code className="bg-gray-200 px-1 rounded text-xs">Extensions: Install from VSIX...</code> and press Enter</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                        <div>
                          <p className="text-sm text-gray-700">Navigate to and select the downloaded <code className="bg-gray-200 px-1 rounded text-xs">quickstage-0.0.1.vsix</code> file</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">5</div>
                        <div>
                          <p className="text-sm text-gray-700">Click "Install" when prompted</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 2: Restart VS Code/Cursor</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">After installation, you'll be prompted to restart VS Code or Cursor. Click "Reload" to activate the extension.</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 3: Use QuickStage</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <div>
                          <p className="text-sm text-gray-700">Open your project folder in VS Code/Cursor</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <div>
                          <p className="text-sm text-gray-700">Press <code className="bg-gray-200 px-1 rounded text-xs">Ctrl+Shift+P</code> (Windows/Linux) or <code className="bg-gray-200 px-1 rounded text-xs">Cmd+Shift+P</code> (Mac)</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <div>
                          <p className="text-sm text-gray-700">Type <code className="bg-gray-200 px-1 rounded text-xs">QuickStage: Stage</code> and press Enter</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                        <div>
                          <p className="text-sm text-gray-700">The extension will build your project and create a shareable snapshot</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tip</h4>
                    <p className="text-sm text-blue-800">
                      Make sure your project has a build script in <code className="bg-blue-100 px-1 rounded text-xs">package.json</code>. 
                      QuickStage supports Vite, Create React App, SvelteKit, and Next.js projects.
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• The extension requires Node.js 18+ with corepack enabled</li>
                      <li>• Your project must have a valid build script</li>
                      <li>• Snapshots are password-protected by default</li>
                      <li>• Files are automatically cleaned up after 7 days</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInstallInstructions(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Snapshots Section */}
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Your Snapshots ({snapshots.length})
              </h3>
            </div>

            {error && (
              <div className="px-6 py-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              </div>
            )}

            {snapshots.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No snapshots yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Use the QuickStage extension in VS Code to create your first snapshot.
                </p>
                <div className="text-sm text-gray-400">
                  <p>1. Install the QuickStage extension</p>
                  <p>2. Open your project in VS Code</p>
                  <p>3. Click "QuickStage: Stage" in the command palette</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Snapshot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Password
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {snapshots.map((snapshot) => {
                      const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
                      const expiryColor = getExpiryColor(daysUntilExpiry);
                      
                      return (
                        <tr key={snapshot.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {snapshot.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {snapshot.id}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(snapshot.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${expiryColor}`}>
                              {daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {snapshot.viewCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              snapshot.isPublic 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {snapshot.isPublic ? 'Public' : 'Private'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {snapshot.password ? (
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {snapshot.password}
                              </code>
                            ) : (
                              <span className="text-gray-500">No password</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a
                              href={`/s/${snapshot.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900 mr-2"
                            >
                              View
                            </a>
                            <button
                              onClick={() => handleCopyUrl(snapshot.id)}
                              className="text-green-600 hover:text-green-900 mr-2"
                            >
                              Copy URL
                            </button>
                            <button 
                              onClick={() => handleExtendSnapshot(snapshot.id)}
                              className="text-gray-600 hover:text-gray-900 mr-2"
                            >
                              Extend
                            </button>
                            <button 
                              onClick={() => handleExpireSnapshot(snapshot.id)}
                              className="text-red-600 hover:text-red-900 mr-2"
                            >
                              Expire
                            </button>
                            <button 
                              onClick={() => handleRotatePassword(snapshot.id)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              New Password
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


