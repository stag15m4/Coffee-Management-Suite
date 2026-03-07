-- Add report_type column to bug_reports for feedback and suggestions
alter table bug_reports
  add column if not exists report_type text not null default 'bug'
  check (report_type in ('bug', 'suggestion', 'feedback'));
