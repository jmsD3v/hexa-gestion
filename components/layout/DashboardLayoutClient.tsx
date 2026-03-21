'use client';

import { SidebarProvider } from '@/lib/sidebar-context';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import type { Profile } from '@/types/database';

export default function DashboardLayoutClient({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: Profile | null;
}) {
  return (
    <SidebarProvider>
      <div className='flex h-screen bg-slate-900 overflow-hidden'>
        <Sidebar />
        <div className='flex flex-col flex-1 min-w-0 overflow-hidden'>
          <TopBar profile={profile} />
          <main className='flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-slate-900'>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
