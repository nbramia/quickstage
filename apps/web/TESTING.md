# 🧪 QuickStage Testing Suite

## Overview

The QuickStage testing suite provides comprehensive coverage of all user interactions, button presses, and use cases across the application. Built with **Vitest** and **React Testing Library**, it's designed to be fast, maintainable, and developer-friendly.

## 🚀 Quick Start

### Run Critical Tests (Recommended for Pre-Deployment)
```bash
pnpm test:critical    # ~30 seconds
```

### Run All Tests
```bash
pnpm test             # ~2-3 minutes
```

### Development Mode
```bash
pnpm test:watch       # Watch mode for development
pnpm test:ui          # Visual test runner
```

### Test Runner Script
```bash
pnpm run-tests fast   # Critical tests only
pnpm run-tests full   # All tests
pnpm run-tests watch  # Watch mode
pnpm run-tests ui     # Visual runner
pnpm run-tests deploy # Critical tests + build
```

## 📋 Test Coverage

### 🏠 Landing Page (`Landing.test.tsx`)
- **Page Structure**: Main sections, content, typography
- **Header Navigation**: Sign up/log in buttons, mobile responsiveness
- **Hero Section**: Full viewport height, headlines, subheadlines
- **Rotating Text Effect**: Text rotation, bold final words, auto-disappear
- **Interactive Background**: Star particles, background effects
- **Feature Callout Boxes**: Icon + title layout, mobile responsiveness
- **Call-to-Action**: Primary/secondary buttons, navigation
- **Typography System**: Share Tech Mono, Inconsolata, Poppins
- **Mobile Responsiveness**: Header, sections, spacing
- **Button Interactions**: Clickability, hover states, styling
- **Visual Elements**: Icons, gradients, spacing
- **Accessibility**: Heading hierarchy, button names, alt text

### 🔐 Login Component (`Login.test.tsx`)
- **Component Rendering**: Forms, typography, Google OAuth
- **Authentication Mode Switching**: Sign in ↔ Sign up
- **URL Parameter Handling**: `mode=signup` auto-switching
- **Form Validation**: Email format, password strength, required fields
- **Form Submission**: API calls, loading states, error handling
- **Google OAuth Integration**: Button clicks, loading, errors
- **Authentication State**: Redirects, loading, user checks
- **Form Accessibility**: Labels, associations, ARIA attributes
- **Error Handling**: Display, dismissal, network errors
- **Loading States**: Disabled inputs, loading text, prevention
- **Form Reset**: Mode switching, error clearing

### 📊 Dashboard (`Dashboard.test.tsx`)
- **Component Rendering**: Typography, logo, welcome message
- **Header & Navigation**: Plan display, links, sign out
- **Mobile Responsiveness**: Hamburger menu, mobile layout
- **Welcome Section**: Personalized messages, subscription status
- **Action Buttons**: Staging, snapshots, extension download
- **Extension Download**: Pro user restrictions, upgrade prompts
- **Feature Callout Boxes**: Pro features, mobile layout
- **Recent Snapshots**: Display, details, empty states
- **Plan-Specific Content**: Free vs Pro user differences
- **Loading States**: Spinners, disabled buttons
- **Error Handling**: API failures, retry functionality
- **Navigation & Routing**: Settings, admin panel access
- **User Role-Based Content**: Free, Pro, Admin, Superadmin
- **Mobile Layout**: Padding, margins, responsive design

### ⚙️ Settings (`Settings.test.tsx`)
- **Component Rendering**: Typography, logo, page title
- **Header & Navigation**: Plan display, links, sign out
- **Mobile Responsiveness**: Hamburger menu, mobile layout
- **Account Information**: User details, member since, billing
- **Plan Management**: Current plan, upgrade buttons
- **Account Actions**: Change password, delete account
- **Change Password**: Modal, validation, API calls
- **Delete Account**: Confirmation, validation, API calls
- **Modal Functionality**: Open/close, focus management
- **Loading States**: Password change, account deletion
- **Error Handling**: Display, dismissal, API errors
- **Navigation & Routing**: Dashboard, admin panel
- **User Role-Based Content**: Role-specific features
- **Mobile Layout**: Responsive design, spacing

