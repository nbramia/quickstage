# QuickStage Version Management & Deployment

This document covers version management, deployment procedures, and schema evolution for the QuickStage project.

## 🚀 Deployment Process

### **Current Deployment Status (Jan 2, 2025)**

- **Worker**: ✅ Deployed with enhanced UI system and comprehensive testing
- **Web App**: ✅ Deployed with unified typography and responsive navigation
- **Extension**: ✅ Ready for deployment
- **Database**: ✅ All KV namespaces and Durable Objects active

### **Latest Release - v2.6.0 (Jan 5, 2025)**

**AI Analysis MutationObserver Fix & Enhanced Error Handling**

This release fixes the critical MutationObserver error in the AI analysis feature and adds comprehensive error handling for better user experience.

**AI Analysis Fixes:**
- ✅ **MutationObserver Error Fix**: Resolved "parameter 1 is not of type 'Node'" error in AI analysis
- ✅ **Enhanced Error Handling**: Added specific error messages for different failure types
- ✅ **Retry Mechanism**: Built-in retry functionality with user-friendly error messages
- ✅ **DOM Safety**: Proper null checks and timing delays to prevent browser compatibility issues
- ✅ **Iframe Handling**: Improved iframe loading and content access for AI analysis
- ✅ **Browser Compatibility**: Enhanced error handling for MutationObserver and iframe-related issues

**Technical Implementation:**
- ✅ **AISuggestionsPanel**: Enhanced with comprehensive error handling and retry logic
- ✅ **Viewer Component**: Added iframe error handling and loading delays
- ✅ **Error Categorization**: Specific error messages for different failure scenarios
- ✅ **Retry Counter**: Visual retry counter with reset functionality
- ✅ **DOM Timing**: Added delays to ensure DOM is ready before AI analysis

**Files Modified:**
- `AISuggestionsPanel.tsx`: Enhanced error handling, retry mechanism, and DOM safety
- `Viewer.tsx`: Added iframe error handling and AI panel initialization delays
- `README.md`: Updated AI assistant documentation with error handling details
- `VERSION_MANAGEMENT.md`: This file - documenting the AI analysis fixes

### **Previous Release - v2.5.0 (Jan 2, 2025)**

**Admin Dashboard Snapshots Tab & Component Reuse**

This release adds a new "Snapshots" tab to the AdminDashboard that displays ALL snapshots from ALL users, while maintaining code reusability and consistency.

**New Admin Dashboard Features:**
- ✅ **Snapshots Tab**: New tab in AdminDashboard showing all snapshots across all users
- ✅ **Component Reuse**: Reuses SnapshotDashboard component from main Dashboard for consistency
- ✅ **Admin API Endpoint**: New `/admin/snapshots` endpoint provides all snapshots across users
- ✅ **Code Reuse Architecture**: No code duplication - AdminDashboard references same components as Dashboard
- ✅ **Automatic Updates**: When Dashboard components are updated, AdminDashboard inherits changes
- ✅ **Unified Interface**: Same UI/UX as main Dashboard but with admin-level data access

**Technical Implementation:**
- ✅ **SnapshotDashboard Component**: Extracted shared component from Dashboard for reuse
- ✅ **Admin API Integration**: New endpoint in worker for fetching all snapshots
- ✅ **State Management**: Admin-specific state for snapshots, loading, and error handling
- ✅ **Tab Navigation**: Added snapshots tab to existing admin interface
- ✅ **TypeScript Support**: Full type safety with proper error handling

**Files Modified:**
- `SnapshotDashboard.tsx`: New shared component extracted from Dashboard
- `Dashboard.tsx`: Refactored to use shared SnapshotDashboard component
- `AdminDashboard.tsx`: Added snapshots tab with shared component integration
- `apps/worker/src/index.ts`: Added `/admin/snapshots` endpoint
- `README.md`: Updated feature list to include Admin Dashboard
- `HOW_TO.md`: Added admin dashboard documentation and guidelines
- `VERSION_MANAGEMENT.md`: This file - documenting the new feature

### **Previous Release - v2.4.0 (Jan 2, 2025)**

