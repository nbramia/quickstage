# QuickStage Worker Refactoring Instructions

## **Objective**
Break down `apps/worker/src/index.ts` (currently 4,749 lines) into manageable modules of hundreds of lines each, not thousands.

## **Current State Analysis**
- **File Size**: 4,749 lines
- **Route Count**: 85 API endpoints
- **Already Extracted**: 5 modules (`auth.ts`, `user.ts`, `stripe.ts`, `snapshot.ts`, `worker-utils.ts`)
- **Remaining**: All route handlers, middleware, and utility functions

## **Target Architecture**
The goal is to have `index.ts` serve only as a **route registry** that imports and uses handlers from focused modules.

## **Systematic Refactoring Plan**

### **Phase 1: Route Handler Extraction**

#### **1.1 Authentication Routes Module** (`routes/auth.ts`)
Extract these routes and their handlers:
- `POST /auth/register` (lines ~75-130)
- `POST /auth/login` (lines ~133-183) 
- `POST /auth/google` (lines ~185-306)
- `POST /auth/logout` (lines ~439-452)
- `PUT /auth/profile` (lines ~453-523)
- `POST /auth/change-password` (lines ~524-570)

**Pattern**: Create handler functions like `handleRegister(c)`, `handleLogin(c)`, etc.

#### **1.2 Billing Routes Module** (`routes/billing.ts`)
Extract these routes:
- `POST /billing/start-trial` (lines ~571-644)
- `POST /billing/subscribe` (lines ~645-706)
- `GET /billing/status` (lines ~707-726)
- `POST /billing/cancel` (lines ~727-800)
- `POST /billing/checkout` (if exists)
- `POST /billing/change-payment` (if exists)
- `POST /billing/portal` (if exists)

#### **1.3 Snapshot Routes Module** (`routes/snapshots.ts`)
Extract these routes:
- `POST /snapshots/create` (lines ~801-904)
- `POST /snapshots/finalize` (lines ~1075-1165)
- `GET /snapshots/list` (lines ~1166-1197)
- `GET /snapshots/:id` (lines ~1198-1236)
- `POST /snapshots/:id/expire` (lines ~1237-1266)
- `POST /snapshots/:id/extend` (if exists)
- `POST /snapshots/:id/rotate-password` (if exists)

#### **1.4 Upload Routes Module** (`routes/upload.ts`)
Extract these routes:
- `POST /upload-url` (lines ~905-953)
- `PUT /upload` (lines ~954-1004)
- `PUT /api/upload` (lines ~1005-1074)

#### **1.5 Viewer Routes Module** (`routes/viewer.ts`)
Extract these routes:
- `GET /s/:id` (lines ~1267-1566)
- `GET /s/:id/*` (lines ~1567-1612)
- `GET /snap/:id/*` (lines ~1613-1641)
- `GET /snap/:id` (lines ~1642-1683)
- `POST /s/:id/gate` (lines ~1684-1756)

#### **1.6 Comments Routes Module** (`routes/comments.ts`)
Extract these routes:
- `GET /api/snapshots/:id/comments` (lines ~1757-1766)
- `GET /comments/:snapshotId` (lines ~1767-1775)
- `POST /api/snapshots/:id/comments` (lines ~1776-1838)
- `GET /comments` (lines ~1839-1846)
- `POST /comments` (lines ~1847-1879)
- `GET /comments/:snapshotId` (duplicate, lines ~3323-3352)
- `POST /comments/:snapshotId` (lines ~3353-3407)

#### **1.7 Admin Routes Module** (`routes/admin.ts`)
Extract these routes:
- `GET /admin/purge-expired` (lines ~1880-1886)
- `GET /admin/users` (lines ~2069-2156)
- `POST /admin/users` (lines ~2157-2283)
- `POST /admin/users/:uid/deactivate` (lines ~2284-2363)
- `POST /admin/users/:uid/activate` (lines ~2364-2444)
- `DELETE /admin/users/:uid` (lines ~2445-2597)
- `POST /admin/setup-superadmin` (lines ~2598-2717)
- `POST /admin/cleanup-corrupted-users` (lines ~4080-4217)

