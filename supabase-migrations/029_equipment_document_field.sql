-- Migration: Add document URL field to equipment table for warranty documents
-- This stores the object storage path for uploaded warranty invoices/documents

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS document_name TEXT;

COMMENT ON COLUMN equipment.document_url IS 'Object storage path for warranty invoice/document';
COMMENT ON COLUMN equipment.document_name IS 'Original filename of the uploaded document';
