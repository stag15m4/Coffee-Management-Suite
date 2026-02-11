-- Rename existing tutorial videos to new format with recorder's name
-- Use Eastern time for date to match when users actually recorded

-- Seth's video
UPDATE maintenance_task_attachments
SET name = 'Seth-Tutorial-'
    || to_char(created_at AT TIME ZONE 'America/New_York', 'Mon-DD-YYYY')
    || '.webm'
WHERE name = 'tutorial-1770509227323.webm';

-- Kara's video
UPDATE maintenance_task_attachments
SET name = 'Kara-Tutorial-'
    || to_char(created_at AT TIME ZONE 'America/New_York', 'Mon-DD-YYYY')
    || '.webm'
WHERE name = 'tutorial-1770506028178.webm';

-- Fix tenant_id mismatch on existing task attachments.
-- Some were saved with the user's profile tenant instead of the task's tenant,
-- making them invisible to other team members via RLS.
UPDATE maintenance_task_attachments mta
SET tenant_id = mt.tenant_id
FROM maintenance_tasks mt
WHERE mta.task_id = mt.id
  AND mta.tenant_id != mt.tenant_id;
