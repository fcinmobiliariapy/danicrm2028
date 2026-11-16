import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Sparkles,
  UserCheck,
  Users,
  Vote,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageKey } from '../types';
import { OfflineIndicator, PWAInstallButton } from './PWAWidgets';

interface LayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

interface NavItem {
  key: PageKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Panel Principal', shortLabel: 'Panel', icon: LayoutDashboard, permission: 'dashboard:view' },
  { key: 'coordinators', label: 'Coordinadores', shortLabel: 'Coord.', icon: UserCheck, permission: 'coordinators:view' },
  { key: 'youth', label: 'Jóvenes', shortLabel: 'Jóvenes', icon: Sparkles, permission: 'youth:view' },
  { key: 'women', label: 'Mujeres', shortLabel: 'Mujeres', icon: Users, permission: 'women:view' },
  { key: 'onp', label: 'ONP (Org. No Políticas)', shortLabel: 'ONP', icon: Building2, permission: 'onp:view' },
  { key: 'projections', label: 'Proyección de Votos', shortLabel: 'Votos', icon: Vote, permission: 'projections:view' },
  { key: 'agenda', label: 'Agenda y Calendario', shortLabel: 'Agenda', icon: CalendarDays, permission: 'agenda:view' },
  { key: 'reports', label: 'Reportes e Informes', shortLabel: 'Reportes', icon: FileSpreadsheet, permission: 'reports:view' },
  { key: 'statistics', label: 'Estadísticas', shortLabel: 'Estadíst.', icon: BarChart3, permission: 'statistics:view' },
  { key: 'territorial', label: 'Config. Territorial', shortLabel: 'Territorio', icon: MapPin, permission: 'territorial:view' },
  { key: 'admin', label: 'Administración General', shortLabel: 'Admin', icon: Settings, permission: 'admin:manage' },
  { key: 'guide', label: 'Guía del Sistema', shortLabel: 'Guía', icon: BookOpen },
];

export const Layout: React.FC<LayoutProps> = ({ activePage, onNavigate, children }) => {
  const { user, settings, logout, hasPermission } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
  const currentItem = NAV_ITEMS.find((i) => i.key === activePage) || NAV_ITEMS[0];
  const mobileBottomItems = visibleItems.filter((i) =>
    ['dashboard', 'coordinators', 'projections', 'agenda'].includes(i.key)
  ).slice(0, 4);

  const handleNav = (key: PageKey) => {
    onNavigate(key);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex theme-canvas bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Desktop Sidebar */}
      <aside
        style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
        className={`hidden lg:flex flex-col border-r transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-3 min-w-0 text-left"
          >
            <img
              src={settings.logo_url}
              alt={settings.organization_name}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
            />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-slate-900 truncate">
                  {settings.campaign_reference || 'CRM Político'}
                </div>
                <div className="text-xs text-slate-500 truncate">{settings.organization_name}</div>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                style={active ? { backgroundColor: settings.primary_color } : undefined}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 border border-slate-200">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{user?.full_name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user?.role_name}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="h-9 w-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 shrink-0"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="w-full h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (3-zone contract: Breadcrumb/Title - Brand/Org - Actions) */}
        <header
          style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
          className="sticky top-0 z-30 h-[52px] lg:h-16 backdrop-blur-md border-b px-4 lg:px-8 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img
              src={settings.logo_url}
              alt={settings.platform_name}
              referrerPolicy="no-referrer"
              className="lg:hidden h-7 w-7 rounded-md object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm lg:text-base font-semibold text-slate-900 truncate">
                {currentItem.label}
              </div>
              <div className="hidden sm:block text-xs text-slate-500 truncate">
                {settings.platform_name} · {settings.campaign_reference}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton />
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 border-l border-slate-200 pl-3">
              <span className="font-medium text-slate-900 whitespace-nowrap">{user?.username}</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{user?.role_name}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 backdrop-blur-md border-t grid grid-cols-5 items-center px-1"
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNav(item.key)}
              style={active ? { color: settings.primary_color } : undefined}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
                active ? 'font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="truncate max-w-[64px]">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium text-slate-500"
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span>Más</span>
        </button>
      </nav>

      {/* Mobile Full Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <div
            style={{ backgroundColor: 'var(--app-surface)' }}
            className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={settings.logo_url}
                  alt={settings.organization_name}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{settings.campaign_reference}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.full_name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNav(item.key)}
                    style={active ? { backgroundColor: settings.primary_color } : undefined}
                    className={`w-full min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={logout}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};
