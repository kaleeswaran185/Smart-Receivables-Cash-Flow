import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import ServerWakeupGuard from './components/common/ServerWakeupGuard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DemoProvider } from './context/DemoContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
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

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServerWakeupGuard>
        <AuthProvider>
          <DemoProvider>
            <Routes>
              {/* Owner Authentication */}
              <Route path="/login" element={<LoginPage />} />

              {/* Standalone Public Customer Payment Page */}
              <Route path="/pay/:token" element={<PublicPayPage />} />

              {/* Standalone Print-Ready Document Views (Protected) */}
              <Route
                path="/invoices/:id/print"
                element={
                  <ProtectedRoute>
                    <PrintInvoicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id/demand-letter"
                element={
                  <ProtectedRoute>
                    <DemandLetterPage />
                  </ProtectedRoute>
                }
              />

              {/* Authenticated Application Shell with Sidebar & Mobile Bottom Nav */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
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
        </AuthProvider>
      </ServerWakeupGuard>
    </ErrorBoundary>
  );
}
