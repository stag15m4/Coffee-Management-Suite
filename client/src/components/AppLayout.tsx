import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Menu } from 'lucide-react';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useTheme } from '@/contexts/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { meta } = useTheme();
  const { tenant } = useAuth();

  const displayName = meta.companyName || tenant?.name || 'Dashboard';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — visible on lg+ */}
      <DesktopSidebar />

      {/* Mobile sidebar drawer (for full nav access via hamburger) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <DesktopSidebar className="flex w-full flex-col h-full" />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — visible below lg */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="p-1 -ml-1 rounded-md hover:opacity-80 transition-colors"
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} />
          </button>
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-secondary)' }}
          >
            {displayName}
          </span>
        </header>

        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom tab bar — visible below lg */}
      <BottomTabBar />
    </div>
  );
}