#### **1.8 API Routes Module** (`routes/api.ts`)
Extract these routes:
- `POST /api/snapshots/create` (lines ~2718-2786)
- `POST /api/tokens/create` (lines ~2787-2842)
- `GET /api/tokens/list` (lines ~2843-2872)
- `DELETE /api/tokens/:tokenId` (lines ~2873-2922)
- `POST /api/upload-url` (lines ~3040-3078)
- `POST /api/snapshots/finalize` (lines ~3079-3119)
- `GET /api/s/:id/*` (lines ~3120-3161)
- `GET /api/me` (lines ~2057-2068)
- `POST /api/auth/google` (lines ~1936-2056)
- `POST /api/snapshots/:id/extend` (lines ~1887-1903)
- `POST /api/snapshots/:id/expire` (lines ~1904-1918)
- `POST /api/snapshots/:id/rotate-password` (lines ~1919-1935)

#### **1.9 Tokens Routes Module** (`routes/tokens.ts`)
Extract these routes:
- `POST /tokens/create` (lines ~2923-2966)
- `GET /tokens/list` (lines ~2967-2992)
- `DELETE /tokens/:tokenId` (lines ~2993-3039)

#### **1.10 Extensions Routes Module** (`routes/extensions.ts`)
Extract these routes:
- `GET /api/extensions/version` (lines ~3162-3178)
- `GET /api/extensions/download` (lines ~3179-3243)
- `GET /extensions/version` (lines ~3244-3259)
- `GET /extensions/download` (lines ~3260-3322)

#### **1.11 Debug Routes Module** (`routes/debug.ts`)
Extract these routes:
- `GET /debug/analytics/events` (lines ~3408-3461)
- `GET /debug/migration/stats` (lines ~3462-3489)
- `POST /debug/migration/run` (lines ~3490-3546)
- `POST /debug/migration/users` (lines ~3547-3591)
- `POST /debug/migration/snapshots` (lines ~3592-3640)
- `POST /debug/fix-subscription/:uid` (lines ~3984-4029)
- `GET /debug/user/:uid` (lines ~4030-4052)
- `GET /debug/user-by-email/:email` (lines ~4053-4079)
- `GET /debug/users` (lines ~4218-4271)
- `GET /debug/user/:uid` (duplicate, lines ~4272-4310)
- `GET /debug/search/email/:email` (lines ~4311-4361)
- `GET /debug/snapshots` (lines ~4362-4412)
- `GET /debug/snapshot/:id` (lines ~4413-4447)
- `GET /debug/stats` (lines ~4448-4523)
- `GET /debug/export` (lines ~4524-4596)
- `GET /debug/health` (lines ~4597-4620)

#### **1.12 Webhooks Routes Module** (`routes/webhooks.ts`)
Extract these routes:
- `POST /webhooks/stripe` (lines ~3816-3929)

### **Phase 2: Utility Functions Extraction**

#### **2.1 Middleware Module** (`middleware/index.ts`)
Extract:
- CORS configuration (lines ~50-58)
- Any authentication middleware
- Request logging middleware
- Error handling middleware

#### **2.2 Validation Module** (`validation/index.ts`)
Extract:
- Request validation functions
- Schema validation helpers
- Input sanitization functions

#### **2.3 Response Helpers Module** (`helpers/responses.ts`)
Extract:
- Standard response formatters
- Error response helpers
- Success response helpers

### **Phase 3: Implementation Pattern**

#### **3.1 Route Handler Pattern**
For each route module, follow this pattern:

```typescript
// routes/auth.ts
import { Context } from 'hono';
import { getUserByName } from '../user';
import { createNewUserWithSchema } from '../migrate-schema';
import { getAnalyticsManager } from '../worker-utils';

export async function handleRegister(c: Context) {
  const { email, password, name } = await c.req.json();
  
  if (!email || !password || !name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  try {
    // Check if user already exists
    const existingUser = await getUserByName(c, name);
    if (existingUser) {
      return c.json({ error: 'Username already taken' }, 400);
    }
    
    // ... rest of the logic
  } catch (error: any) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
}

export async function handleLogin(c: Context) {
  // ... implementation
}

// ... other handlers
```

#### **3.2 Updated index.ts Pattern**
The new `index.ts` should look like:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import route handlers
import { handleRegister, handleLogin, handleGoogleAuth, handleLogout, handleProfile, handleChangePassword } from './routes/auth';
import { handleStartTrial, handleSubscribe, handleBillingStatus, handleCancel } from './routes/billing';
import { handleCreateSnapshot, handleFinalizeSnapshot, handleListSnapshots, handleGetSnapshot } from './routes/snapshots';
// ... other imports

// Import middleware
import { setupCORS } from './middleware';

