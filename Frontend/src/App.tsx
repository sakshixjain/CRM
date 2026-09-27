import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.tsx";

import Dashboard from "./pages/Dashboard.tsx";
import Leads from "./pages/Leads.tsx";
import Contacts from "./pages/Contacts.tsx";
import Companies from "./pages/Companies.tsx";
import Deals from "./pages/Deals.tsx";
import Tasks from "./pages/Tasks.tsx";
import Calendar from "./pages/Calendar.tsx";
import Marketing from "./pages/Marketing.tsx";
import Reports from "./pages/Reports.tsx";
import Settings from "./pages/Settings.tsx";

import Source from "./pages/Source.tsx";
import Status from "./pages/Status.tsx";
import Agent from "./pages/Agent.tsx";
import UserRole from "./pages/UserRole.tsx";
import ProtectedRoute from "./auth/ProtectedRoute.tsx";
import AppLayout from "./layout/AppLayout.tsx";
import Payment from "./pages/Payment.tsx";
import BaseCalculator from "./pages/BaseCalculator.tsx";
import CreateLead from "./pages/CreateLead.tsx";
import CreateQuotation from "./pages/CreateQuotation.tsx";
import Quotations from "./pages/Quotations.tsx";
import QuotationService from "./pages/QuotationService.tsx";
import QuotationDashboard from "./pages/QuotationDashboard.tsx";
import LeadHistory from "./pages/LeadHistory.tsx";
import Followup from "./pages/Followup.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Signup from "./pages/Signup.tsx";
import CompanyDetails from "./pages/CompanyDetails.tsx";
import Activity from "./pages/Activity.tsx";
import FieldWork from "./pages/FieldWork.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected area */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="/create-lead" element={<CreateLead />} />
        <Route path="/create-quotation" element={<CreateQuotation />} />
        <Route path="/quotation-dashboard" element={<QuotationDashboard />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/quotation-service" element={<QuotationService />} />
        <Route path="/followups" element={<Followup />} />
        <Route path="/source" element={<Source />} />
        <Route path="/status" element={<Status />} />
        <Route path="/field-works" element={<FieldWork />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/calculator" element={<BaseCalculator />} />
        <Route path="/payments" element={<Payment />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/user-role" element={<UserRole />} />
        <Route path="/lead-history/:leadId" element={<LeadHistory />} />
        <Route path="/company-details/:id" element={<CompanyDetails />} />
      </Route>

      <Route path="*" element={<div style={{ padding: 20 }}>404 Not Found</div>} />
    </Routes>
  );
}
