# AgentForge Backend Postman Testing Guide

This document is a Postman-friendly reference for testing the NestJS backend.

## Base URL

Use the backend base URL in your Postman environment:

- Local: `http://localhost:3000`

Suggested environment variables:

- `baseUrl` = `http://localhost:3000`
- `adminEmail` = `admin@agentforge.local`
- `adminPassword` = `Admin123!`
- `userEmail` = `user@agentforge.local`
- `userPassword` = `User123!`
- `accessToken` = leave empty until you authenticate
- `sessionId` = use the seeded session id or fetch one from `/sessions/me`
- `planId` = use the seeded plan id after listing plans

## Important auth note

JWT protection uses a Bearer token in the `Authorization` header.

Even though `POST /auth/login` sets a `token` cookie, protected routes expect:

```http
Authorization: Bearer <token>
```

So in Postman, copy the token value into the Authorization tab or into a shared environment variable.

## Seeded demo data

After running the seed, you have:

- Admin user: `admin@agentforge.local` / `Admin123!`
- Regular user: `user@agentforge.local` / `User123!`
- Plans: `starter`, `pro`
- One seeded session and one seeded completed run

## Authentication

### 1. Register a user and get a token in the response

This is the easiest way to get a Bearer token for testing user endpoints.

`POST {{baseUrl}}/auth/register`

Body:

```json
{
  "email": "tester@example.com",
  "password": "Test123!",
  "name": "Test User"
}
```

Response:

```json
{
  "access_token": "<jwt>"
}
```

### 2. Login with the seeded admin or user

`POST {{baseUrl}}/auth/login`

Body for admin:

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

Body for regular user:

```json
{
  "email": "{{userEmail}}",
  "password": "{{userPassword}}"
}
```

This endpoint sets a `token` cookie. Copy the JWT from the cookie and set:

```http
Authorization: Bearer <token>
```

### 3. Verify current auth user

`GET {{baseUrl}}/auth/me`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

---

## Plans API

### Public: get plan by slug

`GET {{baseUrl}}/plans/slug/starter`

No auth required.

### Admin: list all plans

`GET {{baseUrl}}/plans`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

### Admin: get one plan by id

`GET {{baseUrl}}/plans/:id`

### Admin: create plan

`POST {{baseUrl}}/plans`

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "name": "Business",
  "slug": "business",
  "description": "Business plan for higher limits",
  "price": 149,
  "currency": "USD",
  "interval": "YEARLY",
  "features": ["10k runs", "20 agents", "priority support"],
  "maxRuns": 10000,
  "maxAgents": 20,
  "active": true
}
```

### Admin: update plan

`PATCH {{baseUrl}}/plans/:id`

Body example:

```json
{
  "description": "Updated description",
  "price": 199,
  "active": true
}
```

### Admin: soft delete plan

`DELETE {{baseUrl}}/plans/:id`

This marks the plan inactive and sets `deletedAt`.

---

## Subscriptions API

### User: subscribe to a plan

`POST {{baseUrl}}/subscriptions/subscribe`

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body:

```json
{
  "planId": "<plan-id>"
}
```

Tip: get the plan id from `GET /plans` or from the seeded plan you create in Postman.

### User: cancel current subscription

`POST {{baseUrl}}/subscriptions/cancel`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

### Admin: list all subscriptions

`GET {{baseUrl}}/subscriptions`

### Admin: update subscription

`PATCH {{baseUrl}}/subscriptions/:id`

Body examples:

```json
{
  "status": "CANCELED"
}
```

```json
{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

```json
{
  "planId": "<new-plan-id>"
}
```

---

## Sessions API

### User: list my sessions

`GET {{baseUrl}}/sessions/me`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

### Admin: list all sessions

`GET {{baseUrl}}/admin/sessions`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

The admin response includes a run count per session.

If you see `Cannot GET /admin/sessions`, make sure the backend was rebuilt/restarted after registering `SessionsController` in `SessionsModule`.

---

## Runs API

### Create run and stream SSE events

`POST {{baseUrl}}/runs`

Headers:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
Accept: text/event-stream
```

Body:

```json
{
  "prompt": "Build a website builder workflow",
  "sessionId": "<session-id>",
  "domain": "website_builder"
}
```

Expected behavior:

- Creates a `Run` with `RUNNING`
- Creates a linked `AgentRun`
- Proxies the AI service SSE stream back to the client
- Updates `Run` and `AgentRun` as streamed events arrive

Postman note:

- Postman can show streaming responses, but SSE support can be inconsistent depending on version.
- If the stream view is awkward, use the same request with `curl -N` to inspect the SSE output.

### Get a run with its linked AgentRun

`GET {{baseUrl}}/runs/:id`

### Get runs for one session

`GET {{baseUrl}}/sessions/:sessionId/runs`

---

## Admin monitoring

### List all runs with filters

`GET {{baseUrl}}/admin/runs`

Optional query params:

- `domain` = `web_research`, `document`, `data_transform`, `website_builder`
- `status` = `queued`, `running`, `completed`, `failed`

Example:

`GET {{baseUrl}}/admin/runs?domain=data_transform&status=completed`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

The response includes:

- `Run` core fields
- `session` relation with basic session info
- `agentRun` relation including `semanticScore`

---

## Admin user management

### List users

`GET {{baseUrl}}/admin/users?page=1&perPage=20&q=test`

Headers:

```http
Authorization: Bearer {{accessToken}}
```

Response includes:

- user profile fields
- `status`
- `totalRuns`
- pagination metadata

### Change role

`PATCH {{baseUrl}}/admin/users/:id`

Body:

```json
{
  "role": "ADMIN"
}
```

### Change status

`PATCH {{baseUrl}}/admin/users/:id`

Body:

```json
{
  "status": "SUSPENDED"
}
```

---

## Recommended Postman test order

1. `POST /auth/register` or `POST /auth/login`
2. Save the JWT into `accessToken`
3. `GET /auth/me`
4. `GET /plans/slug/starter`
5. `GET /plans`
6. `POST /subscriptions/subscribe`
7. `GET /sessions/me`
8. `POST /runs`
9. `GET /runs/:id`
10. `GET /sessions/:sessionId/runs`
11. Admin only: `GET /admin/users`, `GET /admin/runs`, `GET /admin/sessions`

## Quick test tips

- Use the admin token for admin-only endpoints.
- Use the seeded session id for `/runs` if you want to test immediately.
- For `/runs`, make sure the Python AI service is running on `AI_SERVICE_URL`.
- If you reseed, the data is reset and the demo ids change.

## Verification commands

```bash
cd apps/backend
npm run prisma:generate
npm run prisma:seed
npm run build
npm run dev
```

*** End Patch