import { Review, ReviewParticipant, SnapshotRecord } from '../types';
import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';

// Generate unique review ID
function generateReviewId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create a review request
export async function handleCreateReview(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const body = await c.req.json();
    const { reviewers, deadline, notes } = body;

    // Enhanced input validation
    if (!reviewers || !Array.isArray(reviewers) || reviewers.length === 0) {
      return c.json({ error: 'At least one reviewer is required' }, 400);
    }

    // Validate reviewers array structure
    for (let i = 0; i < reviewers.length; i++) {
      const reviewer = reviewers[i];
      if (!reviewer || typeof reviewer !== 'object') {
        return c.json({ error: `Invalid reviewer data at index ${i}` }, 400);
      }
      if (!reviewer.userId || !reviewer.userName || !reviewer.userEmail) {
        return c.json({ error: `Missing required reviewer fields at index ${i}` }, 400);
      }
    }

    // Safe deadline parsing with validation
    let parsedDeadline: number | undefined = undefined;
    if (deadline) {
      if (typeof deadline === 'string' || typeof deadline === 'number') {
        const dateObj = new Date(deadline);
        if (isNaN(dateObj.getTime())) {
          return c.json({ error: 'Invalid deadline format' }, 400);
        }
        parsedDeadline = dateObj.getTime();
      } else {
        return c.json({ error: 'Deadline must be a valid date string or timestamp' }, 400);
      }
    }

    // Get snapshot to verify ownership
    const snapshotData = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
    if (!snapshotData) {
      return c.json({ error: 'Snapshot not found' }, 404);
    }

    const snapshot = JSON.parse(snapshotData) as SnapshotRecord;
    if (snapshot.ownerUid !== uid) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Check if review already exists
    if (snapshot.review?.isRequested) {
      return c.json({ error: 'Review already requested for this snapshot' }, 400);
    }

    const reviewId = generateReviewId();
    const now = Date.now();

    // Create review participants
    const participants: ReviewParticipant[] = reviewers.map((reviewer: any) => ({
      userId: reviewer.userId,
      userName: reviewer.userName,
      userEmail: reviewer.userEmail,
      assignedAt: now,
      status: 'pending' as const
    }));

    // Build review object from scratch with only safe primitive values
    const safeReview = {
      id: String(reviewId),
      snapshotId: String(snapshotId),
      requestedBy: String(uid),
      requestedAt: Number(now),
      reviewers: participants.map(p => ({
        userId: String(p.userId),
        userName: String(p.userName),
        userEmail: String(p.userEmail),
        assignedAt: Number(p.assignedAt),
        status: String(p.status)
      })),
      deadline: parsedDeadline ? Number(parsedDeadline) : null,
      reminderSent: false,
      status: 'pending',
      notes: notes ? String(notes) : null
    };

    // Store review
    try {
      // Test serialization first
      const testSerialize = JSON.stringify(safeReview);
      
      // If successful, store it
      await c.env.KV_REVIEWS.put(reviewId, testSerialize);
    } catch (jsonError) {
      console.error('Failed to serialize review data:', jsonError);
      console.error('Error details:', (jsonError as Error).message);
      console.error('Review object that failed:', safeReview);
      throw new Error('JSON serialization failed for review data');
    }

    // Update snapshot with review info
    snapshot.review = {
      isRequested: true,
      reviewId,
      checkedOffCount: 0,
      totalReviewers: participants.length,
      deadline: safeReview.deadline || undefined,
      status: 'pending'
    };

    try {
      // Build a safe snapshot object from known properties only
      const safeSnapshot = {
        id: String(snapshot.id || snapshotId),
        name: snapshot.name ? String(snapshot.name) : undefined,
        ownerUid: String(snapshot.ownerUid || uid),
        passwordHash: String(snapshot.passwordHash || ''),
        password: snapshot.password ? String(snapshot.password) : undefined,
        projectId: snapshot.projectId ? String(snapshot.projectId) : undefined,
        totalBytes: Number(snapshot.totalBytes || 0),
        files: Array.isArray(snapshot.files) ? snapshot.files.map((file: any) => ({
          name: String(file.name || ''),
          size: Number(file.size || 0),
          type: String(file.type || ''),
          lastModified: file.lastModified ? Number(file.lastModified) : undefined
        })) : [],
        public: Boolean(snapshot.public),
        status: String(snapshot.status || 'active'),
        createdAt: Number(snapshot.createdAt || Date.now()),
        updatedAt: Number(snapshot.updatedAt || Date.now()),
        expiresAt: Number(snapshot.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastAccessedAt: snapshot.lastAccessedAt ? Number(snapshot.lastAccessedAt) : undefined,
        lastModifiedAt: snapshot.lastModifiedAt ? Number(snapshot.lastModifiedAt) : undefined,
        analytics: snapshot.analytics || {
          viewCount: 0,
          uniqueViewers: 0,
          downloadCount: 0,
          commentCount: 0,
          averageTimeOnPage: 0,
          lastViewedAt: 0,
          viewerCountries: [],
          viewerIPs: [],
          viewSessions: []
        },
        metadata: {
          fileCount: Number(snapshot.metadata?.fileCount || 0),
          hasComments: Boolean(snapshot.metadata?.hasComments),
          tags: Array.isArray(snapshot.metadata?.tags) ? snapshot.metadata.tags.map((t: any) => String(t)) : undefined,
          description: snapshot.metadata?.description ? String(snapshot.metadata.description) : undefined,
          thumbnail: snapshot.metadata?.thumbnail ? String(snapshot.metadata.thumbnail) : undefined,
          version: snapshot.metadata?.version ? String(snapshot.metadata.version) : undefined,
          clientName: snapshot.metadata?.clientName ? String(snapshot.metadata.clientName) : undefined,
          milestone: snapshot.metadata?.milestone ? String(snapshot.metadata.milestone) : undefined,
          reviewSummary: snapshot.metadata?.reviewSummary ? String(snapshot.metadata.reviewSummary) : undefined,
          framework: snapshot.metadata?.framework ? String(snapshot.metadata.framework) : undefined
        },
        review: {
          isRequested: true,
          reviewId: String(reviewId),
          checkedOffCount: 0,
          totalReviewers: Number(participants.length),
          deadline: parsedDeadline ? Number(parsedDeadline) : undefined,
          status: 'pending' as const
        }
      };
      
      // Test serialization first
      const testSerialize = JSON.stringify(safeSnapshot);
      
      // If successful, store it
      await c.env.KV_SNAPS.put(`snap:${snapshotId}`, testSerialize);
    } catch (jsonError: any) {
      console.error('Failed to serialize snapshot data:', jsonError);
      console.error('Error details:', jsonError?.message);
      console.error('Snapshot type:', typeof snapshot);
      console.error('Snapshot constructor:', snapshot?.constructor?.name);
      
      // Log the actual problematic data
      try {
        console.error('Snapshot keys:', Object.keys(snapshot || {}));
        console.error('Snapshot values types:', Object.entries(snapshot || {}).map(([k, v]) => `${k}: ${typeof v}`));
      } catch (e) {
        console.error('Could not log snapshot details:', e);
      }
      
      throw new Error('JSON serialization failed for snapshot data');
    }

    // Track analytics (non-blocking, don't fail the request if analytics fail)
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(
        uid,
        'review_requested',
        { 
          reviewId, 
          snapshotId, 
          reviewerCount: participants.length,
          hasDeadline: !!parsedDeadline 
        }
      );
    } catch (analyticsError) {
      console.warn('Analytics tracking failed for review creation:', analyticsError);
      // Don't fail the request if analytics fail - this is non-critical
    }

    // TODO: Send email notifications to reviewers

    return c.json({ success: true, review: safeReview });
  } catch (error: any) {
    console.error('Error creating review:', error);
    
    // Get uid for error logging (might be null if auth failed)
    let uidForLogging: string | null = null;
    try {
      uidForLogging = await getUidFromSession(c);
    } catch (authError) {
      // Ignore auth errors during error logging
    }
    
    console.error('Review creation context:', {
      snapshotId: c.req.param('snapshotId'),
      uid: uidForLogging,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    // More specific error responses based on error type
    if (error.message && error.message.includes('KV')) {
      return c.json({ error: 'Storage service temporarily unavailable' }, 500);
    }
    
    if (error.message && error.message.includes('JSON')) {
      return c.json({ error: 'Data serialization error' }, 500);
    }
    
    return c.json({ error: 'Failed to create review' }, 500);
  }
}

// Get review details
export async function handleGetReview(c: any) {
  try {
    const reviewId = c.req.param('reviewId');
    
    const reviewData = await c.env.KV_REVIEWS.get(reviewId);
    if (!reviewData) {
      return c.json({ error: 'Review not found' }, 404);
    }

    const review = JSON.parse(reviewData) as Review;

    // Check if user has access (owner or reviewer)
    const uid = await getUidFromSession(c);
    const isReviewer = review.reviewers.some(r => r.userId === uid);
    const isOwner = review.requestedBy === uid;

    if (!isReviewer && !isOwner) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ success: true, review });
  } catch (error: any) {
    console.error('Error fetching review:', error);
    return c.json({ error: 'Failed to fetch review' }, 500);
  }
}

