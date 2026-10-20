import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  Settings,
  Zap,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/links', label: 'My Links', icon: Link2 },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} id="main-sidebar">
        {/* Brand Container */}
        <div className="sidebar-brand-container">
          <div className="brand-logo">
            <div className="brand-icon">
              <Link2 size={20} strokeWidth={2.5} />
            </div>
            <span>
              Link<span className="brand-highlight">Lite</span>
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <div className="nav-section-label">Workspace</div>
          {navLinks.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="nav-section-label">Preferences</div>
          {navLinks.slice(3).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / System Status */}
        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot" aria-hidden="true" />
            <span>LinkLite API · Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
