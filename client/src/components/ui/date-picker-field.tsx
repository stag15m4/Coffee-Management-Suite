import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * In-app date picker that replaces native <input type="date"> overlays.
 *
 * Native date popovers are broken in iPadOS home-screen (standalone) web apps —
 * they dismiss themselves within a second and the value can't be changed. This
 * renders the same styled trigger but opens a react-day-picker calendar in a
 * Popover instead, which works identically in Safari and standalone mode.
 *
 * Values are YYYY-MM-DD strings, matching how dates are stored across the app.
 */
interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

function parseLocalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value + 'T00:00:00');
  return isNaN(d.getTime()) ? undefined : d;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePickerField({
  value,
  onChange,
  children,
  className,
  style,
  'data-testid': dataTestId,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className} style={style} data-testid={dataTestId}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(formatLocalDate(date));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
