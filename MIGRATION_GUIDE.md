# QuickStage Data Migration Guide

This guide covers the comprehensive migration system for handling schema evolution in QuickStage, specifically for migrating legacy user and snapshot data to the new enhanced schema.

## 🎯 Overview

The migration system was created to handle the transition from legacy data structures to the new enhanced schema that includes:
- **Nested subscription objects** instead of flat fields
- **Analytics tracking** for users and snapshots
- **Enhanced metadata** structures
- **Backward compatibility** during the transition

## 📊 Legacy Fields Identified

### User Legacy Fields
- `subscriptionStatus` → `subscription.status`
- `stripeCustomerId` → `subscription.stripeCustomerId`
- `stripeSubscriptionId` → `subscription.stripeSubscriptionId`
- `trialStartedAt` → `subscription.trialStart`
- `trialEndsAt` → `subscription.trialEnd`
- `subscriptionStartedAt` → `subscription.currentPeriodStart`
- `subscriptionEndsAt` → `subscription.currentPeriodEnd`
- `lastPaymentAt` → `subscription.lastPaymentAt`
- `licenseKey` → (deprecated, not migrated)

### Snapshot Legacy Fields
- `createdBy` → `metadata.createdBy`
- `createdAt` → `metadata.createdAt`
- `expiresAt` → `metadata.expiresAt`
- `public` → `metadata.public`
- `password` → `metadata.password`
- `files` → `metadata.files`

## 🛠️ Migration System Architecture

### Core Components

1. **MigrationSystem Class** (`apps/worker/src/migration-system.ts`)
   - Handles batch processing of users and snapshots
   - Provides dry-run capabilities
   - Tracks migration progress and errors
   - Supports configurable batch sizes

2. **Migration Endpoints** (in `apps/worker/src/index.ts`)
   - `GET /debug/migration/stats` - Get migration statistics
   - `POST /debug/migration/run` - Run full migration
   - `POST /debug/migration/users` - Migrate users only
   - `POST /debug/migration/snapshots` - Migrate snapshots only

3. **Admin Dashboard Integration** (`apps/web/src/routes/AdminDashboard.tsx`)
   - Visual migration status dashboard
   - Test migration capabilities
   - Real-time progress tracking

## 🚀 Usage Instructions

### 1. Check Migration Status

First, check how many records need migration:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://quickstage-worker.nbramia.workers.dev/debug/migration/stats
```

Response:
```json
{
  "stats": {
    "totalUsers": 25,
    "migratedUsers": 5,
    "totalSnapshots": 150,
    "migratedSnapshots": 120,
    "legacyUsers": 20,
    "legacySnapshots": 30
  },
  "summary": {
    "totalRecords": 175,
    "migratedRecords": 125,
    "legacyRecords": 50,
    "migrationProgress": 71
  }
}
```

### 2. Test Migration (Dry Run)

Always test migrations first with dry run:

```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "batchSize": 50, "verbose": true}' \
  https://quickstage-worker.nbramia.workers.dev/debug/migration/run
```

### 3. Run Actual Migration

Once dry run is successful, run the actual migration:

```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "batchSize": 50, "skipErrors": true}' \
  https://quickstage-worker.nbramia.workers.dev/debug/migration/run