const app = new Hono();

// Setup middleware
setupCORS(app);

// Register routes
app.post('/auth/register', handleRegister);
app.post('/auth/login', handleLogin);
app.post('/auth/google', handleGoogleAuth);
app.post('/auth/logout', handleLogout);
app.put('/auth/profile', handleProfile);
app.post('/auth/change-password', handleChangePassword);

app.post('/billing/start-trial', handleStartTrial);
app.post('/billing/subscribe', handleSubscribe);
app.get('/billing/status', handleBillingStatus);
app.post('/billing/cancel', handleCancel);

// ... continue for all routes

export default app;
```

### **Phase 4: Implementation Steps**

#### **4.1 Step-by-Step Process**
1. **Create the route modules** in `apps/worker/src/routes/`
2. **Extract one route group at a time** (start with auth routes)
3. **Test each extraction** by running the worker locally
4. **Update imports** in `index.ts` after each successful extraction
5. **Remove extracted code** from `index.ts` after confirming it works
6. **Repeat** for each route group

#### **4.2 Testing Strategy**
After each extraction:
```bash
cd apps/worker
pnpm build
npx wrangler dev
# Test the extracted routes
curl http://localhost:8787/auth/register -X POST -d '{"test":"data"}'
```

#### **4.3 File Organization**
```
apps/worker/src/
├── index.ts                 # Route registry only (~200-300 lines)
├── routes/
│   ├── auth.ts             # Authentication routes
│   ├── billing.ts          # Billing routes
│   ├── snapshots.ts        # Snapshot routes
│   ├── upload.ts           # Upload routes
│   ├── viewer.ts           # Viewer routes
│   ├── comments.ts         # Comments routes
│   ├── admin.ts            # Admin routes
│   ├── api.ts              # API routes
│   ├── tokens.ts           # Token routes
│   ├── extensions.ts       # Extension routes
│   ├── debug.ts            # Debug routes
│   └── webhooks.ts         # Webhook routes
├── middleware/
│   └── index.ts            # Middleware setup
├── validation/
│   └── index.ts            # Validation helpers
├── helpers/
│   └── responses.ts        # Response helpers
├── auth.ts                 # Already extracted
├── user.ts                 # Already extracted
├── stripe.ts               # Already extracted
├── snapshot.ts             # Already extracted
├── worker-utils.ts         # Already extracted
└── ... other existing files
```

### **Phase 5: Quality Assurance**

#### **5.1 Code Quality Checks**
- **No linter errors** after each extraction
- **All imports resolved** correctly
- **Type safety maintained** throughout
- **No circular dependencies** between modules

#### **5.2 Functionality Verification**
- **All routes work** as before
- **Authentication flows** unchanged
- **Data access patterns** preserved
- **Error handling** maintained

#### **5.3 Performance Considerations**
- **Import efficiency**: Only import what's needed
- **Bundle size**: Ensure no significant increase
- **Cold start time**: Monitor for any degradation

### **Phase 6: Documentation Updates**

#### **6.1 Update README.md**
Add section about the new modular route structure:
```markdown
## Route Architecture
- **`index.ts`**: Route registry and app setup (~200-300 lines)
- **`routes/`**: Organized route handlers by functionality
- **`middleware/`**: Shared middleware and setup
- **`validation/`**: Request validation helpers
- **`helpers/`**: Response and utility helpers
```

#### **6.2 Update HOW_TO.md**
Add guidance for:
- Adding new routes
- Modifying existing routes
- Testing route changes
- Understanding the modular structure

### **Success Criteria**
- **`index.ts` reduced to 200-300 lines** (route registry only)
- **Each route module under 500 lines**
- **All functionality preserved**
- **No breaking changes**
- **Improved maintainability**
- **Clear separation of concerns**

### **Important Notes**
- **Preserve all existing functionality** - this is a refactoring, not a rewrite
- **Test thoroughly** after each extraction
- **Maintain backward compatibility** for all API endpoints
- **Keep the same error handling patterns**
- **Preserve all analytics tracking**
- **Maintain all security measures**

### **Emergency Rollback Plan**
If any issues arise:
1. **Keep the original `index.ts` as backup** (`index.ts.backup`)
2. **Test each extraction individually** before proceeding
3. **Have a rollback strategy** to restore original file if needed
4. **Deploy incrementally** to catch issues early

This refactoring will make the codebase much more maintainable and allow multiple developers to work on different route groups simultaneously.
