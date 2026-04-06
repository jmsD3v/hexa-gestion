'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (profile?.nombre === 'Pendiente' && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [profile, pathname, router]);

  return (
    <SidebarProvider>
      <div className='flex h-screen bg-slate-950 overflow-hidden'>
        <Sidebar />
        <div className='flex flex-col flex-1 min-w-0 overflow-hidden'>
          <TopBar profile={profile} />
          <main className='flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-slate-950'>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