// Submit review feedback
export async function handleSubmitReview(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const reviewId = c.req.param('reviewId');
    const body = await c.req.json();
    const { status, feedback } = body;

    if (!status || !['approved', 'changes_requested'].includes(status)) {
      return c.json({ error: 'Invalid review status' }, 400);
    }

    // Get review
    const reviewData = await c.env.KV_REVIEWS.get(reviewId);
    if (!reviewData) {
      return c.json({ error: 'Review not found' }, 404);
    }

    const review = JSON.parse(reviewData) as Review;

    // Find reviewer
    const reviewerIndex = review.reviewers.findIndex(r => r.userId === uid);
    if (reviewerIndex === -1) {
      return c.json({ error: 'You are not a reviewer for this snapshot' }, 403);
    }

    // Update reviewer status
    if (review.reviewers[reviewerIndex]) {
      review.reviewers[reviewerIndex].status = status;
      review.reviewers[reviewerIndex].reviewedAt = Date.now();
      review.reviewers[reviewerIndex].feedback = feedback;
    }

    // Update overall review status
    const allReviewed = review.reviewers.every(r => 
      r.status === 'approved' || r.status === 'changes_requested'
    );
    
    const hasChangesRequested = review.reviewers.some(r => 
      r.status === 'changes_requested'
    );

    if (allReviewed) {
      review.status = 'completed';
      review.completedAt = Date.now();
    } else {
      review.status = 'in_progress';
    }

    // Save updated review
    await c.env.KV_REVIEWS.put(reviewId, JSON.stringify(review));

    // Update snapshot review info
    const snapshotData = await c.env.KV_SNAPS.get(`snap:${review.snapshotId}`);
    if (snapshotData) {
      const snapshot = JSON.parse(snapshotData) as SnapshotRecord;
      const checkedOffCount = review.reviewers.filter(r => 
        r.status === 'approved' || r.status === 'changes_requested'
      ).length;

      snapshot.review = {
        ...snapshot.review!,
        checkedOffCount,
        status: review.status
      };

      await c.env.KV_SNAPS.put(`snap:${review.snapshotId}`, JSON.stringify(snapshot));
    }

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(
      uid,
      'review_submitted',
      { 
        reviewId, 
        status,
        hasChangesRequested
      }
    );

    return c.json({ success: true, review });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    return c.json({ error: 'Failed to submit review' }, 500);
  }
}