**Follow System & Enhanced Notifications**

This release adds a comprehensive follow system allowing users to subscribe to snapshot notifications for comments and reviews.

**New Follow System:**
- ✅ **Follow/Unfollow Snapshots**: Users can follow any snapshot to receive notifications for new comments and review updates
- ✅ **Visual Indicators**: Plus icon (+) for unfollowed snapshots, checkmark icon (✓) for followed snapshots
- ✅ **Real-time Feedback**: "Followed" and "Unfollowed" confirmation messages with 2-second display
- ✅ **Settings Integration**: Followed snapshots appear in the Settings page subscription list
- ✅ **API Integration**: Uses existing subscription system with snapshot-level subscriptions
- ✅ **Loading States**: Spinner animation during follow/unfollow operations
- ✅ **Error Handling**: Graceful error handling with user-friendly messages

**Technical Implementation:**
- ✅ **SnapshotTable Enhancement**: Added follow/unfollow button in Actions column
- ✅ **State Management**: Real-time tracking of followed snapshots with Set-based state
- ✅ **API Endpoints**: Leverages existing `/api/snapshots/:id/subscribe` and `/api/snapshots/:id/unsubscribe` endpoints
- ✅ **Notification System**: Integrated with existing notification infrastructure for comment and review alerts
- ✅ **TypeScript Support**: Full type safety with proper error handling

**Files Modified:**
- `SnapshotTable.tsx`: Added follow/unfollow functionality with visual indicators
- `README.md`: Updated feature list to include Follow System
- `HOW_TO.md`: Added follow system documentation and guidelines
- `VERSION_MANAGEMENT.md`: This file - documenting the new feature

### **Previous Release - v2.3.0 (Jan 2, 2025)**

**Major UI/UX Overhaul & Typography System**

This release addressed critical UI/UX issues and implemented a comprehensive font system for visual consistency across the platform.

**UI/UX Improvements:**
- ✅ **Unified Header System**: Added consistent headers to Settings and Admin pages with mobile hamburger menu
- ✅ **Enhanced Notification Bell**: High-quality Heroicons bell icon with proper sizing (w-5 h-5, p-1.5)
- ✅ **Improved Header Alignment**: QuickStage logo positioned left with `items-center` class for proper alignment
- ✅ **Streamlined Sidebar Icons**: Removed duplicate emoji shield admin icon, kept SVG shield with checkmark
- ✅ **Mobile Navigation**: Hamburger menu functionality on Settings and Admin pages for responsive design

**Typography System Implementation:**
- ✅ **Inconsolata Font**: Applied to all headers (h1, h2, h3) across Dashboard, Settings, Admin pages
- ✅ **Poppins Font**: Set as default body text and button font system-wide
- ✅ **Share Tech Mono**: Reserved for QuickStage wordmark and brand elements only
- ✅ **Font Consistency**: Eliminated system font fallbacks and resolved monospace inconsistencies
- ✅ **Tailwind Configuration**: Updated to use custom font classes (font-inconsolata, font-poppins, font-share-tech-mono)

**Technical Achievements:**
- ✅ **Component Restructuring**: Settings.tsx and AdminDashboard.tsx now use unified sidebar layout
- ✅ **Test Suite Updates**: Fixed failing Dashboard tests ("Test Admin" vs "Test User") for deployment readiness
- ✅ **Cross-Component Consistency**: Standardized ProjectSidebar font application and navigation highlighting
- ✅ **Deployment Success**: All 144 tests passing, full-stack deployment completed

**Files Modified:**
- `NotificationBell.tsx`: Upgraded icon quality and sizing
- `ProjectSidebar.tsx`: Removed duplicate admin icon, fixed Dashboard navigation highlighting
- `Settings.tsx`: Complete header restructure with mobile hamburger menu
- `AdminDashboard.tsx`: Added consistent header navigation
- `Dashboard.test.tsx`: Fixed failing test expectations
- Font system applied across all components

### **Automated Deployment Process**

**Current Deployment Method:**
```bash
./deploy-with-tests.sh
```

