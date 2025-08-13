# QuickStage Development TODO

## 🚀 **Immediate Unblock: Personal Access Token (PAT) System**

### **Goal**
Implement a simple PAT-based authentication system that allows users to authenticate once from the extension and remain authenticated indefinitely.

### **Implementation Plan**
1. **Backend Changes**
   - Add `/api/tokens/create` endpoint to generate PATs
   - Add `/api/tokens/revoke` endpoint for security
   - Store PATs in KV with user association and expiry

2. **Dashboard Changes**
   - Add "Generate PAT" button in user settings
   - Show existing PATs with revoke options
   - Clear instructions for extension usage

3. **Extension Changes**
   - Replace cookie-based auth with PAT-based auth
   - Store PAT securely in VS Code Secret Storage
   - Use `Authorization: Bearer <PAT>` for all API calls
   - Add "QuickStage: Login" command for PAT input

### **Expected UX**
1. User runs "QuickStage: Login" from extension
2. Extension prompts for PAT
3. User generates PAT from dashboard and pastes it
4. Extension stores PAT securely
5. All future "Stage" commands work without re-authentication

### **Timeline**
- **Backend**: 2-3 hours
- **Dashboard**: 1-2 hours  
- **Extension**: 2-3 hours
- **Total**: 1 day

---

## 🔮 **Long-term Plan: OAuth 2.0 Device Flow**

### **Goal**
Implement proper OAuth 2.0 Device Flow for seamless, secure authentication without copy-pasting.

### **Why This is Better**
- **Zero copy-pasting**: Seamless browser-based authentication
- **Universal compatibility**: Works in any editor (VS Code, Cursor, SSH, Codespaces)
- **Automatic token refresh**: Handles expiry transparently
- **Industry standard**: Same pattern as GitHub Copilot, Azure Functions, etc.

### **Implementation Plan**
1. **Backend OAuth Endpoints**
   - `/oauth/device_code` - Generate device authorization codes
   - `/oauth/token` - Exchange codes for access tokens
   - `/oauth/refresh` - Refresh expired access tokens
   - Token storage in KV with proper expiry and rotation

2. **Dashboard Authorization Page**
   - Simple "Authorize Device" page
   - User enters `user_code` from extension
   - Confirms authorization
   - Returns success to extension

3. **Extension Device Flow**
   - New "QuickStage: Login" command
   - Calls `/oauth/device_code` → gets `device_code`, `user_code`, `verification_uri`
   - Shows code to user and opens browser
   - Polls `/oauth/token` until success
   - Stores `access_token` and `refresh_token` securely
   - Automatic token refresh on 401 responses

4. **Enhanced Extension UI**
   - Show login status in extension view
   - "Logged in as <email> • Logout" display
   - Clear authentication state indicators

### **OAuth Flow Details**
```
Extension → /oauth/device_code → {device_code, user_code, verification_uri}
Extension → Shows user_code to user + opens browser
User → Enters user_code in dashboard → Confirms authorization
Extension → Polls /oauth/token until success
Extension → Stores tokens securely → Ready for API calls
```

### **Security Features**
- **Scoped tokens**: Limited to snapshot operations only
- **Automatic rotation**: Access tokens expire hourly, refresh tokens weekly
- **Revocation**: Users can revoke device access from dashboard
- **Audit trail**: Log all token usage and creation

### **Timeline**
- **Backend OAuth**: 2-3 days
- **Dashboard auth page**: 1 day
- **Extension device flow**: 2-3 days
- **Testing & polish**: 1-2 days
- **Total**: 1-2 weeks

---

## 📋 **Current Status**

- [x] **Extension v0.0.20 deployed** with complete PAT-based authentication
- [x] **Dashboard updated** with PAT management system
- [x] **PAT backend endpoints** implemented and deployed
- [x] **Extension PAT storage** completed using VS Code Secret Storage
- [x] **Dashboard PAT generation** implemented with full management
- [x] **Complete PAT authentication flow** working end-to-end

## 🎯 **Next Steps**

1. **Immediate (Today)**
   - Implement PAT backend endpoints
   - Complete extension PAT authentication
   - Test end-to-end PAT flow

2. **Short-term (This Week)**
   - Polish PAT system
   - Add PAT management to dashboard
   - Document PAT usage for users

3. **Medium-term (Next 2-3 Weeks)**
   - Begin OAuth 2.0 Device Flow implementation
   - Design and implement OAuth backend
   - Create dashboard authorization page

4. **Long-term (Next Month)**
   - Complete OAuth implementation
   - Migrate users from PAT to OAuth
   - Deprecate PAT system

---

## 🔧 **Technical Notes**

### **PAT System**
- **Token format**: `qs_pat_<random_32_chars>`
- **Storage**: KV namespace `PAT_TOKENS`
- **Expiry**: 90 days (configurable)
- **Scope**: Full snapshot operations

### **OAuth System**
- **Standard**: OAuth 2.0 Device Authorization Grant (RFC 8628)
- **Token types**: Access token (1 hour) + Refresh token (7 days)
- **Security**: PKCE support for enhanced security
- **Storage**: KV namespace `OAUTH_TOKENS`

### **Extension Storage**
- **VS Code Secret Storage**: `quickstage-access-token`, `quickstage-refresh-token`
- **Fallback**: Local file storage for compatibility
- **Encryption**: VS Code handles encryption automatically
