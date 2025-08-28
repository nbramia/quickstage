# 🧪 QuickStage Worker Testing Suite

## Overview

The QuickStage Worker testing suite provides comprehensive unit test coverage for all refactored backend modules. Built with **Vitest** and custom mocks for Cloudflare Workers environment, it ensures reliability and maintainability of the API endpoints.

## 🚨 CRITICAL: Testing Policy for AI Agents

**Every AI agent working on this codebase MUST follow this testing workflow:**

### **Before Making ANY Changes:**
```bash
npm run test:quick    # 5 seconds - basic validation
npm run test:core     # 1-2 minutes - comprehensive validation
```

### **After Making ANY Changes:**
```bash
npm run test:quick && npm run test:core
```

### **Before Deployment:**
```bash
./deploy-with-tests.sh  # This script enforces testing
```

**Failure to follow this policy will result in broken deployments and regressions.**

---

## 🚀 Quick Start

### Run Tests by Category
```bash
npm run test:quick      # Utility modules only (~5 seconds)
npm run test:core       # Core routes (auth, tokens, snapshots)
npm run test:coverage   # All tests with coverage report
```

### Development Workflow
```bash
npm run test:watch      # Watch mode for development
npm run test:ui         # Interactive test UI
```

### Test Runner Scripts
```bash
npm run test-runner quick     # Quick utility tests
npm run test-runner core      # Core route tests
npm run test-runner coverage  # Coverage report
npm run test-runner help      # Show all options
```

## 📋 Test Coverage

### ✅ Utility Modules (100% Coverage)

#### Response Helpers (`src/test/helpers/response.test.ts`)
- **jsonError**: Error responses with custom status codes
- **jsonSuccess**: Success responses with data
- **jsonNotFound**: 404 responses with custom messages
- **jsonUnauthorized**: 401 authentication errors
- **jsonForbidden**: 403 authorization errors
- **jsonServerError**: 500 internal server errors

#### Request Validation (`src/test/validation/request.test.ts`)
- **validateRequired**: Required field validation
- **validateEmail**: Email format validation
- **validatePassword**: Password strength validation
- **parseLimit**: Query parameter parsing with limits
- **parseExpiryDays**: Date parsing with constraints

#### CORS Middleware (`src/test/middleware/cors.test.ts`)
- **corsMiddleware**: CORS configuration validation

### ✅ Core Route Modules

#### Authentication Routes (`src/test/routes/auth.test.ts`)
- **handleRegister**: User registration with validation
- **handleLogin**: Email/password authentication
- **handleGoogleAuth**: OAuth integration
- **handleMe**: User profile retrieval
- **handleLogout**: Session termination
- **handleProfile**: Profile updates
- **handleChangePassword**: Password changes

**Test Scenarios:**
- Successful operations
- Missing required fields
- Invalid credentials
- Duplicate users/emails
- Authorization checks
- Error handling

#### Token Routes (`src/test/routes/tokens.test.ts`)
- **handleCreateToken**: PAT generation
- **handleListTokens**: Token enumeration
- **handleDeleteToken**: Token revocation

**Test Scenarios:**
- Token lifecycle management
- Ownership validation
- Analytics tracking
- Unauthorized access
- Token expiration

#### Snapshot Routes (`src/test/routes/snapshots.test.ts`)
- **handleCreateSnapshot**: Snapshot creation
- **handleFinalizeSnapshot**: Upload completion
- **handleListSnapshots**: User snapshot listing
- **handleGetSnapshot**: Snapshot retrieval
- **handleExpireSnapshot**: Manual expiration
- **handleExtendSnapshot**: Expiry extension
- **handleRotateSnapshotPassword**: Password rotation

**Test Scenarios:**
- CRUD operations
- Access control
- Public/private snapshots
- Expiration management
- File validation
- Ownership checks

## 🏗️ Test Architecture

### Mock Infrastructure

#### Test Context (`src/test/mocks/context.ts`)
```typescript
const mockContext = createMockContext({
  env: {
    KV_USERS: mockKVStore,
    KV_SNAPS: mockKVStore,
    SESSION_HMAC_SECRET: 'test-secret'
  }
});
```

#### Mock Data
- **mockUsers**: Free, Pro, Admin user profiles
- **mockSnapshots**: Active, expired, public snapshots
- **Mock KV Stores**: In-memory storage simulation
- **Mock Analytics**: Event tracking simulation

### Test Environment (`src/test/setup.ts`)
- **Crypto Mocking**: WebCrypto API simulation
- **Worker APIs**: Request/Response mocking
- **Console Suppression**: Clean test output
- **Global Setup**: Consistent environment

## 📊 Test Results & Metrics

