import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { colors } from '@/lib/colors';
import SquareIntegrationSettings from '@/components/square/SquareIntegrationSettings';

export default function AdminIntegrations() {
  const { tenant, branding, primaryTenant } = useAuth();
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || '');

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg hover:opacity-80"
            style={{ backgroundColor: colors.goldLight }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: colors.gold }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: colors.brown }}>
              Integrations
            </h1>
            {displayName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {displayName}
              </p>
            )}
          </div>
        </div>

        {/* Square Integration */}
        <SquareIntegrationSettings />
      </div>
    </div>
  );
}