**Deployment Flow:**
1. **Phase 1: Worker Testing & Deployment**
   - Install worker dependencies
   - Run quick tests (utilities)
   - Run core tests (routes & auth)
   - Run subscription scenario tests
   - Build TypeScript
   - Deploy to Cloudflare Workers
   - Verify deployment

2. **Phase 2: Web App Testing & Deployment**  
   - Install web app dependencies
   - Run critical component tests (Landing, Login, Dashboard)
   - Build with Vite
   - Deploy to Cloudflare Pages
   - Verify deployment

**Test Results (v2.3.0):**
- Worker Tests: 97 passed (quick + core + subscriptions)
- Web App Tests: 47 passed (critical components)
- **Total: 144 tests passed**

**Deployment URLs:**
- Backend Worker: https://quickstage-worker.nbramia.workers.dev
- Frontend Web App: https://quickstage.pages.dev

### **Manual Deployment Commands (If Needed)**

```bash
# Deploy Worker (Backend)
cd apps/worker
npx wrangler deploy

# Deploy Web App (Frontend)
cd apps/web
pnpm build
npx wrangler pages deploy dist --project-name=quickstage

# Full-stack automated deployment (RECOMMENDED)
./deploy-with-tests.sh
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

## 🔧 Extension Version Management

### **⚠️ CRITICAL: Extension Release Process**

**NEVER manually update version numbers! Always use the automated release workflow.**

### **Proper Extension Release Process:**

```bash
cd apps/extension
npm run release:full
```

**This automated script:**
1. ✅ Bumps version in extension/package.json
2. ✅ Builds the extension
3. ✅ Packages the .vsix file
4. ✅ Copies to web app public directory (quickstage.vsix + versioned file)
5. ✅ **Updates worker/src/version-info.ts** with new version
6. ✅ **Updates web app version files**
7. ✅ Builds and deploys the worker automatically
8. ✅ Verifies all components are in sync

### **Issue Resolution: Version Mismatch (Jan 2025)**

**Problem**: Extension downloaded version 32 instead of 33
- Extension package.json showed v0.0.33 ✅ 
- VSIX file existed for v0.0.33 ✅
- **Worker version-info.ts still showed v0.0.32** ❌

**Root Cause**: Release workflow wasn't run for v0.0.33, so worker version wasn't updated

**Resolution Applied:**
1. ✅ Manually updated `apps/worker/src/version-info.ts` to v0.0.33
2. ✅ Deployed worker with `./deploy-with-tests.sh`
3. ✅ Extension downloads now show correct version

### **Prevention: ALWAYS Use Release Workflow**

**❌ DON'T manually update:**
- extension/package.json version numbers
- worker/src/version-info.ts
- web app version files

**✅ DO use the automated process:**
```bash
cd apps/extension
npm run release:full  # This syncs ALL version numbers automatically
```

### **Post-Release Verification:**

```bash
# 1. Check extension version endpoint
curl https://quickstage.tech/api/extensions/version

# 2. Verify download returns correct version
curl -I https://quickstage.pages.dev/quickstage.vsix

# 3. Test download from dashboard UI
```

**Expected Response:**
```json
{
  "version": "0.0.33",  // Should match extension/package.json
  "filename": "quickstage.vsix",
  "buildDate": "..."
}
```

## 🚨 Critical Notes

### **Deployment Requirements**

1. **Schema Compatibility**: Never deploy changes that break existing data access
2. **Backward Compatibility**: Always maintain legacy field support
3. **Extension Version Sync**: Always use release workflow to keep versions in sync
4. **Migration Testing**: Test schema migrations thoroughly before deployment
5. **Analytics Continuity**: Ensure analytics tracking continues during updates

### **Maintenance Requirements**

1. **Test Coverage**: Maintain comprehensive test coverage for all schema changes
2. **Extension Testing**: Verify extension downloads after each release
3. **Version Verification**: Check that all components report same version
4. **Documentation**: Keep this guide and README.md updated
5. **Migration Safety**: Use built-in migration functions for all schema changes
6. **Performance**: Monitor analytics performance impact on system

**Remember**: The goal is seamless schema evolution without breaking existing functionality or user experience.
