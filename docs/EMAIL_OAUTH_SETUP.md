# 📧 Email OAuth Integration Setup Guide

Complete guide for setting up secure Gmail and Outlook OAuth integration with encrypted token storage.

---

## 🔐 Security Features

✅ **AES-256-GCM Encryption** - All OAuth tokens are encrypted at rest  
✅ **Automatic Token Refresh** - Expired tokens are automatically refreshed  
✅ **Rate Limit Protection** - Exponential backoff for API rate limits  
✅ **Secure Token Storage** - Tokens never exposed in API responses  
✅ **CSRF Protection** - State parameter validation in OAuth flow  

---

## 📋 Table of Contents

1. [Environment Variables Setup](#environment-variables-setup)
2. [Gmail OAuth Configuration](#gmail-oauth-configuration)
3. [Outlook OAuth Configuration](#outlook-oauth-configuration)
4. [Generate Encryption Key](#generate-encryption-key)
5. [API Endpoints](#api-endpoints)
6. [Testing the Integration](#testing-the-integration)
7. [Troubleshooting](#troubleshooting)

---

## Environment Variables Setup

Add these variables to your `.env` file:

```bash
# ========================================
# EMAIL OAUTH CONFIGURATION
# ========================================

# Token Encryption (REQUIRED for security)
TOKEN_ENCRYPTION_KEY=your_generated_encryption_key_here

# Gmail OAuth (Get from Google Cloud Console)
GMAIL_CLIENT_ID=your_gmail_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=http://localhost:5000/api/email/oauth/callback

# Outlook OAuth (Get from Azure Portal)
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
OUTLOOK_REDIRECT_URI=http://localhost:5000/api/email/oauth/callback
OUTLOOK_TENANT_ID=common

# Base URL (for OAuth redirects)
BASE_URL=http://localhost:5000
```

---

## Generate Encryption Key

**IMPORTANT**: You must generate a secure encryption key before using the email OAuth features.

### Option 1: Using Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Option 2: Using the utility script

```bash
npx tsx server/utils/tokenEncryption.ts
```

### Option 3: Using OpenSSL

```bash
openssl rand -hex 32
```

**Copy the generated key and add it to your `.env` file as `TOKEN_ENCRYPTION_KEY`**

⚠️ **CRITICAL SECURITY NOTES**:
- Never commit this key to version control
- Use different keys for development and production
- Store production keys in a secure secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- If you lose this key, all encrypted tokens become unrecoverable

---

## Gmail OAuth Configuration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose **External** user type (unless you have Google Workspace)
3. Fill in required information:
   - **App name**: Your Application Name
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (if in testing mode)

### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose **Web application**
4. Configure:
   - **Name**: Your Application Name
   - **Authorized JavaScript origins**:
     - `http://localhost:5000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/email/oauth/callback` (development)
     - `https://yourdomain.com/api/email/oauth/callback` (production)
5. Click "Create"
6. Copy **Client ID** and **Client Secret** to your `.env` file

### Step 4: Verify Configuration

```bash
# Your .env should have:
GMAIL_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-your_secret_here
GMAIL_REDIRECT_URI=http://localhost:5000/api/email/oauth/callback
TOKEN_ENCRYPTION_KEY=your_64_character_hex_string_here
```

---

## Outlook OAuth Configuration

### Step 1: Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Configure:
   - **Name**: Your Application Name
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: 
     - Platform: **Web**
     - URI: `http://localhost:5000/api/email/oauth/callback`
5. Click "Register"

### Step 2: Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Choose "Microsoft Graph"
4. Select "Delegated permissions"
5. Add these permissions:
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `User.Read`
   - `offline_access`
6. Click "Add permissions"
7. Click "Grant admin consent" (if you're an admin)

### Step 3: Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Add description: "Email OAuth Secret"
4. Set expiration (recommended: 24 months)
5. Click "Add"
6. **IMPORTANT**: Copy the secret value immediately (you won't be able to see it again)

### Step 4: Get Client ID and Tenant ID

1. Go to "Overview" page
2. Copy these values:
   - **Application (client) ID** → This is your `OUTLOOK_CLIENT_ID`
   - **Directory (tenant) ID** → This is your `OUTLOOK_TENANT_ID`
   - Or use `common` for multi-tenant

### Step 5: Add Redirect URIs

1. Go to "Authentication"
2. Add these redirect URIs:
   - `http://localhost:5000/api/email/oauth/callback` (development)
   - `https://yourdomain.com/api/email/oauth/callback` (production)
3. Enable "Access tokens" and "ID tokens" under "Implicit grant and hybrid flows"
4. Click "Save"

### Step 6: Verify Configuration

```bash
# Your .env should have:
OUTLOOK_CLIENT_ID=12345678-1234-1234-1234-123456789012
OUTLOOK_CLIENT_SECRET=your~secret~value~here
OUTLOOK_REDIRECT_URI=http://localhost:5000/api/email/oauth/callback
OUTLOOK_TENANT_ID=common
TOKEN_ENCRYPTION_KEY=your_64_character_hex_string_here
```

---

## API Endpoints

### Authentication Endpoints

#### Get Gmail Authorization URL
```http
GET /api/email/gmail/auth-url
Authorization: Bearer <token>

Response:
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "provider": "gmail",
  "message": "Redirect user to this URL to authorize Gmail access"
}
```

#### Get Outlook Authorization URL
```http
GET /api/email/outlook/auth-url
Authorization: Bearer <token>

Response:
{
  "success": true,
  "authUrl": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...",
  "provider": "outlook",
  "message": "Redirect user to this URL to authorize Outlook access"
}
```

#### Handle OAuth Callback
```http
POST /api/email/oauth/callback
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "oauth_authorization_code",
  "provider": "gmail" // or "outlook"
}

Response:
{
  "success": true,
  "message": "Gmail account connected successfully",
  "account": {
    "id": "uuid",
    "emailAddress": "user@gmail.com",
    "provider": "gmail",
    "isActive": true
  }
}
```

### Account Management Endpoints

#### Get All Connected Accounts
```http
GET /api/email/accounts
Authorization: Bearer <token>

Response:
{
  "success": true,
  "accounts": [
    {
      "id": "uuid",
      "accountName": "My Gmail",
      "emailAddress": "user@gmail.com",
      "provider": "gmail",
      "isDefault": false,
      "isActive": true,
      "syncEnabled": true,
      "lastSyncAt": "2025-10-11T10:30:00Z",
      "createdAt": "2025-10-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### Test Account Connection
```http
POST /api/email/accounts/:accountId/test
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Email account connection is working",
  "provider": "gmail",
  "profile": {
    "emailAddress": "user@gmail.com",
    "messagesTotal": 1234,
    "threadsTotal": 567
  }
}
```

#### Update Account Settings
```http
PATCH /api/email/accounts/:accountId
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountName": "Updated Name",
  "isDefault": true,
  "syncEnabled": true,
  "syncFrequency": 300
}

Response:
{
  "success": true,
  "message": "Account settings updated successfully"
}
```

#### Delete Account
```http
DELETE /api/email/accounts/:accountId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Email account disconnected successfully"
}
```

### Email Operations Endpoints

#### Send Email
```http
POST /api/email/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "uuid",
  "to": ["recipient@example.com"],
  "subject": "Test Email",
  "htmlBody": "<p>Hello!</p>",
  "textBody": "Hello!",
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64_encoded_content",
      "contentType": "application/pdf"
    }
  ]
}

Response:
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "message_id_from_provider"
}
```

#### Sync Emails
```http
POST /api/email/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "uuid",
  "maxResults": 50,
  "query": "is:unread"
}

Response:
{
  "success": true,
  "message": "Email sync completed",
  "syncedCount": 25
}
```

### Gmail-Specific Endpoints

#### Get Labels
```http
GET /api/email/gmail/:accountId/labels
Authorization: Bearer <token>

Response:
{
  "success": true,
  "labels": [
    {
      "id": "INBOX",
      "name": "INBOX",
      "type": "system"
    },
    {
      "id": "Label_123",
      "name": "My Custom Label",
      "type": "user"
    }
  ],
  "count": 2
}
```

#### Create Label
```http
POST /api/email/gmail/:accountId/labels
Authorization: Bearer <token>
Content-Type: application/json

{
  "labelName": "Important Clients",
  "messageListVisibility": "show",
  "labelListVisibility": "labelShow"
}

Response:
{
  "success": true,
  "message": "Label created successfully",
  "label": {
    "id": "Label_456",
    "name": "Important Clients",
    "type": "user"
  }
}
```

#### Quick Actions
```http
# Archive message
POST /api/email/gmail/:accountId/messages/:messageId/archive

# Mark as read
POST /api/email/gmail/:accountId/messages/:messageId/read

# Mark as unread
POST /api/email/gmail/:accountId/messages/:messageId/unread

# Star message
POST /api/email/gmail/:accountId/messages/:messageId/star

# Move to trash
POST /api/email/gmail/:accountId/messages/:messageId/trash

All return:
{
  "success": true,
  "message": "Action completed"
}
```

---

## Testing the Integration

### 1. Start the Server

```bash
npm run dev
```

Verify you see these logs:
```
✅ Enhanced Gmail OAuth service initialized
✅ Outlook OAuth service initialized
Email OAuth services initialized
```

### 2. Test Gmail Connection (Manual)

1. Get the auth URL:
```bash
curl -X GET http://localhost:5000/api/email/gmail/auth-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. Open the returned `authUrl` in your browser
3. Authorize the application
4. You'll be redirected with a `code` parameter
5. Exchange the code for tokens:
```bash
curl -X POST http://localhost:5000/api/email/oauth/callback \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AUTHORIZATION_CODE",
    "provider": "gmail"
  }'
```

### 3. Test with Frontend

The typical OAuth flow in your frontend:

```typescript
// 1. Get authorization URL
const response = await fetch('/api/email/gmail/auth-url', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { authUrl } = await response.json();

// 2. Open popup or redirect
window.location.href = authUrl;

// 3. After user authorizes, handle callback
// You'll receive the code in query params
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

// 4. Send code to backend
await fetch('/api/email/oauth/callback', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ code, provider: 'gmail' })
});
```

### 4. Test Sending Email

```bash
curl -X POST http://localhost:5000/api/email/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "YOUR_ACCOUNT_ID",
    "to": ["test@example.com"],
    "subject": "Test Email",
    "htmlBody": "<p>This is a test email</p>",
    "textBody": "This is a test email"
  }'
```

---

## Troubleshooting

### Error: "TOKEN_ENCRYPTION_KEY must be set in production environment"

**Solution**: Generate and add the encryption key to your `.env` file:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Error: "Gmail OAuth not configured - skipping initialization"

**Solution**: Make sure you have both `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in your `.env` file.

### Error: "Invalid grant" or "Token has been expired or revoked"

**Solution**: The refresh token is invalid. User needs to re-authorize:
1. Delete the account: `DELETE /api/email/accounts/:accountId`
2. Re-authorize: Start OAuth flow again

### Error: "Failed to decrypt token"

**Possible causes**:
1. Encryption key changed - tokens encrypted with old key can't be decrypted
2. Database corruption - token data is corrupted

**Solution**: 
- Users need to re-authorize their accounts
- Never change `TOKEN_ENCRYPTION_KEY` in production without migrating tokens

### Error: "Rate limit exceeded"

**Solution**: The service automatically handles rate limits with exponential backoff. If you see this error, the API is being called too frequently. Wait a few minutes and try again.

### Gmail: "Access blocked: Authorization Error"

**Solution**: 
1. Make sure your app is in "Testing" mode or published
2. Add your Google account as a test user in OAuth consent screen
3. Verify all required scopes are added

### Outlook: "AADSTS500011: The resource principal named...was not found"

**Solution**: 
1. Verify the redirect URI matches exactly (including protocol and path)
2. Make sure redirect URI is added in Azure Portal under "Authentication"

### Testing: "redirect_uri_mismatch"

**Solution**: The redirect URI in your request doesn't match what's configured:
- Gmail: Check Google Cloud Console → Credentials → OAuth 2.0 Client IDs
- Outlook: Check Azure Portal → App registrations → Authentication

---

## Security Best Practices

✅ **Use HTTPS in Production** - Always use HTTPS for OAuth redirects  
✅ **Rotate Encryption Keys** - Plan for key rotation (requires token re-encryption)  
✅ **Monitor Token Usage** - Log unusual token access patterns  
✅ **Implement Token Revocation** - Allow users to disconnect accounts  
✅ **Rate Limit OAuth Attempts** - Prevent OAuth flow abuse  
✅ **Validate State Parameter** - Prevent CSRF attacks in OAuth flow  
✅ **Use Separate Keys per Environment** - Dev, staging, and prod should have different keys  
✅ **Store Secrets Securely** - Use secret managers in production (not .env files)  

---

## Production Deployment Checklist

- [ ] Generate strong `TOKEN_ENCRYPTION_KEY` (64 characters)
- [ ] Store encryption key in secure secrets manager
- [ ] Configure production OAuth redirect URIs
- [ ] Enable HTTPS for all OAuth endpoints
- [ ] Set up monitoring for failed OAuth attempts
- [ ] Test token refresh mechanism
- [ ] Configure backup strategy for encrypted tokens
- [ ] Set up alerts for API rate limit violations
- [ ] Document key rotation procedure
- [ ] Test account deletion and token revocation

---

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review Gmail API documentation: https://developers.google.com/gmail/api
- Review Microsoft Graph API documentation: https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview

---

## Summary

This email OAuth integration provides:

✅ **Secure Token Storage** - AES-256-GCM encryption  
✅ **Automatic Token Refresh** - No user interruption  
✅ **Rate Limit Handling** - Exponential backoff  
✅ **Multi-Account Support** - Connect multiple Gmail/Outlook accounts  
✅ **Comprehensive API** - Full CRUD operations  
✅ **User-Friendly** - Clear error messages and validation  

Your users' email data is safe, secure, and reliably accessible! 🔒📧
