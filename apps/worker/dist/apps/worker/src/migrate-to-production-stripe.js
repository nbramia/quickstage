/**
 * Migration script to handle transition from test to production Stripe
 * This script resets all users with test Stripe data to free plan
 * and designates specific users as superadmins with permanent Pro access
 */
// Add email addresses here for users who should have permanent Pro access
const SUPERADMIN_EMAILS = [
    // TODO: Add your actual email addresses here, then deploy and run migration
    // 'your-actual-email@gmail.com',  // Replace with your real email
    // 'co-founder@yourcompany.com',   // Add other superadmins as needed
    'nbramia@gmail.com'
];
export async function migrateToProductionStripe(env) {
    console.log('Starting migration to production Stripe...');
    const usersToUpdate = [];
    let hasMore = true;
    let cursor = undefined;
    // Get all user keys
    while (hasMore) {
        const listResult = await env.KV_USERS.list({
            prefix: 'user:',
            cursor: cursor
        });
        for (const key of listResult.keys) {
            if (key.name.startsWith('user:') && !key.name.includes(':by')) {
                const userData = await env.KV_USERS.get(key.name);
                if (userData) {
                    const user = JSON.parse(userData);
                    // Check if user has test Stripe data that needs cleanup
                    const hasTestStripeData = (user.stripeCustomerId?.startsWith('cus_') ||
                        user.stripeSubscriptionId?.startsWith('sub_') ||
                        user.subscription?.stripeCustomerId?.startsWith('cus_') ||
                        user.subscription?.stripeSubscriptionId?.startsWith('sub_'));
                    if (hasTestStripeData || user.subscriptionStatus !== 'none') {
                        usersToUpdate.push({ key: key.name, user });
                    }
                }
            }
        }
        hasMore = !listResult.list_complete;
        cursor = listResult.cursor;
    }
    console.log(`Found ${usersToUpdate.length} users to migrate`);
    // Update each user
    for (const { key, user } of usersToUpdate) {
        const isSuperadmin = SUPERADMIN_EMAILS.includes(user.email);
        if (isSuperadmin) {
            // Set as superadmin with permanent Pro access
            user.role = 'superadmin';
            user.plan = 'pro';
            user.subscriptionStatus = 'active';
            // Clean up test Stripe data but keep Pro access
            user.stripeCustomerId = undefined;
            user.stripeSubscriptionId = undefined;
            user.trialEndsAt = undefined;
            user.subscriptionStartedAt = undefined;
            user.lastPaymentAt = undefined;
            // Reset new schema subscription object
            user.subscription = {
                status: 'none' // No Stripe subscription needed for superadmins
            };
            console.log(`Set user ${user.email} as SUPERADMIN with permanent Pro access`);
        }
        else {
            // Reset to clean free state
            user.role = user.role || 'user'; // Keep existing role if not superadmin
            user.subscriptionStatus = 'none';
            user.plan = 'free';
            user.stripeCustomerId = undefined;
            user.stripeSubscriptionId = undefined;
            user.trialEndsAt = undefined;
            user.subscriptionStartedAt = undefined;
            user.lastPaymentAt = undefined;
            // Reset new schema subscription object
            user.subscription = {
                status: 'none'
            };
            console.log(`Reset user ${user.email} to free plan`);
        }
        await env.KV_USERS.put(key, JSON.stringify(user));
    }
    console.log(`Migration complete! Reset ${usersToUpdate.length} users to free plan`);
    return { updated: usersToUpdate.length };
}
