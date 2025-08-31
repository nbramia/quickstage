import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { DEFAULT_ONBOARDING } from '../types';

// Update user onboarding state
export async function handleUpdateOnboarding(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const body = await c.req.json();
    const { hasSeenWelcome, completedTutorials, skippedWelcome } = body;

    // Get current user
    const userKey = `user:${uid}`;
    const existingUser = await c.env.KV_USERS.get(userKey, { type: 'json' });
    if (!existingUser) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Update onboarding data
    const updatedUser = {
      ...existingUser,
      onboarding: {
        ...existingUser.onboarding || DEFAULT_ONBOARDING,
        hasSeenWelcome: hasSeenWelcome ?? existingUser.onboarding?.hasSeenWelcome,
        completedTutorials: completedTutorials ?? existingUser.onboarding?.completedTutorials,
        skippedWelcome: skippedWelcome ?? existingUser.onboarding?.skippedWelcome,
        welcomeShownAt: hasSeenWelcome && !existingUser.onboarding?.hasSeenWelcome ? Date.now() : existingUser.onboarding?.welcomeShownAt,
        lastTutorialCompletedAt: completedTutorials?.length > (existingUser.onboarding?.completedTutorials?.length || 0) ? Date.now() : existingUser.onboarding?.lastTutorialCompletedAt,
      },
      updatedAt: Date.now(),
    };

    // Save updated user
    await c.env.KV_USERS.put(userKey, JSON.stringify(updatedUser));

    // Track analytics events
    if (hasSeenWelcome && !existingUser.onboarding?.hasSeenWelcome) {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'welcome_shown', {});
    }
    
    if (skippedWelcome) {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'welcome_skipped', {});
    }

    // Track tutorial completion
    if (completedTutorials) {
      const existingTutorials = existingUser.onboarding?.completedTutorials || [];
      const newTutorials = completedTutorials.filter((t: string) => !existingTutorials.includes(t));
      
      for (const tutorialId of newTutorials) {
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'tutorial_completed', { tutorialId });
      }
    }

    return c.json({ 
      success: true, 
      data: updatedUser.onboarding 
    });
  } catch (error) {
    console.error('Failed to update onboarding:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Get user onboarding state
export async function handleGetOnboarding(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const userKey = `user:${uid}`;
    const user = await c.env.KV_USERS.get(userKey, { type: 'json' });
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const onboarding = user.onboarding || DEFAULT_ONBOARDING;

    return c.json({ 
      success: true, 
      data: onboarding 
    });
  } catch (error) {
    console.error('Failed to get onboarding:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Track tutorial events
export async function handleTrackTutorial(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const body = await c.req.json();
    const { tutorialId, action, step } = body; // action: 'started' | 'completed' | 'skipped'

    // Track the event
    const eventType = action === 'started' ? 'tutorial_started' : 
                     action === 'completed' ? 'tutorial_completed' : 'tutorial_skipped';
    
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, eventType, { tutorialId, step });

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to track tutorial:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Check if user should see welcome
export async function handleShouldShowWelcome(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const userKey = `user:${uid}`;
    const user = await c.env.KV_USERS.get(userKey, { type: 'json' });
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const onboarding = user.onboarding || DEFAULT_ONBOARDING;
    const shouldShow = !onboarding.hasSeenWelcome && !onboarding.skippedWelcome;

    return c.json({ 
      success: true, 
      data: { shouldShow, onboarding } 
    });
  } catch (error) {
    console.error('Failed to check welcome status:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}