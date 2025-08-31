# QuickStage Development Guide

This guide covers development workflows, testing, and deployment for the QuickStage project.

## 🧪 Testing Suite

### **⚠️ CRITICAL: Test Maintenance Requirements**

**Future developers and AI agents working on this project MUST:**

1. **Keep Tests Updated**: Every time you change functionality, update the corresponding tests to match the new behavior
2. **Add New Tests**: When adding new features or user flows, create comprehensive tests for them
3. **Run Tests Before Deployment**: Always run `pnpm test` before deploying to catch regressions
4. **Maintain Test Coverage**: Ensure all primary user paths, button interactions, and edge cases remain covered
5. **Update Test Documentation**: Keep this section and `README.md` current with any testing changes

**Why This Matters**: The testing suite is designed to catch breaking changes early and ensure the application "just works" as Nathan prioritizes. Neglecting test maintenance will lead to deployment failures and user-facing bugs.

### **Current Test Status**

✅ **Comprehensive Test Coverage**: 143 tests across 13 test files

**Core Component Tests:**
- `Login.test.tsx` - 13 tests ✅
- `Landing.test.tsx` - 29 tests ✅  
- `Dashboard.test.tsx` - 5 tests ✅
- `Settings.test.tsx` - 6 tests ✅
- `AdminDashboard.test.tsx` - 5 tests ✅
- `Viewer.test.tsx` - 5 tests ✅
- `Simple.test.tsx` - 2 tests ✅

**New Feature Component Tests:**
- `ProjectSidebar.test.tsx` - Project management tests ✅
- `SnapshotTable.test.tsx` - Enhanced dashboard tests ✅
- `CommentSystem.test.tsx` - Comment functionality tests ✅
- `CommentModal.test.tsx` - Comment modal interface tests ✅
- `DashboardWidgets.test.tsx` - Dashboard widget tests ✅
- `BulkOperations.test.tsx` - Bulk operations tests ✅

**Test Coverage:** All major features including project folders, enhanced comments, review workflows, and advanced dashboard functionality

### **Test Coverage**

- **🏠 Landing Page**: Navigation, rotating text, interactive background, mobile responsiveness
- **🔐 Authentication**: Login/signup flows, form validation, Google OAuth
- **📊 Dashboard**: User management, plan-specific content, mobile hamburger menu
- **⚙️ Settings**: Profile management, password changes, account deletion
- **👑 Admin Panel**: User management, system statistics, role-based access
- **👁️ Viewer**: Snapshot display, file handling, navigation

### **Running Tests**

```bash
# Run all tests
pnpm test             # ~1-2 minutes

# Run specific test file
pnpm test "src/test/components/Dashboard.test.tsx"

# Development mode
pnpm test:watch       # Watch mode
pnpm test:ui          # Visual test runner
```

### **Test Maintenance Workflow**

**When Making Changes:**
1. **Before**: Run `pnpm test` to establish baseline
2. **During**: Update tests as you modify functionality
3. **After**: Run `pnpm test` again to verify no regressions
4. **Document**: Update test files and documentation to reflect changes

**When Adding Features:**
1. **Design**: Plan test coverage for new user flows
2. **Implement**: Create tests alongside feature development
3. **Verify**: Ensure new tests pass and existing tests still pass
4. **Integrate**: Add new tests to the appropriate test suite

**Remember**: Tests are not optional - they're your safety net to ensure QuickStage continues to "just work" as Nathan expects.

## 📊 Data Schema & Analytics

### **⚠️ CRITICAL: Schema Evolution Requirements**

**Future developers and AI agents working on this project MUST:**

1. **Maintain Backward Compatibility**: Always preserve legacy fields when adding new schema features
2. **Use Migration Functions**: Use the built-in migration helpers in `apps/worker/src/migrate-schema.ts`
3. **Update Both Schemas**: When modifying user/snapshot data, update both new and legacy fields
4. **Test Schema Changes**: Verify that existing data continues to work after schema modifications
5. **Document Changes**: Update this guide and `README.md` when making schema changes

**Why This Matters**: The application maintains backward compatibility to ensure zero downtime during schema evolution. Neglecting this will break existing user data and cause application failures.

### **Current Schema Structure**

#### **User Record Schema**
```typescript
interface UserRecord {
  // Core fields
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  status: 'active' | 'deactivated';
  
  // New nested subscription schema
  subscription?: {
    status: 'none' | 'trial' | 'active' | 'cancelled' | 'past_due';
    trialEnd?: number;
    currentPeriodStart?: number;
    lastPaymentAt?: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  
  // Legacy fields (maintained for backward compatibility)
  plan: 'free' | 'pro';
  subscriptionStatus?: string;
  trialEndsAt?: number;
  subscriptionStartedAt?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Analytics data
  analytics: UserAnalytics;
}
```

#### **Analytics Event Types**
- **User Events**: `user_login`, `user_registered`, `user_deleted`, `profile_updated`
- **Snapshot Events**: `snapshot_created`, `snapshot_viewed`, `snapshot_expired`
- **System Events**: `error_occurred`, `unauthorized_access`, `cleanup_completed`
- **Billing Events**: `payment_succeeded`, `payment_failed`, `subscription_started`

