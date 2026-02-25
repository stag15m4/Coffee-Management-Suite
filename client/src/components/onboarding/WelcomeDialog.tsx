import { useAuth } from '@/contexts/AuthContext';
import { useSetupProgress, SETUP_PHASES } from '@/hooks/use-setup-progress';
import { colors } from '@/lib/colors';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, ChefHat, DollarSign, ArrowRight, Coffee } from 'lucide-react';

const PHASE_ICONS = [Users, ChefHat, DollarSign];

export function WelcomeDialog() {
  const { profile, tenant } = useAuth();
  const { setupProgress, isLoading, isOwner, updateProgress } = useSetupProgress();

  // Only show for owners on first visit
  if (!isOwner || isLoading) return null;
  if (!setupProgress || setupProgress.welcomeSeen || setupProgress.dismissed) return null;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const businessName = tenant?.name || 'your shop';

  const handleGetStarted = async () => {
    await updateProgress({ welcomeSeen: true });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleGetStarted()}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto p-0"
        style={{ backgroundColor: colors.white }}
      >
        {/* Hero section */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{ backgroundColor: colors.cream }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: colors.gold }}
          >
            <Coffee className="w-8 h-8 text-white" />
          </div>

          <DialogTitle
            className="text-2xl font-bold mb-2"
            style={{ color: colors.brown }}
          >
            Welcome, {firstName}!
          </DialogTitle>

          <DialogDescription
            className="text-base max-w-md mx-auto"
            style={{ color: colors.brownLight }}
          >
            We'll help you set up {businessName} in just a few minutes.
            Everything here is designed to save you time and make running your
            shop easier.
          </DialogDescription>
        </div>

        {/* Roadmap */}
        <div className="px-8 py-6">
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: colors.brownLight }}
          >
            Here's what we'll cover
          </p>

          <div className="space-y-3">
            {SETUP_PHASES.map((phase, i) => {
              const Icon = PHASE_ICONS[i];
              return (
                <div
                  key={phase.id}
                  className="flex items-center gap-4 rounded-xl px-4 py-3.5"
                  style={{
                    backgroundColor: colors.cream,
                    border: `1px solid ${colors.creamDark}`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: colors.gold }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-sm"
                      style={{ color: colors.brown }}
                    >
                      {phase.title}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: colors.brownLight }}
                    >
                      {phase.description}
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: colors.goldLight,
                      color: colors.gold,
                    }}
                  >
                    Phase {phase.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-8 pt-2">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleGetStarted}
            style={{ backgroundColor: colors.gold, color: '#fff' }}
          >
            Let's get started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p
            className="text-xs text-center mt-3 leading-relaxed"
            style={{ color: colors.brownLight }}
          >
            You can skip any step or come back later — the setup checklist
            lives on your dashboard until you're done.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
