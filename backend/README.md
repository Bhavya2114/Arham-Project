# Inventory POS & Management System — Backend API

Node.js, Express, TypeScript, and Mongoose (MongoDB) REST API backend for the Inventory Management System.

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
- `/api/customers` — Customer CRM directory
- `/api/purchases` — Purchase procurement & auto-stock increment
- `/api/sales` — Sales & POS Billing with auto-stock decrement
- `/api/reports` — Dashboard, Sales, Purchase, P&L, & Inventory Analytics reports
