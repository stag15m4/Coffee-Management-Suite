import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { colors } from '@/lib/colors';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardWidgetProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  loading?: boolean;
  error?: string;
}

export function DashboardWidget({ title, icon: Icon, children, loading, error }: DashboardWidgetProps) {
  return (
    <Card style={{ backgroundColor: colors.white }} className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: colors.gold }}
          >
            <Icon className="w-5 h-5" style={{ color: colors.brown }} />
          </div>
          <CardTitle className="text-base" style={{ color: colors.brown }}>
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
