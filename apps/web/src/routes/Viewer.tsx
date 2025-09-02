import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AISuggestionsPanel from '../components/AISuggestionsPanel';
import { ReviewPanel } from '../components/ReviewPanel';
import { useAuth } from '../contexts/AuthContext';
import '../fonts.css';

type Comment = {
  id: string;
  text: string;
  createdAt: number;
  author: string;
  line?: number;
  file?: string;
};

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
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  const { id: snapshotId } = useParams();

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

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !turnstileToken) return;

    try {
      setSubmittingComment(true);
      setError(null);
      
      await api.post(`/api/snapshots/${snapshotId}/comments`, { 
        text: newComment,
        turnstileToken 
      });

      setNewComment('');
      setTurnstileToken(null);
      // Reset Turnstile widget
      if (window.turnstile) {
        window.turnstile.reset();
      }
      // Fetch updated comments
      fetchComments();
    } catch (error: any) {
      console.error('Failed to post comment:', error);
      setError(error.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
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
              />
            </div>
          </div>

          {/* Comments Panel */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 font-inconsolata">Comments ({comments.length})</h3>
              
              {/* Comment Form */}
              <div className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full min-h-[80px] p-3 border border-gray-300 rounded-lg resize-vertical font-inherit text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {/* Turnstile Widget */}
                <div 
                  className="cf-turnstile" 
                  data-sitekey="1x00000000000000000000AA"
                  data-callback={handleTurnstileSuccess}
                />
                
                <button 
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim() || !turnstileToken || submittingComment}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    !newComment.trim() || !turnstileToken || submittingComment
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>

              {/* Comments List */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">
                    No comments yet. Be the first to comment!
                  </div>
                ) : (
                  comments.map((comment) => (
                                      <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {comment.author}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    {comment.file && comment.line && (
                      <div className="inline-block text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2">
                        {comment.file}:{comment.line}
                      </div>
                    )}
                    <div className="text-gray-700 text-sm mt-2">
                      {comment.text}
                    </div>
                  </div>
                  ))
                )}
              </div>
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

    </div>
  );
}