```

### 4. Using Admin Dashboard

1. Go to AdminDashboard as superadmin
2. Click "📊 Analytics & System Stats" tab
3. Scroll to "🔄 Data Migration System" section
4. View migration status and progress
5. Click "Test User Migration" or "Test Snapshot Migration" for dry runs
6. Monitor results in the "Migration Results" section

## ⚙️ Migration Options

### Configuration Parameters

- **`dryRun`** (boolean, default: false)
  - If true, simulates migration without making changes
  - Always recommended for testing

- **`batchSize`** (number, default: 50)
  - Number of records to process in each batch
  - Larger batches = faster but more memory usage
  - Smaller batches = safer but slower

- **`skipErrors`** (boolean, default: true)
  - If true, continues migration even if individual records fail
  - If false, stops migration on first error

- **`verbose`** (boolean, default: false)
  - If true, logs detailed information about each record processed

### Migration Types

1. **Full Migration** (`/debug/migration/run`)
   - Migrates both users and snapshots
   - Recommended for complete system migration

2. **User Migration** (`/debug/migration/users`)
   - Migrates only user records
   - Use when focusing on user data issues

3. **Snapshot Migration** (`/debug/migration/snapshots`)
   - Migrates only snapshot records
   - Use when focusing on snapshot data issues

## 🔍 Migration Process Details

### User Migration Process

1. **Scan all user records** in KV_USERS
2. **Check migration status** - skip if already migrated
3. **Initialize new fields**:
   - Create `analytics` object with default values
   - Create `subscription` object with default values
4. **Migrate legacy fields**:
   - Copy legacy subscription fields to new nested structure
   - Preserve all existing data
5. **Add missing timestamps**:
   - Set `updatedAt` if missing
   - Set `lastActivityAt` if missing
   - Set `status` to 'active' if missing
6. **Save migrated record** back to KV_USERS

### Snapshot Migration Process

1. **Scan all snapshot records** in KV_SNAPS
2. **Check migration status** - skip if already migrated
3. **Initialize new fields**:
   - Create `analytics` object with default values
   - Create `metadata` object with default values
4. **Migrate legacy fields**:
   - Copy legacy fields to new nested structure
   - Preserve all existing data
5. **Add missing timestamps**:
   - Set `updatedAt` if missing
   - Set `lastViewedAt` if missing
6. **Save migrated record** back to KV_SNAPS

## 📈 Monitoring & Analytics

### Migration Tracking

All migrations are tracked with analytics events:
- `migration_completed` - Full migration completed
- `user_migration_completed` - User migration completed
- `snapshot_migration_completed` - Snapshot migration completed
- `error_occurred` - Migration errors

### Progress Monitoring

The system provides real-time progress tracking:
- **Overall progress percentage**
- **Records migrated vs total**
- **Error counts and details**
- **Migration duration**
- **Success/failure status**

## 🛡️ Safety Features

### Data Integrity

- **Backward compatibility** - Legacy fields are preserved during migration
- **Atomic operations** - Each record is migrated as a single operation
- **Error handling** - Failed migrations don't corrupt existing data
- **Dry run support** - Test migrations without making changes

### Rollback Strategy

If migration issues occur:
1. **Legacy fields remain intact** - System continues to work with fallbacks
2. **New fields are additive** - No existing functionality is broken
3. **Gradual migration** - Can migrate in batches over time
4. **Selective migration** - Can migrate users and snapshots separately

## 🔮 Future Schema Evolution

### Adding New Fields

When adding new schema fields in the future:

1. **Update types** in `apps/worker/src/types.ts`
2. **Add migration logic** in `migration-system.ts`
3. **Update fallback patterns** in existing code
4. **Test with dry run** before deploying
5. **Run migration** after deployment

### Example: Adding New User Field

```typescript
// 1. Update UserRecord interface
interface UserRecord {
  // ... existing fields
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

// 2. Add migration logic
if (!user.preferences) {
  user.preferences = {
    theme: 'light',
    notifications: true
  };
  newFields.push('preferences');
  needsMigration = true;
}

// 3. Update fallback patterns in code
const theme = user.preferences?.theme || 'light';
```

## 🚨 Important Notes

### Before Running Migration

1. **Backup your data** - Always have a backup before major migrations
2. **Test with dry run** - Never run production migration without testing
3. **Monitor system load** - Large migrations can impact performance
4. **Plan maintenance window** - Consider running during low-traffic periods

### During Migration

1. **Monitor progress** - Watch for errors and performance issues
2. **Don't interrupt** - Let migrations complete naturally
3. **Check logs** - Monitor Cloudflare Worker logs for issues
4. **Verify results** - Check migration stats after completion

### After Migration

1. **Verify data integrity** - Spot-check migrated records
2. **Test functionality** - Ensure all features work correctly
3. **Monitor performance** - Watch for any performance regressions
4. **Update documentation** - Document any issues or learnings

## 📞 Support

If you encounter issues with the migration system:

1. **Check migration stats** to understand current state
2. **Review error logs** in Cloudflare Worker console
3. **Test with dry run** to identify specific issues
4. **Contact support** with specific error messages and migration stats

## 🔄 Maintenance

### Regular Maintenance

- **Monitor migration progress** - Check for stuck or failed migrations
- **Clean up old data** - Consider removing legacy fields after full migration
- **Update migration logic** - Keep migration system current with schema changes
- **Test migration system** - Regularly test with sample data

### Performance Optimization

- **Adjust batch sizes** based on system performance
- **Schedule migrations** during low-traffic periods
- **Monitor KV usage** - Large migrations can impact KV quotas
- **Consider rate limiting** for very large datasets

---

**Remember**: The migration system is designed to be safe, gradual, and reversible. Always test thoroughly before running production migrations, and maintain backups of your data.
