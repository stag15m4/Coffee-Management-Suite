import { useQuery } from '@tanstack/react-query';
import { HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-queries';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface HelpTipProps {
  term: string;
  children?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

interface HelpEntry {
  term_key: string;
  title: string;
  body: string;
  learn_more_url: string | null;
}

export function HelpTip({ term, children, side = 'top' }: HelpTipProps) {
  const { data: helpEntries } = useQuery<HelpEntry[]>({
    queryKey: ['help-content'],
    queryFn: async () => {
      const { data } = await supabase
        .from('help_content')
        .select('term_key, title, body, learn_more_url')
        .order('sort_order');
      return data || [];
    },
    staleTime: Infinity,
  });

  const entry = helpEntries?.find((e) => e.term_key === term);

  if (!children && !entry) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full transition-opacity opacity-50 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Help: ${entry?.title ?? term}`}
        >
          <HelpCircle
            className="text-primary"
            size={14}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed p-3">
        {children ?? (
          <div className="space-y-1">
            <p className="font-semibold text-secondary-foreground">{entry!.title}</p>
            <p className="text-secondary-foreground/80">{entry!.body}</p>
            {entry!.learn_more_url && (
              <a
                href={entry!.learn_more_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary text-xs underline mt-1"
              >
                Learn more
              </a>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
