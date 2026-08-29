# Inventory POS & Management System

A modern, responsive, and secure full-stack MERN (MongoDB, Express, React, Node.js) Inventory Management & POS Billing System designed for real-time stock tracking, procurement, sales, profit & loss analytics, and multi-role operational workflows.

---

## ✨ Key Features

- 🔐 **JWT Authentication & Security**: Secure login with role-based access control (Admin, Sales, Warehouse, Accounts).
- 📦 **Simple Stock Management**: Real-time stock auto-increment on Purchase (+Qty) and auto-decrement on Sale (-Qty).
- ⚡ **POS Billing & Sales**: Quick billing interface, GST calculation, historical cost snapshot protection, and printable invoices.
- 🛒 **Purchase Procurement**: Supplier management, procurement entry, and automatic purchase price history updates.
- 📊 **Financial Analytics & Reports**:
  - **Sales Report**: Net sales revenue, gross billing, output GST, COGS, and customer breakdown.
  - **Purchase Report**: Net purchases, input GST paid, gross procurement spend, supplier analysis, and product procurement stats.
  - **Profit & Loss Statement**: Net Sales, COGS, Gross Profit, and Gross Profit Margin % (with separate GST reporting).
  - **Inventory Analytics**: Asset valuation (at cost), potential retail value, category valuation breakdown, and deficit reorder lists.

---

## 🛠️ Technology Stack

### Frontend SPA
* **Core**: React.js (built with Vite)
* **Routing**: React Router DOM (v6)
* **Styling**: Tailwind CSS & Vanilla CSS
* **API Client**: Axios (with automated JWT interceptors)
* **Icons**: React Icons (Font Awesome)

### Backend REST API
* **Core**: Node.js & TypeScript
* **Router Framework**: Express.js
* **Validation**: Zod Schemas
* **Authentication**: JSON Web Tokens (JWT) & bcryptjs
* **Database Driver**: Mongoose (MongoDB)

### Database
* **Engine**: MongoDB (`mongodb://127.0.0.1:27017/inventory_management`)

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
npm run build
npm start
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 👥 Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@erp.com` | `Password@123` |
| **Sales** | `sales@erp.com` | `Password@123` |
| **Warehouse** | `warehouse@erp.com` | `Password@123` |
| **Accounts** | `accounts@erp.com` | `Password@123` |
