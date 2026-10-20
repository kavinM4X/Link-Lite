import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';

export const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="app-main-wrapper">
        <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
