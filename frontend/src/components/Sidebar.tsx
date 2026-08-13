import React from 'react';
import {
  MessageSquare,
  Kanban,
  Calendar,
  FileText,
  FolderOpen,
  BarChart3,
  QrCode,
  Moon,
  Sun,
  ShieldCheck,
  Users,
  Home,
  UserCheck,
  Crown,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  theme: string;
  toggleTheme: () => void;
  businessName?: string;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  theme,
  toggleTheme,
  businessName = 'DanMax WA',
  isCollapsed,
  setIsCollapsed,
}) => {
  const menuItems = [
    { id: 'landing', label: '🌐 Inicio / Landing', icon: Home },
    { id: 'admin', label: '👑 Panel Super Admin', icon: Crown },
    { id: 'qr', label: '📱 Mi WhatsApp', icon: QrCode },
    { id: 'chat', label: 'Bandeja Multi-Agente', icon: MessageSquare },
    { id: 'kanban', label: 'Embudo Kanban', icon: Kanban },
    { id: 'groups', label: '👥 Mis Grupos', icon: Users },
    { id: 'calendar', label: 'Calendario Difusión', icon: Calendar },
    { id: 'team', label: 'Equipo Vendedores', icon: UserCheck },
    { id: 'templates', label: 'Plantillas', icon: FileText },
    { id: 'media', label: 'Galería de Medios', icon: FolderOpen },
    { id: 'analytics', label: 'Métricas', icon: BarChart3 },
  ];

  return (
    <>
      {/* ↔️ Botón Franja Vertical Extendida a todo el Costado de la Pantalla */}
      <button
        className="sidebar-toggle-edge"
        title={isCollapsed ? 'Desplegar Menú Lateral' : 'Colapsar Menú Lateral'}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="edge-icon-pill">
          {isCollapsed ? <ChevronRight size={18} color="white" /> : <ChevronLeft size={18} color="white" />}
        </div>
      </button>

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="brand-header">
            <div className="brand-logo">WA</div>
            {!isCollapsed && (
              <div>
                <div className="brand-name">DanMax WA</div>
                <div className="tenant-badge">{businessName}</div>
              </div>
            )}
          </div>

          <ul className="nav-list">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <li
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  {!isCollapsed && <span>{item.label}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: isCollapsed ? 'center' : 'flex-start' }} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!isCollapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>

          {!isCollapsed && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="var(--accent-green)" />
              <span>OpenWA Engine Active</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
