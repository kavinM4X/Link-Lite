import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

const PAGE_METADATA = {
  '/': { title: 'Dashboard', subtitle: 'Workspace overview and recent link performance' },
  '/links': { title: 'My Links', subtitle: 'Manage, search, and inspect your shortened links' },
  '/analytics': { title: 'Analytics', subtitle: 'Performance metrics, click breakdown, and trends' },
  '/settings': { title: 'Settings', subtitle: 'Configure platform preferences and defaults' },
};

export const Header = ({ onToggleSidebar }) => {
  const location = useLocation();
  const currentMeta = PAGE_METADATA[location.pathname] || {
    title: 'LinkLite',
    subtitle: 'URL Shortener Platform',
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="mobile-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="header-title-crumb">
          <span className="header-title">{currentMeta.title}</span>
          <span className="header-subtitle">{currentMeta.subtitle}</span>
        </div>
      </div>
    </header>
  );
};

