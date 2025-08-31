import { Notification } from '../types';
import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';

// Get user's notifications
export async function handleGetNotifications(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Get user's notification list
    const userNtfsRaw = await c.env.KV_NOTIFICATIONS.get(`user_ntfs:${uid}`);
    const userNtfIds = userNtfsRaw ? JSON.parse(userNtfsRaw) : [];

    const notifications = [];
    const slice = userNtfIds.slice(offset, offset + limit);

    // Get detailed notification data
    for (const ntfId of slice) {
      const ntfRaw = await c.env.KV_NOTIFICATIONS.get(`ntf:${uid}:${ntfId}`);
      if (ntfRaw) {
        const notification = JSON.parse(ntfRaw);
        notifications.push(notification);
      }
    }

    return c.json({ 
      success: true, 
      notifications,
      total: userNtfIds.length,
      hasMore: offset + limit < userNtfIds.length
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
}

// Mark notification as read
export async function handleMarkNotificationRead(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const notificationId = c.req.param('notificationId');
    const ntfKey = `ntf:${uid}:${notificationId}`;

    const ntfRaw = await c.env.KV_NOTIFICATIONS.get(ntfKey);
    if (!ntfRaw) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    const notification = JSON.parse(ntfRaw);
    if (!notification.readAt) {
      notification.readAt = Date.now();
      await c.env.KV_NOTIFICATIONS.put(ntfKey, JSON.stringify(notification));
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
}

// Mark all notifications as read
export async function handleMarkAllNotificationsRead(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's notification list
    const userNtfsRaw = await c.env.KV_NOTIFICATIONS.get(`user_ntfs:${uid}`);
    const userNtfIds = userNtfsRaw ? JSON.parse(userNtfsRaw) : [];

    const now = Date.now();

    // Mark all as read
    for (const ntfId of userNtfIds) {
      const ntfKey = `ntf:${uid}:${ntfId}`;
      const ntfRaw = await c.env.KV_NOTIFICATIONS.get(ntfKey);
      if (ntfRaw) {
        const notification = JSON.parse(ntfRaw);
        if (!notification.readAt) {
          notification.readAt = now;
          await c.env.KV_NOTIFICATIONS.put(ntfKey, JSON.stringify(notification));
        }
      }
    }

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'notifications_marked_all_read', {
      notificationCount: userNtfIds.length
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return c.json({ error: 'Failed to mark all notifications as read' }, 500);
  }
}

// Delete notification
export async function handleDeleteNotification(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const notificationId = c.req.param('notificationId');
    const ntfKey = `ntf:${uid}:${notificationId}`;

    const ntfRaw = await c.env.KV_NOTIFICATIONS.get(ntfKey);
    if (!ntfRaw) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    // Delete notification
    await c.env.KV_NOTIFICATIONS.delete(ntfKey);

    // Remove from user's notification list
    const userNtfsRaw = await c.env.KV_NOTIFICATIONS.get(`user_ntfs:${uid}`);
    if (userNtfsRaw) {
      const userNtfs = JSON.parse(userNtfsRaw);
      const filteredNtfs = userNtfs.filter((id: string) => id !== notificationId);
      await c.env.KV_NOTIFICATIONS.put(`user_ntfs:${uid}`, JSON.stringify(filteredNtfs));
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return c.json({ error: 'Failed to delete notification' }, 500);
  }
}

// Get notification statistics (unread count, etc.)
export async function handleGetNotificationStats(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's notification list
    const userNtfsRaw = await c.env.KV_NOTIFICATIONS.get(`user_ntfs:${uid}`);
    const userNtfIds = userNtfsRaw ? JSON.parse(userNtfsRaw) : [];

    let unreadCount = 0;
    let totalCount = userNtfIds.length;

    // Count unread notifications
    for (const ntfId of userNtfIds) {
      const ntfRaw = await c.env.KV_NOTIFICATIONS.get(`ntf:${uid}:${ntfId}`);
      if (ntfRaw) {
        const notification = JSON.parse(ntfRaw);
        if (!notification.readAt) {
          unreadCount++;
        }
      }
    }

    return c.json({ 
      success: true, 
      stats: {
        unreadCount,
        totalCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching notification stats:', error);
    return c.json({ error: 'Failed to fetch notification stats' }, 500);
  }
}