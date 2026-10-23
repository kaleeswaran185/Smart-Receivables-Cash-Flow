import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import ServerWakeupGuard from './components/common/ServerWakeupGuard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DemoProvider } from './context/DemoContext';
import AppLayout from './components/layout/AppLayout';
import { Loading } from './components/common/Loading';
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
  const { loading, error } = useAuth();
  if (loading) {
    return <Loading fullPage message="Connecting to secure demo session..." />;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-800 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <h2 className="text-xl font-bold text-white">Unable to Start Demo Session</h2>
          <p className="text-sm text-slate-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
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
              {/* Root redirect directly to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
