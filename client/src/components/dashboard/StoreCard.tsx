import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Wrench,
  Circle,
  Clock,
  User,
  CalendarDays,
} from 'lucide-react';
import type { StoreMetrics, ActionItem } from '@/hooks/use-store-metrics';
import { canViewSection } from '@/hooks/use-store-metrics';
import {
  useStoreTeamMembers,
  useStoreOperatingHours,
  getTodayHours,
  formatRelativeTime,
  getActivityColor,
} from '@/hooks/use-store-profile';
import { useTodayShifts } from '@/hooks/use-shifts';
import { formatTime } from '@/hooks/use-store-profile';
import { colors } from '@/lib/colors';

interface StoreCardProps {
  location: {
    id: string;
    name: string;
    parent_tenant_id?: string | null;
    starting_drawer_default?: number | null;
  };
  metrics: StoreMetrics | undefined;
  isLoading: boolean;
  isError: boolean;
  isParent: boolean;
}

const MAX_FACES = 6;

export function StoreCard({
  location,
  metrics,
  isLoading,
  isError,
  isParent,
}: StoreCardProps) {
  const { profile, switchLocation, tenant } = useAuth();
  const [, setLocation] = useLocation();

  const showHealth = canViewSection('health', profile?.role);

  const { data: teamMembers } = useStoreTeamMembers(location.id);
  const { data: operatingHours } = useStoreOperatingHours(location.id);
  const { data: todayShifts } = useTodayShifts(location.id);

  const todayHoursStr = getTodayHours(operatingHours);

  const handleCardClick = async () => {
    if (tenant?.id !== location.id) {
      await switchLocation(location.id);
    }
    setLocation(`/store/${location.id}`);
  };

  const handleItemClick = async (e: React.MouseEvent, moduleHref: string) => {
    e.stopPropagation();
    if (tenant?.id !== location.id) {
      await switchLocation(location.id);
    }
    setLocation(moduleHref);
  };

  // Group action items by urgency
  const overdueItems =
    metrics?.actionItems.filter((i) => i.urgency === 'overdue') || [];
  const todayItems =
    metrics?.actionItems.filter((i) => i.urgency === 'today') || [];
  const weekItems =
    metrics?.actionItems.filter((i) => i.urgency === 'this-week') || [];

  const visibleMembers = teamMembers?.slice(0, MAX_FACES) || [];
  const overflowCount = (teamMembers?.length || 0) - MAX_FACES;

  const lastTeamLogin = teamMembers?.reduce<string | null>((latest, m) => {
    if (!m.last_login_at) return latest;
    if (!latest) return m.last_login_at;
    return m.last_login_at > latest ? m.last_login_at : latest;
  }, null) ?? null;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      style={{ backgroundColor: colors.white }}
      onClick={handleCardClick}
    >
      {/* Header — store name + compact health info */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: store name + today's hours */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.cream }}
            >
              <Building2 className="w-5 h-5" style={{ color: colors.gold }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-bold text-lg"
                  style={{ color: colors.brown }}
                >
                  {location.name}
                </h3>
                {isParent && (
                  <Badge variant="secondary" className="text-xs">
                    Main
                  </Badge>
                )}
              </div>
              {todayHoursStr && (
                <div
                  className="flex items-center gap-1 text-sm"
                  style={{ color: colors.brownLight }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{todayHoursStr}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: compact revenue + red flag badges (owner/manager only) */}
          {!isLoading && metrics && showHealth && (
            <div className="flex items-center gap-4 flex-wrap">
              {metrics.revenue && (
                <button
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  onClick={(e) => handleItemClick(e, '/cash-deposit')}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: colors.brown }}
                  >
                    {formatCurrency(metrics.revenue.currentMonth)}
                  </span>
                  {metrics.revenue.lastMonth > 0 && (
                    <span
                      className="flex items-center gap-0.5 text-xs font-medium"
                      style={{
                        color:
                          metrics.revenue.trend === 'up'
                            ? colors.green
                            : colors.red,
                      }}
                    >
                      {metrics.revenue.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(metrics.revenue.percentChange).toFixed(1)}%
                    </span>
                  )}
                </button>
              )}
              {metrics.redFlags.overdueMaintenanceCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {metrics.redFlags.overdueMaintenanceCount} overdue maint.
                  </span>
                </div>
              )}
              {metrics.redFlags.overdueTaskCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {metrics.redFlags.overdueTaskCount} overdue task
                    {metrics.redFlags.overdueTaskCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {metrics.redFlags.unassignedTaskCount > 0 && (
                <div
                  className="flex items-center gap-1"
                  style={{ color: colors.orange }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {metrics.redFlags.unassignedTaskCount} unassigned
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Team faces row */}
        {visibleMembers.length > 0 && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex items-center">
              {visibleMembers.map((member, i) => (
                <div
                  key={member.id}
                  className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${i > 0 ? '-ml-1' : ''}`}
                  style={{
                    backgroundColor: colors.cream,
                    border: `1.5px solid ${colors.gold}`,
                    zIndex: MAX_FACES - i,
                    position: 'relative',
                  }}
                  title={member.full_name || member.email}
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User
                      className="w-4 h-4"
                      style={{ color: colors.brownLight }}
                    />
                  )}
                </div>
              ))}
              {overflowCount > 0 && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium -ml-1 flex-shrink-0"
                  style={{
                    backgroundColor: colors.cream,
                    color: colors.brown,
                    border: `1.5px solid ${colors.creamDark}`,
                    position: 'relative',
                  }}
                >
                  +{overflowCount}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span
                className="text-sm"
                style={{ color: colors.brownLight }}
              >
                {teamMembers?.length} team member{teamMembers?.length !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs"
                style={{ color: getActivityColor(lastTeamLogin) }}
              >
                Last active: {formatRelativeTime(lastTeamLogin)}
              </span>
            </div>
          </div>
        )}

        {/* Working Today */}
        {todayShifts && todayShifts.length > 0 && (
          <div
            className="flex items-center gap-2 py-2 mt-1"
            style={{ borderTop: `1px solid ${colors.cream}` }}
          >
            <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: colors.gold }} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium" style={{ color: colors.brown }}>
                {todayShifts.length} scheduled today
              </span>
              <span className="text-xs truncate" style={{ color: colors.brownLight }}>
                {todayShifts
                  .map((s) => s.employee_name?.split(' ')[0])
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3 py-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <p className="text-sm text-red-600 py-2">
            Unable to load metrics for this location.
          </p>
        )}

        {/* Action Items — grouped by urgency */}
        {!isLoading && !isError && metrics && (
          <>
            {metrics.actionItems.length > 0 ? (
              <div className="space-y-3 pt-2">
                {overdueItems.length > 0 && (
                  <UrgencyGroup
                    label="Overdue"
                    items={overdueItems}
                    labelColor={colors.red}
                    onItemClick={handleItemClick}
                  />
                )}
                {todayItems.length > 0 && (
                  <UrgencyGroup
                    label="Due Today"
                    items={todayItems}
                    labelColor={colors.orange}
                    onItemClick={handleItemClick}
                  />
                )}
                {weekItems.length > 0 && (
                  <UrgencyGroup
                    label="This Week"
                    items={weekItems}
                    labelColor={colors.brownLight}
                    onItemClick={handleItemClick}
                  />
                )}
              </div>
            ) : (
              <p
                className="text-sm py-2"
                style={{ color: colors.brownLight }}
              >
                No upcoming tasks or maintenance due
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Sub-components ---

const MAX_ITEMS_PER_GROUP = 3;

function UrgencyGroup({
  label,
  items,
  labelColor,
  onItemClick,
}: {
  label: string;
  items: ActionItem[];
  labelColor: string;
  onItemClick: (e: React.MouseEvent, href: string) => void;
}) {
  const shown = items.slice(0, MAX_ITEMS_PER_GROUP);
  const remaining = items.length - MAX_ITEMS_PER_GROUP;

  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-1"
        style={{ color: labelColor }}
      >
        {label}
      </p>
      <div className="space-y-1">
        {shown.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            onClick={(e) => onItemClick(e, item.moduleHref)}
          />
        ))}
        {remaining > 0 && (
          <button
            className="text-xs font-medium hover:opacity-80 transition-opacity pl-6"
            style={{ color: colors.gold }}
            onClick={(e) => onItemClick(e, shown[0].moduleHref)}
          >
            +{remaining} more →
          </button>
        )}
      </div>
    </div>
  );
}

function ActionItemRow({
  item,
  onClick,
}: {
  item: ActionItem;
  onClick: (e: React.MouseEvent) => void;
}) {
  const icon =
    item.type === 'maintenance' ? (
      <Wrench
        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
        style={{ color: colors.gold }}
      />
    ) : (
      <Circle
        className="w-3 h-3 flex-shrink-0 mt-1"
        style={{ color: getPriorityColor(item.priority) }}
        fill={getPriorityColor(item.priority)}
      />
    );

  return (
    <button
      className="w-full flex items-start gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors text-left group"
      onClick={onClick}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: colors.brown }}
        >
          {item.title}
        </p>
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: colors.brownLight }}
        >
          {item.assigneeName ? (
            <span>{item.assigneeName}</span>
          ) : item.type === 'maintenance' ? (
            <span className="italic">Equipment</span>
          ) : (
            <span className="italic" style={{ color: colors.orange }}>
              Unassigned
            </span>
          )}
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {formatRelativeDate(item.dueDate)}
          </span>
        </div>
      </div>
      <ChevronRight
        className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: colors.brownLight }}
      />
    </button>
  );
}

// --- Helpers ---

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return '1 day overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case 'high':
      return colors.red;
    case 'medium':
      return colors.orange;
    default:
      return '#3b82f6';
  }
}
