import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, getRoleLanding } from '../context/AuthContext';
import { LogOut, UserX } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { profile, loading, signOut, canAccessRoute } = useAuth();
  const location = useLocation();

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

  // Not logged in
  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Inactive profile or profile not configured
  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-[6px] border border-[#D9DEDA] shadow-sm text-center">
          <div className="w-12 h-12 bg-[#FEF3F2] text-[#B42318] rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-[#16324F] mb-2">
            Account not active
          </h2>
          <p className="text-sm text-[#5B6670] mb-6 leading-relaxed">
            Your account isn't set up yet. Ask your admin to add you.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    );
  }

  // Role permissions check
  const hasAccess = canAccessRoute(location.pathname);
  if (!hasAccess) {
    const landing = getRoleLanding(profile.role);
    return <Navigate to={landing} replace />;
  }

  return <>{children}</>;
}
