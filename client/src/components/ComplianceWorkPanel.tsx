import { useEffect, useState } from 'react';
import { getAuthHeaders } from '@/lib/api-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
interface Duty {
  id: string;
  title: string;
  due_date: string;
  owner_name: string;
  stage: string;
  evidence_requirements: string;
  revision: number;
  is_bound: boolean;
  orphaned: boolean;
  feedback: string | null;
}
async function encodeFiles(files: File[]) {
  if (files.length > 3 || files.reduce((n, f) => n + f.size, 0) > 5 * 1024 * 1024)
    throw new Error('Attach up to three PDF or image files, with a combined size of 5 MB.');
  return Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      mime_type: file.type,
      data: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
    }))
  );
}
export function ComplianceWorkPanel({ tenantId }: { tenantId: string }) {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<Record<string, { notes: string; reference: string; files: File[] }>>({});
  async function load() {
    const res = await fetch(`/api/compliance/work?tenant_id=${encodeURIComponent(tenantId)}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to load assigned duties');
    setDuties(data.duties || []);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [tenantId]);
  function form(id: string) {
    return forms[id] || { notes: '', reference: '', files: [] };
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">My compliance duties</h2>
        <p className="text-sm text-gray-600">
          Submit the required evidence to your accountable owner. Submission does not close the obligation.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!duties.length && !error && <p>No compliance duties are assigned to you.</p>}
      {duties.map((d) => (
        <Card key={d.id}>
          <CardHeader>
            <CardTitle>{d.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              Due {d.due_date} · Owner: {d.owner_name} · {d.stage.replace(/_/g, ' ')}
            </p>
            <p className="whitespace-pre-wrap">Required evidence: {d.evidence_requirements}</p>
            {d.feedback && <p className="rounded bg-amber-50 p-3">Owner feedback: {d.feedback}</p>}
            {d.orphaned || !d.is_bound ? (
              <p>This assignment needs attention before work can be submitted.</p>
            ) : (
              ['open', 'returned'].includes(d.stage) && (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    try {
                      const f = form(d.id);
                      const files = await encodeFiles(f.files);
                      const res = await fetch(`/api/compliance/work/${encodeURIComponent(d.id)}/submit`, {
                        method: 'POST',
                        headers: await getAuthHeaders(),
                        body: JSON.stringify({
                          tenant_id: tenantId,
                          revision: d.revision,
                          notes: f.notes,
                          confirmation_reference: f.reference,
                          files,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.message || data.error || 'Unable to submit');
                      setForms((prev) => ({ ...prev, [d.id]: { notes: '', reference: '', files: [] } }));
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Unable to submit');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block">
                    What was completed
                    <Textarea
                      required
                      minLength={10}
                      maxLength={8000}
                      value={form(d.id).notes}
                      onChange={(e) =>
                        setForms((prev) => ({ ...prev, [d.id]: { ...form(d.id), notes: e.target.value } }))
                      }
                    />
                  </label>
                  <label className="block">
                    Confirmation or filing reference
                    <Input
                      maxLength={500}
                      value={form(d.id).reference}
                      onChange={(e) =>
                        setForms((prev) => ({ ...prev, [d.id]: { ...form(d.id), reference: e.target.value } }))
                      }
                    />
                  </label>
                  <label className="block">
                    Evidence files (PDF or images, up to 5 MB total)
                    <Input
                      type="file"
                      multiple
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        setForms((prev) => ({
                          ...prev,
                          [d.id]: { ...form(d.id), files: Array.from(e.target.files || []) },
                        }))
                      }
                    />
                  </label>
                  <Button disabled={busy}>{busy ? 'Submitting…' : 'Submit for owner verification'}</Button>
                </form>
              )
            )}
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => load().catch((e) => setError(e.message))}>
        Refresh duties
      </Button>
    </div>
  );
}
