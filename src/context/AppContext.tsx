import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import { CustomField, Department, District, Seccional, SystemSettings, User } from '../types';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  user: User | null;
  loadingAuth: boolean;
  settings: SystemSettings;
  departments: Department[];
  districts: District[];
  seccionales: Seccional[];
  customFields: CustomField[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTerritorial: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshCustomFields: () => Promise<void>;
  applyThemePreview: (s: SystemSettings) => void;
  hasPermission: (key: string) => boolean;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_SETTINGS: SystemSettings = {
  id: 1,
  platform_name: 'CRM Político – Gestión Territorial',
  organization_name: 'Comando Territorial Dani Centurión 2018',
  campaign_reference: 'DANI CENTURIÓN 2018',
  logo_url: '/src/assets/images/brand_emblem_1794844008906.jpg',
  institutional_image_url: '/src/assets/images/campaign_banner_1794844011380.jpg',
  primary_color: '#1E3A8A',
  secondary_color: '#B91C1C',
  theme_mode: 'light',
  background_color: '#F8FAFC',
  surface_color: '#FFFFFF',
  text_color: '#0F172A',
  font_family: 'Plus Jakarta Sans',
  font_size_scale: 'normal',
  border_radius: 'rounded',
  header_text: 'CRM POLÍTICO – GESTIÓN TERRITORIAL | DANI CENTURIÓN 2018',
  footer_text: 'Documento de uso interno y confidencial · Estructura Territorial Paraguay',
  institutional_text: 'Plataforma centralizada de organización territorial, coordinación electoral, agenda política y proyección estadística.',
  contact_phone: '+595 21 440 2018',
  contact_email: 'coordinacion@danicenturion2018.org.py',
  contact_address: 'Asunción, República del Paraguay',
  document_format: 'A4',
  date_format: 'DD/MM/YYYY',
  report_show_charts: 1,
  report_show_totals: 1,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [seccionales, setSeccionales] = useState<Seccional[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const applyThemeColors = useCallback((s: SystemSettings) => {
    const root = document.documentElement;
    const isDark = s.theme_mode === 'dark';
    root.classList.toggle('dark', isDark);

    root.style.setProperty('--brand-primary', s.primary_color || '#1E3A8A');
    root.style.setProperty('--brand-secondary', s.secondary_color || '#B91C1C');
    root.style.setProperty('--app-bg', s.background_color || (isDark ? '#0F172A' : '#F8FAFC'));
    root.style.setProperty('--app-surface', s.surface_color || (isDark ? '#1E293B' : '#FFFFFF'));
    root.style.setProperty('--app-text', s.text_color || (isDark ? '#F8FAFC' : '#0F172A'));
    root.style.setProperty('--app-border', isDark ? '#334155' : '#E2E8F0');

    const chosenFont = s.font_family || 'Plus Jakarta Sans';
    root.style.setProperty('--app-font', `"${chosenFont}", system-ui, sans-serif`);
    root.style.setProperty('--app-display-font', `"${chosenFont}", system-ui, sans-serif`);

    const scaleMap = { compact: '14.5px', normal: '16px', large: '17.5px' };
    root.style.fontSize = scaleMap[s.font_size_scale || 'normal'] || '16px';

    const radiusMap = { sharp: '4px', rounded: '12px', soft: '18px' };
    root.style.setProperty('--app-radius', radiusMap[s.border_radius || 'rounded'] || '12px');

    document.title = s.platform_name || 'CRM Político – Gestión Territorial';
  }, []);

  const refreshTerritorial = useCallback(async () => {
    try {
      const data = await apiFetch<{
        departments: Department[];
        districts: District[];
        seccionales: Seccional[];
      }>('/api/territorial/tree');
      setDepartments(data.departments);
      setDistricts(data.districts);
      setSeccionales(data.seccionales);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await apiFetch<SystemSettings>('/api/settings');
      if (s) {
        setSettings(s);
        applyThemeColors(s);
      }
    } catch {
      // ignore
    }
  }, [applyThemeColors]);

  const refreshCustomFields = useCallback(async () => {
    try {
      const cf = await apiFetch<CustomField[]>('/api/custom-fields');
      setCustomFields(cf);
    } catch {
      // ignore
    }
  }, []);

  const bootstrapAuthenticated = useCallback(async () => {
    await Promise.all([refreshSettings(), refreshTerritorial(), refreshCustomFields()]);
  }, [refreshSettings, refreshTerritorial, refreshCustomFields]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pub = await apiFetch<SystemSettings>('/api/public/branding');
        if (mounted && pub?.platform_name) {
          setSettings(pub);
          applyThemeColors(pub);
        }
      } catch {
        // ignore
      }
      try {
        const me = await apiFetch<{ user: User }>('/api/auth/me');
        if (mounted && me?.user) {
          setUser(me.user);
          await bootstrapAuthenticated();
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoadingAuth(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyThemeColors, bootstrapAuthenticated]);

  const login = async (username: string, password: string) => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await bootstrapAuthenticated();
    notify(`Bienvenido, ${res.user.full_name}`, 'success');
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
  };

  const hasPermission = useCallback(
    (key: string) => {
      if (!user) return false;
      if (user.role_slug === 'super_admin') return true;
      return !!user.permissions?.[key];
    },
    [user]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        loadingAuth,
        settings,
        departments,
        districts,
        seccionales,
        customFields,
        login,
        logout,
        refreshTerritorial,
        refreshSettings,
        refreshCustomFields,
        applyThemePreview: applyThemeColors,
        hasPermission,
        notify,
      }}
    >
      {children}
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-all ${
              t.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : t.type === 'info'
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return ctx;
}
