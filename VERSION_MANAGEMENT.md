# QuickStage Version Management & Deployment

This document covers version management, deployment procedures, and schema evolution for the QuickStage project.

## 🚀 Deployment Process

### **Current Deployment Status**

- **Worker**: ✅ Deployed with new schema and analytics
- **Web App**: ✅ Ready for deployment with schema updates
- **Extension**: ✅ Ready for deployment
- **Database**: ✅ Schema migration completed

### **Deployment Order**

**For schema and analytics updates (current deployment):**
1. **Worker First** - Contains new data schema and analytics endpoints
2. **Web App Second** - Updated to use new schema with fallbacks
3. **Extension** - No changes needed for this deployment

### **Deployment Commands**

```bash
# Deploy Worker (Backend)
cd infra
npx wrangler deploy

# Deploy Web App (Frontend)
cd apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy dist --project-name=quickstage

# Or use the automated script
./deploy-fix.sh
```

## 📊 Schema Evolution

### **Recent Schema Changes**

**Version 2.0 - Analytics & Modern Schema (Current)**
- ✅ **New User Schema**: Nested subscription and analytics objects
- ✅ **Analytics Manager**: Comprehensive event tracking system
- ✅ **Backward Compatibility**: Legacy fields maintained for zero downtime
- ✅ **Migration Functions**: Built-in schema migration helpers

**Key Improvements:**
- **Organized Data**: Subscription data now in dedicated `user.subscription` object
- **Analytics Tracking**: 20+ event types for comprehensive insights
- **Future-Proof**: Extensible schema design for growth
- **Zero Downtime**: Seamless migration from legacy schema

### **Schema Migration Status**

- ✅ **Backend Migration**: All endpoints updated to use new schema
- ✅ **Frontend Migration**: All components updated with fallbacks
- ✅ **Data Integrity**: Legacy data preserved and accessible
- ✅ **Testing**: All tests passing with new schema

### **Migration Functions**

The following migration helpers are available in `apps/worker/src/migrate-schema.ts`:

```typescript
// User migration
migrateUserToNewSchema(user: any): UserRecord
createNewUserWithSchema(uid: string, name: string, email: string, role: string, plan: string, password?: string, googleId?: string): UserRecord

// Snapshot migration
migrateSnapshotToNewSchema(snapshot: any): SnapshotRecord
createNewSnapshotWithSchema(id: string, ownerUid: string, name: string, expiryDays: number, password?: string, isPublic?: boolean): SnapshotRecord

// Bulk migration
migrateAllUsersToNewSchema(c: any): Promise<void>
migrateAllSnapshotsToNewSchema(c: any): Promise<void>
```

## 🔍 Analytics & Monitoring

### **New Analytics Capabilities**

**Event Types Tracked:**
- **User Lifecycle**: Registration, login, profile updates, deletion
- **Snapshot Activity**: Creation, viewing, expiration, extension
- **System Health**: Errors, unauthorized access, cleanup operations
- **Billing Events**: Payments, subscriptions, trial management

**Analytics Storage:**
- **KV_ANALYTICS**: New namespace for raw analytics events
- **Real-time Metrics**: Live user activity and system performance
- **Historical Data**: Comprehensive event history for insights

### **Debug Endpoints**

**Superadmin Access Required:**
- `GET /debug/stats` - System statistics and subscription breakdown
- `GET /debug/users` - User listing with analytics data
- `GET /debug/snapshots` - Snapshot listing and metadata
- `GET /debug/export` - Complete data export for backup/analysis
- `GET /debug/health` - System health check (public)

## 🧪 Testing & Quality Assurance

### **Current Test Status**

✅ **All Tests Passing**: 65 tests across 7 test files
- **Schema Compatibility**: Tests verify both new and legacy data access
- **Analytics Integration**: Tests cover analytics event tracking
- **Backward Compatibility**: Tests ensure legacy functionality preserved

### **Test Coverage**

- **🏠 Landing Page**: Navigation, rotating text, interactive background
- **🔐 Authentication**: Login/signup flows, form validation, Google OAuth
- **📊 Dashboard**: User management, plan-specific content, mobile menu
- **⚙️ Settings**: Profile management, password changes, account deletion
- **👑 Admin Panel**: User management, system statistics, role-based access
- **👁️ Viewer**: Snapshot display, file handling, navigation

## 🔧 Maintenance & Updates

### **Schema Evolution Guidelines**

**When Adding New Fields:**
1. **Extend New Schema**: Add to nested objects (e.g., `user.subscription.newField`)
2. **Maintain Legacy**: Keep existing fields functional
3. **Use Fallbacks**: Implement `newField || legacyField || defaultValue`
4. **Update Migrations**: Add migration logic in `migrate-schema.ts`
5. **Test Compatibility**: Verify both new and legacy access work

**Example Implementation:**
```typescript
// ✅ Correct: Use fallbacks for backward compatibility
const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
const trialEnd = user.subscription?.trialEnd || user.trialEndsAt;

// ❌ Incorrect: Only use new schema
const subscriptionStatus = user.subscription.status; // Will fail for legacy users
```

### **Analytics Maintenance**

**Adding New Event Types:**
1. **Extend AnalyticsEventType**: Add new event to union type
2. **Update AnalyticsManager**: Implement tracking logic
3. **Add to Endpoints**: Integrate tracking in relevant API endpoints
4. **Test Tracking**: Verify events are properly recorded
5. **Update Documentation**: Document new analytics capabilities

## 📈 Future Roadmap

### **Planned Enhancements**

- **Advanced Analytics**: User behavior patterns and insights
- **Performance Monitoring**: Real-time system performance metrics
- **Custom Dashboards**: Configurable analytics views for admins
- **Data Export**: Enhanced data export and reporting capabilities

### **Schema Evolution Plan**

- **Phase 1**: ✅ Complete (Current - Analytics & Modern Schema)
- **Phase 2**: Enhanced metadata and tagging system
- **Phase 3**: Advanced user preferences and settings
- **Phase 4**: Comprehensive audit logging and compliance

## 🚨 Critical Notes

### **Deployment Requirements**

1. **Schema Compatibility**: Never deploy changes that break existing data access
2. **Backward Compatibility**: Always maintain legacy field support
3. **Migration Testing**: Test schema migrations thoroughly before deployment
4. **Analytics Continuity**: Ensure analytics tracking continues during updates

### **Maintenance Requirements**

1. **Test Coverage**: Maintain comprehensive test coverage for all schema changes
2. **Documentation**: Keep this guide and README.md updated
3. **Migration Safety**: Use built-in migration functions for all schema changes
4. **Performance**: Monitor analytics performance impact on system

**Remember**: The goal is seamless schema evolution without breaking existing functionality or user experience.
