import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import { AdminPage } from './pages/AdminPage';
import { AgendaPage } from './pages/AgendaPage';
import { DashboardPage } from './pages/DashboardPage';
import { GuidePage } from './pages/GuidePage';
import { LoginPage } from './pages/LoginPage';
import { OnpPage } from './pages/OnpPage';
import { PeopleModulePage } from './pages/PeopleModulePage';
import { ProjectionsPage } from './pages/ProjectionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { TerritorialPage } from './pages/TerritorialPage';
import { PageKey } from './types';

function MainRouter() {
  const { user, loadingAuth, hasPermission } = useApp();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        Verificando sesión...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'coordinators':
        return (
          <PeopleModulePage
            moduleKey="coordinators"
            title="Coordinadores"
            singularLabel="Coordinador"
            description="Registro, control territorial, validación de C.I. y exportación de coordinadores de campaña"
          />
        );
      case 'youth':
        return (
          <PeopleModulePage
            moduleKey="youth"
            title="Estructura de Jóvenes"
            singularLabel="Integrante Juvenil"
            description="Administración independiente de la estructura territorial juvenil"
          />
        );
      case 'women':
        return (
          <PeopleModulePage
            moduleKey="women"
            title="Estructura de Mujeres"
            singularLabel="Integrante"
            description="Administración independiente de la estructura territorial de mujeres"
          />
        );
      case 'onp':
        return <OnpPage />;
      case 'projections':
        return <ProjectionsPage />;
      case 'agenda':
        return <AgendaPage />;
      case 'reports':
        return <ReportsPage />;
      case 'statistics':
        return <StatisticsPage />;
      case 'territorial':
        return <TerritorialPage />;
      case 'admin':
        return hasPermission('admin:manage') ? <AdminPage /> : <DashboardPage onNavigate={setActivePage} />;
      case 'guide':
        return <GuidePage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
