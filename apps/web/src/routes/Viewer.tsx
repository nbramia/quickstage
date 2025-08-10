import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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
  const [searchParams] = useSearchParams();
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

  const snapshotId = searchParams.get('id');

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

  const fetchSnapshot = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/snapshots/${snapshotId}`, { 
        credentials: 'include' 
      });
      
      if (response.status === 401) {
        setShowPasswordForm(true);
        setLoading(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setSnapshot(data.snapshot);
        if (data.snapshot.files.length > 0) {
          setSelectedFile(data.snapshot.files[0].name);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch snapshot');
      }
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
      setError('Failed to fetch snapshot');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}/comments`, { 
        credentials: 'include' 
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/snapshots/${snapshotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSnapshot(data.snapshot);
        setShowPasswordForm(false);
        if (data.snapshot.files.length > 0) {
          setSelectedFile(data.snapshot.files[0].name);
        }
        fetchComments();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Invalid password');
      }
    } catch (error) {
      console.error('Password verification failed:', error);
      setError('Failed to verify password');
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !turnstileToken) return;

    try {
      setSubmittingComment(true);
      setError(null);
      
      const response = await fetch(`/api/snapshots/${snapshotId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: newComment,
          turnstileToken 
        }),
        credentials: 'include'
      });

      if (response.ok) {
        setNewComment('');
        setTurnstileToken(null);
        // Reset Turnstile widget
        if (window.turnstile) {
          window.turnstile.reset();
        }
        // Fetch updated comments
        fetchComments();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      setError('Failed to post comment');
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
      <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '20px' }}>
        <div>Loading snapshot...</div>
      </div>
    );
  }

  if (error && !showPasswordForm) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '20px' }}>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fee2e2', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b'
        }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (showPasswordForm) {
    return (
      <div style={{ maxWidth: 400, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Password Protected</h2>
          <p>This snapshot is password protected. Please enter the password to continue.</p>
          
          {error && (
            <div style={{ 
              padding: '12px 16px', 
              backgroundColor: '#fee2e2', 
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
          </div>
          
          <button 
            onClick={handlePasswordSubmit}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View Snapshot
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '20px' }}>
        <div>Snapshot not found</div>
      </div>
    );
  }

  const currentFile = snapshot.files.find(f => f.name === selectedFile);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system' }}>
      {/* Navigation Header */}
      <div style={{ 
        borderBottom: '1px solid #ddd', 
        padding: '20px 0', 
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, marginBottom: '8px' }}>Snapshot: {snapshot.id}</h1>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Created: {formatDate(snapshot.createdAt)} | 
            Expires: {formatDate(snapshot.expiresAt)} | 
            Size: {formatFileSize(snapshot.totalBytes)}
          </div>
        </div>
        <nav>
          <a 
            href="/" 
            style={{ 
              color: '#666', 
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            Dashboard
          </a>
        </nav>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: '24px' }}>
        {/* File List */}
        <div style={{ 
          backgroundColor: '#f9f9f9', 
          padding: '16px', 
          borderRadius: '8px',
          border: '1px solid #eee'
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Files ({snapshot.files.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {snapshot.files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  backgroundColor: selectedFile === file.name ? '#e0f2fe' : 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{file.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatFileSize(file.size)} • {file.type}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* File Content */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #eee',
          minHeight: '600px'
        }}>
          {currentFile ? (
            <div>
              <h3 style={{ margin: '0 0 16px 0' }}>{currentFile.name}</h3>
              {currentFile.content ? (
                <pre style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '16px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: '1px solid #e9ecef'
                }}>
                  <code>{currentFile.content}</code>
                </pre>
              ) : (
                <div style={{ 
                  padding: '40px', 
                  textAlign: 'center', 
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px'
                }}>
                  File content not available
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: '#666' 
            }}>
              Select a file to view
            </div>
          )}
        </div>

        {/* Comments Panel */}
        <div style={{ 
          backgroundColor: '#f9f9f9', 
          padding: '16px', 
          borderRadius: '8px',
          border: '1px solid #eee'
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Comments ({comments.length})</h3>
          
          {/* Comment Form */}
          <div style={{ marginBottom: '20px' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
            
            {/* Turnstile Widget */}
            <div 
              className="cf-turnstile" 
              data-sitekey="1x00000000000000000000AA"
              data-callback={handleTurnstileSuccess}
              style={{ marginBottom: '12px' }}
            />
            
            <button 
              onClick={handleCommentSubmit}
              disabled={!newComment.trim() || !turnstileToken || submittingComment}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: !newComment.trim() || !turnstileToken || submittingComment ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: !newComment.trim() || !turnstileToken || submittingComment ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {submittingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>

          {/* Comments List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                No comments yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comment) => (
                <div 
                  key={comment.id}
                  style={{ 
                    backgroundColor: 'white', 
                    padding: '12px', 
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      {comment.author}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  {comment.file && comment.line && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#2563eb', 
                      marginBottom: '6px',
                      backgroundColor: '#f0f8ff',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      display: 'inline-block'
                    }}>
                      {comment.file}:{comment.line}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                    {comment.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Turnstile Script */}
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    </div>
  );
}