### 👑 Admin Dashboard (`AdminDashboard.test.tsx`)
- **Access Control**: Role-based access, redirects
- **Component Rendering**: Typography, logo, page title
- **Header & Navigation**: Plan display, links, sign out
- **Mobile Responsiveness**: Hamburger menu, mobile layout
- **System Statistics**: User counts, snapshot counts
- **User Management**: Create, deactivate, activate users
- **User List Display**: Table, details, roles, status
- **User Actions**: Deactivate/activate buttons
- **Create User**: Modal, validation, API calls
- **Modal Functionality**: Open/close, focus management
- **Loading States**: Data fetching, operations
- **Error Handling**: API failures, retry functionality
- **Navigation & Routing**: Dashboard, settings, admin panel
- **User Role-Based Content**: Admin vs Superadmin
- **Mobile Layout**: Responsive design, spacing
- **Data Refresh**: Post-operation updates

### 👁️ Viewer (`Viewer.test.tsx`)
- **Component Rendering**: Typography, logo, snapshot title
- **Snapshot Loading**: Data fetching, display, metadata
- **Loading States**: Spinners, loading text
- **Error Handling**: Not found, API failures, retry
- **Snapshot Actions**: Download, view buttons
- **Snapshot Information**: Status, visibility, view count
- **File Type Handling**: HTML, JS, CSS identification
- **Navigation & Routing**: Back button, breadcrumbs
- **Mobile Responsiveness**: Layout, buttons, metadata
- **Accessibility**: Headings, button names, ARIA
- **Edge Cases**: Empty snapshots, long titles, special chars
- **Performance**: Data fetching, re-renders, navigation
- **URL Parameters**: ID handling, validation

## 🏗️ Test Architecture

### Test Utilities (`src/test/utils/test-utils.tsx`)
- **Custom Render Function**: Includes all providers (Router, Auth)
- **Test Data**: Predefined users, snapshots for consistent testing
- **Helper Functions**: Authentication setup, loading waits, API waits
- **Mock Data**: localStorage, sessionStorage mocks

### API Mocking (`src/test/mocks/`)
- **MSW Server**: Intercepts all API calls during testing
- **Handlers**: Comprehensive endpoint coverage with realistic responses
- **Test Data**: Consistent user and snapshot data across tests
- **Authentication**: Token-based user identification

### Test Setup (`src/test/setup.ts`)
- **Jest DOM**: Custom matchers for DOM testing
- **Global Mocks**: matchMedia, IntersectionObserver, ResizeObserver
- **Storage Mocks**: localStorage, sessionStorage
- **MSW Integration**: API mocking setup

## 🎯 Testing Strategy

### **Critical Path Tests** (Must Pass Before Deployment)
- User authentication flows
- Core navigation and routing
- Plan-specific content display
- Mobile responsiveness
- Button interactions

### **Fast Tests** (Under 5 seconds)
- Component rendering
- Form validation
- Basic user flows
- Typography and styling

### **Comprehensive Tests** (Full coverage)
- Edge cases and error handling
- Loading states and transitions
- API integration scenarios
- Accessibility compliance

## 🚀 Pre-Deployment Workflow

### 1. Run Critical Tests
```bash
pnpm test:critical
```
**Expected**: All tests pass in under 30 seconds

### 2. Build Application
```bash
pnpm build
```
**Expected**: TypeScript compilation and build succeed

### 3. Deploy
```bash
pnpm deploy
```

### Alternative: One-Command Pre-Deployment
```bash
pnpm predeploy
```
This runs critical tests + build automatically.

## 🛠️ Development Workflow

