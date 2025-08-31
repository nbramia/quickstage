import { CommentSubscription, Notification } from '../types';
import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';

// Generate unique subscription ID
function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique notification ID
function generateNotificationId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Subscribe to snapshot comments
export async function handleSubscribeToSnapshot(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const body = await c.req.json();
    const { commentId } = body; // Optional: subscribe to specific comment thread

    // Check if already subscribed
    const existingSubRaw = await c.env.KV_SUBSCRIPTIONS.get(`sub:${uid}:${snapshotId}:${commentId || 'snapshot'}`);
    if (existingSubRaw) {
      const existingSub = JSON.parse(existingSubRaw);
      if (existingSub.isActive) {
        return c.json({ success: true, subscription: existingSub });
      }
    }

    const subscriptionId = generateSubscriptionId();
    const now = Date.now();

    const subscription: CommentSubscription = {
      id: subscriptionId,
      userId: uid,
      snapshotId,
      commentId: commentId || undefined,
      createdAt: now,
      isActive: true
    };

    // Store subscription in KV
    await c.env.KV_SUBSCRIPTIONS.put(
      `sub:${uid}:${snapshotId}:${commentId || 'snapshot'}`, 
      JSON.stringify(subscription)
    );

    // Add to user's subscription list
    const userSubsRaw = await c.env.KV_SUBSCRIPTIONS.get(`user_subs:${uid}`);
    const userSubs = userSubsRaw ? JSON.parse(userSubsRaw) : [];
    userSubs.push(subscription.id);
    await c.env.KV_SUBSCRIPTIONS.put(`user_subs:${uid}`, JSON.stringify(userSubs));

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comment_subscription_created', {
      snapshotId,
      commentId: commentId || null,
      subscriptionType: commentId ? 'thread' : 'snapshot'
    });

    return c.json({ success: true, subscription });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return c.json({ error: 'Failed to create subscription' }, 500);
  }
}

// Unsubscribe from snapshot comments
export async function handleUnsubscribeFromSnapshot(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const body = await c.req.json();
    const { commentId } = body; // Optional: unsubscribe from specific comment thread

    const subKey = `sub:${uid}:${snapshotId}:${commentId || 'snapshot'}`;
    const existingSubRaw = await c.env.KV_SUBSCRIPTIONS.get(subKey);
    
    if (!existingSubRaw) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    // Mark as inactive instead of deleting (for analytics)
    const subscription = JSON.parse(existingSubRaw);
    subscription.isActive = false;
    subscription.unsubscribedAt = Date.now();

    await c.env.KV_SUBSCRIPTIONS.put(subKey, JSON.stringify(subscription));

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comment_subscription_cancelled', {
      snapshotId,
      commentId: commentId || null,
      subscriptionType: commentId ? 'thread' : 'snapshot'
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error removing subscription:', error);
    return c.json({ error: 'Failed to remove subscription' }, 500);
  }
}

// Get user's subscriptions
export async function handleGetUserSubscriptions(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's subscription list
    const userSubsRaw = await c.env.KV_SUBSCRIPTIONS.get(`user_subs:${uid}`);
    const userSubIds = userSubsRaw ? JSON.parse(userSubsRaw) : [];

    const subscriptions = [];
    
    // Get detailed subscription data
    for (const subId of userSubIds) {
      // Find subscription by scanning user's keys
      const keys = await c.env.KV_SUBSCRIPTIONS.list({ prefix: `sub:${uid}:` });
      for (const key of keys.keys) {
        const subRaw = await c.env.KV_SUBSCRIPTIONS.get(key.name);
        if (subRaw) {
          const sub = JSON.parse(subRaw);
          if (sub.id === subId && sub.isActive) {
            // Enrich with snapshot name if available
            const snapshotRaw = await c.env.KV_SNAPS.get(`snap:${sub.snapshotId}`);
            if (snapshotRaw) {
              const snapshot = JSON.parse(snapshotRaw);
              sub.snapshotName = snapshot.name || `Snapshot ${sub.snapshotId}`;
            }
            subscriptions.push(sub);
          }
        }
      }
    }

    return c.json({ success: true, subscriptions });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return c.json({ error: 'Failed to fetch subscriptions' }, 500);
  }
}

