import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link2, Unlink, Loader2, BookOpen } from 'lucide-react';
import { colors } from '@/lib/colors';
import { useQboStatus, useQboConnect, useQboDisconnect } from '@/hooks/use-budget';

export default function QboIntegrationSettings() {
  const { tenant } = useAuth();
  const tenantId = tenant?.parent_tenant_id || tenant?.id || '';
  const { toast } = useToast();

  const { data: status, isLoading } = useQboStatus(tenantId);
  const connect = useQboConnect();
  const disconnect = useQboDisconnect();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    if (!tenantId) return;
    connect.mutate(tenantId);
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnecting(true);
    try {
      await disconnect.mutateAsync(tenantId);
      toast({ title: 'QuickBooks disconnected' });
    } catch (err: unknown) {
      toast({ title: 'Failed to disconnect', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card style={{ borderColor: colors.creamDark }}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.gold }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: colors.creamDark }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <BookOpen className="h-5 w-5" />
              QuickBooks Online
            </CardTitle>
            <CardDescription>Sync chart of accounts and actuals from QuickBooks</CardDescription>
          </div>
          {status?.connected ? (
            <Badge className="text-white" style={{ backgroundColor: colors.green }}>
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" style={{ borderColor: colors.creamDark, color: colors.brownLight }}>
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.connected ? (
          <div className="text-center py-6">
            <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
              Connect your QuickBooks Online account to import your chart of accounts and sync P&L actuals into the
              Financial Budget module.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connect.isPending}
              style={{ backgroundColor: colors.gold, color: '#fff' }}
            >
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Connect to QuickBooks
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm" style={{ color: colors.brownLight }}>
                Company ID: <span className="font-mono">{status.realmId}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Unlink className="h-4 w-4 mr-1" />
                )}
                Disconnect
              </Button>
            </div>

            {status.connectedAt && (
              <div className="text-xs" style={{ color: colors.brownLight }}>
                Connected {new Date(status.connectedAt).toLocaleDateString()}
              </div>
            )}

            {status.lastSyncAt && (
              <div className="text-xs" style={{ color: colors.brownLight }}>
                Last synced {new Date(status.lastSyncAt).toLocaleString()}
              </div>
            )}

            <p className="text-xs pt-2" style={{ color: colors.brownLight }}>
              Use the Financial Budget module to sync your chart of accounts and P&L actuals.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
