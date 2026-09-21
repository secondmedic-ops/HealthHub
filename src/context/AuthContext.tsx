import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Profile, AppRole } from '../types/api';
import { getMyProfile, signOut as apiSignOut, signIn as apiSignIn } from '../api/endpoints';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  canAccessRoute: (path: string) => boolean;
  getLandingRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getRoleLanding(role: AppRole): string {
  switch (role) {
    case 'staff':
    case 'hub_lead':
      return '/report';
    case 'manager':
    case 'super_admin':
      return '/dashboard';
    case 'accounts':
      return '/pnl';
    case 'purchase_manager':
    case 'field_staff':
      return '/inventory';
    default:
      return '/report';
  }
}

export function roleCanAccess(role: AppRole, path: string): boolean {
  if (role === 'super_admin') return true;

  if (path === '/report') {
    return ['staff', 'hub_lead', 'manager', 'super_admin'].includes(role);
  }
  if (path === '/history') {
    return ['staff', 'hub_lead', 'manager', 'super_admin'].includes(role);
  }
  if (path === '/dashboard') {
    return ['manager', 'accounts', 'super_admin'].includes(role);
  }
  if (path.startsWith('/hub/')) {
    return ['manager', 'accounts', 'super_admin'].includes(role);
  }
  if (path === '/pnl') {
    return ['accounts', 'super_admin'].includes(role);
  }
  if (path === '/admin') {
    return false; // super_admin was already handled above
  }

  if (path === '/inventory') {
    return ['purchase_manager', 'field_staff', 'super_admin'].includes(role);
  }

  if (path === '/team') {
    return ['manager', 'super_admin'].includes(role);
  }

  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      return p;
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const signIn = async (email: string, pass: string) => {
    await apiSignIn(email, pass);
    await refreshProfile();
  };

  const signOut = async () => {
    await apiSignOut();
    setProfile(null);
  };

  const canAccessRoute = (path: string): boolean => {
    if (!profile || !profile.is_active) return false;
    return roleCanAccess(profile.role, path);
  };

  const getLandingRoute = (): string => {
    if (!profile || !profile.is_active) return '/login';
    return getRoleLanding(profile.role);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
        canAccessRoute,
        getLandingRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
