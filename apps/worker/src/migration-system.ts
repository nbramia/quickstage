import { 
  UserRecord, 
  SnapshotRecord, 
  DEFAULT_USER_ANALYTICS, 
  DEFAULT_SNAPSHOT_ANALYTICS, 
  DEFAULT_SNAPSHOT_METADATA, 
  DEFAULT_SUBSCRIPTION 
} from './types';

// Migration system for handling schema evolution
export interface MigrationResult {
  success: boolean;
  migrated: number;
  errors: number;
  details: MigrationDetail[];
  timestamp: number;
  duration: number;
}

export interface MigrationDetail {
  type: 'user' | 'snapshot';
  id: string;
  action: 'migrated' | 'skipped' | 'error';
  message: string;
  legacyFields?: string[];
  newFields?: string[];
}

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  skipErrors?: boolean;
  verbose?: boolean;
}

// Legacy field mappings for user migration
const USER_LEGACY_FIELDS = [
  'subscriptionStatus',
  'stripeCustomerId', 
  'stripeSubscriptionId',
  'trialStartedAt',
  'trialEndsAt',
  'subscriptionStartedAt',
  'subscriptionEndsAt',
  'lastPaymentAt',
  'licenseKey'
];

// Legacy field mappings for snapshot migration
const SNAPSHOT_LEGACY_FIELDS = [
  'createdBy',
  'createdAt',
  'expiresAt',
  'public',
  'password',
  'files',
  'metadata'
];

/**
 * Comprehensive migration system for users and snapshots
 */
export class MigrationSystem {
  private env: any;
  private options: MigrationOptions;

  constructor(env: any, options: MigrationOptions = {}) {
    this.env = env;
    this.options = {
      dryRun: false,
      batchSize: 50,
      skipErrors: true,
      verbose: false,
      ...options
    };
  }

  /**
   * Run complete migration for all users and snapshots
   */
  async runFullMigration(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migrated: 0,
      errors: 0,
      details: [],
      timestamp: startTime,
      duration: 0
    };

    try {
      console.log('🚀 Starting comprehensive migration...');
      
      // Migrate users
      const userResult = await this.migrateAllUsers();
      result.migrated += userResult.migrated;
      result.errors += userResult.errors;
      result.details.push(...userResult.details);

      // Migrate snapshots
      const snapshotResult = await this.migrateAllSnapshots();
      result.migrated += snapshotResult.migrated;
      result.errors += snapshotResult.errors;
      result.details.push(...snapshotResult.details);

      result.duration = Date.now() - startTime;
      result.success = result.errors === 0;

      console.log(`✅ Migration complete: ${result.migrated} migrated, ${result.errors} errors in ${result.duration}ms`);
      
    } catch (error: any) {
      result.success = false;
      result.errors++;
      result.details.push({
        type: 'user',
        id: 'system',
        action: 'error',
        message: `Migration failed: ${error.message}`
      });
      console.error('❌ Migration failed:', error);
    }

