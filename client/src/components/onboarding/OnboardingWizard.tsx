import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useSetupProgress, SETUP_PHASES, SETUP_STEPS } from '@/hooks/use-setup-progress';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import {
  Users,
  Clock,
  ShoppingBasket,
  CupSoda,
  ChefHat,
  DollarSign,
  Building2,
  Check,
  X,
  Target,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
  PartyPopper,
  SkipForward,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  Clock,
  ShoppingBasket,
  CupSoda,
  ChefHat,
  DollarSign,
  Building2,
};

export function OnboardingWizard() {
  const { tenant } = useAuth();
  const {
    setupProgress,
    isLoading,
    isOwner,
    completedStepIds,
    completedCount,
    allDone,
    updateProgress,
    markStepComplete,
    dismissWizard,
    loadStarterData,
    loadingTemplates,
    hasVerticalTemplates,
  } = useSetupProgress();

  const [, navigate] = useLocation();

  // Resolve dynamic hrefs (e.g., /store/:tenantId)
  const resolveHref = (href: string) =>
    href.replace(':tenantId', tenant?.id || '');

  // Track which phase is being viewed
  const storedPhase = setupProgress?.currentPhase ?? 1;
  const [viewingPhase, setViewingPhase] = useState<number>(storedPhase);

  // Only show for owners
  if (!isOwner) return null;
  // Hide if explicitly dismissed via X button, or still loading
  if (isLoading || !setupProgress) return null;
  if (setupProgress.dismissed) return null;

  // Show celebration if all done and haven't seen it yet
  const showCelebration = allDone && !setupProgress.celebrationSeen;

  if (showCelebration) {
    return <CelebrationCard onDismiss={() => updateProgress({ celebrationSeen: true })} />;
  }

  // After celebration is seen and all done, show a compact completed state
  if (allDone && setupProgress.celebrationSeen) {
    return <CompletedCard onDismiss={dismissWizard} />;
  }

  return (
    <PhaseWizard
      viewingPhase={viewingPhase}
      setViewingPhase={(p) => {
        setViewingPhase(p);
        updateProgress({ currentPhase: p });
      }}
      completedStepIds={completedStepIds}
      completedCount={completedCount}
      markStepComplete={markStepComplete}
      dismissWizard={dismissWizard}
      navigate={(href: string) => navigate(resolveHref(href))}
      loadStarterData={loadStarterData}
      loadingTemplates={loadingTemplates}
      hasVerticalTemplates={hasVerticalTemplates}
    />
  );
}

// ---------- Phase Wizard ----------

interface PhaseWizardProps {
  viewingPhase: number;
  setViewingPhase: (p: number) => void;
  completedStepIds: Set<string>;
  completedCount: number;
  markStepComplete: (id: string) => Promise<void>;
  dismissWizard: () => Promise<void>;
  navigate: (href: string) => void;
  loadStarterData: (type: 'ingredient' | 'recipe') => Promise<void>;
  loadingTemplates: boolean;
  hasVerticalTemplates: boolean;
}