// Get reviews for a snapshot
export async function handleGetSnapshotReviews(c: any) {
  try {
    const snapshotId = c.req.param('snapshotId');
    
    // Get snapshot
    const snapshotData = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
    if (!snapshotData) {
      return c.json({ error: 'Snapshot not found' }, 404);
    }

    const snapshot = JSON.parse(snapshotData) as SnapshotRecord;
    
    if (!snapshot.review?.reviewId) {
      return c.json({ success: true, reviews: [] });
    }

    // Get review
    const reviewData = await c.env.KV_REVIEWS.get(snapshot.review.reviewId);
    if (!reviewData) {
      return c.json({ success: true, reviews: [] });
    }

    const review = JSON.parse(reviewData) as Review;

    return c.json({ success: true, reviews: [review] });
  } catch (error: any) {
    console.error('Error fetching snapshot reviews:', error);
    return c.json({ error: 'Failed to fetch reviews' }, 500);
  }
}

// Cancel a review request
export async function handleCancelReview(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const reviewId = c.req.param('reviewId');

    // Get review
    const reviewData = await c.env.KV_REVIEWS.get(reviewId);
    if (!reviewData) {
      return c.json({ error: 'Review not found' }, 404);
    }

    const review = JSON.parse(reviewData) as Review;

    // Check ownership
    if (review.requestedBy !== uid) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update snapshot to remove review info
    const snapshotData = await c.env.KV_SNAPS.get(`snap:${review.snapshotId}`);
    if (snapshotData) {
      const snapshot = JSON.parse(snapshotData) as SnapshotRecord;
      snapshot.review = undefined;
      await c.env.KV_SNAPS.put(`snap:${review.snapshotId}`, JSON.stringify(snapshot));
    }

    // Delete review
    await c.env.KV_REVIEWS.delete(reviewId);

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(
      uid,
      'review_cancelled',
      { reviewId, snapshotId: review.snapshotId }
    );

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling review:', error);
    return c.json({ error: 'Failed to cancel review' }, 500);
  }
}