### **Schema Migration Workflow**

**When Adding New Fields:**
1. **Add to New Schema**: Extend the nested objects (e.g., `user.subscription.newField`)
2. **Maintain Legacy Fields**: Keep existing fields functional for backward compatibility
3. **Use Fallback Pattern**: Implement `newField || legacyField || defaultValue`
4. **Update Migration Functions**: Add migration logic in `migrate-schema.ts`
5. **Test Both Paths**: Verify new and legacy data access work correctly

**Example Fallback Pattern:**
```typescript
// ✅ Correct: Use fallbacks for backward compatibility
const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
const trialEnd = user.subscription?.trialEnd || user.trialEndsAt;

// ❌ Incorrect: Only use new schema
const subscriptionStatus = user.subscription.status; // Will fail for legacy users
```

**Remember**: The goal is seamless schema evolution without breaking existing functionality.

## 🚀 Development Workflow

### **Pre-Development Setup**

1. **Install Dependencies**: `pnpm install`
2. **Environment Setup**: Copy `.env.example` to `.env` and configure
3. **Start Development**: `pnpm dev`

### **Making Changes**

1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Implement your feature or fix
3. **Update Tests**: Ensure all tests pass and add new tests as needed
4. **Test Locally**: Run `pnpm test` to verify no regressions
5. **Commit Changes**: Use descriptive commit messages

### **Pre-Deployment Checklist**

- [ ] All tests pass (`pnpm test`)
- [ ] Code builds successfully (`pnpm build`)
- [ ] Environment variables are configured
- [ ] No console errors or warnings
- [ ] Mobile responsiveness tested
- [ ] Cross-browser compatibility verified

## 🔧 Development Commands

### **Core Commands**

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev              # Starts web app + worker locally

# Build for production
pnpm build            # Builds web app
cd apps/worker && pnpm build  # Builds worker

# Run tests
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:ui          # Visual test runner

# Clean and rebuild
pnpm clean            # Remove all build artifacts
pnpm rebuild          # Clean install + build
```

### **Service-Specific Commands**

```bash
# Web App
pnpm --filter @quickstage/web dev
pnpm --filter @quickstage/web build
pnpm --filter @quickstage/web test

# Worker
pnpm --filter @quickstage/worker dev
pnpm --filter @quickstage/worker build
pnpm --filter @quickstage/worker deploy

# Extension
pnpm --filter @quickstage/extension build
pnpm --filter @quickstage/extension package
```

## 🚀 Deployment

### **Deployment Order**

**For routing fixes and general updates:**
1. **Worker First** - Contains API logic and business rules
2. **Web App Second** - Serves the dashboard and extension

**For extension updates only:**
1. **Web App Only** - Extension is served directly from web app's public directory

**For worker changes (API updates, etc.):**
1. **Worker First** - Contains API logic and business rules
2. **Web App Second** - Serves the dashboard and extension

### **Deployment Commands**

```bash
# Deploy Worker
cd infra
npx wrangler deploy

# Deploy Web App
cd apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy dist --project-name=quickstage

# Or use the automated script
./deploy-fix.sh
```

### **Post-Deployment Verification**

1. **Check Worker**: Verify API endpoints respond correctly
2. **Check Web App**: Ensure dashboard loads and functions
3. **Check Extension**: Verify extension downloads work
4. **Run Critical Tests**: Ensure core functionality works in production

## 🐛 Troubleshooting

### **Common Issues**

**Tests Failing:**
- Check that all dependencies are installed: `pnpm install`
- Verify test environment is set up correctly
- Check for TypeScript compilation errors
- Ensure mocks are properly configured

**Build Failures:**
- Clear build cache: `pnpm clean`
- Reinstall dependencies: `pnpm install`
- Check for TypeScript errors
- Verify environment variables

**Deployment Issues:**
- Check Cloudflare credentials and permissions
- Verify environment variables in Cloudflare
- Check Worker logs for errors
- Ensure proper deployment order

### **Getting Help**

1. **Check Logs**: Look at browser console and Worker logs
2. **Run Tests**: Use `pnpm test` to identify issues
3. **Check Documentation**: Review this guide and README.md
4. **Create Issue**: Document the problem with steps to reproduce

## 📚 Additional Resources

- **README.md**: Project overview and quick start
- **VERSION_MANAGEMENT.md**: Detailed deployment and version management
- **TESTING.md**: Comprehensive testing documentation
- **Cloudflare Docs**: Worker and Pages documentation
- **React Testing Library**: Testing best practices

## 🎯 Pro Tips

- **Always run tests before committing**: `pnpm test`
- **Use watch mode during development**: `pnpm test:watch`
- **Keep tests simple and focused**: Test behavior, not implementation
- **Update tests when changing functionality**: Don't let tests become outdated
- **Test on mobile devices**: Ensure responsive design works
- **Check browser compatibility**: Test in multiple browsers
- **Monitor performance**: Use browser dev tools to check for performance issues
- **Document changes**: Keep this guide and README.md updated

Remember: The goal is to maintain a robust, reliable application that "just works" for users. Good testing practices are essential to achieving this goal.