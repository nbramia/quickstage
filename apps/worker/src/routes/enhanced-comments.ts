import { Comment, CommentAttachment } from '../types';
import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { createNotificationForSubscribers } from './subscriptions';

// Generate unique comment ID
function generateCommentId(): string {
  return `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique attachment ID
function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create a comment with enhanced features
export async function handleCreateComment(c: any) {
  try {
    const uid = await getUidFromSession(c);
    const isAuthenticated = !!uid;

    const snapshotId = c.req.param('snapshotId');
    
    // Handle both JSON and FormData requests
    let body: any;
    let attachments: File[] = [];
    
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      
      // Extract text fields
      body = {
        text: formData.get('text'),
        elementSelector: formData.get('elementSelector'),
        elementCoordinates: formData.get('elementCoordinates') ? JSON.parse(formData.get('elementCoordinates') as string) : undefined,
        pageUrl: formData.get('pageUrl'),
        parentId: formData.get('parentId'),
        state: formData.get('state') || 'published',
        subscribe: formData.get('subscribe') === 'true',
        authorName: formData.get('authorName'), // For anonymous users
        anonymousUserId: formData.get('anonymousUserId') // For anonymous user tracking
      };
      
      // Extract file attachments
      const files = formData.getAll('attachments');
      attachments = files.filter((file: any): file is File => file instanceof File);
    } else {
      body = await c.req.json();
    }
    
    const {
      text,
      elementSelector,
      elementCoordinates,
      pageUrl,
      parentId,
      state = 'published',
      subscribe = false,
      authorName,
      anonymousUserId
    } = body;

    if (!text || text.trim().length === 0) {
      return c.json({ error: 'Comment text is required' }, 400);
    }

    // Get user info
    let displayName: string;
    let isAnonymous = false;
    
    if (isAuthenticated) {
      const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
      const user = userRaw ? JSON.parse(userRaw) : null;
      displayName = user?.name || `User-${uid.slice(0, 8)}`;
    } else {
      // Anonymous user - use provided name or default to "Anonymous"
      displayName = authorName?.trim() || 'Anonymous';
      isAnonymous = true;
    }

    const commentId = generateCommentId();
    const now = Date.now();

    // Upload attachments to R2 if any
    const commentAttachments: CommentAttachment[] = [];
    
    for (const file of attachments) {
      try {
        const attachmentId = generateAttachmentId();
        const filename = file.name;
        const mimeType = file.type;
        const size = file.size;
        
        // Store in R2 under attachments/{snapshotId}/{commentId}/{attachmentId}
        const objectKey = `attachments/${snapshotId}/${commentId}/${attachmentId}`;
        
        await c.env.R2_SNAPSHOTS.put(objectKey, file.stream(), {
          httpMetadata: { contentType: mimeType }
        });
        
        const attachment: CommentAttachment = {
          id: attachmentId,
          filename,
          mimeType,
          size,
          url: `${c.env.PUBLIC_BASE_URL}/attachments/${snapshotId}/${commentId}/${attachmentId}`,
          uploadedAt: now
        };
        
        commentAttachments.push(attachment);
      } catch (error) {
        console.error('Error uploading attachment:', error);
        // Continue with other attachments, don't fail the whole comment
      }
    }

    const comment: Comment = {
      id: commentId,
      snapshotId,
      text: text.trim(),
      author: uid || anonymousUserId || 'anonymous',
      authorName: displayName,
      isAnonymous,
      createdAt: now,
      elementSelector,
      elementCoordinates,
      pageUrl,
      parentId,
      state,
      attachments: commentAttachments
    };

    // Store comment using Durable Objects
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const response = await stub.fetch('http://do/comments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment)
    });

    if (!response.ok) {
      return c.json({ error: 'Failed to create comment' }, 500);
    }

    // Update snapshot comment count and metadata
    const snapshotRaw = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
    if (snapshotRaw) {
      const snapshot = JSON.parse(snapshotRaw);
      
      // Update analytics
      if (snapshot.analytics) {
        snapshot.analytics.commentCount = (snapshot.analytics.commentCount || 0) + 1;
      }
      
      // Update metadata
      if (snapshot.metadata) {
        snapshot.metadata.hasComments = true;
      }
      
      // Legacy support
      snapshot.commentsCount = (snapshot.commentsCount || 0) + 1;
      
      await c.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
    }

    // Track analytics (only for authenticated users)
    if (isAuthenticated && uid) {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'comment_posted', {
        snapshotId,
        commentId,
        hasElementSelector: !!elementSelector,
        hasCoordinates: !!elementCoordinates,
        isReply: !!parentId,
        textLength: text.length
      });
    }

    // Create notifications for subscribers
    const notificationType = parentId ? 'comment_reply' : 'comment_new';
    const notificationTitle = parentId ? 'New reply to conversation' : 'New comment on snapshot';
    const notificationMessage = `${displayName}: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`;
    const actionUrl = `${c.env.PUBLIC_BASE_URL}/view/${snapshotId}`;
    
    await createNotificationForSubscribers(
      c.env,
      snapshotId,
      parentId || commentId,
      notificationType,
      notificationTitle,
      notificationMessage,
      actionUrl
    );

    return c.json({ success: true, comment });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
}

// Get all comments for a snapshot with threading
export async function handleGetComments(c: any) {
  try {
    const snapshotId = c.req.param('snapshotId');
    
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const response = await stub.fetch(`http://do/comments/list?snapshotId=${snapshotId}`);
    
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch comments' }, 500);
    }

    const data = await response.json();
    return c.json({ success: true, comments: data.comments || [] });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
}

