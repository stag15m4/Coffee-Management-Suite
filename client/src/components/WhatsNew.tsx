import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { changelog, CHANGELOG_VERSION, type ChangelogEntry } from '@/lib/changelog';
import { colors } from '@/lib/colors';
import { useToast } from '@/hooks/use-toast';
import { triggerSpotlight } from '@/components/Spotlight';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Rocket,
  Wrench,
  Bug,
  Send,
  Loader2,
  MessageSquare,
  X,
  ArrowRight,
} from 'lucide-react';

interface FeatureReview {
  feature_id: string;
  rating: 'up' | 'down';
  comment: string | null;
  user_id: string;
  user_name?: string;
}

const categoryConfig: Record<ChangelogEntry['category'], { icon: typeof Sparkles; label: string; color: string }> = {
  feature: { icon: Rocket, label: 'New', color: colors.green },
  improvement: { icon: Sparkles, label: 'Improved', color: colors.blue },
  fix: { icon: Bug, label: 'Fix', color: colors.orange },
};

export function WhatsNew() {
  const { user, tenant, profile, hasRole } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [showFeedbackView, setShowFeedbackView] = useState(false);
  const [myReviews, setMyReviews] = useState<Record<string, FeatureReview>>({});
  const [allReviews, setAllReviews] = useState<FeatureReview[]>([]);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  const isManager = hasRole?.('manager') || hasRole?.('owner');

  // Check for new updates on mount — per-user via DB, auto-open if unseen
  useEffect(() => {
    if (!user) return;

    const checkLastSeen = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('changelog_last_seen')
        .eq('id', user.id)
        .single();

      if (data?.changelog_last_seen !== CHANGELOG_VERSION) {
        setHasNewUpdates(true);
        // Auto-open the sheet after a brief delay so the page loads first
        setTimeout(() => setOpen(true), 1500);
      }
    };

    checkLastSeen();
  }, [user]);

  // Load my reviews when sheet opens
  useEffect(() => {
    if (!open || !user) return;

    const loadMyReviews = async () => {
      const { data } = await supabase
        .from('feature_reviews')
        .select('feature_id, rating, comment')
        .eq('user_id', user.id);

      if (data) {
        const reviewMap: Record<string, FeatureReview> = {};
        for (const r of data) {
          reviewMap[r.feature_id] = r as FeatureReview;
        }
        setMyReviews(reviewMap);
      }
    };

    loadMyReviews();
  }, [open, user]);

  // Load all reviews for managers
  useEffect(() => {
    if (!open || !isManager || !showFeedbackView) return;

    const loadAllReviews = async () => {
      const { data } = await supabase
        .from('feature_reviews')
        .select('feature_id, rating, comment, user_id')
        .eq('tenant_id', tenant?.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Enrich with user names
        const userIds = Array.from(new Set(data.map((r) => r.user_id)));
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);

        const nameMap: Record<string, string> = {};
        profiles?.forEach((p) => { nameMap[p.id] = p.full_name || 'Unknown'; });

        setAllReviews(
          data.map((r) => ({ ...r, user_name: nameMap[r.user_id] || 'Unknown' })) as FeatureReview[]
        );
      }
    };

    loadAllReviews();
  }, [open, isManager, showFeedbackView, tenant?.id]);

  // Mark as seen when opened — per-user via DB
  const handleOpen = (value: boolean) => {
    setOpen(value);
    if (value && user) {
      setHasNewUpdates(false);
      supabase
        .from('user_profiles')
        .update({ changelog_last_seen: CHANGELOG_VERSION })
        .eq('id', user.id)
        .then();
    }
    if (!value) {
      setCommentingOn(null);
      setCommentText('');
      setShowFeedbackView(false);
    }
  };

  // Allow sidebar to open the sheet
  useEffect(() => {
    const handleOpenEvent = () => handleOpen(true);
    window.addEventListener('open-whats-new', handleOpenEvent);
    return () => window.removeEventListener('open-whats-new', handleOpenEvent);
  }, []);

  // Expose hasNewUpdates via custom event for sidebar badge
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('whats-new-status', { detail: { hasNew: hasNewUpdates } }));
  }, [hasNewUpdates]);

  const submitReview = async (featureId: string, rating: 'up' | 'down', comment?: string) => {
    if (!user || !tenant) return;
    setSubmitting(featureId);

    try {
      const payload = {
        user_id: user.id,
        tenant_id: tenant.id,
        feature_id: featureId,
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      };

      // Upsert — update if already exists
      const { error } = await supabase
        .from('feature_reviews')
        .upsert(payload, { onConflict: 'user_id,feature_id' });

      if (error) throw error;

      setMyReviews((prev) => ({
        ...prev,
        [featureId]: { feature_id: featureId, rating, comment: comment || null, user_id: user.id },
      }));

      if (comment) {
        setCommentingOn(null);
        setCommentText('');
      }

      toast({
        title: rating === 'up' ? 'Thanks for the feedback!' : 'Feedback recorded',
        description: rating === 'down' ? 'We\'ll look into this.' : undefined,
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
      toast({
        title: 'Error',
        description: 'Failed to save feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleThumbsDown = (featureId: string) => {
    // If already commenting on this one, close it
    if (commentingOn === featureId) {
      setCommentingOn(null);
      setCommentText('');
      return;
    }
    // Open comment box, pre-fill if they already have a comment
    setCommentingOn(featureId);
    setCommentText(myReviews[featureId]?.comment || '');
  };

  const handleSubmitComment = (featureId: string) => {
    submitReview(featureId, 'down', commentText.trim() || undefined);
  };

  const handleTryIt = (entry: ChangelogEntry) => {
    if (!entry.tryIt) return;
    const { href, spotlight, hint } = entry.tryIt;
    // Close the sheet first
    handleOpen(false);
    // Navigate after sheet animation completes
    setTimeout(() => {
      setLocation(href);
      // Trigger spotlight after page renders
      if (spotlight && hint) {
        setTimeout(() => triggerSpotlight(spotlight, hint), 600);
      }
    }, 350);
  };

  // Aggregate feedback stats for manager view
  const feedbackStats = useMemo(() => {
    const stats: Record<string, { up: number; down: number; comments: { user: string; text: string }[] }> = {};
    for (const review of allReviews) {
      if (!stats[review.feature_id]) {
        stats[review.feature_id] = { up: 0, down: 0, comments: [] };
      }
      if (review.rating === 'up') stats[review.feature_id].up++;
      if (review.rating === 'down') stats[review.feature_id].down++;
      if (review.comment) {
        stats[review.feature_id].comments.push({
          user: review.user_name || 'Unknown',
          text: review.comment,
        });
      }
    }
    return stats;
  }, [allReviews]);

  // Items with thumbs-down feedback, sorted by most thumbs-down
  const needsAttention = useMemo(() => {
    return Object.entries(feedbackStats)
      .filter(([, s]) => s.down > 0)
      .sort(([, a], [, b]) => b.down - a.down)
      .map(([featureId, stats]) => {
        const entry = changelog.find((e) => e.id === featureId);
        return { featureId, entry, stats };
      });
  }, [feedbackStats]);

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent
        side="right"
        className="sm:max-w-md overflow-y-auto"
        style={{ backgroundColor: colors.white }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: colors.brown }}>
            {showFeedbackView ? 'Feature Feedback' : "What's New"}
          </SheetTitle>
          <SheetDescription style={{ color: colors.brownLight }}>
            {showFeedbackView
              ? 'Review feedback from your team on recent changes'
              : 'Recent updates and improvements. Let us know what you think!'}
          </SheetDescription>
        </SheetHeader>

        {/* Toggle between changelog and feedback view (managers only) */}
        {isManager && (
          <div className="flex gap-2 mt-4">
            <Button
              variant={showFeedbackView ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowFeedbackView(false)}
              style={!showFeedbackView ? { backgroundColor: colors.gold, color: colors.white } : { borderColor: colors.creamDark, color: colors.brown }}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              What's New
            </Button>
            <Button
              variant={showFeedbackView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFeedbackView(true)}
              style={showFeedbackView ? { backgroundColor: colors.gold, color: colors.white } : { borderColor: colors.creamDark, color: colors.brown }}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Team Feedback
              {needsAttention.length > 0 && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                  style={{ backgroundColor: colors.red, color: colors.white }}
                >
                  {needsAttention.length}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Changelog view */}
        {!showFeedbackView && (
          <div className="mt-6 space-y-4">
            {changelog.map((entry) => {
              const config = categoryConfig[entry.category];
              const Icon = config.icon;
              const myReview = myReviews[entry.id];
              const isCommenting = commentingOn === entry.id;
              const isSubmitting = submitting === entry.id;

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border p-4"
                  style={{ borderColor: colors.creamDark, backgroundColor: colors.cream + '40' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: config.color + '18', color: config.color }}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                        <span className="text-[11px]" style={{ color: colors.brownLight }}>
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold" style={{ color: colors.brown }}>
                        {entry.title}
                      </h4>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: colors.brownLight }}>
                        {entry.description}
                      </p>
                      {entry.tryIt && (
                        <button
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                          style={{ color: colors.gold }}
                          onClick={() => handleTryIt(entry)}
                        >
                          Try it <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Voting buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: colors.creamDark }}>
                    <button
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        myReview?.rating === 'up' ? '' : 'hover:bg-gray-100'
                      }`}
                      style={{
                        color: myReview?.rating === 'up' ? colors.green : colors.brownLight,
                        backgroundColor: myReview?.rating === 'up' ? colors.green + '12' : undefined,
                        outline: myReview?.rating === 'up' ? `1px solid ${colors.green}` : undefined,
                        outlineOffset: '-1px',
                      }}
                      disabled={isSubmitting}
                      onClick={() => submitReview(entry.id, 'up')}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-3.5 h-3.5" />
                      )}
                      Works great
                    </button>
                    <button
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        myReview?.rating === 'down' ? '' : 'hover:bg-gray-100'
                      }`}
                      style={{
                        color: myReview?.rating === 'down' ? colors.red : colors.brownLight,
                        backgroundColor: myReview?.rating === 'down' ? colors.red + '12' : undefined,
                        outline: myReview?.rating === 'down' ? `1px solid ${colors.red}` : undefined,
                        outlineOffset: '-1px',
                      }}
                      disabled={isSubmitting}
                      onClick={() => handleThumbsDown(entry.id)}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Needs work
                    </button>
                  </div>

                  {/* Comment input for thumbs-down */}
                  {isCommenting && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="What's not working? (optional)"
                        rows={2}
                        className="text-xs"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => handleSubmitComment(entry.id)}
                          style={{ backgroundColor: colors.gold, color: colors.white }}
                          className="text-xs h-7"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Submit
                        </Button>
                        <button
                          className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                          style={{ color: colors.brownLight }}
                          onClick={() => { setCommentingOn(null); setCommentText(''); }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show existing comment */}
                  {myReview?.comment && !isCommenting && (
                    <p
                      className="mt-2 text-[11px] italic px-2 py-1.5 rounded"
                      style={{ backgroundColor: colors.cream, color: colors.brownLight }}
                    >
                      Your note: {myReview.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Feedback view (managers only) */}
        {showFeedbackView && isManager && (
          <div className="mt-6 space-y-6">
            {needsAttention.length === 0 && allReviews.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: colors.creamDark }} />
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  No feedback submitted yet.
                </p>
              </div>
            )}

            {needsAttention.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.red }}>
                  Needs Attention ({needsAttention.length})
                </h3>
                {needsAttention.map(({ featureId, entry, stats }) => (
                  <div
                    key={featureId}
                    className="rounded-lg border p-3 mb-3"
                    style={{ borderColor: colors.red + '30', backgroundColor: colors.red + '06' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold" style={{ color: colors.brown }}>
                        {entry?.title || featureId}
                      </h4>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1" style={{ color: colors.green }}>
                          <ThumbsUp className="w-3 h-3" /> {stats.up}
                        </span>
                        <span className="flex items-center gap-1" style={{ color: colors.red }}>
                          <ThumbsDown className="w-3 h-3" /> {stats.down}
                        </span>
                      </div>
                    </div>
                    {stats.comments.length > 0 && (
                      <div className="space-y-1.5">
                        {stats.comments.map((c, i) => (
                          <div
                            key={i}
                            className="text-xs px-2.5 py-2 rounded"
                            style={{ backgroundColor: colors.cream, color: colors.brown }}
                          >
                            <span className="font-medium">{c.user}:</span>{' '}
                            <span style={{ color: colors.brownLight }}>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary of all features with feedback */}
            {Object.keys(feedbackStats).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.brownLight }}>
                  All Feedback
                </h3>
                {changelog.map((entry) => {
                  const stats = feedbackStats[entry.id];
                  if (!stats) return null;
                  return (
                    <div
                      key={entry.id}
                      className="py-3 border-b last:border-b-0"
                      style={{ borderColor: colors.creamDark }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: colors.brown }}>
                          {entry.title}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1" style={{ color: colors.green }}>
                            <ThumbsUp className="w-3 h-3" /> {stats.up}
                          </span>
                          <span className="flex items-center gap-1" style={{ color: stats.down > 0 ? colors.red : colors.brownLight }}>
                            <ThumbsDown className="w-3 h-3" /> {stats.down}
                          </span>
                        </div>
                      </div>
                      {stats.comments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {stats.comments.map((c, i) => (
                            <div
                              key={i}
                              className="text-xs px-2.5 py-1.5 rounded"
                              style={{ backgroundColor: colors.cream, color: colors.brown }}
                            >
                              <span className="font-medium">{c.user}:</span>{' '}
                              <span style={{ color: colors.brownLight }}>{c.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
