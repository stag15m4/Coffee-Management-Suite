# Legal compliance connection

Dated Administrative Tasks in the **Compliance** category are exported to Legal.
The workforce calendar can create a Compliance task and displays its due date.
Edit completion, recurrence, assignment, and documents in Administrative Tasks.
Calendar events and staffing records are not included in the export.

Configure COMPLIANCE_SERVICE_TOKEN as a new dedicated read-only key. Configure
COMPLIANCE_ALLOWED_TENANT_IDS for the businesses Legal may connect; when unset it
uses ALFRED_ALLOWED_TENANT_IDS, and an explicitly empty value denies all businesses.
Set the same key as CMS_COMPLIANCE_TOKEN on Legal and set CMS_COMPLIANCE_URL to this
app's HTTPS origin. In Legal's Compliance Calendar → Business connections, map the
business to its existing Legal entity. No new CMS SQL migration is required.

GET /api/integrations/compliance/tenants lists authorized businesses.
GET /api/integrations/compliance?tenant_id=UUID returns the version 1 complete
snapshot. Both require X-Compliance-Token. Dates are YYYY-MM-DD, stable task IDs
support deduplication, and completion/cancellation/removal follow the source task.
Legal preserves the last good copy on a failed sync and normally checks once a minute.

Companion implementation: stag15m4/Loan-Docs (hub), stag15m4/Laundroweb (second
source), stag15m4/The-Consultant on claude/personal-ai-assistant-Eq5os (Alfred).
