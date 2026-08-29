import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Suppliers from "./pages/Suppliers";
import Stock from "./pages/Stock";
import LowStock from "./pages/LowStock";
import AddPurchase from "./pages/AddPurchase";
import PurchaseChoice from "./pages/PurchaseChoice";
import PurchaseUpload from "./pages/PurchaseUpload";
import ReviewPurchase from "./pages/ReviewPurchase";
import Purchases from "./pages/Purchases";
import Billing from "./pages/Billing";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Projects from "./pages/Projects";
import AddProject from "./pages/AddProject";
import ProjectDetails from "./pages/ProjectDetails";
import CreateProjectInvoice from "./pages/CreateProjectInvoice";
import ProjectInvoiceDetails from "./pages/ProjectInvoiceDetails";
import AuthProvider from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Root from "./utils/Root";
import ProtectedRoute from "./utils/ProtectedRoute";
import Unauthorized from "./pages/Unauthorized";
import Logout from "./components/Logout";
import Layout from "./components/Layout";

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Dashboard Layout and Sub-routes */}
          <Route
            element={
              <ProtectedRoute requiredRole={["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/new" element={<AddProject />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/projects/:id/edit" element={<AddProject />} />
            <Route path="/projects/:projectId/invoices/new" element={<CreateProjectInvoice />} />
            <Route path="/project-invoices/:id" element={<ProjectInvoiceDetails />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/low-stock" element={<LowStock />} />
            <Route path="/purchases/new" element={<PurchaseChoice />} />
            <Route path="/purchases/new/choice" element={<PurchaseChoice />} />
            <Route path="/purchases/new/manual" element={<AddPurchase />} />
            <Route path="/purchases/new/upload" element={<PurchaseUpload />} />
            <Route path="/purchases/new/review" element={<ReviewPurchase />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="/logout" element={<Logout />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Catch-all 404 fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ToastProvider>
  </AuthProvider>
);

export default App;