// Update subscription settings
export async function handleUpdateSubscription(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const subscriptionId = c.req.param('subscriptionId');
    const body = await c.req.json();
    const { isActive } = body;

    // Find the subscription
    const keys = await c.env.KV_SUBSCRIPTIONS.list({ prefix: `sub:${uid}:` });
    let found = false;

    for (const key of keys.keys) {
      const subRaw = await c.env.KV_SUBSCRIPTIONS.get(key.name);
      if (subRaw) {
        const sub = JSON.parse(subRaw);
        if (sub.id === subscriptionId) {
          sub.isActive = isActive;
          sub.updatedAt = Date.now();
          await c.env.KV_SUBSCRIPTIONS.put(key.name, JSON.stringify(sub));
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return c.json({ error: 'Failed to update subscription' }, 500);
  }
}

// Delete subscription permanently
export async function handleDeleteSubscription(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const subscriptionId = c.req.param('subscriptionId');

    // Find and delete the subscription
    const keys = await c.env.KV_SUBSCRIPTIONS.list({ prefix: `sub:${uid}:` });
    let found = false;

    for (const key of keys.keys) {
      const subRaw = await c.env.KV_SUBSCRIPTIONS.get(key.name);
      if (subRaw) {
        const sub = JSON.parse(subRaw);
        if (sub.id === subscriptionId) {
          await c.env.KV_SUBSCRIPTIONS.delete(key.name);
          
          // Remove from user's subscription list
          const userSubsRaw = await c.env.KV_SUBSCRIPTIONS.get(`user_subs:${uid}`);
          if (userSubsRaw) {
            const userSubs = JSON.parse(userSubsRaw);
            const filteredSubs = userSubs.filter((id: string) => id !== subscriptionId);
            await c.env.KV_SUBSCRIPTIONS.put(`user_subs:${uid}`, JSON.stringify(filteredSubs));
          }
          
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    return c.json({ error: 'Failed to delete subscription' }, 500);
  }
}

// Create notification for subscribers
export async function createNotificationForSubscribers(
  env: any, 
  snapshotId: string, 
  commentId: string, 
  type: 'comment_reply' | 'comment_new' | 'comment_resolved' | 'snapshot_comment',
  title: string,
  message: string,
  actionUrl?: string
) {
  try {
    // Find all active subscriptions for this snapshot/comment
    const keys = await env.KV_SUBSCRIPTIONS.list({ prefix: 'sub:' });
    
    for (const key of keys.keys) {
      const subRaw = await env.KV_SUBSCRIPTIONS.get(key.name);
      if (subRaw) {
        const sub = JSON.parse(subRaw);
        
        // Check if this subscription matches
        const matchesSnapshot = sub.snapshotId === snapshotId && sub.isActive;
        const matchesComment = sub.commentId === commentId || !sub.commentId; // No commentId means subscribe to all
        
        if (matchesSnapshot && matchesComment) {
          // Create notification
          const notificationId = generateNotificationId();
          const notification: Notification = {
            id: notificationId,
            userId: sub.userId,
            type,
            title,
            message,
            snapshotId,
            commentId,
            createdAt: Date.now(),
            actionUrl
          };
          
          // Store notification
          await env.KV_NOTIFICATIONS.put(
            `ntf:${sub.userId}:${notificationId}`, 
            JSON.stringify(notification)
          );
          
          // Add to user's notification list
          const userNtfsRaw = await env.KV_NOTIFICATIONS.get(`user_ntfs:${sub.userId}`);
          const userNtfs = userNtfsRaw ? JSON.parse(userNtfsRaw) : [];
          userNtfs.unshift(notification.id); // Most recent first
          
          // Keep only latest 100 notifications
          if (userNtfs.length > 100) {
            userNtfs.splice(100);
          }
          
          await env.KV_NOTIFICATIONS.put(`user_ntfs:${sub.userId}`, JSON.stringify(userNtfs));
          
          // Update subscription's lastNotified timestamp
          sub.lastNotified = Date.now();
          await env.KV_SUBSCRIPTIONS.put(key.name, JSON.stringify(sub));
        }
      }
    }
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
}