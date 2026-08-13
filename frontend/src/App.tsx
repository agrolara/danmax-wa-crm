import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RegisterModal } from './components/RegisterModal';
import { LoginModal } from './components/LoginModal';
import { SuperAdminView } from './views/SuperAdminView';
import { WhatsAppQRView } from './views/WhatsAppQRView';
import { ChatInboxView } from './views/ChatInboxView';
import { KanbanPipelineView } from './views/KanbanPipelineView';
import { GroupsView } from './views/GroupsView';
import { BroadcastCalendarView } from './views/BroadcastCalendarView';
import { TeamView } from './views/TeamView';
import { TemplatesView } from './views/TemplatesView';
import { MediaCatalogView } from './views/MediaCatalogView';
import { AnalyticsView } from './views/AnalyticsView';
import { socket } from './services/socket';
import { soundService } from './services/sound';

export const App: React.FC = () => {
  // Restore persisted tab or default to 'qr'
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const saved = localStorage.getItem('danmax_tab');
    return saved && saved !== 'landing' ? saved : 'qr';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Restore persisted user session or null
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('danmax_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {}
    }
    return {
      businessName: 'DanMax WA Owner',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    };
  });

  useEffect(() => {
    localStorage.setItem('danmax_tab', currentTab);
  }, [currentTab]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('danmax_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('danmax_user');
    }
  }, [currentUser]);

  useEffect(() => {
    socket.on('new_message', (msg: any) => {
      if (msg?.direction === 'INBOUND' || !msg?.direction) {
        soundService.playIncomingSound();
      }
    });

    return () => {
      socket.off('new_message');
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleRegisterSuccess = (user: any) => {
    setCurrentUser(user);
    alert('¡Registro recibido! Tu cuenta ha sido enviada para aprobación del Super Administrador de DanMax WA.');
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    if (user.role === 'SUPER_ADMIN') {
      setCurrentTab('admin');
    } else {
      setCurrentTab('qr');
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'admin':
        return <SuperAdminView />;
      case 'qr':
        return <WhatsAppQRView />;
      case 'chat':
        return <ChatInboxView />;
      case 'kanban':
        return <KanbanPipelineView setCurrentTab={setCurrentTab} />;
      case 'groups':
        return <GroupsView />;
      case 'calendar':
        return <BroadcastCalendarView />;
      case 'team':
        return <TeamView />;
      case 'templates':
        return <TemplatesView />;
      case 'media':
        return <MediaCatalogView />;
      case 'analytics':
        return <AnalyticsView />;
      default:
        return <WhatsAppQRView />;
    }
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'admin':
        return '👑 Panel de Control Super Administrador DanMax WA';
      case 'qr':
        return '📱 Mi WhatsApp (Vinculación Autoservicio DanMax WA)';
      case 'chat':
        return '💬 Bandeja de Entrada Multi-Agente';
      case 'kanban':
        return '🎯 Embudo de Ventas Kanban';
      case 'groups':
        return '👥 Mis Grupos de WhatsApp & Difusiones Masivas';
      case 'calendar':
        return '📅 Calendario de Difusión Masiva';
      case 'team':
        return '👥 Equipo de Ventas Multi-Agente';
      case 'templates':
        return '📚 Biblioteca de Plantillas Dinámicas';
      case 'media':
        return '🖼️ Galería de Medios y Catálogo Rápido';
      case 'analytics':
        return '📊 Tablero de Analítica y Estadísticas';
      default:
        return 'DanMax WA CRM Multi-Tenant';
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        theme={theme}
        toggleTheme={toggleTheme}
        businessName={currentUser?.businessName || 'DanMax WA'}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <main className="main-content">
        <header className="topbar">
          <h1 className="topbar-title">{getTabTitle()}</h1>
          <div className="topbar-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
                alt="Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%' }}
              />
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700 }}>{currentUser?.fullName || 'Super Admin'}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{currentUser?.businessName || 'DanMax WA Owner'}</div>
              </div>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</div>
      </main>

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleRegisterSuccess}
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;
