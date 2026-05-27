import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../common/Toast';
import { SearchModal } from '../common/SearchModal';
import { CommandPalette } from '../common/CommandPalette';
import { NotificationPanel } from '../common/NotificationPanel';
import { SyncCenter } from '../common/SyncCenter';
import { QuickNotes } from '../common/QuickNotes';

export function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
      <ToastContainer />
      <SearchModal />
      <CommandPalette />
      <NotificationPanel />
      <SyncCenter />
      <QuickNotes />
    </div>
  );
}