function PhaseWizard({
  viewingPhase,
  setViewingPhase,
  completedStepIds,
  completedCount,
  markStepComplete,
  dismissWizard,
  navigate,
  loadStarterData,
  loadingTemplates,
  hasVerticalTemplates,
}: PhaseWizardProps) {
  const totalSteps = SETUP_STEPS.length;
  const phaseSteps = SETUP_STEPS.filter((s) => s.phase === viewingPhase);
  const phaseComplete = phaseSteps.every((s) => completedStepIds.has(s.id));
  const firstIncomplete = phaseSteps.find((s) => !completedStepIds.has(s.id));

  // Phase completion counts for progress segments
  const phaseCompletions = SETUP_PHASES.map((p) => {
    const steps = SETUP_STEPS.filter((s) => s.phase === p.id);
    const done = steps.filter((s) => completedStepIds.has(s.id)).length;
    return { total: steps.length, done };
  });

  const handleSkipPhase = async () => {
    for (const step of phaseSteps) {
      if (!completedStepIds.has(step.id)) {
        await markStepComplete(step.id);
      }
    }
    // Auto-advance to next phase
    if (viewingPhase < SETUP_PHASES.length) {
      setViewingPhase(viewingPhase + 1);
    }
  };

  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden mb-6"
      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <Target className="w-5 h-5 shrink-0" style={{ color: colors.gold }} />
        <h3 className="font-semibold text-base flex-1" style={{ color: colors.brown }}>
          Get set up
        </h3>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: colors.gold, color: '#fff' }}
        >
          {completedCount} of {totalSteps}
        </span>
        <button
          onClick={dismissWizard}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss setup wizard"
        >
          <X className="w-4 h-4 opacity-40" />
        </button>
      </div>

      {/* Phase progress bar — segmented */}
      <div className="mx-5 mb-2 flex gap-1">
        {SETUP_PHASES.map((phase, i) => {
          const pc = phaseCompletions[i];
          const pct = pc.total > 0 ? (pc.done / pc.total) * 100 : 0;
          return (
            <div
              key={phase.id}
              className="flex-1 h-1.5 rounded-full overflow-hidden cursor-pointer"
              style={{ backgroundColor: colors.cream }}
              onClick={() => setViewingPhase(phase.id)}
              title={`Phase ${phase.id}: ${phase.title}`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors.gold,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Phase tabs */}
      <div className="mx-5 mb-4 flex gap-1">
        {SETUP_PHASES.map((phase, i) => {
          const isActive = viewingPhase === phase.id;
          const pc = phaseCompletions[i];
          const isDone = pc.done === pc.total;
          return (
            <button
              key={phase.id}
              onClick={() => setViewingPhase(phase.id)}
              className={`flex-1 text-center py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'shadow-sm' : 'hover:bg-black/5'
              }`}
              style={{
                backgroundColor: isActive ? colors.cream : 'transparent',
                color: isActive ? colors.brown : colors.brownLight,
              }}
            >
              {isDone && <Check className="w-3 h-3 inline mr-1 text-green-600" />}
              {phase.title}
            </button>
          );
        })}
      </div>

      {/* Steps for current phase */}
      <div className="px-5 pb-4 space-y-1">
        {phaseSteps.map((step) => {
          const done = completedStepIds.has(step.id);
          const isActive = !done && step.id === firstIncomplete?.id;
          const Icon = ICON_MAP[step.icon] || Target;

          return (
            <div key={step.id} className="py-2">
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </div>
                ) : (
                  <div
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: isActive ? colors.gold : colors.creamDark }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: isActive ? colors.gold : colors.brownLight }}
                    />
                  </div>
                )}
                <span
                  className={`text-sm font-medium ${done ? 'line-through opacity-50' : ''}`}
                  style={{ color: colors.brown }}
                >
                  {step.title}
                </span>
              </div>

              {isActive && (
                <div className="ml-10 mt-2 space-y-2.5">
                  <p className="text-sm leading-relaxed" style={{ color: colors.brownLight }}>
                    {step.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Starter data button for ingredients */}
                    {step.id === 'ingredients' && hasVerticalTemplates && (
                      <Button
                        size="sm"
                        onClick={() => loadStarterData('ingredient')}
                        disabled={loadingTemplates}
                        style={{ backgroundColor: colors.gold, color: '#fff' }}
                      >
                        {loadingTemplates ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Load starter items
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(step.href)}
                      style={{ borderColor: colors.gold, color: colors.gold }}
                    >
                      Set up <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-50 hover:opacity-100"
                      onClick={() => markStepComplete(step.id)}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase navigation footer */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: colors.cream, borderTop: `1px solid ${colors.creamDark}` }}
      >
        <div>
          {viewingPhase > 1 && (
            <button
              onClick={() => setViewingPhase(viewingPhase - 1)}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: colors.brownLight }}
            >
              <ArrowLeft className="w-3 h-3" />
              {SETUP_PHASES[viewingPhase - 2].title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!phaseComplete && (
            <button
              onClick={handleSkipPhase}
              className="text-xs font-medium flex items-center gap-1 hover:underline opacity-60 hover:opacity-100"
              style={{ color: colors.brownLight }}
            >
              <SkipForward className="w-3 h-3" />
              Skip phase
            </button>
          )}
          {viewingPhase < SETUP_PHASES.length && (
            <button
              onClick={() => setViewingPhase(viewingPhase + 1)}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: phaseComplete ? colors.gold : colors.brownLight }}
            >
              {SETUP_PHASES[viewingPhase].title}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Celebration Card ----------

function CelebrationCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden mb-6 relative"
      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
    >
      {/* Decorative dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-20"
            style={{
              backgroundColor: [colors.gold, colors.green, colors.blue, colors.orange][i % 4],
              top: `${10 + Math.random() * 80}%`,
              left: `${5 + Math.random() * 90}%`,
              animation: `celebration-float ${2 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="px-6 py-8 text-center relative">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: colors.goldLight }}
        >
          <PartyPopper className="w-7 h-7" style={{ color: colors.gold }} />
        </div>

        <h3 className="text-xl font-bold mb-2" style={{ color: colors.brown }}>
          You're all set!
        </h3>
        <p className="text-sm max-w-sm mx-auto mb-5" style={{ color: colors.brownLight }}>
          Your shop is configured and ready to go. You can always adjust settings from the sidebar
          navigation.
        </p>

        <Button
          onClick={onDismiss}
          style={{ backgroundColor: colors.gold, color: '#fff' }}
        >
          Go to dashboard
        </Button>
      </div>

      <style>{`
        @keyframes celebration-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ---------- Completed Card (compact, stays visible until dismissed) ----------

function CompletedCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden mb-6"
      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
    >
      <div className="px-5 py-3 flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: colors.goldLight }}
        >
          <Check className="w-4 h-4" style={{ color: colors.gold }} />
        </div>
        <span className="flex-1 text-sm font-medium" style={{ color: colors.brown }}>
          Setup complete — you're all set!
        </span>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 opacity-40" />
        </button>
      </div>
    </div>
  );
}
