import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileEdit,
  History,
  LayoutDashboard,
  LineChart,
  Settings,
  Package,
  LogOut,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AppRole } from '../types/api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: AppRole[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['manager', 'accounts', 'super_admin'],
  },
  {
    to: '/report',
    label: 'Daily report',
    icon: FileEdit,
    allowedRoles: ['staff', 'hub_lead', 'manager', 'super_admin'],
  },
  {
    to: '/history',
    label: 'History',
    icon: History,
    allowedRoles: ['staff', 'hub_lead', 'manager', 'super_admin'],
  },
  {
    to: '/pnl',
    label: 'P&L',
    icon: LineChart,
    allowedRoles: ['accounts', 'super_admin'],
  },
  {
    to: '/admin',
    label: 'Admin',
    icon: Settings,
    allowedRoles: ['super_admin'],
  },
  {
    to: '/inventory',
    label: 'Inventory',
    icon: Package,
    allowedRoles: ['purchase_manager', 'field_staff', 'super_admin'],
  },
  {
    to: '/team',
    label: 'My Team',
    icon: Users,
    allowedRoles: ['manager', 'super_admin'],
  },
];

const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  accounts: 'Accounts',
  manager: 'Manager',
  hub_lead: 'Hub Lead',
  staff: 'Branch Staff',
  purchase_manager: 'Purchase Mgr',
  field_staff: 'Field Staff',
};

const COLLAPSED_WIDTH = 68; // px — icon-only rail
const EXPANDED_WIDTH = 256; // px — 16rem, same as the old fixed w-64

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // The desktop rail auto-hides to an icon-only strip and expands on
  // hover; clicking the pin button (or the logo, while collapsed) keeps
  // it open regardless of the mouse. Mobile is unaffected — it keeps its
  // own bottom tab bar below.
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const expanded = pinned || hovering;

  if (!profile) return null;

  const visibleNav = ALL_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(profile.role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#1D2329] flex flex-col lg:flex-row antialiased">
      {/* Spacer that reserves the collapsed rail's width in the flex row —
          the rail itself is fixed-positioned so it can expand over the
          page instead of pushing content around. */}
      <div className="hidden lg:block lg:shrink-0" style={{ width: COLLAPSED_WIDTH }} />

      {/* Desktop Left Rail (≥ 1024px) — auto-hides to icons, expands on hover/click */}
      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-0 lg:h-screen bg-[#16324F] text-[#F7F8F6] border-r border-[#234567] z-40 transition-all duration-200 ease-in-out overflow-hidden ${
          expanded ? 'shadow-2xl' : ''
        }`}
        style={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      >
        {/* Brand header — logo doubles as the click-to-pin toggle */}
        <div className="p-4 border-b border-[#234567] flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPinned((v) => !v)}
            title={pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
            className="w-9 h-9 rounded-[6px] bg-[#1F7A4D] text-white flex items-center justify-center font-bold text-lg shrink-0 hover:brightness-110 transition"
          >
            H
          </button>
          {expanded && (
            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="font-semibold tracking-tight text-white text-base leading-tight truncate">
                  SecondMedic
                </h1>
                <p className="text-xs text-[#A8BCCC] truncate">HealthHub</p>
              </div>
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                className="p-1 rounded-[4px] text-[#A8BCCC] hover:text-white hover:bg-[#1C3E61] shrink-0"
              >
                {pinned ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className={`border-b border-[#234567] bg-[#12283E] ${expanded ? 'px-5 py-4' : 'px-0 py-3 flex justify-center'}`}>
          {expanded ? (
            <>
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="inline-block text-xs px-2 py-0.5 rounded-[4px] bg-[#1F3751] text-[#A8BCCC] border border-[#2B4B6E]">
                  {ROLE_DISPLAY_NAMES[profile.role] || profile.role}
                </span>
                <span className="text-[11px] text-[#8EA6B9]">IST</span>
              </div>
            </>
          ) : (
            <div
              className="w-8 h-8 rounded-full bg-[#1F3751] border border-[#2B4B6E] text-[#C5D5E4] text-xs font-semibold flex items-center justify-center"
              title={`${profile.full_name} · ${ROLE_DISPLAY_NAMES[profile.role] || profile.role}`}
            >
              {profile.full_name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className={`flex-1 py-4 space-y-1 ${expanded ? 'px-3' : 'px-2'}`}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors ${
                    expanded ? 'px-3' : 'px-0 justify-center'
                  } ${
                    isActive
                      ? 'bg-[#1F7A4D] text-white'
                      : 'text-[#C5D5E4] hover:text-white hover:bg-[#1C3E61]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer with sign out */}
        <div className={`border-t border-[#234567] ${expanded ? 'p-4' : 'p-2'}`}>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className={`w-full flex items-center gap-2 py-2.5 rounded-[6px] text-sm text-[#C5D5E4] hover:text-white hover:bg-[#1C3E61] transition-colors ${
              expanded ? 'px-3' : 'px-0 justify-center'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        {/* Mobile Header (< 1024px) */}
        <header className="lg:hidden bg-[#16324F] text-white px-4 py-3 border-b border-[#234567] flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-[#1F7A4D] text-white flex items-center justify-center font-bold text-sm">
              H
            </div>
            <div>
              <span className="font-semibold text-sm leading-tight block">
                SecondMedic
              </span>
              <span className="text-[11px] text-[#A8BCCC] block leading-tight">
                {profile.full_name} · {ROLE_DISPLAY_NAMES[profile.role]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-[#C5D5E4] hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Screen Page Outlet */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#16324F] border-t border-[#234567] flex justify-around items-center px-1 safe-bottom">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center min-h-[52px] py-1 text-xs transition-colors ${
                  isActive ? 'text-[#3BD485] font-semibold' : 'text-[#A8BCCC]'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px] leading-tight text-center truncate px-1">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
