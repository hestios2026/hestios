import './i18n';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { SitesPage } from './pages/SitesPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { HRPage } from './pages/HRPage';
import { ProgramariPage } from './pages/ProgramariPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AchizitiiPage } from './pages/AchizitiiPage';
import { AufmassPage } from './pages/AufmassPage';
import { ReportsPage } from './pages/ReportsPage';
import { FacturarePage } from './pages/FacturarePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { TagesberichtPage } from './pages/TagesberichtPage';
import { PontajPage } from './pages/PontajPage';
import { LVCatalogPage } from './pages/LVCatalogPage';
import { InvoiceScannerPage } from './pages/InvoiceScannerPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import type { User } from './types';

export default function App() {
  const { user, signIn, signOut, isAuthenticated } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginPage onLogin={(access, refresh, u) => signIn(access, refresh, u as User)} />
      </>
    );
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':    return <DashboardPage user={user!} onNavigate={setPage} />;
      case 'sites':        return <SitesPage />;
      case 'equipment':    return <EquipmentPage />;
      case 'hr':           return <HRPage user={user!} />;
      case 'procurement':   return <AchizitiiPage />;
      case 'aufmass':       return <AufmassPage user={user!} />;
      case 'reports':       return <ReportsPage />;
      case 'billing':       return <FacturarePage />;
      case 'invoice-scan':  return <InvoiceScannerPage />;
      case 'documents':     return <DocumentsPage />;
      case 'tagesbericht':  return <TagesberichtPage userRole={user!.role} />;
      case 'pontaj':        return <PontajPage />;
      case 'lv':            return <LVCatalogPage />;
      case 'hausanschluss': return <ProgramariPage />;
      case 'users':         return <UsersPage />;
      case 'settings':      return <SettingsPage />;
      default:             return <PlaceholderPage pageKey={page} />;
    }
  }

  return (
    <>
      <Toaster position="top-right" />
      <Layout user={user!} onLogout={signOut} page={page} onNavigate={setPage}>
        {renderPage()}
      </Layout>
    </>
  );
}
