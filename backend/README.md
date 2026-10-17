# Project ERP & Inventory Management System — Backend API

Node.js, Express, TypeScript, and Mongoose (MongoDB) REST API backend for the Arham Project ERP & Inventory Management System.

## Tech Stack

- **Node.js** & **TypeScript**
- **Express.js** (Web Application Framework)
- **MongoDB** & **Mongoose ODM**
- **Zod** (Request validation)
- **JWT** (Authentication)
- **bcryptjs** (Password hashing)

## Environment Variables

Configure `.env` in `backend/`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Server port (default: 3000) | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/inventory_management` |
| `JWT_SECRET` | Secret key for JWT tokens | `your_jwt_secret_key` |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `GEMINI_API_KEY_1` | Primary Gemini API key for OCR extraction | `AIzaSyD...` |
| `GEMINI_API_KEY_2` | Secondary Gemini API key for automatic failover | `AIzaSyD...` |
| `GEMINI_API_KEY_<N>` | Unlimited future Gemini API keys (`GEMINI_API_KEY_3`, etc.) | `AIzaSyD...` |
| `GEMINI_MODEL` | Gemini AI model (default: `gemini-3.6-flash`) | `gemini-3.6-flash` |
| `GEMINI_KEY_COOLDOWN_SECONDS` | Cooldown period in seconds after rate limit (default: 60) | `60` |

---

## Gemini API Key Rotation & Failover System

For Purchase Bill OCR extraction (`POST /api/purchases/extract-bill`), the backend implements an automatic key rotation and failover system to ensure high availability during quota spikes or rate limits.

### How to Configure Keys
In your backend `.env` file or hosting provider's environment settings:
```env
GEMINI_API_KEY_1="your_first_gemini_api_key"
GEMINI_API_KEY_2="your_second_gemini_api_key"
```

### Adding Future Keys (Unlimited Scalability)
You can add unlimited keys without changing any source code or rebuilding the application:
```env
GEMINI_API_KEY_3="your_third_gemini_api_key"
GEMINI_API_KEY_4="your_fourth_gemini_api_key"
GEMINI_API_KEY_5="your_fifth_gemini_api_key"
```
The system automatically discovers all environment variables matching `GEMINI_API_KEY_<number>`, trims whitespace, removes duplicates, and orders them numerically (`1, 2, 3, ...`). Legacy `GEMINI_API_KEY` is also supported as a fallback.

### Automatic Rotation Strategy
1. **Predictable Key Selection**: Requests initially use the lowest-index healthy key (e.g. `GEMINI_API_KEY_1`). Keys are **not** rotated randomly; the primary healthy key remains active as long as it succeeds.
2. **Instant Failover on Quota/Rate Limit**:
   - If the active key hits a quota or rate-limit error (`HTTP 429`, `RESOURCE_EXHAUSTED`, `Rate limit reached`), the manager immediately logs a warning with a masked key, marks that key as temporarily unavailable with a cooldown (default 60 seconds), and immediately attempts the extraction with the next eligible key (`GEMINI_API_KEY_2`).
   - The user's bill extraction request completes smoothly without failure.
3. **Trigger Errors vs. Non-Retryable Errors**:
   - **Failover triggers**: `HTTP 429` (Quota / Rate Limit), `RESOURCE_EXHAUSTED`, `HTTP 503` (Transient Service Unavailable), and `HTTP 401/403` (Authentication failure / invalid key).
   - **Non-retryable errors**: Document format issues, invalid JSON from unreadable bills, or Zod validation schema mismatches do **not** trigger key rotation, preventing wasteful consumption of other keys' quotas.
4. **All Keys Exhausted**: If all configured keys fail with rate-limit or quota errors, the backend returns a controlled `HTTP 429` response: `"Gemini AI quota exceeded (HTTP 429): All configured Gemini API keys have exceeded their quota or rate limit. Please try again later or enter details manually."`

### Vercel / Serverless Deployment Behavior
- On serverless platforms like Vercel, key health state and cooldown timestamps are stored in the memory of the active serverless container/instance.
- **Per-Request Guarantee**: Even when cold-starting on a new serverless instance, failover is evaluated sequentially within the active request. If Key 1 fails, Key 2 is called in the same request loop, guaranteeing that bill extraction succeeds whenever at least one healthy key is configured.
- **Restart / Redeployment Requirement**: When modifying or adding environment variables in `.env` or Vercel Environment Variables dashboard, you must restart the server or redeploy the project for the runtime process to load the new variables.

### Security
- Real API keys are **never** returned in API responses or sent to the React frontend.
- Backend console logs use `maskApiKey()` (e.g. `AIza...dEfG`), ensuring secrets are never leaked into server logs or error traces.

---

## Render Gemini Key Automation CLI (`npm run gemini:keys`)

You can securely manage Gemini API keys on your deployed **Render backend** (`Arham-Backend`) directly from the command line without opening the Render dashboard.

### Deployment Architecture & Secrets Isolation
```text
GitHub  → Source code only; NEVER store or commit real API keys
Vercel  → React frontend only; does NOT require or receive Gemini keys
Render  → Node/Express backend; stores and runs with Gemini environment variables
```

### Setup Render Credentials (Local Only)
In your local `backend/.env` (which is git-ignored and never committed):
```env
RENDER_API_KEY="your_render_api_token"
RENDER_SERVICE_ID="your_render_backend_service_id"
```
- **RENDER_API_KEY**: Generate at [Render Dashboard -> Account Settings -> API Keys](https://dashboard.render.com/u/settings#api-keys).
- **RENDER_SERVICE_ID**: Found in your Render backend service URL (e.g., `https://dashboard.render.com/web/srv-xxxxxxxxxxxxxxxxxxxx`).

