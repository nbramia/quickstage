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
  const [saveLocation, setSaveLocation] = useState('downloads');
  const [customPath, setCustomPath] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [lastDownloadedVersion, setLastDownloadedVersion] = useState('');
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    loadSnapshots();
    
    // Load saved user preferences
    const savedLocation = localStorage.getItem('quickstage-save-location');
    const savedCustomPath = localStorage.getItem('quickstage-custom-path');
    const downloadedVersion = localStorage.getItem('quickstage-downloaded-version');
    
    if (savedLocation) {
      setSaveLocation(savedLocation);
      if (savedCustomPath) {
        setCustomPath(savedCustomPath);
      }
    }
    
    if (downloadedVersion) {
      setLastDownloadedVersion(downloadedVersion);
    }
    
    // Check for updates
    checkForUpdates();
  }, []);
  
  const checkForUpdates = async () => {
    try {
      const response = await fetch('/api/extensions/version');
      if (response.ok) {
        const versionInfo = await response.json();
        setCurrentVersion(versionInfo.version);
        
        // Check if user needs to update
        if (lastDownloadedVersion && lastDownloadedVersion !== versionInfo.version) {
          setNeedsUpdate(true);
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

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
    const url = `${window.location.origin}/api/extensions/quickstage.vsix`;
    
    // Try to use File System Access API if available and custom location selected
    if (saveLocation === 'custom' && customPath && 'showSaveFilePicker' in window) {
      // Use modern file picker API
      downloadToCustomLocation(url, customPath);
    } else {
      // Fallback to traditional download
      downloadToDefaultLocation(url);
    }
    
    // Show instructions after delay
    setTimeout(() => {
      setShowInstallInstructions(true);
    }, 1000);
  };

  const handleShowInstructions = () => {
    setShowInstallInstructions(true);
  };

  const downloadToCustomLocation = async (url: string, path: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Use File System Access API
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'quickstage.vsix',
          types: [{
            description: 'VS Code Extension',
            accept: { 'application/octet-stream': ['.vsix'] }
          }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Save user preference and track version
        localStorage.setItem('quickstage-save-location', 'custom');
        localStorage.setItem('quickstage-custom-path', path);
        localStorage.setItem('quickstage-downloaded-version', currentVersion);
        setLastDownloadedVersion(currentVersion);
        setNeedsUpdate(false);
      } else {
        throw new Error('File System Access API not supported');
      }
    } catch (error) {
      console.error('Failed to save to custom location:', error);
      // Fallback to default download
      downloadToDefaultLocation(url);
    }
  };
  
  const downloadToDefaultLocation = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quickstage.vsix';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Track version when downloading
    if (currentVersion) {
      localStorage.setItem('quickstage-downloaded-version', currentVersion);
      setLastDownloadedVersion(currentVersion);
      setNeedsUpdate(false);
    }
  };

  const getPlatformInfo = () => {
    const platform = navigator.platform;
    const isWindows = platform.indexOf('Win') > -1;
    const isMac = platform.indexOf('Mac') > -1;
    const isLinux = platform.indexOf('Linux') > -1;
    
    return {
      isWindows,
      isMac,
      isLinux,
      platform
    };
  };

  const getExtensionPaths = () => {
    const { isWindows, isMac, isLinux } = getPlatformInfo();
    
    if (isWindows) {
      return {
        vscode: '%USERPROFILE%\\.vscode\\extensions\\',
        cursor: '%USERPROFILE%\\.cursor\\extensions\\',
        downloads: '%USERPROFILE%\\Downloads\\'
      };
    } else if (isMac) {
      return {
        vscode: '~/Library/Application Support/Code/User/extensions/',
        cursor: '~/Library/Application Support/Cursor/User/extensions/',
        downloads: '~/Downloads/'
      };
      } else if (isLinux) {
        return {
          vscode: '~/.vscode/extensions/',
          cursor: '~/.cursor/extensions/',
          downloads: '~/Downloads/'
        };
      }
      
      return {
        vscode: '~/.vscode/extensions/',
        cursor: '~/.cursor/extensions/',
        downloads: '~/Downloads/'
      };
  };

  const handleLocationChange = (newLocation: string) => {
    setSaveLocation(newLocation);
    localStorage.setItem('quickstage-save-location', newLocation);
    
    // Clear custom path if not using custom location
    if (newLocation !== 'custom') {
      setCustomPath('');
      localStorage.removeItem('quickstage-custom-path');
    }
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
                
                {/* Update Notification */}
                {currentVersion && (
                  <div className="mb-4">
                    {needsUpdate ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-yellow-800">
                              Update Available!
                            </div>
                            <div className="text-xs text-yellow-600">
                              New version {currentVersion} available. You have version {lastDownloadedVersion}.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : lastDownloadedVersion ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-green-800">
                              Up to Date!
                            </div>
                            <div className="text-xs text-green-600">
                              You have the latest version ({currentVersion}) installed.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-blue-800">
                              First Time Install
                            </div>
                            <div className="text-xs text-blue-600">
                              Download version {currentVersion} to get started.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Location Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Save Location
                  </label>
                  <select
                    value={saveLocation}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="downloads">Downloads Folder</option>
                    <option value="vscode">VS Code Extensions Folder</option>
                    <option value="cursor">Cursor Extensions Folder</option>
                    <option value="custom">Custom Location...</option>
                  </select>
                  
                  {/* Show platform-specific path info */}
                  {saveLocation !== 'downloads' && saveLocation !== 'custom' && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <strong>Suggested path:</strong> {getExtensionPaths()[saveLocation as keyof ReturnType<typeof getExtensionPaths>]}
                      <br />
                      <span className="text-gray-500">
                        {getPlatformInfo().isWindows ? 'Windows' : getPlatformInfo().isMac ? 'macOS' : 'Linux'} detected
                      </span>
                    </div>
                  )}
                  
                  {saveLocation === 'custom' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customPath}
                        onChange={(e) => {
                          setCustomPath(e.target.value);
                          localStorage.setItem('quickstage-custom-path', e.target.value);
                        }}
                        placeholder="Enter custom path..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <button
                        onClick={() => setShowLocationPicker(true)}
                        className="mt-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Browse...
                      </button>
                    </div>
                  )}
                </div>
                
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
                    onClick={checkForUpdates}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center space-x-2"
                    title="Check for updates"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Check Updates</span>
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
                    Version 0.0.1 • VS Code & Cursor Compatible • Consistent Naming
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