// Update comment
export async function handleUpdateComment(c: any) {
  try {
    const uid = await getUidFromSession(c);
    const isAuthenticated = !!uid;

    const snapshotId = c.req.param('snapshotId');
    const commentId = c.req.param('commentId');
    const body = await c.req.json();

    // Get existing comment to check ownership
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const getResponse = await stub.fetch(`http://do/comments/${commentId}`);
    
    if (!getResponse.ok) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    const existingComment = await getResponse.json();
    
    // Check ownership - only allow editing by author, but anyone can resolve
    const isResolveAction = body.state === 'resolved';
    const currentAuthor = uid || (body.anonymousUserId ? body.anonymousUserId : 'anonymous');
    if (!isResolveAction && existingComment.author !== currentAuthor) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update comment
    const updateResponse = await stub.fetch(`http://do/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        updatedAt: Date.now()
      })
    });

    if (!updateResponse.ok) {
      return c.json({ error: 'Failed to update comment' }, 500);
    }

    const updatedComment = await updateResponse.json();

    // Track analytics (only for authenticated users)
    if (isAuthenticated && uid) {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid as string, 'comment_updated', {
        snapshotId,
        commentId
      });
    }

    return c.json({ success: true, comment: updatedComment });
  } catch (error: any) {
    console.error('Error updating comment:', error);
    return c.json({ error: 'Failed to update comment' }, 500);
  }
}

// Delete comment
export async function handleDeleteComment(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const commentId = c.req.param('commentId');

    // Get existing comment to check ownership
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const getResponse = await stub.fetch(`http://do/comments/${commentId}`);
    
    if (!getResponse.ok) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    const existingComment = await getResponse.json();
    
    // Check ownership (or admin/superadmin)
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    const user = userRaw ? JSON.parse(userRaw) : null;
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    
    if (existingComment.author !== uid && !isAdmin) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete comment attachments from R2
    if (existingComment.attachments && existingComment.attachments.length > 0) {
      try {
        let r2cursor: string | undefined = undefined;
        do {
          const objs: any = await c.env.R2_SNAPSHOTS.list({ 
            prefix: `attachments/${snapshotId}/${commentId}/`, 
            cursor: r2cursor 
          });
          r2cursor = objs.cursor as string | undefined;
          if (objs.objects.length) {
            await c.env.R2_SNAPSHOTS.delete((objs.objects as any[]).map((o: any) => o.key as string));
          }
        } while (r2cursor);
      } catch (error) {
        console.error('Error deleting comment attachments:', error);
        // Continue with comment deletion even if attachment cleanup fails
      }
    }

    // Delete comment
    const deleteResponse = await stub.fetch(`http://do/comments/${commentId}`, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      return c.json({ error: 'Failed to delete comment' }, 500);
    }

    // Update snapshot comment count
    const snapshotRaw = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
    if (snapshotRaw) {
      const snapshot = JSON.parse(snapshotRaw);
      
      if (snapshot.analytics) {
        snapshot.analytics.commentCount = Math.max(0, (snapshot.analytics.commentCount || 1) - 1);
      }
      
      snapshot.commentsCount = Math.max(0, (snapshot.commentsCount || 1) - 1);
      
      // Update hasComments flag if no comments left
      if (snapshot.analytics?.commentCount === 0 && snapshot.metadata) {
        snapshot.metadata.hasComments = false;
      }
      
      await c.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
    }

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comment_deleted', {
      snapshotId,
      commentId
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
}

// Resolve comment
export async function handleResolveComment(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const commentId = c.req.param('commentId');

    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const updateResponse = await stub.fetch(`http://do/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'resolved',
        resolvedBy: uid,
        resolvedAt: Date.now(),
        updatedAt: Date.now()
      })
    });

    if (!updateResponse.ok) {
      return c.json({ error: 'Failed to resolve comment' }, 500);
    }

    const updatedComment = await updateResponse.json();

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comment_resolved', {
      snapshotId,
      commentId
    });

    // Create notification for subscribers
    await createNotificationForSubscribers(
      c.env,
      snapshotId,
      commentId,
      'comment_resolved',
      'Comment resolved',
      'A comment thread has been resolved',
      `${c.env.PUBLIC_BASE_URL}/view/${snapshotId}`
    );

    return c.json({ success: true, comment: updatedComment });
  } catch (error: any) {
    console.error('Error resolving comment:', error);
    return c.json({ error: 'Failed to resolve comment' }, 500);
  }
}

// Upload comment attachment
export async function handleUploadAttachment(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const commentId = c.req.param('commentId');
    
    // Get file from request
    const formData = await c.req.formData();
    const file = formData.get('attachment') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Validate file type and size (same as in handleCreateComment)
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/jpg',
      'text/plain', 'text/markdown', 
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return c.json({ error: 'File size too large. Maximum size is 10MB.' }, 400);
    }
    
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'File type not supported' }, 400);
    }
    
    const attachmentId = generateAttachmentId();
    const filename = file.name;
    const mimeType = file.type;
    const size = file.size;
    
    // Store in R2 under attachments/{snapshotId}/{commentId}/{attachmentId}
    const objectKey = `attachments/${snapshotId}/${commentId}/${attachmentId}`;
    
    await c.env.R2_SNAPSHOTS.put(objectKey, file.stream(), {
      httpMetadata: { contentType: mimeType }
    });
    
    const attachment: CommentAttachment = {
      id: attachmentId,
      filename,
      mimeType,
      size,
      url: `${c.env.PUBLIC_BASE_URL}/attachments/${snapshotId}/${commentId}/${attachmentId}`,
      uploadedAt: Date.now()
    };

    return c.json({ success: true, attachment });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    return c.json({ error: 'Failed to upload attachment' }, 500);
  }
}

// Bulk resolve comments
export async function handleBulkResolveComments(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const { commentIds } = await c.req.json();

    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return c.json({ error: 'Invalid comment IDs' }, 400);
    }

    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    
    // Bulk update comments
    const updateResponse = await stub.fetch('http://do/comments/bulk-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentIds,
        resolvedBy: uid,
        resolvedAt: Date.now(),
        updatedAt: Date.now()
      })
    });

    if (!updateResponse.ok) {
      return c.json({ error: 'Failed to resolve comments' }, 500);
    }

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comments_bulk_resolved', {
      snapshotId,
      commentCount: commentIds.length
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error bulk resolving comments:', error);
    return c.json({ error: 'Failed to resolve comments' }, 500);
  }
}