### Usage

#### 1. Interactive Menu Mode
Run without arguments to access the guided interactive menu:
```bash
npm run gemini:keys
```

#### 2. CLI Command Options
```bash
# List configured Gemini keys on Render (names and status only)
npm run gemini:keys -- --list

# Add a new key slot (e.g. GEMINI_API_KEY_3) with hidden input
npm run gemini:keys -- --add 3

# Replace an existing key slot with confirmation
npm run gemini:keys -- --replace 2

# Remove a key slot with explicit confirmation
npm run gemini:keys -- --remove 3

# Trigger a Render deployment / restart
npm run gemini:keys -- --deploy

# Dry-run mode (previews changes without modifying Render)
npm run gemini:keys -- --dry-run --add 3
npm run gemini:keys -- --dry-run --list
```

### Security & Safety Guarantees
- **Zero-Fragment Secret Masking**: The script **never** displays full keys, key fragments, lengths, or prefixes/suffixes (e.g. key prefixes or tokens). It prints only `GEMINI_API_KEY_X  [CONFIGURED]`.
- **Hidden Input**: Entering an API key uses hidden interactive input (`*`), preventing shoulder-surfing and terminal history leaks.
- **Explicit Deployment Confirmation**: Render does not automatically deploy when environment variables are updated via API. The script prompts to confirm whether you want to trigger a deployment.
- **Environment Group Limitation**: Render's service env-var API manages variables configured directly on the service. Variables inherited from linked Render Environment Groups cannot be modified via this endpoint and will report a clear explanatory message.


---

## Installation & Running

```bash
# Install dependencies
npm install

# Production build
npm run build

# Start server
npm start
```

## API Endpoints

- `/api/auth` — Login & authenticated profile
- `/api/products` — Product catalog management
- `/api/categories` — Product taxonomy categories
- `/api/suppliers` — Supplier directory
- `/api/purchases` — Purchase procurement, AI OCR bill extraction (`/extract-bill`), & auto-stock increment
- `/api/projects` — Projects, budget, materials consumption, & project expenses
- `/api/labours` — Labour directory, project labour assignments, and wage tracking
- `/api/labour-payments` — Labour wage disbursement and payment history
- `/api/project-invoices` — Project customer invoicing, payments & GST
- `/api/reports` — Dashboard, Purchase, Projects Profitability, Inventory, & GST Summary reports