### During Development
```bash
pnpm test:watch
```
- Tests run automatically on file changes
- Fast feedback loop
- Easy debugging

### When Adding New Features
1. Write tests first (TDD approach)
2. Implement feature
3. Ensure tests pass
4. Add to critical test suite if needed

### When Debugging Issues
```bash
pnpm test:watch
```
- Run specific test files
- Use `.only` and `.skip` for focused testing
- Check console for detailed error messages

## 📱 Mobile Testing

### Responsive Design Tests
- **Hamburger Menu**: Mobile navigation functionality
- **Layout Adaptation**: Grid systems, flexbox behavior
- **Touch Interactions**: Button sizing, spacing
- **Typography Scaling**: Font sizes across breakpoints

### Breakpoint Testing
- **Mobile First**: `sm:`, `md:`, `lg:` utility classes
- **Grid Systems**: Responsive column layouts
- **Spacing**: Padding and margins across screen sizes

## ♿ Accessibility Testing

### ARIA Compliance
- **Button Names**: All buttons have accessible names
- **Form Labels**: Proper label associations
- **Heading Hierarchy**: Logical document structure
- **Loading States**: ARIA live regions for dynamic content

### Keyboard Navigation
- **Focus Management**: Tab order, focus indicators
- **Modal Behavior**: Trap focus, escape key handling
- **Form Navigation**: Field-to-field tabbing

## 🔧 Test Maintenance

### Adding New Tests
1. **Follow Naming Convention**: `ComponentName.test.tsx`
2. **Use Test Utilities**: Import from `test-utils.tsx`
3. **Mock Dependencies**: Use MSW for API calls
4. **Test User Flows**: Focus on user interactions
5. **Include Edge Cases**: Error states, loading states

### Updating Existing Tests
1. **Keep Tests Focused**: One assertion per test when possible
2. **Use Descriptive Names**: Clear test descriptions
3. **Maintain Test Data**: Update mock data as needed
4. **Check Coverage**: Ensure new features are tested

### Test Data Management
- **Consistent Test Users**: Free, Pro, Admin, Superadmin
- **Realistic Snapshots**: Various file types, sizes, statuses
- **API Responses**: Match actual backend behavior
- **Error Scenarios**: Network failures, validation errors

## 🚨 Common Issues & Solutions

### Test Failing Due to Mock Issues
```bash
# Check MSW handlers
pnpm test:watch --reporter=verbose

# Verify mock data
console.log(mockApi.get.mock.calls)
```

### Component Not Rendering
```bash
# Check provider setup
# Verify component imports
# Check for missing dependencies
```

### API Calls Not Mocked
```bash
# Ensure MSW is running
# Check handler patterns
# Verify endpoint URLs
```

### Mobile Tests Failing
```bash
# Check responsive utility classes
# Verify breakpoint behavior
# Test hamburger menu functionality
```

## 📊 Test Metrics

### Coverage Goals
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Performance Targets
- **Critical Tests**: <30 seconds
- **Full Test Suite**: <3 minutes
- **Individual Tests**: <1 second
- **Setup Time**: <5 seconds

## 🔮 Future Enhancements

### Planned Features
- **Visual Regression Testing**: Screenshot comparisons
- **Performance Testing**: Bundle size, load time tests
- **E2E Testing**: Playwright integration
- **Test Analytics**: Performance metrics, failure analysis

### Integration Testing
- **API Endpoints**: Backend integration tests
- **Database Operations**: KV store testing
- **Authentication Flow**: OAuth, session management
- **File Operations**: Upload, download, storage

## 📚 Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

### Best Practices
- **Test User Behavior**: Focus on what users do, not implementation
- **Accessibility First**: Test with screen readers, keyboard navigation
- **Mobile Responsive**: Test across all breakpoints
- **Error Scenarios**: Test failure modes and edge cases

---

**Remember**: Good tests are fast, focused, and maintainable. They should give you confidence that your application works correctly without slowing down development.
