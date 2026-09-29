# Staff access without email

## Deployment

Run the entire `supabase-migrations/153_staff_identity.sql` transaction in Supabase after corrected migration 152, confirm success, then merge/deploy this app change. The SQL starts with its migration number and prerequisites. Migration 153 creates the roster/profile link column if missing, without matching names. It does not create staff accounts or automatically reassign any existing person's history.

Server requirements: the existing Supabase service-role configuration, database connection, and trusted `APP_URL` must be available. Supabase Auth must allow the app's `/reset-password` redirect. Account creation and recovery use Supabase's admin API, so live setup-link redemption remains a deployment check.

## Manager workflow

Open **Settings → Team Members** (the existing `/admin/users` screen), then **Staff access — no email required**.

1. If the person already has an email account, keep it. Choose **Connect roster person to existing account**, select the exact roster person and account, and confirm the identity. Do not create a second login just to remove an email requirement.
2. For someone without an account, choose **Create employee account without email**. Select their existing tip roster row when applicable, enter their name and a unique staff ID such as `cob-lauren`, then create the account. New accounts receive Employee permissions.
3. Copy the staff ID and private setup link. Share them privately with that employee outside the app. No email is sent. The employee opens the link on their own device and chooses a password, then signs in with the staff ID and password. Do not open their setup link while signed in as the manager.
4. To reset a staff-ID password, choose **Generate new password setup link** for the existing account. Managers can reset Employee accounts; only Owners can reset privileged staff accounts. Email accounts keep their existing email reset workflow.
5. Set a new employee's kiosk PIN in the existing Details panel if needed. A linked roster person's existing PIN continues to work. Changing their profile PIN clears the old roster PIN. Staff IDs and passwords are for personal devices; kiosk PINs remain for the shared tablet.

A genuinely new person without a tip roster row gets an account only; tip eligibility is not assumed. If they later join the tip roster, connect that roster row to their existing account using the same panel.

## Identity and history behavior

Explicit links replace name-based merging in the combined employee list. Two accounts with the same name remain separate. Previously hidden duplicate-looking rows may become visible; verify identity before linking them.

A confirmed link fills missing account IDs on that roster person's existing time-clock entries, shifts, and shift templates, retaining the original record IDs and roster IDs. Breaks and tip payout history retain their existing references. Future kiosk/import/schedule writes with the roster ID resolve to the linked account. Account-based time-off and correction requests then use that account. Existing links from migration 131 can be explicitly confirmed through the panel to attach still-unassigned historical records. An older roster-only open kiosk shift remains reachable by its original roster identity until it is closed or explicitly linked.

The database rejects cross-location links, replacement of an existing link, conflicting account ownership, and overlapping recorded sessions between the two identities. Linking historical hours invalidates affected timesheet approvals via migration 152. Identity links record the manager and time in `staff_identity_history`; time-clock changes also retain their audit history. Fixing an incorrectly linked identity requires a separate reviewed correction; this UI does not silently unlink or move history.

## Security and limits

Staff IDs use internal, nondeliverable Auth identifiers; employees see their staff ID, not an assigned mailbox. Auth manages passwords, sessions, and link expiry. Setup links are generated, not emailed; they are returned with `Cache-Control: no-store`, never stored in localStorage, and excluded from HTTP response-body logs. Creating an Auth identity and saving the profile cannot be one distributed transaction: a failed profile/link transaction deletes only the newly created Auth user. If cleanup itself fails, the server logs that user's ID for manual cleanup. A failed setup-link request after a successful save retains the account and linked history; generate another link from the panel.

This release adds no SMS provider, email-to-staff-ID conversion, or self-service staff-ID recovery. Existing email accounts remain valid. Account creation and identity linking follow the manager's primary tenant, consistent with the existing Team Members administration screen. Cross-location staff administration remains separate. Training/certification rows keep their existing roster references; they are not rewritten by this migration.

After deployment, verify one roster link and one staff-ID setup on a non-manager test employee before staff rollout. Check personal-device login, kiosk PIN, historical hours, schedule, a time-off request, and a correction request requiring manager approval. Tests cover local/database behavior; live Supabase Auth delivery/redirect behavior and production device interaction are not confirmed by those tests.
