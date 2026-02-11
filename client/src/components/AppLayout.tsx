import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { branding, tenant } = useAuth();

  const displayName = branding?.company_name || tenant?.name || 'Coffee Suite';

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="p-1 -ml-1 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Menu className="w-5 h-5" style={{ color: colors.brown }} />
          </button>
          <span
            className="text-sm font-semibold truncate"
            style={{ color: colors.brown }}
          >
            {displayName}
          </span>
        </header>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
