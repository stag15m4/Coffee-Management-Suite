import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquarePlus, Send, Loader2 } from 'lucide-react';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',
};

type FeedbackType = 'bug' | 'suggestion' | 'general';

interface FeedbackFormData {
  type: FeedbackType;
  subject: string;
  description: string;
}

export function FeedbackButton() {
  const { user, profile, tenant } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'general',
    subject: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a description',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType: formData.type,
          subject: formData.subject || `${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} Report`,
          description: formData.description,
          pageUrl: window.location.href,
          browserInfo: navigator.userAgent,
          userEmail: user?.email || profile?.email,
          userName: profile?.full_name,
          tenantId: tenant?.id,
          tenantName: tenant?.name,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Feedback Submitted',
          description: 'Thank you! Your feedback has been sent to our team.',
        });
        setFormData({ type: 'general', subject: '', description: '' });
        setIsOpen(false);
      } else {
        throw new Error(result.error || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Feedback submission error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeLabel = (type: FeedbackType) => {
    switch (type) {
      case 'bug': return 'Bug Report';
      case 'suggestion': return 'Suggestion';
      case 'general': return 'General Feedback';
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-semibold transition-all hover:scale-105"
        style={{ backgroundColor: colors.gold, color: colors.white }}
        data-testid="button-feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
          className="max-w-md"
          style={{ backgroundColor: colors.white }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>
              Send Feedback
            </DialogTitle>
            <DialogDescription style={{ color: colors.brownLight }}>
              Report a bug, suggest an improvement, or share your thoughts
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: FeedbackType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger 
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="select-feedback-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="general">General Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Subject (optional)</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary..."
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-feedback-subject"
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={
                  formData.type === 'bug'
                    ? "Please describe the issue you encountered. What were you trying to do? What happened instead?"
                    : formData.type === 'suggestion'
                    ? "What improvement would you like to see? How would it help you?"
                    : "Share your thoughts with us..."
                }
                rows={5}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-feedback-description"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                style={{ borderColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-feedback"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.description.trim()}
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-submit-feedback"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