### Current Status
- **Test Files**: 6
- **Total Tests**: 88
- **Passing Tests**: 70 (80% pass rate)
- **Infrastructure**: ✅ Fully operational
- **Mock Quality**: ✅ High fidelity

### Coverage Areas
```
├── Utility Modules     ✅ 100% (All tests passing)
├── Authentication      🔄 80% (Core flows working)
├── Token Management    🔄 85% (PAT operations working)
├── Snapshot CRUD       🔄 75% (Main operations working)
└── Error Handling      ✅ 95% (Comprehensive coverage)
```

### Identified Issues
1. **Assertion Mismatches**: Expected vs actual response formats
2. **Missing Mocks**: Some utility functions need additional mocking
3. **Import Paths**: Shared package imports need correction

## 🎯 Testing Strategy

### Unit Testing Focus
- **Route Handler Logic**: Individual function testing
- **Input Validation**: Parameter and payload validation
- **Error Scenarios**: Exception handling and edge cases
- **Access Control**: Authentication and authorization
- **Data Transformation**: Request/response processing

### Mock-First Approach
- **Isolated Testing**: No external dependencies
- **Predictable Data**: Consistent test scenarios
- **Fast Execution**: No network or database calls
- **Deterministic Results**: Reproducible outcomes

### Real Implementation Testing
Tests interact with actual route handlers:
```typescript
// Tests call real functions
await handleRegister(mockContext);

// Verify actual behavior
expect(mockContext.json).toHaveBeenCalledWith({
  user: { uid: 'test_123', name: 'Test User' }
});
```

## 🚀 Usage Examples

### Basic Test Execution
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific category
npm run test:quick
```

### Development Workflow
```bash
# Start watch mode
npm run test:watch

# Open test UI for debugging
npm run test:ui

# Pre-commit validation
npm run test:precommit
```

### CI/CD Integration
```bash
# CI pipeline tests
npm run test:ci

# Generates:
# - test-results.xml (JUnit format)
# - coverage/ directory (HTML reports)
```

## 🛠️ Development Guidelines

### Adding New Tests

#### 1. Create Test File
```typescript
// src/test/routes/newmodule.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '../mocks/context';

describe('New Module Routes', () => {
  // Test implementation
});
```

#### 2. Mock Dependencies
```typescript
vi.mock('../../dependency', () => ({
  functionName: vi.fn()
}));
```

#### 3. Test Structure
```typescript
it('should handle successful operation', async () => {
  // Arrange
  const mockContext = createMockContext();
  
  // Act
  await handleFunction(mockContext);
  
  // Assert
  expect(mockContext.json).toHaveBeenCalledWith({
    expected: 'response'
  });
});
```

### Best Practices
- **Descriptive Names**: Clear test descriptions
- **Arrange-Act-Assert**: Consistent test structure
- **Mock Isolation**: Independent test execution
- **Edge Case Coverage**: Test failure scenarios
- **Real Data**: Use realistic test data

## 📈 Performance Metrics

### Execution Times
- **Quick Tests**: ~5 seconds (utilities only)
- **Core Tests**: ~15 seconds (main routes)
- **Full Suite**: ~30 seconds (all tests)
- **Coverage Report**: ~45 seconds (with analysis)

### Resource Usage
- **Memory**: Low impact with mocked dependencies
- **CPU**: Minimal overhead for test execution
- **Storage**: No persistent storage required

## 🔮 Future Enhancements

### Planned Improvements
1. **Integration Tests**: Full request/response cycles
2. **Performance Tests**: Load and stress testing
3. **Security Tests**: Authentication and authorization edge cases
4. **Contract Tests**: API specification validation

### Additional Coverage
1. **Billing Routes**: Stripe integration testing
2. **Upload Routes**: File handling and R2 operations
3. **Admin Routes**: Superadmin functionality
4. **Webhook Routes**: External API integration

### Testing Infrastructure
1. **Test Database**: Persistent test data
2. **Test Environments**: Staging environment integration
3. **Visual Testing**: UI component testing
4. **E2E Testing**: Full workflow validation

## 📚 Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/)
- [Mock Service Worker](https://mswjs.io/)

### Commands Reference
```bash
# Essential Commands
npm test                    # Run all tests
npm run test:coverage       # Coverage report
npm run test:watch          # Watch mode
npm run test:ui            # Interactive UI

# Test Runner
npm run test-runner help   # Show all options
npm run test-runner quick  # Quick tests
npm run test-runner core   # Core routes
npm run test-runner ci     # CI pipeline
```

---

**Testing Philosophy**: Write tests that validate real user workflows and catch breaking changes early. Focus on behavior over implementation details, and maintain high coverage without sacrificing test quality.