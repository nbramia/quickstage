import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AISuggestionsPanel from '../components/AISuggestionsPanel';
import { ReviewPanel } from '../components/ReviewPanel';
import CommentThread from '../components/CommentThread';
import CommentModal from '../components/CommentModal';
import { useAuth } from '../contexts/AuthContext';
import { Comment } from '../types/dashboard';
import '../fonts.css';

type Snapshot = {
  id: string;
  files: Array<{
    name: string;
    size: number;
    type: string;
    content?: string;
  }>;
  createdAt: number;
  expiresAt: number;
  totalBytes: number;
  status: string;
  password?: string;
};

export function Viewer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPosition, setCommentPosition] = useState<{ x: number; y: number } | undefined>();

  const { id: snapshotId } = useParams();

  // Detect if we're in an iframe and which section to show
  const isInIframe = window.self !== window.top;
  const urlHash = window.location.hash.slice(1); // Remove # from hash
  const iframeSection = isInIframe ? urlHash : null;

  useEffect(() => {
    if (!snapshotId) {
      setError('No snapshot ID provided');
      setLoading(false);
      return;
    }

    fetchSnapshot();
  }, [snapshotId]);

  useEffect(() => {
    if (snapshot && !snapshot.password) {
      fetchComments();
    }
  }, [snapshot]);

  // Auto-open sections when in iframe mode
  useEffect(() => {
    if (isInIframe && iframeSection && snapshot) {
      if (iframeSection === 'comments') {
        // Comments are always shown via CommentThread now
      } else if (iframeSection === 'reviews') {
        // Reviews are shown by default in the component
      } else if (iframeSection === 'ai') {
        // Add a small delay to ensure DOM is ready for AI analysis
        setTimeout(() => {
          setShowAISuggestions(true);
        }, 200);
      }
    }
  }, [isInIframe, iframeSection, snapshot]);

  // Auto-focus password field when form becomes visible
  useEffect(() => {
    if (showPasswordForm && !loading) {
      // Small delay to ensure the form is fully rendered, then focus the password field
      setTimeout(() => {
        const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        if (passwordInput) {
          passwordInput.focus();
        }
      }, 100);
    }
  }, [showPasswordForm, loading]);

  const fetchSnapshot = async () => {
    try {
      setError(null);
      const response = await api.get(`/snapshots/${snapshotId}`);
      setSnapshot(response.snapshot);
      if (response.snapshot.files.length > 0) {
        setSelectedFile(response.snapshot.files[0].name);
      }
      
      // For protected snapshots, always ensure gate cookie is set for iframe access
      if (!response.snapshot.public) {
        // Check if we already have the gate cookie
        const gateCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith(`ps_gate_${snapshotId}=`));
        
        if (!gateCookie) {
          // No gate cookie found, need password for iframe access
          setShowPasswordForm(true);
        }
      }
    } catch (error: any) {
      if (error.message.includes('401')) {
        setShowPasswordForm(true);
      } else {
        console.error('Failed to fetch snapshot:', error);
        setError('Failed to fetch snapshot');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/snapshots/${snapshotId}/comments`);
      setComments(response.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      setError(null);
      // Gate cookie is set by this non-API endpoint
      const res = await fetch(`/s/${snapshotId}/gate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error(res.status.toString());
      setShowPasswordForm(false);
      // Refresh snapshot details (now accessible) and comments
      await fetchSnapshot();
      fetchComments();

    } catch (error: any) {
      console.error('Password verification failed:', error);
      setError(error.message || 'Invalid password');
    }
  };

  const handlePasswordSubmitWithPassword = async (passwordToUse: string) => {
    try {
      setError(null);
      // Gate cookie is set by this non-API endpoint
      const res = await fetch(`/s/${snapshotId}/gate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordToUse })
      });
      if (!res.ok) throw new Error(res.status.toString());
      setShowPasswordForm(false);
      // Refresh snapshot details (now accessible) and comments
      await fetchSnapshot();
      fetchComments();

    } catch (error: any) {
      console.error('Password verification failed:', error);
      setError(error.message || 'Invalid password');
    }
  };

  const handleCommentSubmit = async (data: { 
    text: string; 
    attachments?: File[]; 
    subscribe?: boolean; 
    state?: string; 
    parentId?: string 
  }) => {
    try {
      setError(null);
      
      // Create FormData for file upload support
      const formData = new FormData();
      formData.append('text', data.text);
      if (data.state) formData.append('state', data.state);
      if (data.parentId) formData.append('parentId', data.parentId);
      if (data.subscribe !== undefined) formData.append('subscribe', String(data.subscribe));
      
      if (data.attachments) {
        data.attachments.forEach(file => {
          formData.append('attachments', file);
        });
      }

      // For file uploads, we need to use fetch directly  
      const response = await fetch(`/api/snapshots/${snapshotId}/comments`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      // Fetch updated comments
      await fetchComments();
      setShowCommentModal(false);
    } catch (error: any) {
      console.error('Failed to post comment:', error);
      setError(error.message || 'Failed to post comment');
    }
  };

  const handleAddComment = (position?: { x: number; y: number }) => {
    setCommentPosition(position);
    setShowCommentModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading snapshot...</p>
        </div>
      </div>
    );
  }

  if (error && !showPasswordForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 font-poppins">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 font-inconsolata">Error</h2>
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showPasswordForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-6 font-poppins">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 font-inconsolata">Password Protected</h1>
            <p className="text-gray-600">This snapshot is password protected. Please enter the password to continue.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}
            
            <div className="mb-6">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            
            <button 
              onClick={handlePasswordSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors w-full"
            >
              View Snapshot
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-inconsolata">Snapshot Not Found</h2>
          <p className="text-gray-600 mb-6">The requested snapshot could not be found.</p>
                      <button 
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
        </div>
      </div>
    );
  }

  const currentFile = snapshot.files.find(f => f.name === selectedFile);

  // Render iframe-only content when embedded
  if (isInIframe && iframeSection) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        {iframeSection === 'comments' && snapshotId && (
          <CommentThread
            snapshotId={snapshotId}
            comments={comments}
            onClose={() => {}} // No close needed in iframe
            isOwner={!!user}
            onCommentsUpdate={(updatedComments) => setComments(updatedComments)}
          />
        )}
        
        {iframeSection === 'reviews' && snapshotId && (
          <div className="p-6">
            <ReviewPanel 
              snapshotId={snapshotId}
              isOwner={!!user}
            />
          </div>
        )}
        
        {iframeSection === 'ai' && snapshotId && (
          <AISuggestionsPanel
            snapshotId={snapshotId}
            isVisible={true}
            onClose={() => {}} // No close needed in iframe
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-inconsolata">Snapshot: {snapshot.id}</h1>
              <div className="text-sm text-gray-500">
                Created: {formatDate(snapshot.createdAt)} | 
                Expires: {formatDate(snapshot.expiresAt)} | 
                Size: {formatFileSize(snapshot.totalBytes)}
              </div>
            </div>
            <nav className="flex items-center space-x-3">
              <button 
                onClick={() => setShowAISuggestions(!showAISuggestions)}
                className={`px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                  showAISuggestions 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'text-gray-600 hover:text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                🤖 AI UX Assistant
              </button>
              <button 
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                Dashboard
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 font-inconsolata">Files ({snapshot.files.length})</h3>
              <div className="space-y-2">
                {snapshot.files.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedFile === file.name 
                        ? 'bg-blue-50 border-blue-200 text-blue-900' 
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFileSize(file.size)} • {file.type}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live App Preview */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-lg shadow p-2 min-h-[600px]">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <h3 className="text-lg font-medium text-gray-900 font-inconsolata">Preview</h3>
                <a href={`https://quickstage.tech/s/${snapshotId}/index.html`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open in new tab</a>
              </div>
              <iframe
                key={snapshotId}
                src={`https://quickstage.tech/s/${snapshotId}/index.html`}
                className="w-full h-[70vh] border-0"
                title="Snapshot Preview"
                onLoad={() => {
                  // Ensure iframe is fully loaded before allowing AI analysis
                  console.log('Snapshot iframe loaded successfully');
                }}
                onError={(e) => {
                  console.error('Failed to load snapshot iframe:', e);
                  setError('Failed to load snapshot preview. Please try refreshing the page.');
                }}
              />
            </div>
          </div>

          {/* Comments Panel */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              {/* Always show the sophisticated CommentThread - unified experience */}
              <CommentThread
                snapshotId={snapshotId || ''}
                comments={comments}
                onClose={() => {}} // No close needed - this is the main comments panel
                isOwner={!!user}
                onCommentsUpdate={(updatedComments) => setComments(updatedComments)}
              />
            </div>
            
            {/* Reviews Panel */}
            <div className="mt-6">
              <ReviewPanel 
                snapshotId={snapshotId || ''}
                isOwner={!!user} // Show review functionality to authenticated users
              />
            </div>
          </div>
        </div>
      </main>

      {/* AI Suggestions Panel */}
      {snapshotId && (
        <AISuggestionsPanel
          snapshotId={snapshotId}
          isVisible={showAISuggestions}
          onClose={() => setShowAISuggestions(false)}
        />
      )}

      {/* Comment Modal */}
      {snapshotId && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          onSubmit={handleCommentSubmit}
          snapshotId={snapshotId}
          position={commentPosition}
          existingComments={comments}
          showThread={false}
          isOwner={!!user}
        />
      )}

    </div>
  );
}


