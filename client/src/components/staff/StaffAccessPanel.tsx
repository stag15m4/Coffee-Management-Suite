import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { getAuthHeaders } from '@/lib/api-helpers';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StaffProfile {
  id: string;
  full_name: string;
  staff_login_id: string | null;
  email: string;
}
interface RosterPerson {
  id: string;
  name: string;
  user_profile_id: string | null;
}
export function StaffAccessPanel({ tenantId, onChanged }: { tenantId: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'create' | 'link' | 'setup'>('create');
  const [fullName, setFullName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [tipId, setTipId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ loginId: string; setupLink: string | null } | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-access', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [profiles, tips] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id,full_name,email,staff_login_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('full_name'),
        supabase.from('tip_employees').select('id,name,user_profile_id').eq('tenant_id', tenantId).order('name'),
      ]);
      if (profiles.error) throw profiles.error;
      if (tips.error) throw tips.error;
      return { profiles: profiles.data as StaffProfile[], tips: tips.data as RosterPerson[] };
    },
  });
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage('');
    setResult(null);
    try {
      const response = await fetch('/api/staff-access', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          tenantId,
          action,
          fullName: fullName || undefined,
          loginId: loginId || undefined,
          tipEmployeeId: tipId || undefined,
          profileId: profileId || undefined,
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Staff access could not be updated');
      setMessage(
        value.message ||
          (action === 'link'
            ? 'Identity linked. Existing hours and scheduled shifts now use this account.'
            : 'Share this staff ID and private setup link with the employee. They choose their own password.')
      );
      if (value.loginId) setResult({ loginId: value.loginId, setupLink: value.setupLink });
      for (const key of [
        'staff-access',
        'all-employees',
        'time-clock',
        'shifts',
        'timesheet-approval',
        'timesheet-approvals',
      ])
        void queryClient.invalidateQueries({ queryKey: [key] });
      onChanged();
      if (action === 'create') {
        setFullName('');
        setLoginId('');
        setTipId('');
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff access — no email required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Staff sign in with a staff ID and their own password. Kiosk PINs still work on the shared tablet. Use an
          existing account when the person already has one.
        </p>
        {error && <p role="alert">{getErrorMessage(error)}</p>}
        <Label htmlFor="staff-action">Action</Label>
        <select
          id="staff-action"
          className="w-full border rounded p-2"
          disabled={pending}
          value={action}
          onChange={(e) => {
            setAction(e.target.value as typeof action);
            setResult(null);
            setMessage('');
            setTipId('');
            setProfileId('');
            setLoginId('');
            setFullName('');
          }}
        >
          <option value="create">Create employee account without email</option>
          <option value="link">Connect roster person to existing account</option>
          <option value="setup">Generate new password setup link</option>
        </select>
        {action !== 'setup' && (
          <div>
            <Label htmlFor="staff-roster">Existing tip roster person</Label>
            <select
              id="staff-roster"
              className="w-full border rounded p-2"
              disabled={pending || isLoading}
              value={tipId}
              onChange={(e) => {
                setTipId(e.target.value);
                const person = data?.tips.find((t) => t.id === e.target.value);
                if (person) setFullName(person.name);
              }}
            >
              <option value="">{action === 'create' ? 'New person — not on the roster' : 'Choose the person'}</option>
              {data?.tips
                .filter((t) => action === 'link' || !t.user_profile_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.user_profile_id ? ' (already linked — verify history)' : ''} · {t.id.slice(-6)}
                  </option>
                ))}
            </select>
            <p className="text-xs mt-1">Check the person's identity. Matching names alone do not connect records.</p>
          </div>
        )}
        {action === 'create' ? (
          <>
            <div>
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                value={fullName}
                disabled={pending}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="staff-id">Staff ID</Label>
              <Input
                id="staff-id"
                autoCapitalize="none"
                autoCorrect="off"
                value={loginId}
                disabled={pending}
                onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                placeholder="cob-lauren"
              />
              <p className="text-xs mt-1">
                Choose a unique ID, such as your store initials and first name. New accounts start with Employee
                permissions.
              </p>
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="staff-account">Account</Label>
            <select
              id="staff-account"
              className="w-full border rounded p-2"
              disabled={pending || isLoading}
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              <option value="">Choose the account</option>
              {data?.profiles
                .filter((p) => action === 'link' || p.staff_login_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} · {p.staff_login_id || p.email}
                  </option>
                ))}
            </select>
          </div>
        )}
        <Button
          onClick={submit}
          disabled={
            pending ||
            isLoading ||
            !!error ||
            (action === 'create' ? !fullName || !loginId : !profileId) ||
            (action === 'link' && !tipId)
          }
        >
          {pending
            ? 'Saving…'
            : action === 'create'
              ? 'Create staff account'
              : action === 'link'
                ? 'Confirm identity and link'
                : 'Generate setup link'}
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {result && (
          <div className="border rounded p-3 space-y-2">
            <p>
              <strong>Staff ID: {result.loginId}</strong>
            </p>
            {result.setupLink && (
              <>
                <Label htmlFor="staff-setup-link">Private password setup link</Label>
                <Input id="staff-setup-link" readOnly value={result.setupLink} onFocus={(e) => e.target.select()} />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `Staff ID: ${result.loginId}\nSet your password: ${result.setupLink}`
                      );
                      setMessage('Copied. Share privately with this employee.');
                    } catch {
                      setMessage('Select the link above and copy it manually.');
                    }
                  }}
                >
                  Copy staff ID and link
                </Button>
                <p className="text-xs">
                  Share privately; anyone with this link can set this account's password. Generate a new link here if it
                  expires. Do not open a staff member's link while signed in as yourself.
                </p>
              </>
            )}
            <Button variant="ghost" onClick={() => setResult(null)}>
              Hide credentials
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
