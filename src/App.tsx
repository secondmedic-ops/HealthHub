import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { LoginScreen } from './screens/LoginScreen';
import { SetPasswordScreen } from './screens/SetPasswordScreen';
import { ReportScreen } from './screens/ReportScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { HubDetailScreen } from './screens/HubDetailScreen';
import { PnlScreen } from './screens/PnlScreen';
import { AdminScreen } from './screens/AdminScreen';
import { InventoryScreen } from './screens/InventoryScreen';

// Helper to redirect root path "/" to role landing page
function RootRedirect() {
  const { profile, loading, getLandingRoute } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#16324F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#5B6670]">Loading HealthHub...</p>
        </div>
      </div>
    );
  }

  if (!profile || !profile.is_active) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getLandingRoute()} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/set-password" element={<SetPasswordScreen />} />

            {/* Root index redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Protected authenticated routes inside responsive Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/report" element={<ReportScreen />} />
              <Route path="/history" element={<HistoryScreen />} />
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/hub/:hubId" element={<HubDetailScreen />} />
              <Route path="/pnl" element={<PnlScreen />} />
              <Route path="/admin" element={<AdminScreen />} />
              <Route path="/inventory" element={<InventoryScreen />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