    return result;
  }

  /**
   * Migrate all users to new schema
   */
  async migrateAllUsers(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migrated: 0,
      errors: 0,
      details: [],
      timestamp: startTime,
      duration: 0
    };

    try {
      console.log('👥 Starting user migration...');
      
      let cursor: string | undefined;
      let totalProcessed = 0;

      do {
        const list = await this.env.KV_USERS.list({ 
          prefix: 'user:', 
          cursor,
          limit: this.options.batchSize 
        });
        
        cursor = list.cursor as string | undefined;

        for (const key of list.keys) {
          // Only process actual user records (user:uid), not index keys
          if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
            totalProcessed++;
            
            try {
              const userRaw = await this.env.KV_USERS.get(key.name);
              if (!userRaw) continue;

              const user: any = JSON.parse(userRaw);
              const migrationResult = this.migrateUserToNewSchema(user);
              
              if (migrationResult.needsMigration) {
                if (!this.options.dryRun) {
                  await this.env.KV_USERS.put(key.name, JSON.stringify(migrationResult.user));
                }
                
                result.migrated++;
                result.details.push({
                  type: 'user',
                  id: user.uid,
                  action: 'migrated',
                  message: `Migrated user ${user.uid}`,
                  legacyFields: migrationResult.legacyFields,
                  newFields: migrationResult.newFields
                });

                if (this.options.verbose) {
                  console.log(`✅ Migrated user ${user.uid}`);
                }
              } else {
                result.details.push({
                  type: 'user',
                  id: user.uid,
                  action: 'skipped',
                  message: `User ${user.uid} already migrated`
                });
              }

            } catch (error: any) {
              result.errors++;
              result.details.push({
                type: 'user',
                id: key.name,
                action: 'error',
                message: `Failed to migrate user: ${error.message}`
              });

              if (!this.options.skipErrors) {
                throw error;
              }

              console.error(`❌ Error migrating user ${key.name}:`, error);
            }
          }
        }

        if (this.options.verbose) {
          console.log(`📊 Processed ${totalProcessed} users...`);
        }

      } while (cursor);

      result.duration = Date.now() - startTime;
      console.log(`✅ User migration complete: ${result.migrated} migrated, ${result.errors} errors`);

    } catch (error: any) {
      result.success = false;
      result.errors++;
      result.details.push({
        type: 'user',
        id: 'system',
        action: 'error',
        message: `User migration failed: ${error.message}`
      });
      console.error('❌ User migration failed:', error);
    }

    return result;
  }

  /**
   * Migrate all snapshots to new schema
   */
  async migrateAllSnapshots(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migrated: 0,
      errors: 0,
      details: [],
      timestamp: startTime,
      duration: 0
    };

    try {
      console.log('📸 Starting snapshot migration...');
      
      let cursor: string | undefined;
      let totalProcessed = 0;

      do {
        const list = await this.env.KV_SNAPS.list({ 
          prefix: 'snap:', 
          cursor,
          limit: this.options.batchSize 
        });
        
        cursor = list.cursor as string | undefined;

        for (const key of list.keys) {
          // Only process actual snapshot records (snap:id), not other keys
          if (key.name.startsWith('snap:') && !key.name.includes(':', 5)) {
            totalProcessed++;
            
            try {
              const snapshotRaw = await this.env.KV_SNAPS.get(key.name);
              if (!snapshotRaw) continue;

              const snapshot: any = JSON.parse(snapshotRaw);
              const migrationResult = this.migrateSnapshotToNewSchema(snapshot);
              
              if (migrationResult.needsMigration) {
                if (!this.options.dryRun) {
                  await this.env.KV_SNAPS.put(key.name, JSON.stringify(migrationResult.snapshot));
                }
                
                result.migrated++;
                result.details.push({
                  type: 'snapshot',
                  id: snapshot.id,
                  action: 'migrated',
                  message: `Migrated snapshot ${snapshot.id}`,
                  legacyFields: migrationResult.legacyFields,
                  newFields: migrationResult.newFields
                });

                if (this.options.verbose) {
                  console.log(`✅ Migrated snapshot ${snapshot.id}`);
                }
              } else {
                result.details.push({
                  type: 'snapshot',
                  id: snapshot.id,
                  action: 'skipped',
                  message: `Snapshot ${snapshot.id} already migrated`
                });
              }

            } catch (error: any) {
              result.errors++;
              result.details.push({
                type: 'snapshot',
                id: key.name,
                action: 'error',
                message: `Failed to migrate snapshot: ${error.message}`
              });

              if (!this.options.skipErrors) {
                throw error;
              }

              console.error(`❌ Error migrating snapshot ${key.name}:`, error);
            }
          }
        }

        if (this.options.verbose) {
          console.log(`📊 Processed ${totalProcessed} snapshots...`);
        }

      } while (cursor);

      result.duration = Date.now() - startTime;
      console.log(`✅ Snapshot migration complete: ${result.migrated} migrated, ${result.errors} errors`);

    } catch (error: any) {
      result.success = false;
      result.errors++;
      result.details.push({
        type: 'snapshot',
        id: 'system',
        action: 'error',
        message: `Snapshot migration failed: ${error.message}`
      });
      console.error('❌ Snapshot migration failed:', error);
    }

    return result;
  }

  /**
   * Migrate individual user to new schema
   */
  private migrateUserToNewSchema(user: any): {
    user: UserRecord;
    needsMigration: boolean;
    legacyFields: string[];
    newFields: string[];
  } {
    const now = Date.now();
    const legacyFields: string[] = [];
    const newFields: string[] = [];
    let needsMigration = false;

    // Check if already migrated
    if (user.analytics && user.subscription && user.status && user.updatedAt) {
      return { user, needsMigration: false, legacyFields: [], newFields: [] };
    }

    // Initialize analytics if missing
    if (!user.analytics) {
      user.analytics = { ...DEFAULT_USER_ANALYTICS };
      user.analytics.lastActiveAt = user.lastLoginAt || user.createdAt;
      newFields.push('analytics');
      needsMigration = true;
    }

    // Initialize subscription if missing
    if (!user.subscription) {
      user.subscription = { ...DEFAULT_SUBSCRIPTION };
      newFields.push('subscription');
      needsMigration = true;
    }

    // Migrate legacy subscription fields
    if (user.subscriptionStatus && user.subscription.status === 'none') {
      user.subscription.status = user.subscriptionStatus;
      legacyFields.push('subscriptionStatus');
      newFields.push('subscription.status');
      needsMigration = true;
    }

    if (user.stripeCustomerId && !user.subscription.stripeCustomerId) {
      user.subscription.stripeCustomerId = user.stripeCustomerId;
      legacyFields.push('stripeCustomerId');
      newFields.push('subscription.stripeCustomerId');
      needsMigration = true;
    }

    if (user.stripeSubscriptionId && !user.subscription.stripeSubscriptionId) {
      user.subscription.stripeSubscriptionId = user.stripeSubscriptionId;
      legacyFields.push('stripeSubscriptionId');
      newFields.push('subscription.stripeSubscriptionId');
      needsMigration = true;
    }

    if (user.trialStartedAt && !user.subscription.trialStart) {
      user.subscription.trialStart = user.trialStartedAt;
      legacyFields.push('trialStartedAt');
      newFields.push('subscription.trialStart');
      needsMigration = true;
    }

    if (user.trialEndsAt && !user.subscription.trialEnd) {
      user.subscription.trialEnd = user.trialEndsAt;
      legacyFields.push('trialEndsAt');
      newFields.push('subscription.trialEnd');
      needsMigration = true;
    }

    if (user.subscriptionStartedAt && !user.subscription.currentPeriodStart) {
      user.subscription.currentPeriodStart = user.subscriptionStartedAt;
      legacyFields.push('subscriptionStartedAt');
      newFields.push('subscription.currentPeriodStart');
      needsMigration = true;
    }

    if (user.subscriptionEndsAt && !user.subscription.currentPeriodEnd) {
      user.subscription.currentPeriodEnd = user.subscriptionEndsAt;
      legacyFields.push('subscriptionEndsAt');
      newFields.push('subscription.currentPeriodEnd');
      needsMigration = true;
    }

    if (user.lastPaymentAt && !user.subscription.lastPaymentAt) {
      user.subscription.lastPaymentAt = user.lastPaymentAt;
      legacyFields.push('lastPaymentAt');
      newFields.push('subscription.lastPaymentAt');
      needsMigration = true;
    }

    // Add missing timestamp fields
    if (!user.updatedAt) {
      user.updatedAt = user.createdAt;
      newFields.push('updatedAt');
      needsMigration = true;
    }

    if (!user.lastActivityAt) {
      user.lastActivityAt = user.lastLoginAt || user.createdAt;
      newFields.push('lastActivityAt');
      needsMigration = true;
    }

    if (!user.status) {
      user.status = 'active';
      newFields.push('status');
      needsMigration = true;
    }

    return { user: user as UserRecord, needsMigration, legacyFields, newFields };
  }

  /**
   * Migrate individual snapshot to new schema
   */
  private migrateSnapshotToNewSchema(snapshot: any): {
    snapshot: SnapshotRecord;
    needsMigration: boolean;
    legacyFields: string[];
    newFields: string[];
  } {
    const now = Date.now();
    const legacyFields: string[] = [];
    const newFields: string[] = [];
    let needsMigration = false;

    // Check if already migrated
    if (snapshot.analytics && snapshot.metadata && snapshot.updatedAt) {
      return { snapshot, needsMigration: false, legacyFields: [], newFields: [] };
    }

    // Initialize analytics if missing
    if (!snapshot.analytics) {
      snapshot.analytics = { ...DEFAULT_SNAPSHOT_ANALYTICS };
      newFields.push('analytics');
      needsMigration = true;
    }

    // Initialize metadata if missing
    if (!snapshot.metadata) {
      snapshot.metadata = { ...DEFAULT_SNAPSHOT_METADATA };
      newFields.push('metadata');
      needsMigration = true;
    }

    // Migrate legacy fields to new structure
    if (snapshot.createdBy && !snapshot.metadata.createdBy) {
      snapshot.metadata.createdBy = snapshot.createdBy;
      legacyFields.push('createdBy');
      newFields.push('metadata.createdBy');
      needsMigration = true;
    }

    if (snapshot.createdAt && !snapshot.metadata.createdAt) {
      snapshot.metadata.createdAt = snapshot.createdAt;
      legacyFields.push('createdAt');
      newFields.push('metadata.createdAt');
      needsMigration = true;
    }

    if (snapshot.expiresAt && !snapshot.metadata.expiresAt) {
      snapshot.metadata.expiresAt = snapshot.expiresAt;
      legacyFields.push('expiresAt');
      newFields.push('metadata.expiresAt');
      needsMigration = true;
    }

    if (snapshot.public !== undefined && snapshot.metadata.public === undefined) {
      snapshot.metadata.public = snapshot.public;
      legacyFields.push('public');
      newFields.push('metadata.public');
      needsMigration = true;
    }

    if (snapshot.password && !snapshot.metadata.password) {
      snapshot.metadata.password = snapshot.password;
      legacyFields.push('password');
      newFields.push('metadata.password');
      needsMigration = true;
    }

    if (snapshot.files && !snapshot.metadata.files) {
      snapshot.metadata.files = snapshot.files;
      legacyFields.push('files');
      newFields.push('metadata.files');
      needsMigration = true;
    }

    // Add missing timestamp fields
    if (!snapshot.updatedAt) {
      snapshot.updatedAt = snapshot.createdAt || now;
      newFields.push('updatedAt');
      needsMigration = true;
    }

    if (!snapshot.lastViewedAt) {
      snapshot.lastViewedAt = snapshot.createdAt || now;
      newFields.push('lastViewedAt');
      needsMigration = true;
    }

    return { snapshot: snapshot as SnapshotRecord, needsMigration, legacyFields, newFields };
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<{
    totalUsers: number;
    migratedUsers: number;
    totalSnapshots: number;
    migratedSnapshots: number;
    legacyUsers: number;
    legacySnapshots: number;
  }> {
    let totalUsers = 0;
    let migratedUsers = 0;
    let totalSnapshots = 0;
    let migratedSnapshots = 0;

    // Count users
    let cursor: string | undefined;
    do {
      const userList = await this.env.KV_USERS.list({ prefix: 'user:', cursor, limit: 1000 });
      cursor = userList.cursor as string | undefined;
      
      for (const key of userList.keys) {
        if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
          totalUsers++;
          
          const userRaw = await this.env.KV_USERS.get(key.name);
          if (userRaw) {
            const user = JSON.parse(userRaw);
            if (user.analytics && user.subscription && user.status && user.updatedAt) {
              migratedUsers++;
            }
          }
        }
      }
    } while (cursor);

    // Count snapshots
    cursor = undefined;
    do {
      const snapList = await this.env.KV_SNAPS.list({ prefix: 'snap:', cursor, limit: 1000 });
      cursor = snapList.cursor as string | undefined;
      
      for (const key of snapList.keys) {
        if (key.name.startsWith('snap:') && !key.name.includes(':', 5)) {
          totalSnapshots++;
          
          const snapRaw = await this.env.KV_SNAPS.get(key.name);
          if (snapRaw) {
            const snapshot = JSON.parse(snapRaw);
            if (snapshot.analytics && snapshot.metadata && snapshot.updatedAt) {
              migratedSnapshots++;
            }
          }
        }
      }
    } while (cursor);

    return {
      totalUsers,
      migratedUsers,
      totalSnapshots,
      migratedSnapshots,
      legacyUsers: totalUsers - migratedUsers,
      legacySnapshots: totalSnapshots - migratedSnapshots
    };
  }
}
