# Authentication API Documentation

## Overview

The CM24.4 API uses OAuth2 and JWT tokens for authentication. All API requests must include a valid authentication token in the request headers.

## Authentication Methods

### 1. OAuth2 Authentication

#### Authorization Flow

```
GET /auth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope={SCOPES}
```

**Parameters:**
- `client_id` (required): Your application's client ID
- `redirect_uri` (required): The URI to redirect to after authorization
- `response_type` (required): Must be "code"
- `scope` (optional): Space-separated list of scopes

**Example Request:**
```bash
curl -X GET "https://api.cm24.example.com/auth/authorize?client_id=abc123&redirect_uri=https://myapp.com/callback&response_type=code&scope=read:diagnostics write:remediation"
```

#### Token Exchange

```
POST /auth/token
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**
```
grant_type=authorization_code
&code={AUTHORIZATION_CODE}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&redirect_uri={REDIRECT_URI}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=xyz789" \
  -d "client_id=abc123" \
  -d "client_secret=secret456" \
  -d "redirect_uri=https://myapp.com/callback"
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "read:diagnostics write:remediation"
}
```

### 2. JWT Token Authentication

#### Direct Token Generation

```
POST /auth/jwt/generate
Content-Type: application/json
Authorization: Basic {BASE64_ENCODED_CREDENTIALS}
```

**Request Body:**
```json
{
  "client_id": "abc123",
  "client_secret": "secret456",
  "scopes": ["read:diagnostics", "write:remediation"],
  "expires_in": 3600
}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/auth/jwt/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YWJjMTIzOnNlY3JldDQ1Ng==" \
  -d '{
    "client_id": "abc123",
    "client_secret": "secret456",
    "scopes": ["read:diagnostics", "write:remediation"],
    "expires_in": 3600
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-04-01T12:00:00Z",
  "token_type": "Bearer"
}
```

## Using Authentication Tokens

### Request Headers

Include the authentication token in all API requests:

```
Authorization: Bearer {ACCESS_TOKEN}
```

**Example:**
```bash
curl -X GET https://api.cm24.example.com/api/v1/diagnostics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Token Refresh

### Refresh Token Flow

```
POST /auth/token
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**
```
grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

**Example Request:**
```bash
curl -X POST https://api.cm24.example.com/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d "client_id=abc123" \
  -d "client_secret=secret456"
```

## Scopes

Available scopes for API access:

| Scope | Description |
|-------|-------------|
| `read:diagnostics` | Read access to diagnostic data |
| `write:diagnostics` | Write access to diagnostic operations |
| `read:remediation` | Read access to remediation status |
| `write:remediation` | Execute remediation actions |
| `read:monitoring` | Read monitoring data and metrics |
| `admin:webhooks` | Manage webhook configurations |
| `read:all` | Read access to all resources |
| `write:all` | Write access to all resources |

## Error Responses

### Authentication Errors

**401 Unauthorized**
```json
{
  "error": "invalid_token",
  "error_description": "The access token is invalid or has expired",
  "error_code": "AUTH001"
}
```

**403 Forbidden**
```json
{
  "error": "insufficient_scope",
  "error_description": "The token does not have the required scope",
  "error_code": "AUTH002",
  "required_scope": "write:remediation"
}
```

**400 Bad Request**
```json
{
  "error": "invalid_request",
  "error_description": "Missing required parameter: client_id",
  "error_code": "AUTH003"
}
```

## Rate Limiting

Authentication endpoints have specific rate limits:

- `/auth/token`: 20 requests per minute per IP
- `/auth/jwt/generate`: 10 requests per minute per client_id
- `/auth/authorize`: 30 requests per minute per IP

When rate limited, you'll receive:

```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests",
  "error_code": "AUTH004",
  "retry_after": 60
}
```

## Security Best Practices

1. **Store tokens securely**: Never expose tokens in client-side code or version control
2. **Use HTTPS**: Always use HTTPS for API requests
3. **Rotate secrets**: Regularly rotate client secrets
4. **Minimal scopes**: Request only the scopes your application needs
5. **Token expiration**: Use short-lived tokens and refresh as needed

## Token Introspection

Validate and inspect tokens:

```
POST /auth/introspect
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {BASE64_ENCODED_CREDENTIALS}
```

**Request Body:**
```
token={ACCESS_TOKEN}
&token_type_hint=access_token
```

**Response:**
```json
{
  "active": true,
  "scope": "read:diagnostics write:remediation",
  "client_id": "abc123",
  "username": "service-account-123",
  "exp": 1712059200,
  "iat": 1712055600,
  "sub": "12345",
  "aud": "https://api.cm24.example.com"
}
```

## Revoke Tokens

Revoke access or refresh tokens:

```
POST /auth/revoke
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {BASE64_ENCODED_CREDENTIALS}
```

**Request Body:**
```
token={TOKEN_TO_REVOKE}
&token_type_hint=access_token
```

**Response:**
```
HTTP/1.1 200 OK
```