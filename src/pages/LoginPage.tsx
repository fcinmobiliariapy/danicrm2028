import { Eye, EyeOff, Lock, ShieldCheck, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin Principal', user: 'admin', pass: 'Dani2018!' },
  { label: 'Administrador', user: 'operador', pass: 'Admin2018!' },
  { label: 'Coordinador', user: 'coordinador', pass: 'Coord2018!' },
  { label: 'Consulta', user: 'consulta', pass: 'Consulta2018!' },
];

export const LoginPage: React.FC = () => {
  const { login, settings } = useApp();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Dani2018!');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
      {/* Left Institutional Visual */}
      <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white">
        <img
          src={settings.institutional_image_url}
          alt={settings.organization_name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-slate-950/40" />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src={settings.logo_url}
            alt={settings.organization_name}
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-xl object-cover bg-white p-0.5 shadow-md"
          />
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-200">{settings.campaign_reference}</div>
            <div className="text-base font-bold text-white">{settings.organization_name}</div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            {settings.platform_name}
          </h1>
          <p className="mt-4 text-base text-slate-200 leading-relaxed">
            {settings.institutional_text}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-slate-300 border-t border-white/15 pt-5">
            <span>18 Departamentos de Paraguay</span>
            <span aria-hidden="true">·</span>
            <span>Estructura de Coordinadores, Jóvenes y Mujeres</span>
            <span aria-hidden="true">·</span>
            <span>Proyección de Votos y Agenda</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <img
              src={settings.logo_url}
              alt={settings.organization_name}
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-lg object-cover border border-slate-200"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Acceso al Sistema</h2>
              <p className="text-xs text-slate-500">{settings.campaign_reference}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Usuario</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Ingrese su usuario"
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Ingrese su contraseña"
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: settings.primary_color }}
              className="w-full min-h-[44px] rounded-lg py-2.5 px-4 text-sm font-semibold text-white hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {submitting ? 'Verificando acceso...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <span>Accesos de prueba por rol</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.user}
                  type="button"
                  onClick={() => {
                    setUsername(acc.user);
                    setPassword(acc.pass);
                  }}
                  className="text-left rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-800">{acc.label}</div>
                  <div className="text-[11px] font-mono text-slate-500">{acc.user}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
