import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import { DemoProvider } from './context/DemoContext';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import NewInvoicePage from './pages/NewInvoicePage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import CustomersPage from './pages/CustomersPage';
import PaymentsPage from './pages/PaymentsPage';
import FollowupsPage from './pages/FollowupsPage';
import InboxPage from './pages/InboxPage';
import ForecastPage from './pages/ForecastPage';
import SettingsPage from './pages/SettingsPage';
import PublicPayPage from './pages/PublicPayPage';
import PrintInvoicePage from './pages/PrintInvoicePage';
import DemandLetterPage from './pages/DemandLetterPage';

export default function App() {
  return (
    <ErrorBoundary>
      <DemoProvider>
        <Routes>
          {/* Standalone Public Customer Payment Page */}
          <Route path="/pay/:token" element={<PublicPayPage />} />

          {/* Standalone Print-Ready Document Views (Zero sidebar/nav clutter in DOM) */}
          <Route path="/invoices/:id/print" element={<PrintInvoicePage />} />
          <Route path="/invoices/:id/demand-letter" element={<DemandLetterPage />} />

          {/* Authenticated Application Shell with Sidebar & Mobile Bottom Nav */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/new" element={<NewInvoicePage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/followups" element={<FollowupsPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DemoProvider>
    </ErrorBoundary>
  );
}
