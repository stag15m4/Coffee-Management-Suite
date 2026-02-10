import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { X } from 'lucide-react';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  white: '#FFFDF7',
};

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { tenant } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    const dismissed = localStorage.getItem('trial-banner-dismissed');
    if (!dismissed) return false;
    // Re-show banner after 24 hours
    return Date.now() - parseInt(dismissed, 10) < 24 * 60 * 60 * 1000;
  });

  const isTrial = tenant?.subscription_plan === 'free' || !tenant?.subscription_plan;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const showBanner = isTrial && trialDaysLeft !== null && !bannerDismissed;
  const isUrgent = trialDaysLeft !== null && trialDaysLeft <= 3;
  const isExpired = trialDaysLeft === 0;

  const handleDismiss = () => {
    localStorage.setItem('trial-banner-dismissed', Date.now().toString());
    setBannerDismissed(true);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {showBanner && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 text-sm border-b"
            style={{
              backgroundColor: isUrgent ? '#fef2f2' : '#eff6ff',
              borderColor: isUrgent ? '#fecaca' : '#bfdbfe',
              color: colors.brown,
            }}
          >
            <p className="flex-1">
              {isExpired ? (
                <>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>Your free trial has ended.</span>
                  {' '}Subscribe to keep access to all modules and your data.
                </>
              ) : (
                <>
                  <span className="font-semibold">
                    Your free trial {isUrgent ? 'ends' : 'will end'} in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.
                  </span>
                  {' '}After your trial, you'll need a subscription to continue using modules.
                </>
              )}
            </p>
            <Link href="/billing">
              <button
                className="shrink-0 px-3 py-1 rounded-md text-xs font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                {isExpired ? 'Subscribe Now' : 'Upgrade'}
              </button>
            </Link>
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: colors.brownLight }}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