// Send review reminders (called by cron job)
export async function handleSendReviewReminders(c: any) {
  try {
    const now = Date.now();
    const reminderThreshold = 24 * 60 * 60 * 1000; // 24 hours before deadline

    // List all reviews
    const reviewsList = await c.env.KV_REVIEWS.list();

    for (const key of reviewsList.keys) {
      const reviewData = await c.env.KV_REVIEWS.get(key.name);
      if (!reviewData) continue;

      const review = JSON.parse(reviewData) as Review;

      // Skip if no deadline or already sent reminder
      if (!review.deadline || review.reminderSent) continue;

      // Skip if review is completed
      if (review.status === 'completed') continue;

      // Check if deadline is approaching
      const timeUntilDeadline = review.deadline - now;
      if (timeUntilDeadline > 0 && timeUntilDeadline <= reminderThreshold) {
        // Get pending reviewers
        const pendingReviewers = review.reviewers.filter(r => 
          r.status === 'pending' || r.status === 'reviewing'
        );

        if (pendingReviewers.length > 0) {
          // TODO: Send email reminders to pending reviewers
          
          // Mark reminder as sent
          review.reminderSent = true;
          await c.env.KV_REVIEWS.put(key.name, JSON.stringify(review));

          // Track analytics
          const analytics = getAnalyticsManager(c);
          await analytics.trackEvent(
            'system',
            'review_reminder_sent',
            { 
              reviewId: review.id,
              pendingCount: pendingReviewers.length 
            }
          );
        }
      }

      // Check if deadline has passed
      if (now > review.deadline && !['completed', 'overdue'].includes(review.status)) {
        review.status = 'overdue';
        await c.env.KV_REVIEWS.put(key.name, JSON.stringify(review));

        // Update snapshot
        const snapshotData = await c.env.KV_SNAPS.get(`snap:${review.snapshotId}`);
        if (snapshotData) {
          const snapshot = JSON.parse(snapshotData) as SnapshotRecord;
          if (snapshot.review) {
            snapshot.review.status = 'overdue';
            await c.env.KV_SNAPS.put(`snap:${review.snapshotId}`, JSON.stringify(snapshot));
          }
        }
      }
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error sending review reminders:', error);
    return c.json({ error: 'Failed to send reminders' }, 500);
  }
}