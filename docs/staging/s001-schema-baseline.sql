-- Staging baseline S001: schema-only snapshot; ONLY CMS Staging iuugcktfbpdlljmmpfrl.
-- Not a production migration. No application records, secrets, Auth users, Storage objects or jobs copied.
SET LOCAL check_function_bodies = off;
SET LOCAL search_path = public, extensions;
CREATE TYPE public."recurrence_type" AS ENUM ('none','daily','weekly','monthly','quarterly','yearly');
CREATE TYPE public."shift_status" AS ENUM ('draft','published','cancelled');
CREATE TYPE public."task_priority" AS ENUM ('low','medium','high');
CREATE TYPE public."task_status" AS ENUM ('pending','in_progress','completed','cancelled');
CREATE TYPE public."time_off_category" AS ENUM ('vacation','sick','personal','bereavement','other');
CREATE TYPE public."time_off_status" AS ENUM ('pending','approved','denied','cancelled');
CREATE TYPE public."user_role" AS ENUM ('owner','manager','lead','employee');
CREATE SEQUENCE public."reseller_volume_tiers_id_seq" AS integer START 1;
CREATE SEQUENCE public."reseller_invoice_number_seq" AS bigint START 1;
CREATE TABLE public."account_businesses" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"color" text DEFAULT '#6366f1'::text NOT NULL,
"display_order" integer DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."admin_task_categories" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"color" text DEFAULT '#C9A227'::text,
"is_default" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."admin_task_comments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"task_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"content" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."admin_task_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"task_id" uuid NOT NULL,
"user_id" uuid,
"action" text NOT NULL,
"old_value" text,
"new_value" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."admin_tasks" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"title" text NOT NULL,
"description" text,
"category_id" uuid,
"assigned_to" uuid,
"created_by" uuid,
"priority" task_priority DEFAULT 'medium'::task_priority NOT NULL,
"status" task_status DEFAULT 'pending'::task_status NOT NULL,
"due_date" date,
"completed_at" timestamp with time zone,
"completed_by" uuid,
"recurrence" recurrence_type DEFAULT 'none'::recurrence_type NOT NULL,
"next_recurrence_date" date,
"parent_task_id" uuid,
"document_url" text,
"document_name" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"estimated_cost" numeric(10,2),
"is_admin_only" boolean DEFAULT false NOT NULL);
CREATE TABLE public."alfred_confirmation_tokens" (
"token" text NOT NULL,
"tenant_id" uuid NOT NULL,
"action" text NOT NULL,
"payload" jsonb NOT NULL,
"summary" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"expires_at" timestamp with time zone NOT NULL,
"used_at" timestamp with time zone);
CREATE TABLE public."audit_logs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"actor_id" uuid NOT NULL,
"action" text NOT NULL,
"resource_type" text NOT NULL,
"resource_id" uuid,
"old_value" jsonb,
"new_value" jsonb,
"ip_address" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."base_template_ingredients" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"base_template_id" uuid,
"ingredient_id" uuid,
"size_id" uuid,
"quantity" numeric(10,4) DEFAULT 1 NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"unit" text DEFAULT 'each'::text);
CREATE TABLE public."base_templates" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"drink_type" text NOT NULL,
"description" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL);
CREATE TABLE public."blackout_dates" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"label" text NOT NULL,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"reason" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_chart_of_accounts" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"account_number" text,
"name" text NOT NULL,
"account_type" text NOT NULL,
"detail_type" text,
"parent_id" uuid,
"depth" integer DEFAULT 0 NOT NULL,
"display_order" integer DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_fiscal_years" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"year" integer NOT NULL,
"start_month" integer DEFAULT 1 NOT NULL,
"status" text DEFAULT 'draft'::text NOT NULL,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_forecast_drivers" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"scenario_id" uuid NOT NULL,
"target_account_id" uuid NOT NULL,
"driver_type" text NOT NULL,
"source_account_id" uuid,
"driver_value" numeric(12,4) DEFAULT 0 NOT NULL,
"apply_months" integer[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}'::integer[] NOT NULL,
"priority" integer DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_forecast_line_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"scenario_id" uuid NOT NULL,
"account_id" uuid NOT NULL,
"month" integer NOT NULL,
"forecast_amount" numeric(12,2) DEFAULT 0 NOT NULL,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_forecast_scenarios" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"fiscal_year_id" uuid NOT NULL,
"name" text NOT NULL,
"description" text,
"is_default" boolean DEFAULT false NOT NULL,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_import_logs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"import_type" text NOT NULL,
"file_name" text NOT NULL,
"rows_imported" integer DEFAULT 0 NOT NULL,
"rows_skipped" integer DEFAULT 0 NOT NULL,
"errors" jsonb,
"imported_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."budget_line_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"fiscal_year_id" uuid NOT NULL,
"account_id" uuid NOT NULL,
"month" integer NOT NULL,
"budget_amount" numeric(12,2) DEFAULT 0 NOT NULL,
"actual_amount" numeric(12,2),
"forecast_amount" numeric(12,2),
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"prior_year_actual" numeric(12,2));
CREATE TABLE public."budget_seasonal_patterns" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"month_weights" numeric(5,4)[] DEFAULT '{1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0}'::numeric[] NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."bug_reports" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"submitted_by" uuid NOT NULL,
"submitted_by_name" text,
"submitted_by_email" text,
"title" text NOT NULL,
"description" text NOT NULL,
"severity" text DEFAULT 'medium'::text NOT NULL,
"status" text DEFAULT 'open'::text NOT NULL,
"admin_notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"screenshot_url" text,
"report_type" text DEFAULT 'bug'::text NOT NULL);
CREATE TABLE public."business_accounts" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"service_name" text NOT NULL,
"service_url" text,
"business" text DEFAULT 'Erwin Mills'::text NOT NULL,
"category" text DEFAULT 'Other'::text NOT NULL,
"username_or_email" text,
"cost" numeric(10,2),
"billing_cycle" text DEFAULT 'Monthly'::text NOT NULL,
"renewal_date" date,
"auto_renew" boolean DEFAULT true NOT NULL,
"status" text DEFAULT 'Active'::text NOT NULL,
"notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."calendar_events" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"title" text NOT NULL,
"description" text,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"location" text,
"color" text DEFAULT '#3b82f6'::text,
"source" text DEFAULT 'manual'::text NOT NULL,
"ical_uid" text,
"ical_subscription_id" uuid,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."cash_activity" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"drawer_date" date NOT NULL,
"gross_revenue" numeric(10,2) DEFAULT 0,
"starting_drawer" numeric(10,2) DEFAULT 200,
"cash_sales" numeric(10,2) DEFAULT 0,
"tip_pool" numeric(10,2) DEFAULT 0,
"owner_tips" numeric(10,2) DEFAULT 0,
"pay_in" numeric(10,2) DEFAULT 0,
"pay_out" numeric(10,2) DEFAULT 0,
"actual_deposit" numeric(10,2) DEFAULT 0,
"calculated_deposit" numeric(10,2) GENERATED ALWAYS AS ((((((cash_sales - tip_pool) - owner_tips) - pay_out) + pay_in) - ((200)::numeric - starting_drawer))) STORED,
"notes" text,
"flagged" boolean DEFAULT false,
"archived" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"cash_refund" numeric(10,2) DEFAULT 0,
"excluded_from_average" boolean DEFAULT false,
"transaction_count" integer);
CREATE TABLE public."certification_types" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"description" text,
"default_validity_months" integer,
"issuing_body" text,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."coffee_order_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"order_date" timestamp with time zone DEFAULT now(),
"items" jsonb DEFAULT '{}'::jsonb NOT NULL,
"units" integer DEFAULT 0 NOT NULL,
"total_cost" numeric(10,2),
"notes" text,
"sent_to_vendor" boolean DEFAULT false,
"vendor_email" text,
"created_at" timestamp with time zone DEFAULT now(),
"retail_labels" jsonb,
"vendor_id" uuid,
"received_at" timestamp with time zone);
CREATE TABLE public."compliance_workflow_links" (
"task_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"obligation_id" uuid NOT NULL,
"parent_obligation_id" uuid,
"is_placeholder" boolean DEFAULT false NOT NULL,
"revision" integer NOT NULL,
"owner_name" text NOT NULL,
"assignee_id" uuid,
"evidence_requirements" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."compliance_workflow_receipts" (
"event_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"task_id" uuid NOT NULL,
"response" jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."connecteam_employee_mappings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"connecteam_user_id" text NOT NULL,
"connecteam_user_name" text NOT NULL,
"tip_employee_id" uuid,
"status" text DEFAULT 'suggested'::text NOT NULL,
"confirmed_by" uuid,
"confirmed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."connecteam_settings" (
"tenant_id" uuid NOT NULL,
"api_key" text NOT NULL,
"time_clock_id" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"rate_limited_until" timestamp with time zone);
CREATE TABLE public."conversation_participants" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"conversation_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"is_admin" boolean DEFAULT false NOT NULL,
"last_read_at" timestamp with time zone,
"joined_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."conversations" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"type" text NOT NULL,
"name" text,
"description" text,
"created_by" uuid,
"is_system" boolean DEFAULT false NOT NULL,
"system_role" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."document_acknowledgments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"document_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."document_categories" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"display_order" integer DEFAULT 0 NOT NULL,
"is_default" boolean DEFAULT false NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."documents" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"category_id" uuid,
"title" text NOT NULL,
"description" text,
"file_url" text NOT NULL,
"file_name" text NOT NULL,
"file_type" text,
"file_size" bigint,
"min_role_required" user_role DEFAULT 'employee'::user_role NOT NULL,
"requires_acknowledgment" boolean DEFAULT false NOT NULL,
"uploaded_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"review_interval_days" integer,
"last_reviewed_at" timestamp with time zone,
"last_reviewed_by" uuid,
"review_assigned_to" uuid,
"is_archived" boolean DEFAULT false NOT NULL);
CREATE TABLE public."employee_certifications" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"certification_type_id" uuid NOT NULL,
"employee_id" uuid,
"tip_employee_id" uuid,
"training_class_id" uuid,
"issue_date" date NOT NULL,
"expiry_date" date,
"certificate_number" text,
"document_url" text,
"status" text DEFAULT 'active'::text NOT NULL,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."employee_unavailability" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"all_day" boolean DEFAULT true NOT NULL,
"start_time" time without time zone,
"end_time" time without time zone,
"reason" text,
"is_recurring" boolean DEFAULT false NOT NULL,
"recurrence_day" integer,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."equipment" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"category" text,
"notes" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"has_warranty" boolean DEFAULT false,
"purchase_date" date,
"warranty_duration_months" integer,
"warranty_notes" text,
"document_url" text,
"document_name" text,
"in_service_date" date,
"photo_url" text,
"license_state" text,
"license_plate" text,
"vin" text,
"model" text,
"serial_number" text,
"current_mileage" integer,
"assigned_to" uuid);
CREATE TABLE public."equipment_attachments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"equipment_id" uuid NOT NULL,
"attachment_type" text NOT NULL,
"name" text NOT NULL,
"url" text NOT NULL,
"file_type" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."feature_reviews" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid,
"user_id" uuid,
"feature_id" text NOT NULL,
"rating" text NOT NULL,
"comment" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."food_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"category_id" uuid,
"name" text NOT NULL,
"cost" numeric(10,2) DEFAULT 0 NOT NULL,
"units_per_case" integer DEFAULT 1,
"cost_per_unit" numeric(10,4) GENERATED ALWAYS AS (
CASE
    WHEN (units_per_case > 0) THEN (cost / (units_per_case)::numeric)
    ELSE (0)::numeric
END) STORED,
"sale_price" numeric(10,2) DEFAULT 0 NOT NULL,
"vendor" text,
"notes" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL);
CREATE TABLE public."growth_tracker_monthly" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"year" integer NOT NULL,
"month" integer NOT NULL,
"gross_revenue" numeric(12,2) DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."help_content" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"term_key" text NOT NULL,
"vertical_id" uuid,
"title" text NOT NULL,
"body" text NOT NULL,
"learn_more_url" text,
"sort_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ical_subscriptions" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"url" text NOT NULL,
"color" text DEFAULT '#3b82f6'::text,
"last_synced_at" timestamp with time zone,
"sync_error" text,
"is_active" boolean DEFAULT true,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ingredient_categories" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"display_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL);
CREATE TABLE public."ingredients" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"category_id" uuid,
"name" text NOT NULL,
"cost" numeric(10,2) DEFAULT 0 NOT NULL,
"quantity" numeric(10,4) DEFAULT 1 NOT NULL,
"unit" text DEFAULT 'each'::text NOT NULL,
"cost_per_unit" numeric(10,6) GENERATED ALWAYS AS (
CASE
    WHEN (quantity > (0)::numeric) THEN (cost / quantity)
    ELSE (0)::numeric
END) STORED,
"secondary_unit" text,
"secondary_conversion" numeric(10,6),
"cost_per_secondary" numeric(10,6) GENERATED ALWAYS AS (
CASE
    WHEN ((quantity > (0)::numeric) AND (secondary_conversion > (0)::numeric)) THEN ((cost / quantity) * secondary_conversion)
    ELSE NULL::numeric
END) STORED,
"vendor" text,
"manufacturer" text,
"item_number" text,
"is_active" boolean DEFAULT true,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"usage_unit" text,
"ingredient_type" text DEFAULT 'Drink Ingredient'::text,
"tenant_id" uuid NOT NULL,
"vendor_id" uuid);
CREATE TABLE public."license_codes" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"code" text NOT NULL,
"reseller_id" uuid NOT NULL,
"tenant_id" uuid,
"subscription_plan" text DEFAULT 'premium'::text,
"redeemed_at" timestamp with time zone,
"expires_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now(),
"created_by" uuid,
"vertical_id" uuid,
"invited_email" text);
CREATE TABLE public."maintenance_logs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"task_id" uuid NOT NULL,
"completed_at" timestamp with time zone DEFAULT now(),
"completed_by" text,
"notes" text,
"usage_at_completion" integer,
"created_at" timestamp with time zone DEFAULT now(),
"cost" numeric(10,2) DEFAULT NULL::numeric,
"mileage_at_completion" integer);
CREATE TABLE public."maintenance_task_attachments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"task_id" uuid NOT NULL,
"attachment_type" text NOT NULL,
"name" text NOT NULL,
"url" text NOT NULL,
"file_type" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."maintenance_tasks" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"equipment_id" uuid NOT NULL,
"name" text NOT NULL,
"description" text,
"interval_type" text DEFAULT 'time'::text NOT NULL,
"interval_days" integer,
"interval_units" integer,
"usage_unit_label" text,
"current_usage" integer DEFAULT 0,
"last_completed_at" timestamp with time zone,
"next_due_at" timestamp with time zone,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"estimated_cost" numeric(10,2),
"image_url" text);
CREATE TABLE public."messages" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"conversation_id" uuid NOT NULL,
"sender_id" uuid NOT NULL,
"content" text,
"attachment_url" text,
"attachment_type" text,
"attachment_name" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"deleted_at" timestamp with time zone);
CREATE TABLE public."modules" (
"id" text NOT NULL,
"name" text NOT NULL,
"description" text,
"display_order" integer DEFAULT 0,
"monthly_price" numeric(10,2) DEFAULT 0,
"is_premium_only" boolean DEFAULT false,
"rollout_status" text DEFAULT 'ga'::text NOT NULL);
CREATE TABLE public."overhead_items" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"amount" numeric(12,2) DEFAULT 0 NOT NULL,
"frequency" text DEFAULT 'monthly'::text NOT NULL,
"sort_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."overhead_settings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"cost_per_minute" numeric(10,4) DEFAULT 2.26 NOT NULL,
"minutes_per_drink" numeric(10,2) DEFAULT 1 NOT NULL,
"notes" text,
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL,
"operating_days_per_week" integer DEFAULT 7,
"hours_open_per_day" numeric(4,2) DEFAULT 8,
"owner_tips_enabled" boolean DEFAULT true,
"use_store_hours" boolean DEFAULT true,
"growth_open_month" integer,
"growth_open_year" integer,
"items_per_transaction" numeric(6,2) DEFAULT 1,
"prices_include_tax" boolean DEFAULT false,
"sales_tax_rate" numeric(8,6) DEFAULT 0);
CREATE TABLE public."platform_admins" (
"id" uuid NOT NULL,
"email" text NOT NULL,
"full_name" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"last_login_at" timestamp with time zone);
CREATE TABLE public."platform_cost_settings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"hosting" numeric(10,2) DEFAULT 0,
"supabase" numeric(10,2) DEFAULT 0,
"stripe_fee_percent" numeric(5,2) DEFAULT 2.9,
"support_labor" numeric(10,2) DEFAULT 0,
"other" numeric(10,2) DEFAULT 0,
"notes" text,
"updated_at" timestamp with time zone DEFAULT now(),
"updated_by" uuid);
CREATE TABLE public."product_categories" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"display_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL);
CREATE TABLE public."product_sizes" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"size_value" integer NOT NULL,
"product_type" text NOT NULL,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL,
"size_unit" text DEFAULT 'oz'::text NOT NULL);
CREATE TABLE public."products" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"recipe_id" uuid,
"size_id" uuid,
"sale_price" numeric(10,2) DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid NOT NULL);
CREATE TABLE public."recipe_ingredients" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"recipe_id" uuid,
"ingredient_id" uuid,
"size_id" uuid,
"quantity" numeric(10,4) DEFAULT 0 NOT NULL,
"unit" text,
"created_at" timestamp with time zone DEFAULT now(),
"syrup_recipe_id" uuid);
CREATE TABLE public."recipe_size_bases" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"recipe_id" uuid NOT NULL,
"size_id" uuid NOT NULL,
"base_template_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."recipe_size_pricing" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"recipe_id" uuid NOT NULL,
"size_id" uuid NOT NULL,
"sale_price" numeric(10,2) DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."recipe_vendors" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"phone" text,
"email" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."recipes" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"category_id" uuid,
"name" text NOT NULL,
"description" text,
"base_template_id" uuid,
"available_sizes" text[] DEFAULT ARRAY['12oz Hot'::text, '16oz Cold'::text, '20oz Hot'::text, '24oz Cold'::text],
"is_active" boolean DEFAULT true,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"is_bulk_recipe" boolean DEFAULT false NOT NULL,
"tenant_id" uuid NOT NULL,
"minutes_per_drink" numeric(5,2) DEFAULT NULL::numeric);
CREATE TABLE public."referral_codes" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"code" text NOT NULL,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."referral_redemptions" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"referral_code_id" uuid NOT NULL,
"referrer_tenant_id" uuid NOT NULL,
"referred_tenant_id" uuid NOT NULL,
"redeemed_at" timestamp with time zone DEFAULT now(),
"referrer_reward_applied" boolean DEFAULT false,
"referee_reward_applied" boolean DEFAULT false,
"referrer_stripe_coupon_id" text,
"referee_stripe_coupon_id" text);
CREATE TABLE public."reseller_invoices" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"reseller_id" uuid NOT NULL,
"stripe_invoice_id" text,
"invoice_number" text NOT NULL,
"status" text DEFAULT 'draft'::text NOT NULL,
"payment_method" text,
"billable_seats" integer NOT NULL,
"rate_per_seat" numeric(10,2) NOT NULL,
"subtotal" numeric(10,2) NOT NULL,
"surcharge_amount" numeric(10,2) DEFAULT 0,
"total" numeric(10,2) NOT NULL,
"period_start" date NOT NULL,
"period_end" date NOT NULL,
"due_date" date NOT NULL,
"paid_at" timestamp with time zone,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"created_by" uuid);
CREATE TABLE public."reseller_volume_tiers" (
"id" integer DEFAULT nextval('reseller_volume_tiers_id_seq'::regclass) NOT NULL,
"min_locations" integer NOT NULL,
"max_locations" integer,
"discount_percent" numeric(5,2) NOT NULL,
"label" text NOT NULL);
CREATE TABLE public."resellers" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"contact_email" text NOT NULL,
"contact_name" text,
"phone" text,
"company_address" text,
"seats_total" integer DEFAULT 0 NOT NULL,
"seats_used" integer DEFAULT 0 NOT NULL,
"stripe_customer_id" text,
"notes" text,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"revenue_share_percent" numeric(5,2) DEFAULT 0,
"tier" text DEFAULT 'authorized'::text,
"discount_percent" numeric(5,2) DEFAULT 20,
"minimum_seats" integer DEFAULT 0,
"billing_cycle" text DEFAULT 'monthly'::text,
"annual_commitment" integer DEFAULT 0,
"tier_updated_at" timestamp with time zone,
"wholesale_rate_per_seat" numeric(10,2) DEFAULT 0,
"card_surcharge_percent" numeric(5,2) DEFAULT 4.00);
CREATE TABLE public."shift_templates" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"day_of_week" integer,
"start_time" time without time zone NOT NULL,
"end_time" time without time zone NOT NULL,
"position" text,
"employee_id" uuid,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tip_employee_id" uuid,
"employee_name" text);
CREATE TABLE public."shifts" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid,
"date" date NOT NULL,
"start_time" time without time zone NOT NULL,
"end_time" time without time zone NOT NULL,
"position" text,
"notes" text,
"status" shift_status DEFAULT 'draft'::shift_status NOT NULL,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tip_employee_id" uuid,
"employee_name" text,
"acceptance" text,
"accepted_at" timestamp with time zone,
"decline_reason" text);
CREATE TABLE public."square_employee_mappings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"square_team_member_id" text NOT NULL,
"square_team_member_name" text NOT NULL,
"user_profile_id" uuid,
"tip_employee_id" uuid,
"status" text DEFAULT 'suggested'::text NOT NULL,
"confirmed_by" uuid,
"confirmed_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."staff_identity_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"actor_id" uuid NOT NULL,
"tip_employee_id" uuid NOT NULL,
"user_profile_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL);
CREATE TABLE public."store_operating_hours" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"day_of_week" integer NOT NULL,
"open_time" time without time zone,
"close_time" time without time zone,
"is_closed" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."subscription_plan_modules" (
"plan_id" text NOT NULL,
"module_id" text NOT NULL);
CREATE TABLE public."subscription_plans" (
"id" text NOT NULL,
"name" text NOT NULL,
"description" text,
"monthly_price" numeric(10,2) DEFAULT 0,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"is_published" boolean DEFAULT true,
"max_locations" integer DEFAULT 1,
"max_modules" integer,
"max_users" integer,
"annual_price" numeric(10,2) DEFAULT NULL::numeric,
"features" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public."tenant_activity_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"user_id" uuid,
"action" text NOT NULL,
"details" jsonb,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tenant_branding" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"logo_url" text,
"primary_color" text DEFAULT '#C9A227'::text,
"secondary_color" text DEFAULT '#4A3728'::text,
"accent_color" text DEFAULT '#F5F0E1'::text,
"background_color" text DEFAULT '#FFFDF7'::text,
"company_name" text,
"tagline" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."tenant_coffee_products" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"sku" text NOT NULL,
"name" text NOT NULL,
"size" text DEFAULT ''::text NOT NULL,
"category" text DEFAULT 'default'::text NOT NULL,
"default_price" numeric(10,2) DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true,
"display_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"vendor_id" uuid);
CREATE TABLE public."tenant_coffee_vendors" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"display_name" text DEFAULT 'Coffee Vendor'::text NOT NULL,
"contact_email" text,
"cc_email" text,
"logo_url" text,
"notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"supports_retail_labels" boolean DEFAULT true NOT NULL);
CREATE TABLE public."tenant_module_overrides" (
"tenant_id" uuid NOT NULL,
"module_id" text NOT NULL,
"is_enabled" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tenant_module_subscriptions" (
"tenant_id" uuid NOT NULL,
"module_id" text NOT NULL,
"subscribed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tenant_role_settings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"role" user_role NOT NULL,
"display_name" text NOT NULL,
"approve_time_off" boolean DEFAULT false NOT NULL,
"approve_time_edits" boolean DEFAULT false NOT NULL,
"manage_shifts" boolean DEFAULT false NOT NULL,
"delete_shifts" boolean DEFAULT false NOT NULL,
"manage_recipes" boolean DEFAULT false NOT NULL,
"manage_users" boolean DEFAULT false NOT NULL,
"view_reports" boolean DEFAULT false NOT NULL,
"export_payroll" boolean DEFAULT false NOT NULL,
"manage_equipment" boolean DEFAULT false NOT NULL,
"manage_tasks" boolean DEFAULT false NOT NULL,
"manage_orders" boolean DEFAULT false NOT NULL,
"manage_branding" boolean DEFAULT false NOT NULL,
"manage_locations" boolean DEFAULT false NOT NULL,
"manage_cash_deposits" boolean DEFAULT false NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"approve_timesheets" boolean DEFAULT false);
CREATE TABLE public."tenant_usage_metrics" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"metric_date" date DEFAULT CURRENT_DATE NOT NULL,
"total_users" integer DEFAULT 0,
"active_users" integer DEFAULT 0,
"recipe_count" integer DEFAULT 0,
"tip_entries_count" integer DEFAULT 0,
"cash_deposits_count" integer DEFAULT 0,
"coffee_orders_count" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tenants" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"slug" text NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"subscription_status" text DEFAULT 'trial'::text,
"subscription_plan" text DEFAULT 'basic'::text,
"trial_ends_at" timestamp with time zone DEFAULT (now() + '14 days'::interval),
"parent_tenant_id" uuid,
"max_locations_override" integer,
"reseller_id" uuid,
"license_code_id" uuid,
"starting_drawer_default" numeric(10,2) DEFAULT 200,
"vertical_id" uuid,
"setup_progress" jsonb DEFAULT '{}'::jsonb,
"kiosk_code" text,
"square_merchant_id" text,
"square_access_token" text,
"square_refresh_token" text,
"square_token_expires_at" timestamp with time zone,
"square_location_id" text,
"square_sync_enabled" boolean DEFAULT false,
"square_last_sync_at" timestamp with time zone,
"billable_locations" integer DEFAULT 1,
"billing_interval" text DEFAULT 'monthly'::text,
"is_grandfathered" boolean DEFAULT false,
"address_line1" text,
"address_line2" text,
"city" text,
"state" text,
"zip_code" text,
"latitude" numeric(10,8),
"longitude" numeric(11,8),
"geofence_radius_meters" integer DEFAULT 100,
"geofence_lat" double precision,
"geofence_lng" double precision,
"qbo_realm_id" text,
"qbo_access_token" text,
"qbo_refresh_token" text,
"qbo_token_expires_at" timestamp with time zone,
"qbo_connected_at" timestamp with time zone,
"qbo_last_sync_at" timestamp with time zone,
"connecteam_sync_enabled" boolean DEFAULT false,
"connecteam_last_sync_at" timestamp with time zone,
"square_transactions_last_sync_at" timestamp with time zone,
"square_transactions_sync_watermark" date);
CREATE TABLE public."time_clock_audit_events" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid,
"entry_id" uuid NOT NULL,
"actor_id" uuid,
"actor_name" text,
"entity_type" text NOT NULL,
"action" text NOT NULL,
"reason" text,
"old_value" jsonb,
"new_value" jsonb,
"transaction_id" bigint DEFAULT txid_current() NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL);
CREATE TABLE public."time_clock_breaks" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"time_clock_entry_id" uuid NOT NULL,
"break_start" timestamp with time zone NOT NULL,
"break_end" timestamp with time zone,
"break_type" text DEFAULT 'break'::text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"external_id" text);
CREATE TABLE public."time_clock_edit_requests" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"time_clock_entry_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"original_clock_in" timestamp with time zone NOT NULL,
"original_clock_out" timestamp with time zone,
"requested_clock_in" timestamp with time zone,
"requested_clock_out" timestamp with time zone,
"reason" text NOT NULL,
"status" time_off_status DEFAULT 'pending'::time_off_status NOT NULL,
"reviewed_by" uuid,
"reviewed_at" timestamp with time zone,
"review_notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."time_clock_entries" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid,
"clock_in" timestamp with time zone NOT NULL,
"clock_out" timestamp with time zone,
"notes" text,
"is_edited" boolean DEFAULT false,
"edited_by" uuid,
"edited_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tip_employee_id" uuid,
"employee_name" text,
"source" text DEFAULT 'manual'::text,
"external_id" text,
"clock_in_lat" double precision,
"clock_in_lng" double precision,
"clock_in_accuracy" double precision,
"clock_out_lat" double precision,
"clock_out_lng" double precision,
"clock_in_outside_geofence" boolean DEFAULT false NOT NULL);
CREATE TABLE public."time_clock_missing_requests" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"clock_in" timestamp with time zone NOT NULL,
"clock_out" timestamp with time zone NOT NULL,
"breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
"reason" text NOT NULL,
"status" text DEFAULT 'pending'::text NOT NULL,
"reviewed_by" uuid,
"reviewed_at" timestamp with time zone,
"review_notes" text,
"entry_id" uuid,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL);
CREATE TABLE public."time_off_accrual_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"policy_id" uuid NOT NULL,
"balance_id" uuid NOT NULL,
"entry_type" text NOT NULL,
"hours" numeric(10,2) NOT NULL,
"description" text,
"reference_id" uuid,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."time_off_balances" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"policy_id" uuid NOT NULL,
"balance_hours" numeric(10,2) DEFAULT 0 NOT NULL,
"used_hours" numeric(10,2) DEFAULT 0 NOT NULL,
"pending_hours" numeric(10,2) DEFAULT 0 NOT NULL,
"year" integer DEFAULT EXTRACT(year FROM now()) NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."time_off_policies" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"policy_type" text DEFAULT 'none'::text NOT NULL,
"categories" text[] DEFAULT '{vacation}'::text[] NOT NULL,
"accrual_hours" numeric(8,2) DEFAULT 0,
"accrual_per_hours_worked" numeric(8,2) DEFAULT 0,
"annual_hours" numeric(8,2) DEFAULT 0,
"grant_method" text DEFAULT 'upfront'::text,
"milestone_tiers" jsonb DEFAULT '[]'::jsonb,
"max_balance_hours" numeric(8,2) DEFAULT NULL::numeric,
"carryover_type" text DEFAULT 'none'::text,
"carryover_max_hours" numeric(8,2) DEFAULT 0,
"waiting_period_days" integer DEFAULT 0,
"eligible_roles" text[] DEFAULT '{}'::text[],
"is_active" boolean DEFAULT true NOT NULL,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."time_off_requests" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"start_date" date NOT NULL,
"end_date" date NOT NULL,
"category" time_off_category DEFAULT 'personal'::time_off_category NOT NULL,
"reason" text,
"status" time_off_status DEFAULT 'pending'::time_off_status NOT NULL,
"reviewed_by" uuid,
"reviewed_at" timestamp with time zone,
"review_notes" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."timesheet_approval_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"approval_id" uuid NOT NULL,
"actor_id" uuid,
"old_value" jsonb,
"new_value" jsonb,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL);
CREATE TABLE public."timesheet_approvals" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"period_start" date NOT NULL,
"period_end" date NOT NULL,
"status" text DEFAULT 'pending'::text NOT NULL,
"approved_by" uuid,
"approved_at" timestamp with time zone,
"manager_notes" text,
"employee_notes" text,
"total_regular_hours" numeric(8,2),
"total_break_hours" numeric(8,2),
"total_pto_hours" numeric(8,2),
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"invalidated_at" timestamp with time zone,
"invalidation_reason" text,
"period_timezone" text,
"approval_count" integer DEFAULT 0 NOT NULL);
CREATE TABLE public."tip_employee_hours" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"employee_id" uuid NOT NULL,
"week_key" date NOT NULL,
"hours" numeric(6,2) DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tip_employees" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"schedule_color" text,
"kiosk_pin" text,
"tip_eligible" boolean DEFAULT true,
"user_profile_id" uuid);
CREATE TABLE public."tip_payout_approval_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"approval_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"week_key" date NOT NULL,
"previous_record" jsonb NOT NULL,
"changed_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."tip_payout_approvals" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"week_key" date NOT NULL,
"cash_tips" numeric(10,2) NOT NULL,
"cc_tips" numeric(10,2) NOT NULL,
"cc_fee_rate" numeric(5,4) DEFAULT 0.0350 NOT NULL,
"total_pool" numeric(10,2) NOT NULL,
"total_hours" numeric(8,2) NOT NULL,
"hourly_rate" numeric(10,4) NOT NULL,
"distribution_method" text DEFAULT 'hours'::text NOT NULL,
"employee_payouts" jsonb DEFAULT '[]'::jsonb NOT NULL,
"calculated_by" uuid NOT NULL,
"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
"approved_by" uuid,
"approved_at" timestamp with time zone,
"status" text DEFAULT 'pending'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."tip_weekly_data" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"week_key" date NOT NULL,
"cash_tips" numeric(10,2) DEFAULT 0,
"cc_tips" numeric(10,2) DEFAULT 0,
"cash_entries" jsonb DEFAULT '[]'::jsonb,
"cc_entries" jsonb DEFAULT '[]'::jsonb,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."training_attendance" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"training_class_id" uuid NOT NULL,
"employee_id" uuid,
"tip_employee_id" uuid,
"status" text DEFAULT 'attended'::text NOT NULL,
"notes" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."training_classes" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tenant_id" uuid NOT NULL,
"name" text NOT NULL,
"description" text,
"provider" text,
"location" text,
"class_date" date NOT NULL,
"end_date" date,
"duration_hours" numeric(5,2),
"cost" numeric(10,2),
"cost_per_person" boolean DEFAULT false,
"certification_type_id" uuid,
"notes" text,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."user_profiles" (
"id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"email" text NOT NULL,
"full_name" text,
"role" user_role DEFAULT 'employee'::user_role NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"avatar_url" text,
"start_date" date DEFAULT CURRENT_DATE,
"last_login_at" timestamp with time zone,
"changelog_last_seen" text,
"manager_id" uuid,
"is_exempt" boolean DEFAULT false NOT NULL,
"hourly_rate" numeric(8,2),
"annual_salary" numeric(10,2),
"pay_frequency" text DEFAULT 'biweekly'::text,
"schedule_color" text,
"kiosk_pin" text,
"onboarding_progress" jsonb DEFAULT '{}'::jsonb,
"phone" text,
"date_of_birth" date,
"address_line1" text,
"address_line2" text,
"city" text,
"state" text,
"zip_code" text,
"emergency_contact_name" text,
"emergency_contact_phone" text,
"staff_login_id" text);
CREATE TABLE public."user_tenant_assignments" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL,
"role" user_role DEFAULT 'employee'::user_role NOT NULL,
"is_primary" boolean DEFAULT false NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"manager_id" uuid);
CREATE TABLE public."vertical_templates" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"vertical_id" uuid NOT NULL,
"template_type" text NOT NULL,
"name" text NOT NULL,
"data" jsonb NOT NULL,
"sort_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."verticals" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"slug" text NOT NULL,
"product_name" text NOT NULL,
"display_name" text NOT NULL,
"is_published" boolean DEFAULT false,
"is_system" boolean DEFAULT true,
"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
"workflows" jsonb DEFAULT '{}'::jsonb NOT NULL,
"suggested_modules" text[] DEFAULT ARRAY[]::text[],
"landing_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
"domains" text[] DEFAULT ARRAY[]::text[],
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"reseller_id" uuid);
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_full_name TEXT;
BEGIN
    -- Get tenant_id from user metadata (set during signup)
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    
    -- Get role from metadata, default to 'employee'
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
    
    -- Get full name from metadata
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    
    -- Only create profile if tenant_id is provided
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (
            NEW.id,
            v_tenant_id,
            NEW.email,
            v_full_name,
            v_role::user_role,
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_profile_info()
 RETURNS TABLE(user_tenant_id uuid, user_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id, role::text
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role::text FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_role_and_tenant(user_id uuid)
 RETURNS TABLE(role text, tenant_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role::text, tenant_id FROM user_profiles WHERE id = user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.get_storage_object(object_id uuid)
 RETURNS TABLE(bucket_id text, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT bucket_id, name
  FROM storage.objects
  WHERE id = object_id
     OR name LIKE '%' || object_id::text || '%'
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.is_owner_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.get_tenant_location_usage(p_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := public.get_tenant_location_count(p_tenant_id);
    max_allowed := public.get_tenant_max_locations(p_tenant_id);
    
    RETURN json_build_object(
        'current_count', current_count,
        'max_allowed', max_allowed,
        'can_add', current_count < max_allowed,
        'remaining', GREATEST(0, max_allowed - current_count)
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  next_val INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  next_val := nextval('reseller_invoice_number_seq');
  RETURN 'INV-' || current_year || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_kiosk_pin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_pin TEXT;
    attempts INT := 0;
BEGIN
    IF NEW.kiosk_pin IS NULL AND NEW.is_active = true THEN
        LOOP
            new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE tenant_id = NEW.tenant_id AND kiosk_pin = new_pin AND is_active = true AND id != NEW.id
            ) THEN
                NEW.kiosk_pin := new_pin;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_accessible_tenants()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    primary_tenant_id UUID;
BEGIN
    -- Get user's primary tenant from user_profiles
    SELECT tenant_id INTO primary_tenant_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Return primary tenant
    RETURN NEXT primary_tenant_id;
    
    -- Return all assigned tenants from user_tenant_assignments
    RETURN QUERY
    SELECT uta.tenant_id
    FROM user_tenant_assignments uta
    WHERE uta.user_id = auth.uid()
    AND uta.is_active = true
    AND uta.tenant_id != primary_tenant_id;
    
    -- If user is owner of a parent tenant, also return all child tenants
    IF (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'owner' THEN
        RETURN QUERY
        SELECT t.id
        FROM tenants t
        WHERE t.parent_tenant_id = primary_tenant_id
        AND t.is_active = true;
    END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid());
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS user_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN (SELECT role FROM public.user_profiles WHERE id = auth.uid());
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_role_or_higher(required_role user_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    user_current_role public.user_role;
    role_order INTEGER;
    required_order INTEGER;
BEGIN
    user_current_role := public.get_current_user_role();
    IF user_current_role IS NULL THEN RETURN FALSE; END IF;
    SELECT CASE user_current_role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 WHEN 'employee' THEN 1 ELSE 0 END INTO role_order;
    SELECT CASE required_role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 WHEN 'employee' THEN 1 ELSE 0 END INTO required_order;
    RETURN role_order >= required_order;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_tenant(check_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    primary_tenant_id UUID;
    user_role_val user_role;
BEGIN
    -- Get user's primary tenant and role
    SELECT tenant_id, role INTO primary_tenant_id, user_role_val
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Direct access to primary tenant
    IF check_tenant_id = primary_tenant_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check user_tenant_assignments
    IF EXISTS (
        SELECT 1 FROM user_tenant_assignments
        WHERE user_id = auth.uid()
        AND tenant_id = check_tenant_id
        AND is_active = true
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- If owner, check if this is a child tenant of their primary tenant
    IF user_role_val = 'owner' THEN
        IF EXISTS (
            SELECT 1 FROM tenants
            WHERE id = check_tenant_id
            AND parent_tenant_id = primary_tenant_id
            AND is_active = true
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_child_tenants(parent_id uuid)
 RETURNS SETOF tenants
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM tenants
    WHERE parent_tenant_id = parent_id
    AND is_active = true
    ORDER BY name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_parent_tenant(check_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenants
        WHERE parent_tenant_id = check_tenant_id
        AND is_active = true
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_license_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  random_bytes BYTEA;
  i INTEGER;
BEGIN
  random_bytes := gen_random_bytes(12);
  FOR i IN 1..12 LOOP
    result := result || substr(chars, (get_byte(random_bytes, i - 1) % length(chars)) + 1, 1);
    IF i = 4 OR i = 8 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.auto_register_ga_module()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    full_access_plan TEXT;
BEGIN
    -- Only fire when rollout_status transitions TO 'ga'
    IF NEW.rollout_status = 'ga' AND (OLD IS NULL OR OLD.rollout_status IS DISTINCT FROM 'ga') THEN
        -- Insert into all full-access subscription plans
        FOR full_access_plan IN
            SELECT id FROM subscription_plans
            WHERE id IN ('free', 'beta', 'premium', 'professional')
              AND is_active = true
        LOOP
            INSERT INTO subscription_plan_modules (plan_id, module_id)
            VALUES (full_access_plan, NEW.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_tenant_max_locations(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    override_limit INTEGER;
    plan_limit INTEGER;
BEGIN
    -- Check for override first
    SELECT max_locations_override INTO override_limit
    FROM public.tenants
    WHERE id = p_tenant_id;
    
    IF override_limit IS NOT NULL THEN
        RETURN override_limit;
    END IF;
    
    -- Get limit from subscription plan
    SELECT sp.max_locations INTO plan_limit
    FROM public.tenants t
    JOIN public.subscription_plans sp ON sp.id = t.subscription_plan
    WHERE t.id = p_tenant_id;
    
    -- Default to 1 if no plan found
    RETURN COALESCE(plan_limit, 1);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND is_active = true
  );
$function$
;
CREATE OR REPLACE FUNCTION public.get_tenant_location_count(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    loc_count INTEGER;
BEGIN
    -- Count child locations (the parent counts as 1, plus children)
    SELECT COUNT(*) + 1 INTO loc_count
    FROM public.tenants
    WHERE parent_tenant_id = p_tenant_id
    AND is_active = true;
    
    RETURN loc_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_add_location(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := public.get_tenant_location_count(p_tenant_id);
    max_allowed := public.get_tenant_max_locations(p_tenant_id);
    
    RETURN current_count < max_allowed;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_location_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    parent_id UUID;
    can_add BOOLEAN;
BEGIN
    -- Only check if this is a child location (has parent_tenant_id)
    IF NEW.parent_tenant_id IS NOT NULL THEN
        parent_id := NEW.parent_tenant_id;
        
        -- Check if the parent can add more locations
        can_add := public.can_add_location(parent_id);
        
        IF NOT can_add THEN
            RAISE EXCEPTION 'Location limit reached. Upgrade your subscription to add more locations.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.seed_tenant_role_settings(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenant_role_settings WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO tenant_role_settings (
            tenant_id, role, display_name,
            approve_time_off, approve_time_edits, manage_shifts, delete_shifts,
            manage_recipes, manage_users, view_reports, export_payroll,
            manage_equipment, manage_tasks, manage_orders, manage_branding,
            manage_locations, manage_cash_deposits
        ) VALUES
        -- Owner: all true (locked in UI, never editable)
        (p_tenant_id, 'owner', 'Owner',
            true, true, true, true, true, true, true, true, true, true, true, true, true, true),
        -- Manager: most permissions
        (p_tenant_id, 'manager', 'Manager',
            true, true, true, true, true, true, true, true, true, true, true, false, false, true),
        -- Lead: approvals + scheduling + reports
        (p_tenant_id, 'lead', 'Lead',
            true, true, true, false, false, false, true, false, false, false, false, false, false, false),
        -- Employee: no management permissions
        (p_tenant_id, 'employee', 'Employee',
            false, false, false, false, false, false, false, false, false, false, false, false, false, false);
    END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_kiosk_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_code TEXT;
    attempts INT := 0;
BEGIN
    IF NEW.kiosk_code IS NULL THEN
        LOOP
            new_code := UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
            IF NOT EXISTS (
                SELECT 1 FROM tenants WHERE UPPER(kiosk_code) = new_code AND id != NEW.id
            ) THEN
                NEW.kiosk_code := new_code;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_conversations(p_user_id uuid, p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, type text, name text, description text, created_by uuid, is_system boolean, system_role text, created_at timestamp with time zone, updated_at timestamp with time zone, last_message_content text, last_message_at timestamp with time zone, last_message_sender_id uuid, last_message_attachment_type text, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    c.id,
    c.tenant_id,
    c.type,
    c.name,
    c.description,
    c.created_by,
    c.is_system,
    c.system_role,
    c.created_at,
    c.updated_at,
    lm.content                AS last_message_content,
    lm.created_at             AS last_message_at,
    lm.sender_id              AS last_message_sender_id,
    lm.attachment_type        AS last_message_attachment_type,
    COUNT(um.id)              AS unread_count
  FROM conversations c
  JOIN conversation_participants cp
    ON cp.conversation_id = c.id
   AND cp.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id, attachment_type
    FROM messages
    WHERE conversation_id = c.id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN messages um
    ON um.conversation_id = c.id
   AND um.sender_id != p_user_id
   AND um.deleted_at IS NULL
   AND um.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
  WHERE c.tenant_id = p_tenant_id
  GROUP BY
    c.id, c.tenant_id, c.type, c.name, c.description, c.created_by,
    c.is_system, c.system_role, c.created_at, c.updated_at,
    lm.content, lm.created_at, lm.sender_id, lm.attachment_type
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.get_parent_tenant_id(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    parent_id UUID;
BEGIN
    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;
    
    RETURN parent_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_read_tenant_data(data_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_tenant UUID;
    user_parent UUID;
BEGIN
    -- Get current user's tenant
    SELECT tenant_id INTO user_tenant
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Direct match - user is in the same tenant as the data
    IF data_tenant_id = user_tenant THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is in a child location and the data is from their parent
    SELECT parent_tenant_id INTO user_parent
    FROM tenants
    WHERE id = user_tenant;
    
    IF user_parent IS NOT NULL AND data_tenant_id = user_parent THEN
        RETURN TRUE;
    END IF;
    
    -- Also check if user has general access (owner with multi-location access)
    RETURN can_access_tenant(data_tenant_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.ensure_system_channels(p_user_id uuid, p_tenant_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_all_id uuid;
  v_mgr_id uuid;
BEGIN
  -- All Staff channel
  INSERT INTO conversations (tenant_id, type, name, is_system, system_role)
    VALUES (p_tenant_id, 'channel', 'All Staff', true, 'all')
    ON CONFLICT DO NOTHING;

  SELECT id INTO v_all_id
  FROM conversations
  WHERE tenant_id = p_tenant_id
    AND is_system = true
    AND system_role = 'all'
  LIMIT 1;

  IF v_all_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_all_id, p_user_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  -- Managers channel (owner, manager, lead roles)
  IF p_role IN ('owner', 'manager', 'lead') THEN
    INSERT INTO conversations (tenant_id, type, name, is_system, system_role)
      VALUES (p_tenant_id, 'channel', 'Managers', true, 'manager')
      ON CONFLICT DO NOTHING;

    SELECT id INTO v_mgr_id
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND is_system = true
      AND system_role = 'manager'
    LIMIT 1;

    IF v_mgr_id IS NOT NULL THEN
      INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_mgr_id, p_user_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_conversation_members(p_conversation_id uuid)
 RETURNS TABLE(user_id uuid, is_admin boolean, joined_at timestamp with time zone, full_name text, avatar_url text, role text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    cp.user_id,
    cp.is_admin,
    cp.joined_at,
    up.full_name,
    up.avatar_url,
    up.role
  FROM conversation_participants cp
  JOIN user_profiles up ON up.id = cp.user_id
  WHERE cp.conversation_id = p_conversation_id
  ORDER BY up.full_name;
$function$
;
CREATE OR REPLACE FUNCTION public.redeem_license_code(p_code text, p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_license_id UUID;
  v_reseller_id UUID;
  v_subscription_plan TEXT;
BEGIN
  -- Verify the caller has access to this tenant
  IF NOT public.can_access_tenant(p_tenant_id) AND NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  -- Find valid unredeemed code
  SELECT id, reseller_id, subscription_plan
  INTO v_license_id, v_reseller_id, v_subscription_plan
  FROM public.license_codes
  WHERE code = p_code
    AND redeemed_at IS NULL
    AND expires_at > NOW();

  IF v_license_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mark as redeemed
  UPDATE public.license_codes
  SET redeemed_at = NOW(), tenant_id = p_tenant_id
  WHERE id = v_license_id AND redeemed_at IS NULL;

  -- Link tenant to reseller
  UPDATE public.tenants
  SET reseller_id = v_reseller_id,
      license_code_id = v_license_id,
      subscription_plan = COALESCE(v_subscription_plan, subscription_plan)
  WHERE id = p_tenant_id;

  -- Increment reseller seat count
  UPDATE public.resellers
  SET seats_used = seats_used + 1
  WHERE id = v_reseller_id;

  RETURN v_license_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_bug_reports_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_verified_compliance_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF COALESCE(current_setting('cms.compliance_verified',true),'')='on' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=OLD.id) THEN
      RAISE EXCEPTION 'Delegated compliance duties must retain their verification history';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.parent_task_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=NEW.parent_task_id) THEN
    RAISE EXCEPTION 'Only verified completion can create this compliance renewal';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR
     (OLD.status='completed' AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.recurrence IS DISTINCT FROM OLD.recurrence)))
     AND EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=OLD.id) THEN
    RAISE EXCEPTION 'Submit this compliance duty for owner verification';
  END IF;
  RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_staff_time_clock_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT has_role_or_higher('manager'::user_role)
     AND (
       abs(extract(epoch FROM (NEW.clock_in - now()))) > 120
       OR NEW.clock_out IS NOT NULL
       OR NEW.is_edited IS TRUE
       OR NEW.edited_by IS NOT NULL
       OR NEW.edited_at IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'Time corrections require manager approval';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_timesheet_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO timesheet_approval_history(tenant_id,employee_id,approval_id,actor_id,old_value,new_value)
  VALUES (NEW.tenant_id,NEW.employee_id,NEW.id,auth.uid(),CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW));
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.review_timesheet_period(p_tenant uuid, p_employee uuid, p_start date, p_end date, p_timezone text, p_expected jsonb, p_approve boolean, p_notes text DEFAULT NULL::text)
 RETURNS timesheet_approvals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE start_at timestamptz; end_at timestamptz; snapshot jsonb; result timesheet_approvals; gross numeric; breaks numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=p_tenant AND is_active AND role IN ('owner','manager'))
    OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=p_employee AND tenant_id=p_tenant)
    THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end-p_start > 62 OR p_timezone IS NULL OR p_approve IS NULL
    THEN RAISE EXCEPTION 'Invalid pay period'; END IF;
  start_at := p_start::timestamp AT TIME ZONE p_timezone;
  end_at := (p_end+1)::timestamp AT TIME ZONE p_timezone;
  PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || p_tenant::text,0));
  snapshot := timesheet_snapshot(p_tenant,p_employee,start_at,end_at);
  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM timesheet_approvals WHERE tenant_id=p_tenant AND employee_id=p_employee AND period_start=p_start AND period_end=p_end AND status='approved' AND period_timezone=p_timezone) THEN RAISE EXCEPTION 'This pay period is already approved'; END IF;
    IF p_expected IS NULL OR normalize_timesheet_snapshot(p_expected) <> snapshot THEN
      RAISE EXCEPTION 'Recorded time changed. Refresh the timesheet and review it again.'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id=p_tenant AND employee_id=p_employee AND clock_in < end_at AND clock_out IS NULL)
      THEN RAISE EXCEPTION 'End open work sessions before approving this pay period'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE tenant_id=p_tenant AND employee_id=p_employee AND status='pending' AND time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v))
      OR EXISTS (SELECT 1 FROM time_clock_missing_requests WHERE tenant_id=p_tenant AND employee_id=p_employee AND status='pending' AND clock_in < end_at AND clock_out > start_at)
      THEN RAISE EXCEPTION 'Review pending time corrections before approving this pay period'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_breaks WHERE time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v) AND break_end IS NULL) THEN RAISE EXCEPTION 'End open breaks before approving this pay period'; END IF;
    SELECT coalesce(sum(extract(epoch FROM least(clock_out,end_at)-greatest(clock_in,start_at))/3600),0) INTO gross
      FROM time_clock_entries WHERE tenant_id=p_tenant AND employee_id=p_employee AND clock_in < end_at AND clock_out > start_at;
    SELECT coalesce(sum(greatest(0,extract(epoch FROM least(b.break_end,end_at,e.clock_out)-greatest(b.break_start,start_at,e.clock_in))/3600)),0) INTO breaks
      FROM time_clock_breaks b JOIN time_clock_entries e ON e.id=b.time_clock_entry_id
      WHERE e.tenant_id=p_tenant AND e.employee_id=p_employee AND e.clock_in < end_at AND e.clock_out > start_at;
  END IF;
  INSERT INTO timesheet_approvals(tenant_id,employee_id,period_start,period_end,period_timezone,status,approved_by,approved_at,manager_notes,total_regular_hours,total_break_hours,approval_count)
  VALUES(p_tenant,p_employee,p_start,p_end,p_timezone,CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,auth.uid(),clock_timestamp(),p_notes,greatest(0,gross-breaks),breaks,CASE WHEN p_approve THEN 1 ELSE 0 END)
  ON CONFLICT (tenant_id,employee_id,period_start,period_end) DO UPDATE SET
    status=excluded.status,period_timezone=excluded.period_timezone,approved_by=excluded.approved_by,approved_at=excluded.approved_at,
    manager_notes=excluded.manager_notes,total_regular_hours=excluded.total_regular_hours,total_break_hours=excluded.total_break_hours,
    invalidated_at=NULL,invalidation_reason=NULL,updated_at=clock_timestamp(),
    approval_count=timesheet_approvals.approval_count + CASE WHEN p_approve THEN 1 ELSE 0 END
  RETURNING * INTO result;
  RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.guard_staff_break_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT has_role_or_higher('manager'::user_role)
  THEN
    IF TG_OP = 'INSERT' THEN
      IF abs(extract(epoch FROM (NEW.break_start - now()))) > 120
         OR NEW.break_end IS NOT NULL
      THEN
        RAISE EXCEPTION 'Break corrections require manager approval';
      END IF;
    ELSIF OLD.break_end IS NOT NULL
       OR NEW.break_end IS NULL
       OR NEW.break_end < OLD.break_start
       OR abs(extract(epoch FROM (NEW.break_end - now()))) > 120
       OR (to_jsonb(NEW) - 'break_end')
          IS DISTINCT FROM (to_jsonb(OLD) - 'break_end')
    THEN
      RAISE EXCEPTION 'Break corrections require manager approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_time_clock_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  before_row jsonb;
  after_row jsonb;
  row_data jsonb;
  worker uuid;
  entry uuid;
  actor_label text;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  -- Break changes touch the parent version; avoid a second timestamp-only event.
  IF TG_OP = 'UPDATE' AND (before_row - ARRAY['updated_at', 'edited_at', 'edited_by', 'is_edited']) = (after_row - ARRAY['updated_at', 'edited_at', 'edited_by', 'is_edited']) THEN RETURN NEW; END IF;
  row_data := coalesce(after_row, before_row);
  IF TG_TABLE_NAME = 'time_clock_entries' THEN
    entry := (row_data->>'id')::uuid;
    worker := (row_data->>'employee_id')::uuid;
  ELSE
    entry := (row_data->>'time_clock_entry_id')::uuid;
    SELECT employee_id INTO worker FROM time_clock_entries WHERE id = entry;
  END IF;
  SELECT full_name INTO actor_label FROM user_profiles WHERE id = auth.uid();
  INSERT INTO time_clock_audit_events(tenant_id, employee_id, entry_id, actor_id, actor_name, entity_type, action, reason, old_value, new_value)
  VALUES ((row_data->>'tenant_id')::uuid, worker, entry, auth.uid(), actor_label,
    CASE WHEN TG_TABLE_NAME = 'time_clock_entries' THEN 'session' ELSE 'break' END,
    lower(TG_OP), nullif(current_setting('cms.time_change_reason', true), ''), before_row, after_row);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_time_clock_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE time_clock_entries SET updated_at = clock_timestamp() WHERE id = OLD.time_clock_entry_id;
    RETURN OLD;
  END IF;
  UPDATE time_clock_entries SET updated_at = clock_timestamp() WHERE id = NEW.time_clock_entry_id;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_time_clock_edit(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE time_clock_edit_requests
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_id
    AND employee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending request not found';
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_tip_approval_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tip_payout_approval_history (approval_id, tenant_id, week_key, previous_record)
  VALUES (OLD.id, OLD.tenant_id, OLD.week_key, to_jsonb(OLD));
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_work_session(p_in timestamp with time zone, p_out timestamp with time zone, p_breaks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE b record; previous_end timestamptz;
BEGIN
  IF p_in IS NULL OR p_out IS NULL OR NOT isfinite(p_in) OR NOT isfinite(p_out) OR p_out <= p_in THEN
    RAISE EXCEPTION 'Enter a clock-out date and time after clock in';
  END IF;
  IF p_breaks IS NULL OR jsonb_typeof(p_breaks) <> 'array' THEN RAISE EXCEPTION 'Invalid breaks'; END IF;
  IF jsonb_array_length(p_breaks) > 30 THEN RAISE EXCEPTION 'Too many breaks'; END IF;
  FOR b IN SELECT * FROM jsonb_to_recordset(p_breaks) AS x(id uuid, break_start timestamptz, break_end timestamptz, break_type text) ORDER BY break_start LOOP
    IF b.break_start IS NULL OR b.break_end IS NULL OR b.break_end <= b.break_start
       OR b.break_start < p_in OR b.break_end > p_out OR b.break_start < previous_end THEN
      RAISE EXCEPTION 'Breaks must be complete, inside the session, and must not overlap';
    END IF;
    previous_end := b.break_end;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.save_time_clock_session(p_tenant uuid, p_employee uuid, p_entry uuid, p_expected_updated_at timestamp with time zone, p_clock_in timestamp with time zone, p_clock_out timestamp with time zone, p_breaks jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing time_clock_entries%ROWTYPE;
  saved_id uuid;
  b record;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = p_tenant AND is_active = true AND role IN ('manager', 'owner')
  ) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_employee AND tenant_id = p_tenant) THEN
    RAISE EXCEPTION 'Employee not found in this business';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(p_reason) > 2000 THEN RAISE EXCEPTION 'A reason is required (up to 2000 characters)'; END IF;
  PERFORM validate_work_session(p_clock_in, p_clock_out, p_breaks);
  -- Serialize session edits/additions for this employee.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || p_employee::text, 0));
  IF p_entry IS NOT NULL THEN
    SELECT * INTO existing FROM time_clock_entries WHERE id = p_entry AND tenant_id = p_tenant AND employee_id = p_employee FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'This session changed while you were editing. Close the editor, refresh, and try again';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id = p_tenant AND employee_id = p_employee
    AND (p_entry IS NULL OR id <> p_entry) AND clock_in < p_clock_out AND (clock_out IS NULL OR clock_out > p_clock_in)) THEN
    RAISE EXCEPTION 'This session overlaps another recorded session';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_breaks) AS x(id uuid)
    WHERE id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM time_clock_breaks owned_break WHERE owned_break.id = x.id AND owned_break.time_clock_entry_id = p_entry)) THEN
    RAISE EXCEPTION 'A break no longer belongs to this session';
  END IF;
  PERFORM set_config('cms.time_change_reason', btrim(p_reason), true);
  IF p_entry IS NULL THEN
    INSERT INTO time_clock_entries(tenant_id, employee_id, clock_in, clock_out, source, is_edited, edited_by, edited_at, updated_at)
    VALUES (p_tenant, p_employee, p_clock_in, p_clock_out, 'manual', true, auth.uid(), clock_timestamp(), clock_timestamp()) RETURNING id INTO saved_id;
  ELSE
    UPDATE time_clock_entries SET clock_in = p_clock_in, clock_out = p_clock_out, is_edited = true,
      edited_by = auth.uid(), edited_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = p_entry RETURNING id INTO saved_id;
  END IF;
  DELETE FROM time_clock_breaks WHERE time_clock_entry_id = saved_id
    AND id NOT IN (SELECT x.id FROM jsonb_to_recordset(p_breaks) AS x(id uuid) WHERE x.id IS NOT NULL);
  FOR b IN SELECT * FROM jsonb_to_recordset(p_breaks) AS x(id uuid, break_start timestamptz, break_end timestamptz, break_type text) LOOP
    IF b.id IS NULL THEN
      INSERT INTO time_clock_breaks(tenant_id, time_clock_entry_id, break_start, break_end, break_type)
      VALUES (p_tenant, saved_id, b.break_start, b.break_end, coalesce(nullif(b.break_type, ''), 'break'));
    ELSE
      UPDATE time_clock_breaks SET break_start = b.break_start, break_end = b.break_end,
        break_type = coalesce(nullif(b.break_type, ''), 'break') WHERE id = b.id AND time_clock_entry_id = saved_id;
    END IF;
  END LOOP;
  RETURN saved_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.tenant_owned_by_platform_admin(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN platform_admins pa ON pa.id = up.id AND pa.is_active = true
        WHERE up.tenant_id = p_tenant_id AND up.role = 'owner' AND up.is_active = true
    );
$function$
;
CREATE OR REPLACE FUNCTION public.get_tenant_enabled_modules(p_tenant_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    effective_tenant_id UUID;
    parent_id UUID;
    tenant_plan TEXT;
    caller_is_admin BOOLEAN;
    tenant_is_internal BOOLEAN;
    result TEXT[];
BEGIN
    caller_is_admin := is_platform_admin();

    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;

    IF parent_id IS NOT NULL THEN
        effective_tenant_id := parent_id;
    ELSE
        effective_tenant_id := p_tenant_id;
    END IF;

    tenant_is_internal := caller_is_admin OR tenant_owned_by_platform_admin(effective_tenant_id);

    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = effective_tenant_id;

    IF tenant_plan IS NULL OR tenant_plan = '' THEN
        tenant_plan := 'free';
    END IF;

    IF tenant_plan IN ('free', 'beta', 'premium', 'professional') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND (tenant_plan IN ('beta', 'professional') OR tenant_is_internal))
            OR (m.rollout_status = 'internal' AND tenant_is_internal)
          );
    ELSE
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = effective_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND tenant_is_internal)
            OR (m.rollout_status = 'internal' AND tenant_is_internal)
          );
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_time_clock_session(p_entry uuid, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e time_clock_entries%ROWTYPE;
BEGIN
  SELECT * INTO e FROM time_clock_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
    AND tenant_id = e.tenant_id AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF e.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Session changed. Refresh before deleting'; END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'A deletion reason is required'; END IF;
  IF EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE time_clock_entry_id = p_entry) THEN
    RAISE EXCEPTION 'This session has correction requests and cannot be deleted';
  END IF;
  PERFORM set_config('cms.time_change_reason', btrim(p_reason), true);
  DELETE FROM time_clock_breaks WHERE time_clock_entry_id = p_entry;
  DELETE FROM time_clock_entries WHERE id = p_entry;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.request_missing_time_session(p_tenant uuid, p_clock_in timestamp with time zone, p_clock_out timestamp with time zone, p_breaks jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE request_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = p_tenant AND is_active = true) THEN
    RAISE EXCEPTION 'Employee access required';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(p_reason) > 2000 THEN RAISE EXCEPTION 'A reason is required (up to 2000 characters)'; END IF;
  PERFORM validate_work_session(p_clock_in, p_clock_out, p_breaks);
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_breaks) AS x(id uuid) WHERE id IS NOT NULL) THEN RAISE EXCEPTION 'New session breaks cannot reference existing breaks'; END IF;
  INSERT INTO time_clock_missing_requests(tenant_id, employee_id, clock_in, clock_out, breaks, reason)
    VALUES (p_tenant, auth.uid(), p_clock_in, p_clock_out, p_breaks, btrim(p_reason)) RETURNING id INTO request_id;
  RETURN request_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.review_missing_time_session(p_id uuid, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r time_clock_missing_requests%ROWTYPE; saved_id uuid;
BEGIN
  SELECT * INTO r FROM time_clock_missing_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF p_status = 'cancelled' THEN
    IF auth.uid() IS DISTINCT FROM r.employee_id THEN RAISE EXCEPTION 'You can cancel only your own request'; END IF;
  ELSIF p_status IN ('approved', 'denied') THEN
    IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = r.tenant_id
      AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager approval required'; END IF;
  ELSE RAISE EXCEPTION 'Invalid review status'; END IF;
  IF p_status = 'approved' THEN
    saved_id := save_time_clock_session(r.tenant_id, r.employee_id, NULL, NULL, r.clock_in, r.clock_out, r.breaks, r.reason);
  END IF;
  UPDATE time_clock_missing_requests SET status = p_status, reviewed_by = auth.uid(), reviewed_at = clock_timestamp(),
    review_notes = p_notes, entry_id = saved_id WHERE id = p_id;
  RETURN saved_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.review_time_clock_edit(p_id uuid, p_approve boolean, p_notes text DEFAULT NULL::text)
 RETURNS time_clock_edit_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r time_clock_edit_requests%ROWTYPE; e time_clock_entries%ROWTYPE; existing_breaks jsonb;
BEGIN
  SELECT * INTO r FROM time_clock_edit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = r.tenant_id
    AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager approval required'; END IF;
  IF p_approve THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(r.tenant_id::text || r.employee_id::text, 0));
    SELECT * INTO e FROM time_clock_entries WHERE id = r.time_clock_entry_id AND tenant_id = r.tenant_id AND employee_id = r.employee_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF e.clock_in IS DISTINCT FROM r.original_clock_in OR e.clock_out IS DISTINCT FROM r.original_clock_out THEN
      RAISE EXCEPTION 'Time entry changed since the request; submit a new correction';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'break_start', break_start, 'break_end', break_end, 'break_type', break_type)), '[]'::jsonb)
      INTO existing_breaks FROM time_clock_breaks WHERE time_clock_entry_id = e.id;
    PERFORM save_time_clock_session(r.tenant_id, r.employee_id, e.id, e.updated_at,
      coalesce(r.requested_clock_in, e.clock_in), coalesce(r.requested_clock_out, e.clock_out), existing_breaks, r.reason);
  END IF;
  UPDATE time_clock_edit_requests SET status = CASE WHEN p_approve THEN 'approved'::time_off_status ELSE 'denied'::time_off_status END,
    reviewed_by = auth.uid(), reviewed_at = clock_timestamp(), review_notes = p_notes, updated_at = clock_timestamp()
    WHERE id = p_id RETURNING * INTO r;
  RETURN r;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.invalidate_timesheet_window(t uuid, e uuid, start_at timestamp with time zone, end_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE timesheet_approvals a SET status = 'pending', approved_by = NULL, approved_at = NULL,
    total_regular_hours = NULL, total_break_hours = NULL, total_pto_hours = NULL,
    invalidated_at = clock_timestamp(), invalidation_reason = 'Recorded time changed after approval. Review and approve this pay period again.',
    updated_at = clock_timestamp()
  WHERE a.tenant_id = t AND a.employee_id = e AND a.status = 'approved'
    -- Legacy approvals have no timezone. Conservatively include adjacent dates.
    AND start_at < ((a.period_end + 1)::timestamp AT TIME ZONE coalesce(a.period_timezone,'UTC')) + CASE WHEN a.period_timezone IS NULL THEN interval '1 day' ELSE interval '0' END
    AND coalesce(end_at,'infinity'::timestamptz) > (a.period_start::timestamp AT TIME ZONE coalesce(a.period_timezone,'UTC')) - CASE WHEN a.period_timezone IS NULL THEN interval '1 day' ELSE interval '0' END;
END $function$
;
CREATE OR REPLACE FUNCTION public.invalidate_changed_timesheet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE old_row jsonb; new_row jsonb; r record; tenant_key uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'time_clock_entries' AND
      (old_row->'tenant_id',old_row->'employee_id',old_row->'clock_in',old_row->'clock_out') IS NOT DISTINCT FROM
      (new_row->'tenant_id',new_row->'employee_id',new_row->'clock_in',new_row->'clock_out') THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'time_clock_breaks' AND
      (old_row - ARRAY['updated_at','created_at']) = (new_row - ARRAY['updated_at','created_at']) THEN RETURN NEW; END IF;
  END IF;
  FOR tenant_key IN SELECT DISTINCT v FROM unnest(ARRAY[(old_row->>'tenant_id')::uuid,(new_row->>'tenant_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || tenant_key::text,0));
  END LOOP;
  IF TG_TABLE_NAME = 'time_clock_entries' THEN
    IF old_row IS NOT NULL THEN PERFORM invalidate_timesheet_window(OLD.tenant_id,OLD.employee_id,OLD.clock_in,OLD.clock_out); END IF;
    IF new_row IS NOT NULL THEN
      PERFORM invalidate_timesheet_window(NEW.tenant_id,NEW.employee_id,NEW.clock_in,NEW.clock_out);
      NEW.updated_at := clock_timestamp();
    END IF;
  ELSE
    FOR r IN SELECT * FROM time_clock_entries WHERE id IN ((old_row->>'time_clock_entry_id')::uuid,(new_row->>'time_clock_entry_id')::uuid) LOOP
      PERFORM invalidate_timesheet_window(r.tenant_id,r.employee_id,r.clock_in,r.clock_out);
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.timesheet_snapshot(t uuid, e uuid, start_at timestamp with time zone, end_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'employee_id',employee_id,'clock_in',clock_in,'clock_out',clock_out,'updated_at',updated_at) ORDER BY id),'[]'::jsonb)
  FROM time_clock_entries WHERE tenant_id=t AND (e IS NULL OR employee_id=e)
    AND clock_in < end_at AND coalesce(clock_out,'infinity'::timestamptz) > start_at;
$function$
;
CREATE OR REPLACE FUNCTION public.normalize_timesheet_snapshot(value jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)
  FROM jsonb_to_recordset(value) r(id uuid,employee_id uuid,clock_in timestamptz,clock_out timestamptz,updated_at timestamptz);
$function$
;
CREATE OR REPLACE FUNCTION public.link_staff_identity(p_actor uuid, p_tenant uuid, p_tip uuid, p_profile uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE roster tip_employees; target user_profiles; actor_role user_role;
BEGIN
 SELECT role INTO actor_role FROM user_profiles WHERE id=p_actor AND tenant_id=p_tenant AND is_active;
 IF actor_role IS NULL OR actor_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'Manager access required'; END IF;
 SELECT * INTO target FROM user_profiles WHERE id=p_profile AND tenant_id=p_tenant AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account not found in this location'; END IF;
 IF actor_role <> 'owner' AND target.role <> 'employee' THEN RAISE EXCEPTION 'Only the owner can link a privileged account'; END IF;
 SELECT * INTO roster FROM tip_employees WHERE id=p_tip AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Roster employee not found in this location'; END IF;
 IF roster.user_profile_id IS NOT NULL AND roster.user_profile_id<>p_profile THEN RAISE EXCEPTION 'This roster employee is already linked to another account'; END IF;
 IF EXISTS (SELECT 1 FROM tip_employees WHERE tenant_id=p_tenant AND user_profile_id=p_profile AND id<>p_tip) THEN RAISE EXCEPTION 'This account already has a roster link'; END IF;
 IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 OR EXISTS (SELECT 1 FROM shifts WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 OR EXISTS (SELECT 1 FROM shift_templates WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 THEN RAISE EXCEPTION 'Some history belongs to another account. Review the identities before linking'; END IF;
 IF EXISTS (SELECT 1 FROM time_clock_entries a JOIN time_clock_entries b ON a.id<>b.id AND a.clock_in<coalesce(b.clock_out,'infinity'::timestamptz) AND b.clock_in<coalesce(a.clock_out,'infinity'::timestamptz)
   WHERE a.tenant_id=p_tenant AND b.tenant_id=p_tenant AND a.tip_employee_id=p_tip AND b.employee_id=p_profile AND b.tip_employee_id IS DISTINCT FROM p_tip)
 THEN RAISE EXCEPTION 'Overlapping work sessions need review before linking'; END IF;
 UPDATE tip_employees SET user_profile_id=p_profile WHERE id=p_tip;
 PERFORM set_config('cms.time_change_reason','Staff identity linked by manager ' || p_actor::text,true);
 UPDATE time_clock_entries SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 UPDATE shifts SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 UPDATE shift_templates SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 INSERT INTO staff_identity_history(tenant_id,actor_id,tip_employee_id,user_profile_id) VALUES(p_tenant,p_actor,p_tip,p_profile);
END $function$
;
CREATE OR REPLACE FUNCTION public.validate_timesheet_export(p_tenant uuid, p_start date, p_end date, p_timezone text, p_expected jsonb)
 RETURNS SETOF timesheet_approvals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE start_at timestamptz; end_at timestamptz; snapshot jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=p_tenant AND is_active AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end-p_start > 62 OR p_timezone IS NULL THEN RAISE EXCEPTION 'Invalid pay period'; END IF;
  start_at := p_start::timestamp AT TIME ZONE p_timezone; end_at := (p_end+1)::timestamp AT TIME ZONE p_timezone;
  PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || p_tenant::text,0));
  snapshot := timesheet_snapshot(p_tenant,NULL,start_at,end_at);
  IF p_expected IS NULL OR normalize_timesheet_snapshot(p_expected) <> snapshot THEN RAISE EXCEPTION 'Recorded time changed. Refresh before exporting.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot) v WHERE NOT EXISTS (
    SELECT 1 FROM timesheet_approvals a WHERE a.tenant_id=p_tenant AND a.employee_id=(v->>'employee_id')::uuid AND a.period_start=p_start AND a.period_end=p_end
      AND a.status='approved' AND a.period_timezone=p_timezone)) THEN RAISE EXCEPTION 'Every timesheet must be approved for this pay period before exporting. Review any changes and approve again.'; END IF;
  IF EXISTS (SELECT 1 FROM time_clock_missing_requests WHERE tenant_id=p_tenant AND status='pending' AND clock_in < end_at AND clock_out > start_at) OR EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE tenant_id=p_tenant AND status='pending' AND time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v)) THEN RAISE EXCEPTION 'Review pending time corrections before exporting'; END IF;
  RETURN QUERY SELECT * FROM timesheet_approvals WHERE tenant_id=p_tenant AND period_start=p_start AND period_end=p_end AND status='approved';
END $function$
;
CREATE OR REPLACE FUNCTION public.guard_staff_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NOT NULL THEN
   IF TG_TABLE_NAME='user_profiles' AND ((TG_OP='INSERT' AND (to_jsonb(NEW)->>'staff_login_id') IS NOT NULL) OR (TG_OP='UPDATE' AND (to_jsonb(NEW)->>'staff_login_id') IS DISTINCT FROM (to_jsonb(OLD)->>'staff_login_id'))) THEN
     RAISE EXCEPTION 'Staff IDs are managed through Staff access';
   ELSIF TG_TABLE_NAME='tip_employees' AND ((TG_OP='INSERT' AND (to_jsonb(NEW)->>'user_profile_id') IS NOT NULL) OR (TG_OP='UPDATE' AND (to_jsonb(NEW)->>'user_profile_id') IS DISTINCT FROM (to_jsonb(OLD)->>'user_profile_id'))) THEN
     RAISE EXCEPTION 'Roster links are managed through Staff access';
   END IF;
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.resolve_roster_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE linked uuid;
BEGIN
 IF NEW.tip_employee_id IS NOT NULL THEN
   SELECT user_profile_id INTO linked FROM tip_employees WHERE id=NEW.tip_employee_id AND tenant_id=NEW.tenant_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Roster employee must belong to the same location'; END IF;
   IF linked IS NOT NULL THEN
     IF NEW.employee_id IS NOT NULL AND NEW.employee_id<>linked THEN RAISE EXCEPTION 'Roster and account identities do not match'; END IF;
     NEW.employee_id:=linked;
   END IF;
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.invalidate_tip_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tenant uuid; v_week date;
BEGIN
  v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF TG_TABLE_NAME = 'tip_employees' THEN
    IF TG_OP = 'UPDATE' AND (NEW.is_active, NEW.tip_eligible, NEW.name, NEW.user_profile_id)
      IS NOT DISTINCT FROM (OLD.is_active, OLD.tip_eligible, OLD.name, OLD.user_profile_id) THEN
      RETURN NEW;
    END IF;
    UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
      WHERE tenant_id = v_tenant AND status = 'approved';
  ELSE
    v_week := COALESCE(NEW.week_key, OLD.week_key);
    IF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'tip_weekly_data' AND
        (to_jsonb(NEW)->'cash_tips', to_jsonb(NEW)->'cc_tips', to_jsonb(NEW)->'cash_entries', to_jsonb(NEW)->'cc_entries')
        IS NOT DISTINCT FROM (to_jsonb(OLD)->'cash_tips', to_jsonb(OLD)->'cc_tips', to_jsonb(OLD)->'cash_entries', to_jsonb(OLD)->'cc_entries') THEN
        RETURN NEW;
      END IF;
      IF TG_TABLE_NAME = 'tip_employee_hours' AND
        (to_jsonb(NEW)->'hours', to_jsonb(NEW)->'employee_id') IS NOT DISTINCT FROM
        (to_jsonb(OLD)->'hours', to_jsonb(OLD)->'employee_id') THEN
        RETURN NEW;
      END IF;
    END IF;
    UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
      WHERE tenant_id = v_tenant AND week_key = v_week AND status = 'approved';
    IF TG_OP = 'UPDATE' AND OLD.week_key IS DISTINCT FROM NEW.week_key THEN
      UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
        WHERE tenant_id = OLD.tenant_id AND week_key = OLD.week_key AND status = 'approved';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;
ALTER TABLE public."account_businesses" ADD CONSTRAINT "account_businesses_name_key" UNIQUE (name);
ALTER TABLE public."account_businesses" ADD CONSTRAINT "account_businesses_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_task_categories" ADD CONSTRAINT "admin_task_categories_tenant_id_name_key" UNIQUE (tenant_id, name);
ALTER TABLE public."admin_task_categories" ADD CONSTRAINT "admin_task_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_task_comments" ADD CONSTRAINT "admin_task_comments_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_task_history" ADD CONSTRAINT "admin_task_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."alfred_confirmation_tokens" ADD CONSTRAINT "alfred_confirmation_tokens_pkey" PRIMARY KEY (token);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."base_template_ingredients" ADD CONSTRAINT "base_template_ingredients_pkey" PRIMARY KEY (id);
ALTER TABLE public."base_template_ingredients" ADD CONSTRAINT "base_template_ingredients_base_template_id_ingredient_id_si_key" UNIQUE (base_template_id, ingredient_id, size_id);
ALTER TABLE public."base_templates" ADD CONSTRAINT "base_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."blackout_dates" ADD CONSTRAINT "valid_blackout_date_range" CHECK ((end_date >= start_date));
ALTER TABLE public."blackout_dates" ADD CONSTRAINT "blackout_dates_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_chart_of_accounts" ADD CONSTRAINT "budget_chart_of_accounts_account_type_check" CHECK ((account_type = ANY (ARRAY['Revenue'::text, 'COGS'::text, 'Expense'::text, 'Other'::text])));
ALTER TABLE public."budget_chart_of_accounts" ADD CONSTRAINT "budget_chart_of_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_fiscal_years" ADD CONSTRAINT "budget_fiscal_years_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'locked'::text])));
ALTER TABLE public."budget_fiscal_years" ADD CONSTRAINT "budget_fiscal_years_tenant_id_year_key" UNIQUE (tenant_id, year);
ALTER TABLE public."budget_fiscal_years" ADD CONSTRAINT "budget_fiscal_years_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_driver_type_check" CHECK ((driver_type = ANY (ARRAY['percentage_of_account'::text, 'fixed_amount'::text, 'growth_rate'::text, 'per_unit'::text])));
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_month_check" CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_tenant_id_scenario_id_account_id_key" UNIQUE (tenant_id, scenario_id, account_id, month);
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_forecast_scenarios" ADD CONSTRAINT "budget_forecast_scenarios_tenant_id_fiscal_year_id_name_key" UNIQUE (tenant_id, fiscal_year_id, name);
ALTER TABLE public."budget_forecast_scenarios" ADD CONSTRAINT "budget_forecast_scenarios_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_import_logs" ADD CONSTRAINT "budget_import_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_import_logs" ADD CONSTRAINT "budget_import_logs_import_type_check" CHECK ((import_type = ANY (ARRAY['chart_of_accounts'::text, 'actuals'::text])));
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_month_check" CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_tenant_id_fiscal_year_id_account_id_month_key" UNIQUE (tenant_id, fiscal_year_id, account_id, month);
ALTER TABLE public."budget_seasonal_patterns" ADD CONSTRAINT "budget_seasonal_patterns_tenant_id_name_key" UNIQUE (tenant_id, name);
ALTER TABLE public."budget_seasonal_patterns" ADD CONSTRAINT "budget_seasonal_patterns_pkey" PRIMARY KEY (id);
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_report_type_check" CHECK ((report_type = ANY (ARRAY['bug'::text, 'suggestion'::text, 'feedback'::text])));
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])));
ALTER TABLE public."business_accounts" ADD CONSTRAINT "business_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."calendar_events" ADD CONSTRAINT "valid_event_dates" CHECK ((end_date >= start_date));
ALTER TABLE public."calendar_events" ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_activity" ADD CONSTRAINT "cash_activity_pkey" PRIMARY KEY (id);
ALTER TABLE public."cash_activity" ADD CONSTRAINT "cash_activity_tenant_id_drawer_date_key" UNIQUE (tenant_id, drawer_date);
ALTER TABLE public."certification_types" ADD CONSTRAINT "certification_types_tenant_id_name_key" UNIQUE (tenant_id, name);
ALTER TABLE public."certification_types" ADD CONSTRAINT "certification_types_pkey" PRIMARY KEY (id);
ALTER TABLE public."coffee_order_history" ADD CONSTRAINT "coffee_order_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."compliance_workflow_links" ADD CONSTRAINT "compliance_workflow_links_pkey" PRIMARY KEY (task_id);
ALTER TABLE public."compliance_workflow_receipts" ADD CONSTRAINT "compliance_workflow_receipts_pkey" PRIMARY KEY (event_id);
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "chk_ct_mapping_status" CHECK ((status = ANY (ARRAY['suggested'::text, 'confirmed'::text, 'ignored'::text])));
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "connecteam_employee_mappings_pkey" PRIMARY KEY (id);
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "chk_ct_mapping_employee" CHECK (((status <> 'confirmed'::text) OR (tip_employee_id IS NOT NULL)));
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "uq_connecteam_mapping" UNIQUE (tenant_id, connecteam_user_id);
ALTER TABLE public."connecteam_settings" ADD CONSTRAINT "connecteam_settings_pkey" PRIMARY KEY (tenant_id);
ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY (id);
ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_user_id_key" UNIQUE (conversation_id, user_id);
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_type_check" CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text, 'channel'::text])));
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY (id);
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_system_role_check" CHECK ((system_role = ANY (ARRAY['all'::text, 'manager'::text])));
ALTER TABLE public."document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_document_id_user_id_key" UNIQUE (document_id, user_id);
ALTER TABLE public."document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_pkey" PRIMARY KEY (id);
ALTER TABLE public."document_categories" ADD CONSTRAINT "document_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY (id);
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'pending_renewal'::text])));
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_cert_has_employee" CHECK (((employee_id IS NOT NULL) OR (tip_employee_id IS NOT NULL)));
ALTER TABLE public."employee_unavailability" ADD CONSTRAINT "employee_unavailability_pkey" PRIMARY KEY (id);
ALTER TABLE public."employee_unavailability" ADD CONSTRAINT "valid_unavail_range" CHECK ((end_date >= start_date));
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_attachments" ADD CONSTRAINT "equipment_attachments_pkey" PRIMARY KEY (id);
ALTER TABLE public."equipment_attachments" ADD CONSTRAINT "equipment_attachments_attachment_type_check" CHECK ((attachment_type = ANY (ARRAY['file'::text, 'link'::text])));
ALTER TABLE public."feature_reviews" ADD CONSTRAINT "feature_reviews_rating_check" CHECK ((rating = ANY (ARRAY['up'::text, 'down'::text])));
ALTER TABLE public."feature_reviews" ADD CONSTRAINT "feature_reviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."feature_reviews" ADD CONSTRAINT "feature_reviews_user_id_feature_id_key" UNIQUE (user_id, feature_id);
ALTER TABLE public."food_items" ADD CONSTRAINT "food_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."growth_tracker_monthly" ADD CONSTRAINT "growth_tracker_monthly_pkey" PRIMARY KEY (id);
ALTER TABLE public."growth_tracker_monthly" ADD CONSTRAINT "growth_tracker_monthly_tenant_id_year_month_key" UNIQUE (tenant_id, year, month);
ALTER TABLE public."growth_tracker_monthly" ADD CONSTRAINT "growth_tracker_monthly_month_check" CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public."help_content" ADD CONSTRAINT "help_content_term_key_vertical_id_key" UNIQUE (term_key, vertical_id);
ALTER TABLE public."help_content" ADD CONSTRAINT "help_content_pkey" PRIMARY KEY (id);
ALTER TABLE public."ical_subscriptions" ADD CONSTRAINT "ical_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."ingredient_categories" ADD CONSTRAINT "ingredient_categories_name_tenant_key" UNIQUE (name, tenant_id);
ALTER TABLE public."ingredient_categories" ADD CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."ingredients" ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY (id);
ALTER TABLE public."license_codes" ADD CONSTRAINT "license_codes_pkey" PRIMARY KEY (id);
ALTER TABLE public."license_codes" ADD CONSTRAINT "license_codes_code_key" UNIQUE (code);
ALTER TABLE public."maintenance_logs" ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."maintenance_task_attachments" ADD CONSTRAINT "maintenance_task_attachments_pkey" PRIMARY KEY (id);
ALTER TABLE public."maintenance_task_attachments" ADD CONSTRAINT "maintenance_task_attachments_attachment_type_check" CHECK ((attachment_type = ANY (ARRAY['file'::text, 'link'::text, 'video'::text])));
ALTER TABLE public."maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY (id);
ALTER TABLE public."maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_interval_type_check" CHECK ((interval_type = ANY (ARRAY['time'::text, 'usage'::text])));
ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);
ALTER TABLE public."messages" ADD CONSTRAINT "messages_attachment_type_check" CHECK ((attachment_type = ANY (ARRAY['image'::text, 'file'::text])));
ALTER TABLE public."modules" ADD CONSTRAINT "modules_pkey" PRIMARY KEY (id);
ALTER TABLE public."overhead_items" ADD CONSTRAINT "overhead_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."overhead_items" ADD CONSTRAINT "overhead_items_frequency_check" CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'bi-weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text])));
ALTER TABLE public."overhead_settings" ADD CONSTRAINT "overhead_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_admins" ADD CONSTRAINT "platform_admins_email_key" UNIQUE (email);
ALTER TABLE public."platform_admins" ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY (id);
ALTER TABLE public."platform_cost_settings" ADD CONSTRAINT "platform_cost_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_name_tenant_key" UNIQUE (name, tenant_id);
ALTER TABLE public."product_sizes" ADD CONSTRAINT "drink_sizes_pkey" PRIMARY KEY (id);
ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE public."products" ADD CONSTRAINT "products_recipe_id_size_id_key" UNIQUE (recipe_id, size_id);
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_ingredient_id_size_id_key" UNIQUE (recipe_id, ingredient_id, size_id);
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY (id);
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "check_ingredient_or_syrup" CHECK ((((ingredient_id IS NOT NULL) AND (syrup_recipe_id IS NULL)) OR ((ingredient_id IS NULL) AND (syrup_recipe_id IS NOT NULL))));
ALTER TABLE public."recipe_size_bases" ADD CONSTRAINT "recipe_size_bases_recipe_id_size_id_key" UNIQUE (recipe_id, size_id);
ALTER TABLE public."recipe_size_bases" ADD CONSTRAINT "recipe_size_bases_pkey" PRIMARY KEY (id);
ALTER TABLE public."recipe_size_pricing" ADD CONSTRAINT "recipe_size_pricing_pkey" PRIMARY KEY (id);
ALTER TABLE public."recipe_size_pricing" ADD CONSTRAINT "recipe_size_pricing_recipe_id_size_id_key" UNIQUE (recipe_id, size_id);
ALTER TABLE public."recipe_vendors" ADD CONSTRAINT "recipe_vendors_pkey" PRIMARY KEY (id);
ALTER TABLE public."recipes" ADD CONSTRAINT "recipes_pkey" PRIMARY KEY (id);
ALTER TABLE public."referral_codes" ADD CONSTRAINT "referral_codes_pkey" PRIMARY KEY (id);
ALTER TABLE public."referral_codes" ADD CONSTRAINT "unique_tenant_referral" UNIQUE (tenant_id);
ALTER TABLE public."referral_codes" ADD CONSTRAINT "referral_codes_code_key" UNIQUE (code);
ALTER TABLE public."referral_redemptions" ADD CONSTRAINT "unique_referred_tenant" UNIQUE (referred_tenant_id);
ALTER TABLE public."referral_redemptions" ADD CONSTRAINT "referral_redemptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_invoices" ADD CONSTRAINT "reseller_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'overdue'::text, 'void'::text])));
ALTER TABLE public."reseller_invoices" ADD CONSTRAINT "reseller_invoices_payment_method_check" CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['ach'::text, 'card'::text, 'check'::text, 'other'::text]))));
ALTER TABLE public."reseller_invoices" ADD CONSTRAINT "reseller_invoices_pkey" PRIMARY KEY (id);
ALTER TABLE public."reseller_volume_tiers" ADD CONSTRAINT "reseller_volume_tiers_pkey" PRIMARY KEY (id);
ALTER TABLE public."resellers" ADD CONSTRAINT "resellers_tier_check" CHECK ((tier = ANY (ARRAY['authorized'::text, 'silver'::text, 'gold'::text])));
ALTER TABLE public."resellers" ADD CONSTRAINT "resellers_pkey" PRIMARY KEY (id);
ALTER TABLE public."resellers" ADD CONSTRAINT "resellers_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text])));
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_pkey" PRIMARY KEY (id);
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_acceptance_check" CHECK (((acceptance IS NULL) OR (acceptance = ANY (ARRAY['accepted'::text, 'declined'::text]))));
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_has_employee" CHECK (((employee_id IS NOT NULL) OR (tip_employee_id IS NOT NULL)));
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "chk_square_mapping_status" CHECK ((status = ANY (ARRAY['suggested'::text, 'confirmed'::text, 'ignored'::text])));
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "chk_square_mapping_employee" CHECK (((status <> 'confirmed'::text) OR (user_profile_id IS NOT NULL) OR (tip_employee_id IS NOT NULL)));
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "uq_square_mapping" UNIQUE (tenant_id, square_team_member_id);
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "square_employee_mappings_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff_identity_history" ADD CONSTRAINT "staff_identity_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."store_operating_hours" ADD CONSTRAINT "store_operating_hours_pkey" PRIMARY KEY (id);
ALTER TABLE public."store_operating_hours" ADD CONSTRAINT "unique_tenant_day" UNIQUE (tenant_id, day_of_week);
ALTER TABLE public."store_operating_hours" ADD CONSTRAINT "store_operating_hours_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
ALTER TABLE public."subscription_plan_modules" ADD CONSTRAINT "subscription_plan_modules_pkey" PRIMARY KEY (plan_id, module_id);
ALTER TABLE public."subscription_plans" ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_activity_log" ADD CONSTRAINT "tenant_activity_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_branding" ADD CONSTRAINT "tenant_branding_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_key" UNIQUE (tenant_id);
ALTER TABLE public."tenant_coffee_products" ADD CONSTRAINT "tenant_coffee_products_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_coffee_products" ADD CONSTRAINT "tenant_coffee_products_tenant_id_sku_key" UNIQUE (tenant_id, sku);
ALTER TABLE public."tenant_coffee_vendors" ADD CONSTRAINT "tenant_coffee_vendors_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_module_overrides" ADD CONSTRAINT "tenant_module_overrides_pkey" PRIMARY KEY (tenant_id, module_id);
ALTER TABLE public."tenant_module_subscriptions" ADD CONSTRAINT "tenant_module_subscriptions_pkey" PRIMARY KEY (tenant_id, module_id);
ALTER TABLE public."tenant_role_settings" ADD CONSTRAINT "tenant_role_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_role_settings" ADD CONSTRAINT "tenant_role_settings_tenant_id_role_key" UNIQUE (tenant_id, role);
ALTER TABLE public."tenant_usage_metrics" ADD CONSTRAINT "tenant_usage_metrics_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_usage_metrics" ADD CONSTRAINT "tenant_usage_metrics_tenant_id_metric_date_key" UNIQUE (tenant_id, metric_date);
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_billing_interval_check" CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'annual'::text])));
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_slug_key" UNIQUE (slug);
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_clock_audit_events" ADD CONSTRAINT "time_clock_audit_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_clock_breaks" ADD CONSTRAINT "time_clock_breaks_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_clock_edit_requests" ADD CONSTRAINT "time_clock_edit_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_clock_entries" ADD CONSTRAINT "time_clock_entries_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_clock_missing_requests" ADD CONSTRAINT "time_clock_missing_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'cancelled'::text])));
ALTER TABLE public."time_clock_missing_requests" ADD CONSTRAINT "time_clock_missing_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_entry_type_check" CHECK ((entry_type = ANY (ARRAY['accrual'::text, 'usage'::text, 'adjustment'::text, 'carryover'::text, 'grant'::text, 'pending'::text, 'pending_release'::text])));
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_off_balances" ADD CONSTRAINT "time_off_balances_tenant_id_employee_id_policy_id_year_key" UNIQUE (tenant_id, employee_id, policy_id, year);
ALTER TABLE public."time_off_balances" ADD CONSTRAINT "time_off_balances_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_carryover_type_check" CHECK ((carryover_type = ANY (ARRAY['none'::text, 'unlimited'::text, 'capped'::text])));
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_grant_method_check" CHECK ((grant_method = ANY (ARRAY['upfront'::text, 'per_pay_period'::text])));
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_policy_type_check" CHECK ((policy_type = ANY (ARRAY['none'::text, 'accrual'::text, 'fixed_annual'::text, 'milestone'::text])));
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_pkey" PRIMARY KEY (id);
ALTER TABLE public."time_off_requests" ADD CONSTRAINT "valid_date_range" CHECK ((end_date >= start_date));
ALTER TABLE public."time_off_requests" ADD CONSTRAINT "time_off_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."timesheet_approval_history" ADD CONSTRAINT "timesheet_approval_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "uq_ts_approval" UNIQUE (tenant_id, employee_id, period_start, period_end);
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "chk_ts_approval_status" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_employee_hours" ADD CONSTRAINT "tip_employee_hours_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_employee_hours" ADD CONSTRAINT "tip_employee_hours_employee_id_week_key_key" UNIQUE (employee_id, week_key);
ALTER TABLE public."tip_employees" ADD CONSTRAINT "tip_employees_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_employees" ADD CONSTRAINT "tip_employees_tenant_id_name_key" UNIQUE (tenant_id, name);
ALTER TABLE public."tip_payout_approval_history" ADD CONSTRAINT "tip_payout_approval_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "chk_tip_approval_status" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "chk_positive_pool" CHECK ((total_pool >= (0)::numeric));
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "chk_distribution_method" CHECK ((distribution_method = ANY (ARRAY['hours'::text, 'equal'::text, 'points'::text])));
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "tip_payout_approvals_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "uq_tip_payout_approvals_tenant_week" UNIQUE (tenant_id, week_key);
ALTER TABLE public."tip_weekly_data" ADD CONSTRAINT "tip_weekly_data_pkey" PRIMARY KEY (id);
ALTER TABLE public."tip_weekly_data" ADD CONSTRAINT "tip_weekly_data_tenant_id_week_key_key" UNIQUE (tenant_id, week_key);
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_pkey" PRIMARY KEY (id);
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_has_employee" CHECK (((employee_id IS NOT NULL) OR (tip_employee_id IS NOT NULL)));
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_status_check" CHECK ((status = ANY (ARRAY['registered'::text, 'attended'::text, 'no_show'::text, 'cancelled'::text])));
ALTER TABLE public."training_classes" ADD CONSTRAINT "training_classes_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_profiles" ADD CONSTRAINT "chk_pay_frequency" CHECK ((pay_frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semi_monthly'::text, 'monthly'::text])));
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_profiles" ADD CONSTRAINT "valid_staff_login_id" CHECK (((staff_login_id IS NULL) OR (staff_login_id ~ '^[a-z][a-z0-9._-]{2,39}$'::text)));
ALTER TABLE public."user_tenant_assignments" ADD CONSTRAINT "user_tenant_assignments_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_tenant_assignments" ADD CONSTRAINT "user_tenant_assignments_user_id_tenant_id_key" UNIQUE (user_id, tenant_id);
ALTER TABLE public."vertical_templates" ADD CONSTRAINT "vertical_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."verticals" ADD CONSTRAINT "verticals_slug_key" UNIQUE (slug);
ALTER TABLE public."verticals" ADD CONSTRAINT "verticals_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_task_categories" ADD CONSTRAINT "admin_task_categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."admin_task_comments" ADD CONSTRAINT "admin_task_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."admin_task_comments" ADD CONSTRAINT "admin_task_comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES admin_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."admin_task_comments" ADD CONSTRAINT "admin_task_comments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."admin_task_history" ADD CONSTRAINT "admin_task_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."admin_task_history" ADD CONSTRAINT "admin_task_history_task_id_fkey" FOREIGN KEY (task_id) REFERENCES admin_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."admin_task_history" ADD CONSTRAINT "admin_task_history_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_parent_task_id_fkey" FOREIGN KEY (parent_task_id) REFERENCES admin_tasks(id) ON DELETE SET NULL;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_category_id_fkey" FOREIGN KEY (category_id) REFERENCES admin_task_categories(id) ON DELETE SET NULL;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."admin_tasks" ADD CONSTRAINT "admin_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."alfred_confirmation_tokens" ADD CONSTRAINT "alfred_confirmation_tokens_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."base_template_ingredients" ADD CONSTRAINT "base_template_ingredients_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;
ALTER TABLE public."base_template_ingredients" ADD CONSTRAINT "base_template_ingredients_base_template_id_fkey" FOREIGN KEY (base_template_id) REFERENCES base_templates(id) ON DELETE CASCADE;
ALTER TABLE public."base_template_ingredients" ADD CONSTRAINT "base_template_ingredients_size_id_fkey" FOREIGN KEY (size_id) REFERENCES product_sizes(id) ON DELETE CASCADE;
ALTER TABLE public."base_templates" ADD CONSTRAINT "base_templates_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."budget_chart_of_accounts" ADD CONSTRAINT "budget_chart_of_accounts_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE public."budget_chart_of_accounts" ADD CONSTRAINT "budget_chart_of_accounts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_fiscal_years" ADD CONSTRAINT "budget_fiscal_years_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_target_account_id_fkey" FOREIGN KEY (target_account_id) REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_scenario_id_fkey" FOREIGN KEY (scenario_id) REFERENCES budget_forecast_scenarios(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_drivers" ADD CONSTRAINT "budget_forecast_drivers_source_account_id_fkey" FOREIGN KEY (source_account_id) REFERENCES budget_chart_of_accounts(id) ON DELETE SET NULL;
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_account_id_fkey" FOREIGN KEY (account_id) REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_line_items" ADD CONSTRAINT "budget_forecast_line_items_scenario_id_fkey" FOREIGN KEY (scenario_id) REFERENCES budget_forecast_scenarios(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_scenarios" ADD CONSTRAINT "budget_forecast_scenarios_fiscal_year_id_fkey" FOREIGN KEY (fiscal_year_id) REFERENCES budget_fiscal_years(id) ON DELETE CASCADE;
ALTER TABLE public."budget_forecast_scenarios" ADD CONSTRAINT "budget_forecast_scenarios_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_import_logs" ADD CONSTRAINT "budget_import_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_fiscal_year_id_fkey" FOREIGN KEY (fiscal_year_id) REFERENCES budget_fiscal_years(id) ON DELETE CASCADE;
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_account_id_fkey" FOREIGN KEY (account_id) REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE public."budget_line_items" ADD CONSTRAINT "budget_line_items_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."budget_seasonal_patterns" ADD CONSTRAINT "budget_seasonal_patterns_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."bug_reports" ADD CONSTRAINT "bug_reports_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."calendar_events" ADD CONSTRAINT "calendar_events_ical_subscription_id_fkey" FOREIGN KEY (ical_subscription_id) REFERENCES ical_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public."calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."cash_activity" ADD CONSTRAINT "cash_activity_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."certification_types" ADD CONSTRAINT "certification_types_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."coffee_order_history" ADD CONSTRAINT "coffee_order_history_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."coffee_order_history" ADD CONSTRAINT "coffee_order_history_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES tenant_coffee_vendors(id) ON DELETE SET NULL;
ALTER TABLE public."compliance_workflow_links" ADD CONSTRAINT "compliance_workflow_links_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."compliance_workflow_links" ADD CONSTRAINT "compliance_workflow_links_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."compliance_workflow_links" ADD CONSTRAINT "compliance_workflow_links_task_id_fkey" FOREIGN KEY (task_id) REFERENCES admin_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."compliance_workflow_receipts" ADD CONSTRAINT "compliance_workflow_receipts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "connecteam_employee_mappings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "connecteam_employee_mappings_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."connecteam_employee_mappings" ADD CONSTRAINT "connecteam_employee_mappings_confirmed_by_fkey" FOREIGN KEY (confirmed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."connecteam_settings" ADD CONSTRAINT "connecteam_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE public."document_acknowledgments" ADD CONSTRAINT "document_acknowledgments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."document_categories" ADD CONSTRAINT "document_categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."documents" ADD CONSTRAINT "documents_review_assigned_to_fkey" FOREIGN KEY (review_assigned_to) REFERENCES user_profiles(id);
ALTER TABLE public."documents" ADD CONSTRAINT "documents_last_reviewed_by_fkey" FOREIGN KEY (last_reviewed_by) REFERENCES user_profiles(id);
ALTER TABLE public."documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_certification_type_id_fkey" FOREIGN KEY (certification_type_id) REFERENCES certification_types(id) ON DELETE CASCADE;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_training_class_id_fkey" FOREIGN KEY (training_class_id) REFERENCES training_classes(id) ON DELETE SET NULL;
ALTER TABLE public."employee_certifications" ADD CONSTRAINT "employee_certifications_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."employee_unavailability" ADD CONSTRAINT "employee_unavailability_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."employee_unavailability" ADD CONSTRAINT "employee_unavailability_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."equipment" ADD CONSTRAINT "equipment_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_attachments" ADD CONSTRAINT "equipment_attachments_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE;
ALTER TABLE public."equipment_attachments" ADD CONSTRAINT "equipment_attachments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."feature_reviews" ADD CONSTRAINT "feature_reviews_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."feature_reviews" ADD CONSTRAINT "feature_reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."food_items" ADD CONSTRAINT "food_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES product_categories(id);
ALTER TABLE public."food_items" ADD CONSTRAINT "food_items_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."growth_tracker_monthly" ADD CONSTRAINT "growth_tracker_monthly_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."help_content" ADD CONSTRAINT "help_content_vertical_id_fkey" FOREIGN KEY (vertical_id) REFERENCES verticals(id) ON DELETE CASCADE;
ALTER TABLE public."ical_subscriptions" ADD CONSTRAINT "ical_subscriptions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."ical_subscriptions" ADD CONSTRAINT "ical_subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."ingredient_categories" ADD CONSTRAINT "ingredient_categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."ingredients" ADD CONSTRAINT "ingredients_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES recipe_vendors(id) ON DELETE SET NULL;
ALTER TABLE public."ingredients" ADD CONSTRAINT "ingredients_category_id_fkey" FOREIGN KEY (category_id) REFERENCES ingredient_categories(id);
ALTER TABLE public."ingredients" ADD CONSTRAINT "ingredients_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."license_codes" ADD CONSTRAINT "license_codes_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE;
ALTER TABLE public."license_codes" ADD CONSTRAINT "license_codes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE public."license_codes" ADD CONSTRAINT "license_codes_vertical_id_fkey" FOREIGN KEY (vertical_id) REFERENCES verticals(id) ON DELETE SET NULL;
ALTER TABLE public."maintenance_logs" ADD CONSTRAINT "maintenance_logs_task_id_fkey" FOREIGN KEY (task_id) REFERENCES maintenance_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."maintenance_logs" ADD CONSTRAINT "maintenance_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."maintenance_task_attachments" ADD CONSTRAINT "maintenance_task_attachments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."maintenance_task_attachments" ADD CONSTRAINT "maintenance_task_attachments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES maintenance_tasks(id) ON DELETE CASCADE;
ALTER TABLE public."maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE;
ALTER TABLE public."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."overhead_items" ADD CONSTRAINT "overhead_items_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."overhead_settings" ADD CONSTRAINT "overhead_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."platform_admins" ADD CONSTRAINT "platform_admins_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."platform_cost_settings" ADD CONSTRAINT "platform_cost_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."product_sizes" ADD CONSTRAINT "drink_sizes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."products" ADD CONSTRAINT "products_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE public."products" ADD CONSTRAINT "products_size_id_fkey" FOREIGN KEY (size_id) REFERENCES product_sizes(id);
ALTER TABLE public."products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_syrup_recipe_id_fkey" FOREIGN KEY (syrup_recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_size_id_fkey" FOREIGN KEY (size_id) REFERENCES product_sizes(id);
ALTER TABLE public."recipe_size_bases" ADD CONSTRAINT "recipe_size_bases_base_template_id_fkey" FOREIGN KEY (base_template_id) REFERENCES base_templates(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_size_bases" ADD CONSTRAINT "recipe_size_bases_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_size_bases" ADD CONSTRAINT "recipe_size_bases_size_id_fkey" FOREIGN KEY (size_id) REFERENCES product_sizes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_size_pricing" ADD CONSTRAINT "recipe_size_pricing_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_size_pricing" ADD CONSTRAINT "recipe_size_pricing_size_id_fkey" FOREIGN KEY (size_id) REFERENCES product_sizes(id) ON DELETE CASCADE;
ALTER TABLE public."recipe_vendors" ADD CONSTRAINT "recipe_vendors_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."recipes" ADD CONSTRAINT "recipes_category_id_fkey" FOREIGN KEY (category_id) REFERENCES product_categories(id);
ALTER TABLE public."recipes" ADD CONSTRAINT "recipes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."recipes" ADD CONSTRAINT "recipes_base_template_id_fkey" FOREIGN KEY (base_template_id) REFERENCES base_templates(id);
ALTER TABLE public."referral_codes" ADD CONSTRAINT "referral_codes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."referral_redemptions" ADD CONSTRAINT "referral_redemptions_referred_tenant_id_fkey" FOREIGN KEY (referred_tenant_id) REFERENCES tenants(id);
ALTER TABLE public."referral_redemptions" ADD CONSTRAINT "referral_redemptions_referrer_tenant_id_fkey" FOREIGN KEY (referrer_tenant_id) REFERENCES tenants(id);
ALTER TABLE public."referral_redemptions" ADD CONSTRAINT "referral_redemptions_referral_code_id_fkey" FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE CASCADE;
ALTER TABLE public."reseller_invoices" ADD CONSTRAINT "reseller_invoices_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE;
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "square_employee_mappings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "square_employee_mappings_user_profile_id_fkey" FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "square_employee_mappings_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."square_employee_mappings" ADD CONSTRAINT "square_employee_mappings_confirmed_by_fkey" FOREIGN KEY (confirmed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."store_operating_hours" ADD CONSTRAINT "store_operating_hours_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."subscription_plan_modules" ADD CONSTRAINT "subscription_plan_modules_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE;
ALTER TABLE public."subscription_plan_modules" ADD CONSTRAINT "subscription_plan_modules_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_activity_log" ADD CONSTRAINT "tenant_activity_log_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_activity_log" ADD CONSTRAINT "tenant_activity_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_coffee_products" ADD CONSTRAINT "tenant_coffee_products_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES tenant_coffee_vendors(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_coffee_products" ADD CONSTRAINT "tenant_coffee_products_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_coffee_vendors" ADD CONSTRAINT "tenant_coffee_vendors_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_module_overrides" ADD CONSTRAINT "tenant_module_overrides_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_module_overrides" ADD CONSTRAINT "tenant_module_overrides_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_module_subscriptions" ADD CONSTRAINT "tenant_module_subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_module_subscriptions" ADD CONSTRAINT "tenant_module_subscriptions_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_role_settings" ADD CONSTRAINT "tenant_role_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenant_usage_metrics" ADD CONSTRAINT "tenant_usage_metrics_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL;
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_license_code_id_fkey" FOREIGN KEY (license_code_id) REFERENCES license_codes(id) ON DELETE SET NULL;
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY (parent_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_vertical_id_fkey" FOREIGN KEY (vertical_id) REFERENCES verticals(id);
ALTER TABLE public."time_clock_breaks" ADD CONSTRAINT "time_clock_breaks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_breaks" ADD CONSTRAINT "time_clock_breaks_time_clock_entry_id_fkey" FOREIGN KEY (time_clock_entry_id) REFERENCES time_clock_entries(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_edit_requests" ADD CONSTRAINT "time_clock_edit_requests_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_edit_requests" ADD CONSTRAINT "time_clock_edit_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_edit_requests" ADD CONSTRAINT "time_clock_edit_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."time_clock_edit_requests" ADD CONSTRAINT "time_clock_edit_requests_time_clock_entry_id_fkey" FOREIGN KEY (time_clock_entry_id) REFERENCES time_clock_entries(id) ON DELETE RESTRICT;
ALTER TABLE public."time_clock_entries" ADD CONSTRAINT "time_clock_entries_edited_by_fkey" FOREIGN KEY (edited_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."time_clock_entries" ADD CONSTRAINT "time_clock_entries_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_entries" ADD CONSTRAINT "time_clock_entries_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id);
ALTER TABLE public."time_clock_entries" ADD CONSTRAINT "time_clock_entries_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."time_clock_missing_requests" ADD CONSTRAINT "time_clock_missing_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id);
ALTER TABLE public."time_clock_missing_requests" ADD CONSTRAINT "time_clock_missing_requests_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."time_clock_missing_requests" ADD CONSTRAINT "time_clock_missing_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id);
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_balance_id_fkey" FOREIGN KEY (balance_id) REFERENCES time_off_balances(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_policy_id_fkey" FOREIGN KEY (policy_id) REFERENCES time_off_policies(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_accrual_log" ADD CONSTRAINT "time_off_accrual_log_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_balances" ADD CONSTRAINT "time_off_balances_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_balances" ADD CONSTRAINT "time_off_balances_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_balances" ADD CONSTRAINT "time_off_balances_policy_id_fkey" FOREIGN KEY (policy_id) REFERENCES time_off_policies(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_policies" ADD CONSTRAINT "time_off_policies_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."time_off_requests" ADD CONSTRAINT "time_off_requests_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."time_off_requests" ADD CONSTRAINT "time_off_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."tip_employee_hours" ADD CONSTRAINT "tip_employee_hours_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tip_employee_hours" ADD CONSTRAINT "tip_employee_hours_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES tip_employees(id) ON DELETE CASCADE;
ALTER TABLE public."tip_employees" ADD CONSTRAINT "tip_employees_user_profile_id_fkey" FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."tip_employees" ADD CONSTRAINT "tip_employees_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tip_payout_approval_history" ADD CONSTRAINT "tip_payout_approval_history_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE public."tip_payout_approval_history" ADD CONSTRAINT "tip_payout_approval_history_approval_id_fkey" FOREIGN KEY (approval_id) REFERENCES tip_payout_approvals(id) ON DELETE RESTRICT;
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "tip_payout_approvals_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "tip_payout_approvals_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."tip_payout_approvals" ADD CONSTRAINT "tip_payout_approvals_calculated_by_fkey" FOREIGN KEY (calculated_by) REFERENCES user_profiles(id) ON DELETE RESTRICT;
ALTER TABLE public."tip_weekly_data" ADD CONSTRAINT "tip_weekly_data_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_tip_employee_id_fkey" FOREIGN KEY (tip_employee_id) REFERENCES tip_employees(id) ON DELETE SET NULL;
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_training_class_id_fkey" FOREIGN KEY (training_class_id) REFERENCES training_classes(id) ON DELETE CASCADE;
ALTER TABLE public."training_attendance" ADD CONSTRAINT "training_attendance_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."training_classes" ADD CONSTRAINT "training_classes_certification_type_id_fkey" FOREIGN KEY (certification_type_id) REFERENCES certification_types(id) ON DELETE SET NULL;
ALTER TABLE public."training_classes" ADD CONSTRAINT "training_classes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."training_classes" ADD CONSTRAINT "training_classes_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."user_tenant_assignments" ADD CONSTRAINT "user_tenant_assignments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE public."user_tenant_assignments" ADD CONSTRAINT "user_tenant_assignments_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public."user_tenant_assignments" ADD CONSTRAINT "user_tenant_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."vertical_templates" ADD CONSTRAINT "vertical_templates_vertical_id_fkey" FOREIGN KEY (vertical_id) REFERENCES verticals(id) ON DELETE CASCADE;
ALTER TABLE public."verticals" ADD CONSTRAINT "verticals_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL;
CREATE INDEX idx_tip_weekly_data_tenant ON public.tip_weekly_data USING btree (tenant_id);
CREATE INDEX idx_recipe_size_bases_size ON public.recipe_size_bases USING btree (size_id);
CREATE INDEX idx_cash_activity_tenant ON public.cash_activity USING btree (tenant_id);
CREATE INDEX idx_admin_task_history_task ON public.admin_task_history USING btree (task_id);
CREATE INDEX idx_bug_reports_created ON public.bug_reports USING btree (created_at DESC);
CREATE INDEX idx_time_off_status ON public.time_off_requests USING btree (status);
CREATE INDEX idx_time_off_balances_employee ON public.time_off_balances USING btree (employee_id);
CREATE INDEX idx_verticals_slug ON public.verticals USING btree (slug);
CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email);
CREATE INDEX idx_coffee_history_tenant ON public.coffee_order_history USING btree (tenant_id);
CREATE INDEX idx_tc_edit_req_tenant ON public.time_clock_edit_requests USING btree (tenant_id);
CREATE INDEX idx_base_template_ingredients_ingredient ON public.base_template_ingredients USING btree (ingredient_id);
CREATE INDEX idx_task_attachments_task ON public.maintenance_task_attachments USING btree (task_id);
CREATE INDEX missing_time_requests_employee ON public.time_clock_missing_requests USING btree (tenant_id, employee_id, created_at DESC);
CREATE INDEX idx_document_acks_tenant ON public.document_acknowledgments USING btree (tenant_id);
CREATE INDEX idx_tenant_activity_log_module_visit ON public.tenant_activity_log USING btree (action, created_at DESC) WHERE (action = 'module_visit'::text);
CREATE INDEX idx_resellers_active ON public.resellers USING btree (is_active);
CREATE INDEX idx_cal_events_dates ON public.calendar_events USING btree (start_date, end_date);
CREATE INDEX idx_documents_tenant_category ON public.documents USING btree (tenant_id, category_id);
CREATE UNIQUE INDEX idx_tip_employees_kiosk_pin_tenant ON public.tip_employees USING btree (tenant_id, kiosk_pin) WHERE ((kiosk_pin IS NOT NULL) AND (is_active = true));
CREATE INDEX idx_license_codes_reseller ON public.license_codes USING btree (reseller_id);
CREATE INDEX idx_business_accounts_renewal ON public.business_accounts USING btree (renewal_date);
CREATE INDEX idx_ical_subs_tenant ON public.ical_subscriptions USING btree (tenant_id);
CREATE INDEX idx_ingredients_tenant ON public.ingredients USING btree (tenant_id);
CREATE INDEX idx_coffee_products_active ON public.tenant_coffee_products USING btree (tenant_id, is_active);
CREATE INDEX idx_equipment_attachments_tenant ON public.equipment_attachments USING btree (tenant_id);
CREATE INDEX idx_budget_lines_fy ON public.budget_line_items USING btree (tenant_id, fiscal_year_id);
CREATE INDEX idx_coffee_products_vendor ON public.tenant_coffee_products USING btree (vendor_id);
CREATE INDEX idx_bug_reports_status ON public.bug_reports USING btree (status);
CREATE INDEX idx_alfred_conf_tokens_expires ON public.alfred_confirmation_tokens USING btree (expires_at);
CREATE INDEX idx_resellers_email ON public.resellers USING btree (contact_email);
CREATE INDEX idx_coffee_history_vendor ON public.coffee_order_history USING btree (vendor_id);
CREATE INDEX idx_recipe_size_pricing_size ON public.recipe_size_pricing USING btree (size_id);
CREATE INDEX idx_cp_conversation_id ON public.conversation_participants USING btree (conversation_id);
CREATE INDEX idx_time_clock_in ON public.time_clock_entries USING btree (clock_in);
CREATE INDEX idx_equipment_active ON public.equipment USING btree (tenant_id, is_active);
CREATE INDEX idx_equipment_attachments_equipment ON public.equipment_attachments USING btree (equipment_id);
CREATE INDEX idx_blackout_dates ON public.blackout_dates USING btree (start_date, end_date);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_unavail_dates ON public.employee_unavailability USING btree (start_date, end_date);
CREATE INDEX idx_time_off_dates ON public.time_off_requests USING btree (start_date, end_date);
CREATE INDEX idx_documents_tenant ON public.documents USING btree (tenant_id);
CREATE UNIQUE INDEX idx_training_attendance_class_emp ON public.training_attendance USING btree (training_class_id, employee_id) WHERE (employee_id IS NOT NULL);
CREATE INDEX idx_ts_approval_period ON public.timesheet_approvals USING btree (period_start, period_end);
CREATE INDEX idx_license_codes_code ON public.license_codes USING btree (code);
CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients USING btree (recipe_id);
CREATE INDEX idx_emp_certs_employee ON public.employee_certifications USING btree (employee_id) WHERE (employee_id IS NOT NULL);
CREATE INDEX idx_unavail_employee ON public.employee_unavailability USING btree (employee_id);
CREATE INDEX idx_forecast_drivers_scenario ON public.budget_forecast_drivers USING btree (tenant_id, scenario_id);
CREATE INDEX idx_products_recipe ON public.products USING btree (recipe_id);
CREATE UNIQUE INDEX idx_tcb_external_id ON public.time_clock_breaks USING btree (tenant_id, external_id) WHERE (external_id IS NOT NULL);
CREATE INDEX idx_document_categories_tenant ON public.document_categories USING btree (tenant_id);
CREATE INDEX idx_tip_employee_hours_tenant ON public.tip_employee_hours USING btree (tenant_id);
CREATE INDEX idx_maintenance_tasks_tenant ON public.maintenance_tasks USING btree (tenant_id);
CREATE INDEX idx_reseller_invoices_stripe_id ON public.reseller_invoices USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL);
CREATE INDEX idx_budget_coa_type ON public.budget_chart_of_accounts USING btree (tenant_id, account_type);
CREATE INDEX idx_accrual_log_employee ON public.time_off_accrual_log USING btree (employee_id);
CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);
CREATE INDEX idx_maintenance_logs_tenant ON public.maintenance_logs USING btree (tenant_id);
CREATE INDEX idx_license_codes_beta ON public.license_codes USING btree (subscription_plan, created_at DESC) WHERE (subscription_plan = 'beta'::text);
CREATE INDEX idx_documents_category ON public.documents USING btree (category_id);
CREATE INDEX idx_task_attachments_tenant ON public.maintenance_task_attachments USING btree (tenant_id);
CREATE INDEX idx_cp_user_id ON public.conversation_participants USING btree (user_id);
CREATE INDEX idx_shifts_tenant_date ON public.shifts USING btree (tenant_id, date);
CREATE INDEX idx_tenant_usage_metrics_tenant_date ON public.tenant_usage_metrics USING btree (tenant_id, metric_date);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);
CREATE INDEX idx_verticals_published ON public.verticals USING btree (is_published) WHERE (is_published = true);
CREATE INDEX idx_budget_coa_parent ON public.budget_chart_of_accounts USING btree (tenant_id, parent_id);
CREATE INDEX idx_recipe_ingredients_syrup_recipe ON public.recipe_ingredients USING btree (syrup_recipe_id);
CREATE INDEX idx_time_off_tenant ON public.time_off_requests USING btree (tenant_id);
CREATE INDEX idx_tenants_parent ON public.tenants USING btree (parent_tenant_id);
CREATE INDEX idx_tip_weekly_data_week ON public.tip_weekly_data USING btree (week_key);
CREATE INDEX idx_admin_tasks_due_date ON public.admin_tasks USING btree (due_date);
CREATE INDEX idx_recipe_size_bases_template ON public.recipe_size_bases USING btree (base_template_id);
CREATE INDEX idx_admin_task_categories_tenant ON public.admin_task_categories USING btree (tenant_id);
CREATE INDEX idx_time_off_balances_tenant ON public.time_off_balances USING btree (tenant_id);
CREATE INDEX idx_ts_approval_tenant ON public.timesheet_approvals USING btree (tenant_id);
CREATE UNIQUE INDEX idx_cal_events_dedup ON public.calendar_events USING btree (ical_subscription_id, ical_uid) WHERE (ical_uid IS NOT NULL);
CREATE INDEX idx_shifts_tip_employee ON public.shifts USING btree (tip_employee_id);
CREATE INDEX idx_tenant_role_settings_tenant ON public.tenant_role_settings USING btree (tenant_id);
CREATE INDEX idx_products_size ON public.products USING btree (size_id);
CREATE INDEX idx_coffee_products_tenant ON public.tenant_coffee_products USING btree (tenant_id);
CREATE INDEX idx_uta_manager ON public.user_tenant_assignments USING btree (manager_id);
CREATE INDEX idx_budget_lines_account ON public.budget_line_items USING btree (account_id);
CREATE INDEX idx_admin_tasks_assigned ON public.admin_tasks USING btree (assigned_to);
CREATE INDEX idx_forecast_lines_account ON public.budget_forecast_line_items USING btree (account_id);
CREATE INDEX idx_license_codes_unredeemed ON public.license_codes USING btree (redeemed_at) WHERE (redeemed_at IS NULL);
CREATE INDEX idx_cert_types_tenant ON public.certification_types USING btree (tenant_id);
CREATE INDEX idx_breaks_tenant ON public.time_clock_breaks USING btree (tenant_id);
CREATE INDEX idx_store_hours_tenant ON public.store_operating_hours USING btree (tenant_id);
CREATE INDEX idx_training_classes_tenant ON public.training_classes USING btree (tenant_id, class_date DESC);
CREATE INDEX idx_ct_map_tenant ON public.connecteam_employee_mappings USING btree (tenant_id);
CREATE INDEX idx_tenants_reseller ON public.tenants USING btree (reseller_id) WHERE (reseller_id IS NOT NULL);
CREATE INDEX idx_emp_certs_tenant ON public.employee_certifications USING btree (tenant_id);
CREATE INDEX idx_shift_templates_tenant ON public.shift_templates USING btree (tenant_id);
CREATE UNIQUE INDEX idx_tenants_kiosk_code ON public.tenants USING btree (upper(kiosk_code)) WHERE (kiosk_code IS NOT NULL);
CREATE INDEX idx_training_attendance_tip_employee ON public.training_attendance USING btree (tip_employee_id) WHERE (tip_employee_id IS NOT NULL);
CREATE INDEX idx_emp_certs_cert_type ON public.employee_certifications USING btree (certification_type_id);
CREATE INDEX idx_forecast_lines_scenario ON public.budget_forecast_line_items USING btree (tenant_id, scenario_id);
CREATE INDEX idx_tip_employees_tenant ON public.tip_employees USING btree (tenant_id);
CREATE UNIQUE INDEX idx_tce_external_id ON public.time_clock_entries USING btree (tenant_id, external_id) WHERE (external_id IS NOT NULL);
CREATE INDEX idx_cash_activity_date ON public.cash_activity USING btree (drawer_date);
CREATE INDEX idx_emp_certs_expiry ON public.employee_certifications USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_help_content_term ON public.help_content USING btree (term_key);
CREATE INDEX idx_base_templates_tenant ON public.base_templates USING btree (tenant_id);
CREATE INDEX idx_budget_import_logs_tenant ON public.budget_import_logs USING btree (tenant_id);
CREATE INDEX idx_training_attendance_class ON public.training_attendance USING btree (training_class_id);
CREATE INDEX idx_time_off_employee ON public.time_off_requests USING btree (employee_id);
CREATE INDEX idx_shifts_acceptance ON public.shifts USING btree (tenant_id, acceptance) WHERE (acceptance IS NOT NULL);
CREATE INDEX idx_ingredients_vendor_id ON public.ingredients USING btree (vendor_id);
CREATE INDEX idx_unavail_tenant ON public.employee_unavailability USING btree (tenant_id);
CREATE INDEX idx_products_tenant ON public.products USING btree (tenant_id);
CREATE INDEX idx_admin_tasks_tenant ON public.admin_tasks USING btree (tenant_id);
CREATE INDEX idx_maintenance_logs_task ON public.maintenance_logs USING btree (task_id);
CREATE INDEX idx_verticals_reseller ON public.verticals USING btree (reseller_id) WHERE (reseller_id IS NOT NULL);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);
CREATE INDEX idx_accrual_log_balance ON public.time_off_accrual_log USING btree (balance_id);
CREATE INDEX idx_ingredients_active ON public.ingredients USING btree (is_active);
CREATE INDEX idx_feature_reviews_tenant ON public.feature_reviews USING btree (tenant_id);
CREATE INDEX idx_admin_tasks_status ON public.admin_tasks USING btree (status);
CREATE INDEX idx_ingredient_categories_tenant ON public.ingredient_categories USING btree (tenant_id);
CREATE INDEX idx_equipment_assigned_to ON public.equipment USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);
CREATE INDEX idx_sq_map_team_member ON public.square_employee_mappings USING btree (square_team_member_id);
CREATE INDEX idx_recipe_ingredients_size ON public.recipe_ingredients USING btree (size_id);
CREATE INDEX idx_blackout_tenant ON public.blackout_dates USING btree (tenant_id);
CREATE INDEX idx_user_profiles_tenant ON public.user_profiles USING btree (tenant_id);
CREATE INDEX idx_coffee_vendors_tenant ON public.tenant_coffee_vendors USING btree (tenant_id);
CREATE INDEX idx_bug_reports_tenant ON public.bug_reports USING btree (tenant_id);
CREATE INDEX idx_time_clock_tenant_date ON public.time_clock_entries USING btree (tenant_id, clock_in);
CREATE INDEX idx_feature_reviews_feature ON public.feature_reviews USING btree (feature_id);
CREATE INDEX idx_breaks_entry ON public.time_clock_breaks USING btree (time_clock_entry_id);
CREATE INDEX idx_time_off_policies_tenant ON public.time_off_policies USING btree (tenant_id);
CREATE INDEX idx_product_sizes_tenant ON public.product_sizes USING btree (tenant_id);
CREATE INDEX idx_budget_fy_tenant ON public.budget_fiscal_years USING btree (tenant_id);
CREATE INDEX idx_overhead_settings_tenant ON public.overhead_settings USING btree (tenant_id);
CREATE INDEX idx_overhead_items_tenant ON public.overhead_items USING btree (tenant_id);
CREATE INDEX idx_tenants_vertical ON public.tenants USING btree (vertical_id);
CREATE INDEX idx_recipes_base_template ON public.recipes USING btree (base_template_id);
CREATE INDEX idx_cash_activity_archived ON public.cash_activity USING btree (archived);
CREATE INDEX idx_shifts_tenant ON public.shifts USING btree (tenant_id);
CREATE INDEX idx_equipment_tenant ON public.equipment USING btree (tenant_id);
CREATE INDEX idx_maintenance_logs_date ON public.maintenance_logs USING btree (completed_at DESC);
CREATE INDEX idx_growth_tracker_monthly_tenant ON public.growth_tracker_monthly USING btree (tenant_id, year, month);
CREATE INDEX idx_user_profiles_manager ON public.user_profiles USING btree (manager_id);
CREATE INDEX idx_product_categories_tenant ON public.product_categories USING btree (tenant_id);
CREATE INDEX idx_tenants_square_merchant ON public.tenants USING btree (square_merchant_id) WHERE (square_merchant_id IS NOT NULL);
CREATE INDEX idx_time_clock_employee ON public.time_clock_entries USING btree (employee_id);
CREATE INDEX idx_tenant_activity_log_tenant ON public.tenant_activity_log USING btree (tenant_id, created_at DESC);
CREATE INDEX time_clock_audit_employee ON public.time_clock_audit_events USING btree (tenant_id, employee_id, created_at DESC);
CREATE INDEX idx_forecast_scenarios_tenant ON public.budget_forecast_scenarios USING btree (tenant_id, fiscal_year_id);
CREATE INDEX idx_budget_coa_tenant ON public.budget_chart_of_accounts USING btree (tenant_id);
CREATE INDEX idx_document_acks_user ON public.document_acknowledgments USING btree (user_id);
CREATE INDEX idx_business_accounts_category ON public.business_accounts USING btree (category);
CREATE INDEX idx_tce_outside_geofence ON public.time_clock_entries USING btree (tenant_id, clock_in_outside_geofence) WHERE (clock_in_outside_geofence = true);
CREATE INDEX idx_ts_approval_employee ON public.timesheet_approvals USING btree (employee_id);
CREATE INDEX idx_feature_reviews_rating ON public.feature_reviews USING btree (rating);
CREATE INDEX idx_cal_events_tenant ON public.calendar_events USING btree (tenant_id);
CREATE INDEX idx_document_acks_document ON public.document_acknowledgments USING btree (document_id);
CREATE UNIQUE INDEX idx_training_attendance_class_tip ON public.training_attendance USING btree (training_class_id, tip_employee_id) WHERE (tip_employee_id IS NOT NULL);
CREATE INDEX idx_help_content_vertical ON public.help_content USING btree (vertical_id);
CREATE INDEX idx_training_attendance_employee ON public.training_attendance USING btree (employee_id) WHERE (employee_id IS NOT NULL);
CREATE INDEX idx_tip_employee_hours_employee ON public.tip_employee_hours USING btree (employee_id);
CREATE INDEX idx_shifts_date ON public.shifts USING btree (date);
CREATE INDEX idx_admin_tasks_category ON public.admin_tasks USING btree (category_id);
CREATE UNIQUE INDEX user_profiles_staff_login_id ON public.user_profiles USING btree (lower(staff_login_id)) WHERE (staff_login_id IS NOT NULL);
CREATE INDEX idx_user_tenant_assignments_user ON public.user_tenant_assignments USING btree (user_id);
CREATE INDEX idx_user_tenant_assignments_tenant ON public.user_tenant_assignments USING btree (tenant_id);
CREATE INDEX idx_ts_approval_status ON public.timesheet_approvals USING btree (status);
CREATE INDEX idx_tc_edit_req_entry ON public.time_clock_edit_requests USING btree (time_clock_entry_id);
CREATE INDEX idx_sq_map_tenant ON public.square_employee_mappings USING btree (tenant_id);
CREATE INDEX idx_tc_edit_req_status ON public.time_clock_edit_requests USING btree (status);
CREATE INDEX idx_admin_task_comments_task ON public.admin_task_comments USING btree (task_id);
CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_maintenance_tasks_due ON public.maintenance_tasks USING btree (next_due_at);
CREATE UNIQUE INDEX idx_user_profiles_kiosk_pin_tenant ON public.user_profiles USING btree (tenant_id, kiosk_pin) WHERE ((kiosk_pin IS NOT NULL) AND (is_active = true));
CREATE INDEX tip_payout_approval_history_lookup ON public.tip_payout_approval_history USING btree (tenant_id, week_key, changed_at DESC);
CREATE INDEX idx_messages_sender_created ON public.messages USING btree (conversation_id, sender_id, created_at);
CREATE INDEX idx_business_accounts_status ON public.business_accounts USING btree (status);
CREATE INDEX idx_recipe_vendors_tenant ON public.recipe_vendors USING btree (tenant_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON public.recipe_ingredients USING btree (ingredient_id);
CREATE INDEX idx_tc_edit_req_employee ON public.time_clock_edit_requests USING btree (employee_id);
CREATE INDEX idx_coffee_history_outstanding ON public.coffee_order_history USING btree (tenant_id, order_date DESC) WHERE ((sent_to_vendor = true) AND (received_at IS NULL));
CREATE INDEX idx_shifts_employee ON public.shifts USING btree (employee_id);
CREATE INDEX idx_food_items_tenant ON public.food_items USING btree (tenant_id);
CREATE INDEX idx_tenant_activity_log_tenant_action ON public.tenant_activity_log USING btree (tenant_id, action, created_at DESC);
CREATE INDEX idx_coffee_history_date ON public.coffee_order_history USING btree (order_date DESC);
CREATE INDEX idx_base_template_ingredients_size ON public.base_template_ingredients USING btree (size_id);
CREATE INDEX idx_tip_employee_hours_week ON public.tip_employee_hours USING btree (week_key);
CREATE INDEX idx_maintenance_tasks_equipment ON public.maintenance_tasks USING btree (equipment_id);
CREATE INDEX idx_vertical_templates_vertical_type ON public.vertical_templates USING btree (vertical_id, template_type);
CREATE INDEX idx_reseller_invoices_reseller_id ON public.reseller_invoices USING btree (reseller_id);
CREATE INDEX idx_business_accounts_business ON public.business_accounts USING btree (business);
CREATE INDEX idx_ingredients_category ON public.ingredients USING btree (category_id);
CREATE INDEX idx_emp_certs_tip_employee ON public.employee_certifications USING btree (tip_employee_id) WHERE (tip_employee_id IS NOT NULL);
CREATE INDEX idx_accrual_log_tenant ON public.time_off_accrual_log USING btree (tenant_id);
CREATE INDEX idx_recipes_tenant ON public.recipes USING btree (tenant_id);
CREATE INDEX idx_recipes_active ON public.recipes USING btree (is_active);
CREATE INDEX idx_time_clock_tenant ON public.time_clock_entries USING btree (tenant_id);
CREATE INDEX idx_recipes_category ON public.recipes USING btree (category_id);
CREATE INDEX idx_food_items_category ON public.food_items USING btree (category_id);
CREATE VIEW public."v_food_pricing" WITH (security_invoker=true) AS  SELECT f.id,
    f.category_id,
    f.name,
    f.cost,
    f.units_per_case,
    f.cost_per_unit,
    f.sale_price,
    f.vendor,
    f.notes,
    f.is_active,
    f.created_at,
    f.updated_at,
    pc.name AS category_name,
        CASE
            WHEN (f.sale_price > (0)::numeric) THEN round((((f.sale_price - f.cost_per_unit) / f.sale_price) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS margin_percent,
    round((f.sale_price - f.cost_per_unit), 2) AS profit
   FROM (food_items f
     LEFT JOIN product_categories pc ON ((f.category_id = pc.id)))
  WHERE (f.is_active = true)
  ORDER BY pc.display_order, f.name;
CREATE VIEW public."v_ingredients" WITH (security_invoker=true) AS  SELECT i.id,
    i.name,
    i.category_id,
    i.ingredient_type,
    i.cost,
    i.quantity,
    i.unit,
    i.usage_unit,
    i.vendor,
    i.manufacturer,
    i.item_number,
    i.updated_at,
    i.is_active,
    ic.name AS category_name
   FROM (ingredients i
     LEFT JOIN ingredient_categories ic ON ((i.category_id = ic.id)));
CREATE VIEW public."v_product_pricing" WITH (security_invoker=true) AS  SELECT p.id AS product_id,
    r.id AS recipe_id,
    r.name AS recipe_name,
    pc.name AS category_name,
    ds.name AS size_name,
    ds.size_value AS size_oz,
    ds.product_type AS drink_type,
    p.sale_price,
    (COALESCE(( SELECT sum((i.cost_per_unit * bti.quantity)) AS sum
           FROM (base_template_ingredients bti
             JOIN ingredients i ON ((bti.ingredient_id = i.id)))
          WHERE ((bti.base_template_id = r.base_template_id) AND (bti.size_id = ds.id))), (0)::numeric) + COALESCE(( SELECT (overhead_settings.cost_per_minute * overhead_settings.minutes_per_drink)
           FROM overhead_settings
         LIMIT 1), (0)::numeric)) AS base_cost,
    COALESCE(( SELECT sum((i.cost_per_unit * ri.quantity)) AS sum
           FROM (recipe_ingredients ri
             JOIN ingredients i ON ((ri.ingredient_id = i.id)))
          WHERE ((ri.recipe_id = r.id) AND (ri.size_id = ds.id))), (0)::numeric) AS ingredient_cost,
    p.is_active
   FROM (((products p
     JOIN recipes r ON ((p.recipe_id = r.id)))
     JOIN product_sizes ds ON ((p.size_id = ds.id)))
     LEFT JOIN product_categories pc ON ((r.category_id = pc.id)))
  ORDER BY pc.display_order, r.name, ds.display_order;
CREATE VIEW public."user_pay_rates" WITH (security_invoker=true) AS  SELECT id,
    tenant_id,
    hourly_rate,
    annual_salary,
    pay_frequency
   FROM user_profiles
  WHERE (can_access_tenant(tenant_id) AND ((id = auth.uid()) OR has_role_or_higher('manager'::user_role)));
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_base_templates_updated_at BEFORE UPDATE ON public.base_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_food_items_updated_at BEFORE UPDATE ON public.food_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bug_reports_updated_at BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION update_bug_reports_updated_at();
CREATE TRIGGER guard_staff_identity BEFORE INSERT OR UPDATE ON public.tip_employees FOR EACH ROW EXECUTE FUNCTION guard_staff_identity();
CREATE TRIGGER invalidate_tip_roster AFTER UPDATE ON public.tip_employees FOR EACH ROW EXECUTE FUNCTION invalidate_tip_approval();
CREATE TRIGGER invalidate_tip_week AFTER INSERT OR DELETE OR UPDATE ON public.tip_weekly_data FOR EACH ROW EXECUTE FUNCTION invalidate_tip_approval();
CREATE TRIGGER invalidate_tip_hours AFTER INSERT OR DELETE OR UPDATE ON public.tip_employee_hours FOR EACH ROW EXECUTE FUNCTION invalidate_tip_approval();
CREATE TRIGGER guard_staff_identity BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION guard_staff_identity();
CREATE TRIGGER trg_generate_kiosk_pin BEFORE INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION generate_kiosk_pin();
CREATE TRIGGER trg_auto_register_ga_module AFTER INSERT OR UPDATE OF rollout_status ON public.modules FOR EACH ROW EXECUTE FUNCTION auto_register_ga_module();
CREATE TRIGGER growth_tracker_monthly_updated_at BEFORE UPDATE ON public.growth_tracker_monthly FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER guard_verified_compliance_task BEFORE INSERT OR DELETE OR UPDATE ON public.admin_tasks FOR EACH ROW EXECUTE FUNCTION guard_verified_compliance_task();
CREATE TRIGGER update_overhead_settings_updated_at BEFORE UPDATE ON public.overhead_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON public.time_clock_entries FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
CREATE TRIGGER aaa_invalidate_timesheet BEFORE INSERT OR DELETE OR UPDATE ON public.time_clock_entries FOR EACH ROW EXECUTE FUNCTION invalidate_changed_timesheet();
CREATE TRIGGER audit_time_clock_entry BEFORE INSERT OR DELETE OR UPDATE ON public.time_clock_entries FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();
CREATE TRIGGER guard_staff_time_clock_insert BEFORE INSERT ON public.time_clock_entries FOR EACH ROW EXECUTE FUNCTION guard_staff_time_clock_insert();
CREATE TRIGGER aaa_invalidate_timesheet BEFORE INSERT OR DELETE OR UPDATE ON public.time_clock_breaks FOR EACH ROW EXECUTE FUNCTION invalidate_changed_timesheet();
CREATE TRIGGER audit_time_clock_break BEFORE INSERT OR DELETE OR UPDATE ON public.time_clock_breaks FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();
CREATE TRIGGER guard_staff_break_change BEFORE INSERT OR UPDATE ON public.time_clock_breaks FOR EACH ROW EXECUTE FUNCTION guard_staff_break_change();
CREATE TRIGGER touch_time_clock_session AFTER INSERT OR DELETE OR UPDATE ON public.time_clock_breaks FOR EACH ROW EXECUTE FUNCTION touch_time_clock_session();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER emp_certs_updated_at BEFORE UPDATE ON public.employee_certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER training_classes_updated_at BEFORE UPDATE ON public.training_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cert_types_updated_at BEFORE UPDATE ON public.certification_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER audit_timesheet_approval AFTER INSERT OR UPDATE ON public.timesheet_approvals FOR EACH ROW EXECUTE FUNCTION audit_timesheet_approval();
CREATE TRIGGER record_tip_approval_revision BEFORE UPDATE ON public.tip_payout_approvals FOR EACH ROW EXECUTE FUNCTION record_tip_approval_revision();
CREATE TRIGGER check_location_limit BEFORE INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION enforce_location_limit();
CREATE TRIGGER trg_generate_kiosk_code BEFORE INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION generate_kiosk_code();
ALTER TABLE public."account_businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_task_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_task_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_task_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."alfred_confirmation_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."base_template_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."base_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."blackout_dates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_chart_of_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_fiscal_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_forecast_drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_forecast_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_forecast_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_import_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."budget_seasonal_patterns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bug_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."business_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cash_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."certification_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coffee_order_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."compliance_workflow_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."compliance_workflow_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."connecteam_employee_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."connecteam_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conversation_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."document_acknowledgments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."document_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."employee_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."employee_unavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."equipment_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."feature_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."food_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."growth_tracker_monthly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."help_content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ical_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ingredient_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."license_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maintenance_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maintenance_task_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maintenance_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."overhead_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."overhead_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_cost_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_sizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recipe_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recipe_size_bases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recipe_size_pricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recipe_vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referral_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referral_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reseller_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reseller_volume_tiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."resellers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."square_employee_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."staff_identity_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."store_operating_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subscription_plan_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_coffee_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_coffee_vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_module_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_module_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_role_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_usage_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_clock_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_clock_breaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_clock_edit_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_clock_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_clock_missing_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_off_accrual_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_off_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_off_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."time_off_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."timesheet_approval_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."timesheet_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_employee_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_payout_approval_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_payout_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_weekly_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."training_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_tenant_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vertical_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."verticals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers_delete_blackouts" ON public."blackout_dates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM user_tenant_assignments
  WHERE ((user_tenant_assignments.user_id = auth.uid()) AND (user_tenant_assignments.tenant_id = blackout_dates.tenant_id) AND (user_tenant_assignments.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));
CREATE POLICY "managers_insert_blackouts" ON public."blackout_dates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM user_tenant_assignments
  WHERE ((user_tenant_assignments.user_id = auth.uid()) AND (user_tenant_assignments.tenant_id = blackout_dates.tenant_id) AND (user_tenant_assignments.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));
CREATE POLICY "platform_admin_blackouts" ON public."blackout_dates" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "tenant_view_blackouts" ON public."blackout_dates" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id IN ( SELECT user_tenant_assignments.tenant_id
   FROM user_tenant_assignments
  WHERE (user_tenant_assignments.user_id = auth.uid()))));
CREATE POLICY "Allow authenticated users to read ingredient_categories" ON public."ingredient_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete ingredient categories" ON public."ingredient_categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert ingredient categories" ON public."ingredient_categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update ingredient categories" ON public."ingredient_categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."ingredient_categories" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible ingredient categories" ON public."ingredient_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Managers can create store hours" ON public."store_operating_hours" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can delete store hours" ON public."store_operating_hours" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update store hours" ON public."store_operating_hours" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage store hours" ON public."store_operating_hours" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view store hours" ON public."store_operating_hours" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Allow authenticated users to read ingredients" ON public."ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update ingredients" ON public."ingredients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can insert ingredients" ON public."ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete ingredients" ON public."ingredients" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert ingredients" ON public."ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update ingredients" ON public."ingredients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."ingredients" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible ingredients" ON public."ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Allow all selects on drink_sizes" ON public."product_sizes" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow authenticated users to delete product_sizes" ON public."product_sizes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to insert product_sizes" ON public."product_sizes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read product_sizes" ON public."product_sizes" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete drink sizes" ON public."product_sizes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert drink sizes" ON public."product_sizes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update drink sizes" ON public."product_sizes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."product_sizes" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible drink sizes" ON public."product_sizes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Allow authenticated users to insert base_templates" ON public."base_templates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read base_templates" ON public."base_templates" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete base templates" ON public."base_templates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert base templates" ON public."base_templates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update base templates" ON public."base_templates" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."base_templates" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible base templates" ON public."base_templates" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Allow authenticated users to delete base_template_ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to insert base_template_ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read base_template_ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete base template ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM base_templates
  WHERE ((base_templates.id = base_template_ingredients.base_template_id) AND can_access_tenant(base_templates.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert base template ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM base_templates
  WHERE ((base_templates.id = base_template_ingredients.base_template_id) AND can_access_tenant(base_templates.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update base template ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM base_templates
  WHERE ((base_templates.id = base_template_ingredients.base_template_id) AND can_access_tenant(base_templates.tenant_id)))) AND has_role_or_higher('manager'::user_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM base_templates
  WHERE ((base_templates.id = base_template_ingredients.base_template_id) AND can_access_tenant(base_templates.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."base_template_ingredients" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM base_templates bt
  WHERE ((bt.id = base_template_ingredients.base_template_id) AND (bt.tenant_id = get_current_tenant_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM base_templates bt
  WHERE ((bt.id = base_template_ingredients.base_template_id) AND (bt.tenant_id = get_current_tenant_id())))));
CREATE POLICY "Users can view accessible base template ingredients" ON public."base_template_ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM base_templates
  WHERE ((base_templates.id = base_template_ingredients.base_template_id) AND can_access_tenant(base_templates.tenant_id)))));
CREATE POLICY "Tenant isolation" ON public."products" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Allow authenticated users to delete recipe_ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read recipe_ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update recipe_ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can insert recipe_ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete recipe ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_ingredients.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert recipe ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_ingredients.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update recipe ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_ingredients.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_ingredients.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."recipe_ingredients" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.tenant_id = get_current_tenant_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.tenant_id = get_current_tenant_id())))));
CREATE POLICY "Users can view accessible recipe ingredients" ON public."recipe_ingredients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_ingredients.recipe_id) AND can_access_tenant(recipes.tenant_id)))));
CREATE POLICY "Tenant isolation" ON public."food_items" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Allow authenticated users to read product_categories" ON public."product_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete product categories" ON public."product_categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert product categories" ON public."product_categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update product categories" ON public."product_categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."product_categories" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible product categories" ON public."product_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Allow authenticated users to delete recipes" ON public."recipes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read recipes" ON public."recipes" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update recipes" ON public."recipes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can insert recipes" ON public."recipes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete recipes" ON public."recipes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert recipes" ON public."recipes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update recipes" ON public."recipes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."recipes" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible recipes" ON public."recipes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Managers can delete cash activity" ON public."cash_activity" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can delete cash_activity" ON public."cash_activity" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert cash activity" ON public."cash_activity" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert cash_activity" ON public."cash_activity" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update cash activity" ON public."cash_activity" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update cash_activity" ON public."cash_activity" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role))) WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible cash activity" ON public."cash_activity" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Users can view own tenant cash_activity" ON public."cash_activity" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = get_current_tenant_id()));
CREATE POLICY "platform_admin_business_accounts" ON public."business_accounts" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can update bug reports" ON public."bug_reports" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can view all bug reports" ON public."bug_reports" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can submit bug reports for their tenant" ON public."bug_reports" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "Users can view their tenant bug reports" ON public."bug_reports" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) OR (tenant_id IN ( SELECT user_tenant_assignments.tenant_id
   FROM user_tenant_assignments
  WHERE ((user_tenant_assignments.user_id = auth.uid()) AND (user_tenant_assignments.is_active = true))))));
CREATE POLICY "Platform admins can manage all metrics" ON public."tenant_usage_metrics" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible tenant metrics" ON public."tenant_usage_metrics" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Platform admins can manage all activity" ON public."tenant_activity_log" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can insert activity for own tenant" ON public."tenant_activity_log" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (user_id = auth.uid())));
CREATE POLICY "Users can view accessible tenant activity" ON public."tenant_activity_log" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Users can check if they are platform admin" ON public."platform_admins" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));
CREATE POLICY "Users can check own platform admin status" ON public."platform_admins" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((id = auth.uid()));
CREATE POLICY "Owners can manage tenant assignments" ON public."user_tenant_assignments" AS PERMISSIVE FOR ALL TO PUBLIC USING ((((tenant_id = get_current_tenant_id()) AND has_role_or_higher('owner'::user_role)) OR (EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.id = user_tenant_assignments.tenant_id) AND (t.parent_tenant_id = get_current_tenant_id()) AND has_role_or_higher('owner'::user_role)))))) WITH CHECK ((((tenant_id = get_current_tenant_id()) AND has_role_or_higher('owner'::user_role)) OR (EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.id = user_tenant_assignments.tenant_id) AND (t.parent_tenant_id = get_current_tenant_id()) AND has_role_or_higher('owner'::user_role))))));
CREATE POLICY "Users can read own assignments" ON public."user_tenant_assignments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "platform_admin_account_businesses" ON public."account_businesses" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Leads can delete tip employees" ON public."tip_employees" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can insert tip employees" ON public."tip_employees" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can insert tip_employees" ON public."tip_employees" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip employees" ON public."tip_employees" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip_employees" ON public."tip_employees" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role))) WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Managers can delete tip_employees" ON public."tip_employees" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible tip employees" ON public."tip_employees" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Users can view own tenant tip_employees" ON public."tip_employees" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Allow authenticated users to insert recipe_size_pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read recipe_size_pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update recipe_size_pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete recipe size pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_pricing.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert recipe size pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_pricing.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update recipe size pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_pricing.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_pricing.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible recipe size pricing" ON public."recipe_size_pricing" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_pricing.recipe_id) AND can_access_tenant(recipes.tenant_id)))));
CREATE POLICY "Leads can insert tip weekly data" ON public."tip_weekly_data" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can insert tip_weekly_data" ON public."tip_weekly_data" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip weekly data" ON public."tip_weekly_data" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip_weekly_data" ON public."tip_weekly_data" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role))) WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Managers can delete tip_weekly_data" ON public."tip_weekly_data" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible tip weekly data" ON public."tip_weekly_data" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Users can view own tenant tip_weekly_data" ON public."tip_weekly_data" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Leads can insert tip hours" ON public."tip_employee_hours" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can insert tip_employee_hours" ON public."tip_employee_hours" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip hours" ON public."tip_employee_hours" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update tip_employee_hours" ON public."tip_employee_hours" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role))) WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Managers can delete tip_employee_hours" ON public."tip_employee_hours" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible tip hours" ON public."tip_employee_hours" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Users can view own tenant tip_employee_hours" ON public."tip_employee_hours" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Owners can insert tenant branding" ON public."tenant_branding" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can update tenant branding" ON public."tenant_branding" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Platform admins can insert branding" ON public."tenant_branding" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can read all branding" ON public."tenant_branding" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Platform admins can update branding" ON public."tenant_branding" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible tenant branding" ON public."tenant_branding" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Allow authenticated users to insert recipe_size_bases" ON public."recipe_size_bases" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read recipe_size_bases" ON public."recipe_size_bases" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update recipe_size_bases" ON public."recipe_size_bases" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete recipe size bases" ON public."recipe_size_bases" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_bases.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert recipe size bases" ON public."recipe_size_bases" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_bases.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update recipe size bases" ON public."recipe_size_bases" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_bases.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_bases.recipe_id) AND can_access_tenant(recipes.tenant_id)))) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible recipe size bases" ON public."recipe_size_bases" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_size_bases.recipe_id) AND can_access_tenant(recipes.tenant_id)))));
CREATE POLICY "Read own or managed missing sessions" ON public."time_clock_missing_requests" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Authenticated users can read all profiles" ON public."user_profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Users can view accessible profiles" ON public."user_profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "user_profiles_insert" ON public."user_profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text]))));
CREATE POLICY "user_profiles_read_own" ON public."user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "user_profiles_select" ON public."user_profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((id = auth.uid()) OR ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text])))));
CREATE POLICY "user_profiles_update" ON public."user_profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((id = auth.uid()) OR (is_owner_or_manager() AND (tenant_id = get_my_tenant_id())))) WITH CHECK (
CASE
    WHEN (id = auth.uid()) THEN ((role = ( SELECT user_profiles_1.role
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid()))) AND (tenant_id = ( SELECT user_profiles_1.tenant_id
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid()))) AND (is_active = ( SELECT user_profiles_1.is_active
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid()))) AND (NOT (hourly_rate IS DISTINCT FROM ( SELECT user_profiles_1.hourly_rate
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid())))) AND (NOT (annual_salary IS DISTINCT FROM ( SELECT user_profiles_1.annual_salary
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid())))) AND (NOT (pay_frequency IS DISTINCT FROM ( SELECT user_profiles_1.pay_frequency
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid())))) AND (NOT (manager_id IS DISTINCT FROM ( SELECT user_profiles_1.manager_id
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid())))) AND ((NOT (is_exempt IS DISTINCT FROM ( SELECT user_profiles_1.is_exempt
       FROM user_profiles user_profiles_1
      WHERE (user_profiles_1.id = auth.uid())))) OR has_role_or_higher('manager'::user_role)))
    ELSE true
END);
CREATE POLICY "Plan modules are readable by authenticated users" ON public."subscription_plan_modules" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Platform admins can manage plan modules" ON public."subscription_plan_modules" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can manage all module subscriptions" ON public."tenant_module_subscriptions" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible module subscriptions" ON public."tenant_module_subscriptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Platform admins can manage all module overrides" ON public."tenant_module_overrides" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible module overrides" ON public."tenant_module_overrides" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Modules are readable by authenticated users" ON public."modules" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Platform admins can manage modules" ON public."modules" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can update modules" ON public."modules" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Leads can insert coffee vendors" ON public."tenant_coffee_vendors" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update coffee vendors" ON public."tenant_coffee_vendors" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Platform admins can manage all vendors" ON public."tenant_coffee_vendors" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible coffee vendors" ON public."tenant_coffee_vendors" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Leads can delete coffee products" ON public."tenant_coffee_products" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can insert coffee products" ON public."tenant_coffee_products" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update coffee products" ON public."tenant_coffee_products" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Platform admins can manage all products" ON public."tenant_coffee_products" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible coffee products" ON public."tenant_coffee_products" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Plans are readable by authenticated users" ON public."subscription_plans" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Platform admins can manage plans" ON public."subscription_plans" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "growth_tracker_monthly_delete" ON public."growth_tracker_monthly" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "growth_tracker_monthly_insert" ON public."growth_tracker_monthly" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "growth_tracker_monthly_select" ON public."growth_tracker_monthly" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "growth_tracker_monthly_update" ON public."growth_tracker_monthly" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "All team members can insert tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((equipment_id IN ( SELECT equipment.id
   FROM equipment
  WHERE (equipment.tenant_id IN ( SELECT user_profiles.tenant_id
           FROM user_profiles
          WHERE (user_profiles.id = auth.uid())
        UNION
         SELECT tenants.id
           FROM tenants
          WHERE (tenants.parent_tenant_id = ( SELECT user_profiles.tenant_id
                   FROM user_profiles
                  WHERE (user_profiles.id = auth.uid()))))))));
CREATE POLICY "Managers can delete maintenance tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert maintenance tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers+ can delete tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can update accessible maintenance tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND (EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = maintenance_tasks.equipment_id) AND ((e.assigned_to IS NULL) OR (e.assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role))))))) WITH CHECK ((can_access_tenant(tenant_id) AND (EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = maintenance_tasks.equipment_id) AND ((e.assigned_to IS NULL) OR (e.assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role)))))));
CREATE POLICY "Users can view accessible maintenance tasks" ON public."maintenance_tasks" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_read_tenant_data(tenant_id) AND (EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = maintenance_tasks.equipment_id) AND ((e.assigned_to IS NULL) OR (e.assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role)))))));
CREATE POLICY "All team members can insert equipment" ON public."equipment" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())
UNION
 SELECT tenants.id
   FROM tenants
  WHERE (tenants.parent_tenant_id = ( SELECT user_profiles.tenant_id
           FROM user_profiles
          WHERE (user_profiles.id = auth.uid()))))));
CREATE POLICY "Managers can delete equipment" ON public."equipment" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert equipment" ON public."equipment" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers+ can delete equipment" ON public."equipment" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can update accessible equipment" ON public."equipment" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((assigned_to IS NULL) OR (assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role)))) WITH CHECK ((can_access_tenant(tenant_id) AND ((assigned_to IS NULL) OR (assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Users can view accessible equipment" ON public."equipment" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_read_tenant_data(tenant_id) AND ((assigned_to IS NULL) OR (assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "All team members can insert equipment attachments" ON public."equipment_attachments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "All team members can update equipment attachments" ON public."equipment_attachments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Managers+ can delete equipment attachments" ON public."equipment_attachments" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible equipment attachments" ON public."equipment_attachments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "All team members can insert logs" ON public."maintenance_logs" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((task_id IN ( SELECT mt.id
   FROM (maintenance_tasks mt
     JOIN equipment e ON ((mt.equipment_id = e.id)))
  WHERE (e.tenant_id IN ( SELECT user_profiles.tenant_id
           FROM user_profiles
          WHERE (user_profiles.id = auth.uid())
        UNION
         SELECT tenants.id
           FROM tenants
          WHERE (tenants.parent_tenant_id = ( SELECT user_profiles.tenant_id
                   FROM user_profiles
                  WHERE (user_profiles.id = auth.uid()))))))));
CREATE POLICY "All team members can update logs" ON public."maintenance_logs" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "All users can insert maintenance logs" ON public."maintenance_logs" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Managers+ can delete logs" ON public."maintenance_logs" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible maintenance logs" ON public."maintenance_logs" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND (EXISTS ( SELECT 1
   FROM (maintenance_tasks mt
     JOIN equipment e ON ((e.id = mt.equipment_id)))
  WHERE ((mt.id = maintenance_logs.task_id) AND ((e.assigned_to IS NULL) OR (e.assigned_to = auth.uid()) OR has_role_or_higher('manager'::user_role)))))));
CREATE POLICY "Leads can insert coffee orders" ON public."coffee_order_history" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads+ can insert orders" ON public."coffee_order_history" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads+ can update orders" ON public."coffee_order_history" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role))) WITH CHECK (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Managers+ can delete orders" ON public."coffee_order_history" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins can manage all orders" ON public."coffee_order_history" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view accessible coffee orders" ON public."coffee_order_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Users can view own tenant orders" ON public."coffee_order_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Managers can delete task categories" ON public."admin_task_categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert task categories" ON public."admin_task_categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update task categories" ON public."admin_task_categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible task categories" ON public."admin_task_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "admin_task_categories_delete" ON public."admin_task_categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (is_default = false)));
CREATE POLICY "admin_task_categories_insert" ON public."admin_task_categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text]))));
CREATE POLICY "admin_task_categories_select" ON public."admin_task_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))));
CREATE POLICY "admin_task_categories_update" ON public."admin_task_categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text]))));
CREATE POLICY "Managers can insert task comments" ON public."admin_task_comments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible task comments" ON public."admin_task_comments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "admin_task_comments_delete" ON public."admin_task_comments" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND ((user_id = auth.uid()) OR (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text])))));
CREATE POLICY "admin_task_comments_insert" ON public."admin_task_comments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (user_id = auth.uid())));
CREATE POLICY "admin_task_comments_select" ON public."admin_task_comments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))));
CREATE POLICY "admin_task_comments_update" ON public."admin_task_comments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (user_id = auth.uid())));
CREATE POLICY "System can insert task history" ON public."admin_task_history" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Users can view accessible task history" ON public."admin_task_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "admin_task_history_insert" ON public."admin_task_history" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))));
CREATE POLICY "admin_task_history_select" ON public."admin_task_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))));
CREATE POLICY "Anyone can check unredeemed codes" ON public."license_codes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((redeemed_at IS NULL) AND ((expires_at IS NULL) OR (expires_at > now()))));
CREATE POLICY "Platform admins can delete license codes" ON public."license_codes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can insert license codes" ON public."license_codes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can update license codes" ON public."license_codes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can view license codes" ON public."license_codes" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can insert cost settings" ON public."platform_cost_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can update cost settings" ON public."platform_cost_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can view cost settings" ON public."platform_cost_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Managers can delete tasks" ON public."admin_tasks" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert tasks" ON public."admin_tasks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update tasks" ON public."admin_tasks" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible tasks" ON public."admin_tasks" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "admin_tasks_delete" ON public."admin_tasks" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text]))));
CREATE POLICY "admin_tasks_insert" ON public."admin_tasks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND (( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text, 'lead'::text]))));
CREATE POLICY "admin_tasks_select" ON public."admin_tasks" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))));
CREATE POLICY "admin_tasks_update" ON public."admin_tasks" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((tenant_id = ( SELECT get_my_profile_info.user_tenant_id
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role))) AND ((( SELECT get_my_profile_info.user_role
   FROM get_my_profile_info() get_my_profile_info(user_tenant_id, user_role)) = ANY (ARRAY['owner'::text, 'manager'::text])) OR (assigned_to = auth.uid()) OR (created_by = auth.uid()))));
CREATE POLICY "All team members can insert task attachments" ON public."maintenance_task_attachments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "All team members can update task attachments" ON public."maintenance_task_attachments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Managers+ can delete task attachments" ON public."maintenance_task_attachments" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible task attachments" ON public."maintenance_task_attachments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Authenticated users can look up codes" ON public."referral_codes" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Owners can create referral code" ON public."referral_codes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Platform admins manage referral codes" ON public."referral_codes" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view own referral code" ON public."referral_codes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Platform admins manage referral redemptions" ON public."referral_redemptions" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view own referral redemption" ON public."referral_redemptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(referred_tenant_id));
CREATE POLICY "Users can view referrals they made" ON public."referral_redemptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(referrer_tenant_id));
CREATE POLICY "Platform admins can delete reseller invoices" ON public."reseller_invoices" AS PERMISSIVE FOR DELETE TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Platform admins can insert reseller invoices" ON public."reseller_invoices" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can update reseller invoices" ON public."reseller_invoices" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Platform admins can view reseller invoices" ON public."reseller_invoices" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Allow authenticated users to insert overhead_settings" ON public."overhead_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to read overhead_settings" ON public."overhead_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Allow authenticated users to update overhead_settings" ON public."overhead_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Managers can delete overhead settings" ON public."overhead_settings" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((tenant_id = get_current_tenant_id()) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert overhead settings" ON public."overhead_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update overhead settings" ON public."overhead_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Tenant isolation" ON public."overhead_settings" AS PERMISSIVE FOR ALL TO PUBLIC USING ((tenant_id = get_current_tenant_id())) WITH CHECK ((tenant_id = get_current_tenant_id()));
CREATE POLICY "Users can view accessible overhead settings" ON public."overhead_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Managers can delete overhead items" ON public."overhead_items" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert overhead items" ON public."overhead_items" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update overhead items" ON public."overhead_items" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible overhead items" ON public."overhead_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Managers can create shift templates" ON public."shift_templates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can delete shift templates" ON public."shift_templates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update shift templates" ON public."shift_templates" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage shift templates" ON public."shift_templates" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view shift templates" ON public."shift_templates" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Employees and leads can update time off" ON public."time_off_requests" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('lead'::user_role)))) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Employees can delete own pending requests" ON public."time_off_requests" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND (((employee_id = auth.uid()) AND (status = 'pending'::time_off_status)) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Employees can request time off" ON public."time_off_requests" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND (employee_id = auth.uid())));
CREATE POLICY "Managers can review time off requests" ON public."time_off_requests" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role])))))) WITH CHECK ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));
CREATE POLICY "Managers can view all tenant time off requests" ON public."time_off_requests" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));
CREATE POLICY "Platform admins manage time off" ON public."time_off_requests" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view time off requests" ON public."time_off_requests" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_read_tenant_data(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('lead'::user_role))));
CREATE POLICY "Employees can accept/decline own shifts" ON public."shifts" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND (employee_id = auth.uid()) AND (status = 'published'::shift_status))) WITH CHECK ((can_access_tenant(tenant_id) AND (employee_id = auth.uid()) AND (status = 'published'::shift_status)));
CREATE POLICY "Leads can create shifts" ON public."shifts" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update shifts" ON public."shifts" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Managers can delete shifts" ON public."shifts" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can view all tenant shifts" ON public."shifts" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))));
CREATE POLICY "Platform admins manage shifts" ON public."shifts" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view shifts" ON public."shifts" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Employees can clock in" ON public."time_clock_entries" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND (employee_id = auth.uid())));
CREATE POLICY "Managers can delete clock entries" ON public."time_clock_entries" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update clock entries" ON public."time_clock_entries" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage time clock" ON public."time_clock_entries" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view time clock entries" ON public."time_clock_entries" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_read_tenant_data(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Employees can end own breaks" ON public."time_clock_breaks" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND (has_role_or_higher('manager'::user_role) OR (EXISTS ( SELECT 1
   FROM time_clock_entries e
  WHERE ((e.id = time_clock_breaks.time_clock_entry_id) AND (e.tenant_id = time_clock_breaks.tenant_id) AND (e.employee_id = auth.uid()) AND (e.clock_out IS NULL))))))) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Employees can start own breaks" ON public."time_clock_breaks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND (has_role_or_higher('manager'::user_role) OR (EXISTS ( SELECT 1
   FROM time_clock_entries e
  WHERE ((e.id = time_clock_breaks.time_clock_entry_id) AND (e.tenant_id = time_clock_breaks.tenant_id) AND (e.employee_id = auth.uid()) AND (e.clock_out IS NULL)))))));
CREATE POLICY "Managers can delete breaks" ON public."time_clock_breaks" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage breaks" ON public."time_clock_breaks" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view breaks" ON public."time_clock_breaks" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Managers can delete recipe vendors" ON public."recipe_vendors" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert recipe vendors" ON public."recipe_vendors" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update recipe vendors" ON public."recipe_vendors" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view accessible recipe vendors" ON public."recipe_vendors" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Managers can view tenant reviews" ON public."feature_reviews" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND (( SELECT user_profiles.role
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));
CREATE POLICY "Users can insert reviews" ON public."feature_reviews" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));
CREATE POLICY "Users can update own reviews" ON public."feature_reviews" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "Users can view own reviews" ON public."feature_reviews" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "Employees can propose own punch corrections" ON public."time_clock_edit_requests" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND (employee_id = auth.uid()) AND (status = 'pending'::time_off_status) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_notes IS NULL) AND (length(btrim(reason)) > 0) AND (abs(EXTRACT(epoch FROM (created_at - now()))) < (120)::numeric) AND (abs(EXTRACT(epoch FROM (updated_at - now()))) < (120)::numeric) AND ((requested_clock_in IS NOT NULL) OR (requested_clock_out IS NOT NULL)) AND (EXISTS ( SELECT 1
   FROM time_clock_entries e
  WHERE ((e.id = time_clock_edit_requests.time_clock_entry_id) AND (e.tenant_id = time_clock_edit_requests.tenant_id) AND (e.employee_id = auth.uid()) AND (e.clock_in = time_clock_edit_requests.original_clock_in) AND (NOT (e.clock_out IS DISTINCT FROM time_clock_edit_requests.original_clock_out)))))));
CREATE POLICY "Employees see own corrections and managers see tenant correctio" ON public."time_clock_edit_requests" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Platform admins manage time clock edit requests" ON public."time_clock_edit_requests" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Owners can delete role settings" ON public."tenant_role_settings" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can insert role settings" ON public."tenant_role_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can update role settings" ON public."tenant_role_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role))) WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Platform admins manage role settings" ON public."tenant_role_settings" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view own tenant role settings" ON public."tenant_role_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Authenticated users can view templates" ON public."vertical_templates" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Platform admins can delete templates" ON public."vertical_templates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can insert templates" ON public."vertical_templates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can update templates" ON public."vertical_templates" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Help content is readable by everyone" ON public."help_content" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Platform admins can manage help content" ON public."help_content" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Anyone can view published verticals" ON public."verticals" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((is_published = true));
CREATE POLICY "Authenticated users can view all verticals" ON public."verticals" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Platform admins can delete verticals" ON public."verticals" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can insert verticals" ON public."verticals" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can update verticals" ON public."verticals" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Resellers can view their own verticals" ON public."verticals" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((reseller_id IS NOT NULL) AND (reseller_id IN ( SELECT r.id
   FROM ((resellers r
     JOIN tenants t ON ((t.reseller_id = r.id)))
     JOIN user_profiles up ON ((up.tenant_id = t.id)))
  WHERE (up.id = auth.uid())))));
CREATE POLICY "Managers can create ical subscriptions" ON public."ical_subscriptions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can delete ical subscriptions" ON public."ical_subscriptions" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update ical subscriptions" ON public."ical_subscriptions" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Platform admins manage ical subscriptions" ON public."ical_subscriptions" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view ical subscriptions" ON public."ical_subscriptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Leads can create calendar events" ON public."calendar_events" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update calendar events" ON public."calendar_events" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))) WITH CHECK (can_access_tenant(tenant_id));
CREATE POLICY "Managers can delete calendar events" ON public."calendar_events" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage calendar events" ON public."calendar_events" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view calendar events" ON public."calendar_events" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Leads can create documents" ON public."documents" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can delete documents" ON public."documents" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Leads can update documents" ON public."documents" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role)));
CREATE POLICY "Platform admins manage documents" ON public."documents" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view documents with sufficient role" ON public."documents" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_read_tenant_data(tenant_id) AND has_role_or_higher(min_role_required)));
CREATE POLICY "Managers can delete square mappings" ON public."square_employee_mappings" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert square mappings" ON public."square_employee_mappings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update square mappings" ON public."square_employee_mappings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Platform admins manage square mappings" ON public."square_employee_mappings" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view square mappings" ON public."square_employee_mappings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Owners can create document categories" ON public."document_categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can delete document categories" ON public."document_categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can update document categories" ON public."document_categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Platform admins manage document categories" ON public."document_categories" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can view document categories" ON public."document_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Platform admins manage document acknowledgments" ON public."document_acknowledgments" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Users can acknowledge documents" ON public."document_acknowledgments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND (user_id = auth.uid())));
CREATE POLICY "Users can view document acknowledgments" ON public."document_acknowledgments" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "Platform admins can delete resellers" ON public."resellers" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can insert resellers" ON public."resellers" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can update resellers" ON public."resellers" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can view resellers" ON public."resellers" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "Platform admins can manage volume tiers" ON public."reseller_volume_tiers" AS PERMISSIVE FOR ALL TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Volume tiers readable by authenticated users" ON public."reseller_volume_tiers" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "conversations_insert_members" ON public."conversations" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() IS NOT NULL) AND (is_system = false)));
CREATE POLICY "conversations_select_participant" ON public."conversations" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))));
CREATE POLICY "conversations_update_admin" ON public."conversations" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid()) AND (cp.is_admin = true))))));
CREATE POLICY "cp_insert_self" ON public."conversation_participants" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "cp_select_participant" ON public."conversation_participants" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM conversation_participants cp2
  WHERE ((cp2.conversation_id = conversation_participants.conversation_id) AND (cp2.user_id = auth.uid())))));
CREATE POLICY "cp_update_self" ON public."conversation_participants" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "messages_insert_participant" ON public."messages" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))));
CREATE POLICY "messages_select_participant" ON public."messages" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))));
CREATE POLICY "messages_update_own" ON public."messages" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((sender_id = auth.uid()));
CREATE POLICY "time_off_accrual_log_insert" ON public."time_off_accrual_log" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_accrual_log.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_accrual_log_select" ON public."time_off_accrual_log" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_accrual_log.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'lead'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_policies_delete" ON public."time_off_policies" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_policies.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_policies_insert" ON public."time_off_policies" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_policies.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_policies_select" ON public."time_off_policies" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_policies.tenant_id) AND (uta.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_policies_update" ON public."time_off_policies" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_policies.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_balances_delete" ON public."time_off_balances" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_balances.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_balances_insert" ON public."time_off_balances" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_balances.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_balances_select" ON public."time_off_balances" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_balances.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'lead'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "time_off_balances_update" ON public."time_off_balances" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = time_off_balances.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "budget_coa_delete" ON public."budget_chart_of_accounts" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_coa_insert" ON public."budget_chart_of_accounts" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_coa_select" ON public."budget_chart_of_accounts" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "budget_coa_update" ON public."budget_chart_of_accounts" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_fy_delete" ON public."budget_fiscal_years" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_fy_insert" ON public."budget_fiscal_years" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_fy_select" ON public."budget_fiscal_years" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "budget_fy_update" ON public."budget_fiscal_years" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_import_logs_insert" ON public."budget_import_logs" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_import_logs_select" ON public."budget_import_logs" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "unavail_delete" ON public."employee_unavailability" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = employee_unavailability.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "unavail_insert" ON public."employee_unavailability" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((((employee_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = employee_unavailability.tenant_id) AND (uta.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "unavail_select" ON public."employee_unavailability" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = employee_unavailability.tenant_id) AND (uta.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "unavail_update" ON public."employee_unavailability" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_tenant_assignments uta
  WHERE ((uta.tenant_id = employee_unavailability.tenant_id) AND (uta.user_id = auth.uid()) AND (uta.role = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))) OR (EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true))))));
CREATE POLICY "budget_lines_delete" ON public."budget_line_items" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_lines_insert" ON public."budget_line_items" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "budget_lines_select" ON public."budget_line_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "budget_lines_update" ON public."budget_line_items" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_scenarios_delete" ON public."budget_forecast_scenarios" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_scenarios_insert" ON public."budget_forecast_scenarios" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_scenarios_select" ON public."budget_forecast_scenarios" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_scenarios_update" ON public."budget_forecast_scenarios" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "seasonal_patterns_delete" ON public."budget_seasonal_patterns" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "seasonal_patterns_insert" ON public."budget_seasonal_patterns" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "seasonal_patterns_select" ON public."budget_seasonal_patterns" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "seasonal_patterns_update" ON public."budget_seasonal_patterns" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_lines_delete" ON public."budget_forecast_line_items" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_lines_insert" ON public."budget_forecast_line_items" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_lines_select" ON public."budget_forecast_line_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_lines_update" ON public."budget_forecast_line_items" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_drivers_delete" ON public."budget_forecast_drivers" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_drivers_insert" ON public."budget_forecast_drivers" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "forecast_drivers_select" ON public."budget_forecast_drivers" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_drivers_update" ON public."budget_forecast_drivers" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "training_attend_delete" ON public."training_attendance" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "training_attend_insert" ON public."training_attendance" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "training_attend_select" ON public."training_attendance" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "training_attend_update" ON public."training_attendance" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "emp_certs_delete" ON public."employee_certifications" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "emp_certs_insert" ON public."employee_certifications" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "emp_certs_select" ON public."employee_certifications" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "emp_certs_update" ON public."employee_certifications" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can delete connecteam mappings" ON public."connecteam_employee_mappings" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can insert connecteam mappings" ON public."connecteam_employee_mappings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers can update connecteam mappings" ON public."connecteam_employee_mappings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Users can view connecteam mappings" ON public."connecteam_employee_mappings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "training_classes_delete" ON public."training_classes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "training_classes_insert" ON public."training_classes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "training_classes_select" ON public."training_classes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "training_classes_update" ON public."training_classes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "cert_types_delete" ON public."certification_types" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "cert_types_insert" ON public."certification_types" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "cert_types_select" ON public."certification_types" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "cert_types_update" ON public."certification_types" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Read own or managed time history" ON public."time_clock_audit_events" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Users can view timesheet approvals" ON public."timesheet_approvals" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(tenant_id));
CREATE POLICY "Read own or managed approval history" ON public."timesheet_approval_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND ((employee_id = auth.uid()) OR has_role_or_higher('manager'::user_role))));
CREATE POLICY "Managers read identity links" ON public."staff_identity_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers read tip approval history" ON public."tip_payout_approval_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Managers read tip payout approvals" ON public."tip_payout_approvals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
CREATE POLICY "Owners can delete child locations" ON public."tenants" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((parent_tenant_id IS NOT NULL) AND can_access_tenant(id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Owners can insert child locations" ON public."tenants" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((has_role_or_higher('owner'::user_role) AND (parent_tenant_id = get_my_tenant_id())));
CREATE POLICY "Owners can update child locations" ON public."tenants" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((can_access_tenant(id) AND has_role_or_higher('owner'::user_role))) WITH CHECK ((can_access_tenant(id) AND has_role_or_higher('owner'::user_role)));
CREATE POLICY "Platform admins can insert tenants" ON public."tenants" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins can read all tenants" ON public."tenants" AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_platform_admin());
CREATE POLICY "Platform admins can update tenants" ON public."tenants" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can read own tenant" ON public."tenants" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));
CREATE POLICY "Users can view accessible tenants" ON public."tenants" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_access_tenant(id));
CREATE POLICY "compliance_links_read" ON public."compliance_workflow_links" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_read_tenant_data(tenant_id));
CREATE POLICY "audit_logs_platform_admin_select" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM platform_admins
  WHERE ((platform_admins.id = auth.uid()) AND (platform_admins.is_active = true)))));
CREATE POLICY "audit_logs_select" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role)));
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_and_tenant(user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_object(object_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_usage(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_kiosk_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_or_higher(required_role user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(check_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_child_tenants(parent_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_tenant(check_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_license_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_register_ga_module() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_max_locations(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_location_count(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_location(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_location_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_role_settings(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_kiosk_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_conversations(p_user_id uuid, p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_tenant_id(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_tenant_data(data_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_system_channels(p_user_id uuid, p_tenant_id uuid, p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_members(p_conversation_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_license_code(p_code text, p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bug_reports_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_verified_compliance_task() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_staff_time_clock_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_timesheet_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_timesheet_period(p_tenant uuid, p_employee uuid, p_start date, p_end date, p_timezone text, p_expected jsonb, p_approve boolean, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_staff_break_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_time_clock_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_time_clock_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_time_clock_edit(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tip_approval_revision() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_work_session(p_in timestamp with time zone, p_out timestamp with time zone, p_breaks jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_time_clock_session(p_tenant uuid, p_employee uuid, p_entry uuid, p_expected_updated_at timestamp with time zone, p_clock_in timestamp with time zone, p_clock_out timestamp with time zone, p_breaks jsonb, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_owned_by_platform_admin(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_enabled_modules(p_tenant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_time_clock_session(p_entry uuid, p_expected_updated_at timestamp with time zone, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_missing_time_session(p_tenant uuid, p_clock_in timestamp with time zone, p_clock_out timestamp with time zone, p_breaks jsonb, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_missing_time_session(p_id uuid, p_status text, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_time_clock_edit(p_id uuid, p_approve boolean, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_timesheet_window(t uuid, e uuid, start_at timestamp with time zone, end_at timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_changed_timesheet() TO authenticated;
GRANT EXECUTE ON FUNCTION public.timesheet_snapshot(t uuid, e uuid, start_at timestamp with time zone, end_at timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_timesheet_snapshot(value jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_timesheet_export(p_tenant uuid, p_start date, p_end date, p_timezone text, p_expected jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_staff_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_roster_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_tip_approval() TO authenticated;
GRANT INSERT ON public."blackout_dates" TO "authenticated";
GRANT SELECT ON public."blackout_dates" TO "authenticated";
GRANT UPDATE ON public."blackout_dates" TO "authenticated";
GRANT DELETE ON public."blackout_dates" TO "authenticated";
GRANT INSERT ON public."blackout_dates" TO "service_role";
GRANT SELECT ON public."blackout_dates" TO "service_role";
GRANT UPDATE ON public."blackout_dates" TO "service_role";
GRANT DELETE ON public."blackout_dates" TO "service_role";
GRANT INSERT ON public."ingredient_categories" TO "authenticated";
GRANT SELECT ON public."ingredient_categories" TO "authenticated";
GRANT UPDATE ON public."ingredient_categories" TO "authenticated";
GRANT DELETE ON public."ingredient_categories" TO "authenticated";
GRANT INSERT ON public."ingredient_categories" TO "service_role";
GRANT SELECT ON public."ingredient_categories" TO "service_role";
GRANT UPDATE ON public."ingredient_categories" TO "service_role";
GRANT DELETE ON public."ingredient_categories" TO "service_role";
GRANT INSERT ON public."store_operating_hours" TO "authenticated";
GRANT SELECT ON public."store_operating_hours" TO "authenticated";
GRANT UPDATE ON public."store_operating_hours" TO "authenticated";
GRANT DELETE ON public."store_operating_hours" TO "authenticated";
GRANT INSERT ON public."store_operating_hours" TO "service_role";
GRANT SELECT ON public."store_operating_hours" TO "service_role";
GRANT UPDATE ON public."store_operating_hours" TO "service_role";
GRANT DELETE ON public."store_operating_hours" TO "service_role";
GRANT INSERT ON public."ingredients" TO "authenticated";
GRANT SELECT ON public."ingredients" TO "authenticated";
GRANT UPDATE ON public."ingredients" TO "authenticated";
GRANT DELETE ON public."ingredients" TO "authenticated";
GRANT INSERT ON public."ingredients" TO "service_role";
GRANT SELECT ON public."ingredients" TO "service_role";
GRANT UPDATE ON public."ingredients" TO "service_role";
GRANT DELETE ON public."ingredients" TO "service_role";
GRANT INSERT ON public."product_sizes" TO "authenticated";
GRANT SELECT ON public."product_sizes" TO "authenticated";
GRANT UPDATE ON public."product_sizes" TO "authenticated";
GRANT DELETE ON public."product_sizes" TO "authenticated";
GRANT INSERT ON public."product_sizes" TO "service_role";
GRANT SELECT ON public."product_sizes" TO "service_role";
GRANT UPDATE ON public."product_sizes" TO "service_role";
GRANT DELETE ON public."product_sizes" TO "service_role";
GRANT INSERT ON public."base_templates" TO "authenticated";
GRANT SELECT ON public."base_templates" TO "authenticated";
GRANT UPDATE ON public."base_templates" TO "authenticated";
GRANT DELETE ON public."base_templates" TO "authenticated";
GRANT INSERT ON public."base_templates" TO "service_role";
GRANT SELECT ON public."base_templates" TO "service_role";
GRANT UPDATE ON public."base_templates" TO "service_role";
GRANT DELETE ON public."base_templates" TO "service_role";
GRANT INSERT ON public."base_template_ingredients" TO "authenticated";
GRANT SELECT ON public."base_template_ingredients" TO "authenticated";
GRANT UPDATE ON public."base_template_ingredients" TO "authenticated";
GRANT DELETE ON public."base_template_ingredients" TO "authenticated";
GRANT INSERT ON public."base_template_ingredients" TO "service_role";
GRANT SELECT ON public."base_template_ingredients" TO "service_role";
GRANT UPDATE ON public."base_template_ingredients" TO "service_role";
GRANT DELETE ON public."base_template_ingredients" TO "service_role";
GRANT INSERT ON public."products" TO "authenticated";
GRANT SELECT ON public."products" TO "authenticated";
GRANT UPDATE ON public."products" TO "authenticated";
GRANT DELETE ON public."products" TO "authenticated";
GRANT INSERT ON public."products" TO "service_role";
GRANT SELECT ON public."products" TO "service_role";
GRANT UPDATE ON public."products" TO "service_role";
GRANT DELETE ON public."products" TO "service_role";
GRANT INSERT ON public."recipe_ingredients" TO "authenticated";
GRANT SELECT ON public."recipe_ingredients" TO "authenticated";
GRANT UPDATE ON public."recipe_ingredients" TO "authenticated";
GRANT DELETE ON public."recipe_ingredients" TO "authenticated";
GRANT INSERT ON public."recipe_ingredients" TO "service_role";
GRANT SELECT ON public."recipe_ingredients" TO "service_role";
GRANT UPDATE ON public."recipe_ingredients" TO "service_role";
GRANT DELETE ON public."recipe_ingredients" TO "service_role";
GRANT INSERT ON public."food_items" TO "authenticated";
GRANT SELECT ON public."food_items" TO "authenticated";
GRANT UPDATE ON public."food_items" TO "authenticated";
GRANT DELETE ON public."food_items" TO "authenticated";
GRANT INSERT ON public."food_items" TO "service_role";
GRANT SELECT ON public."food_items" TO "service_role";
GRANT UPDATE ON public."food_items" TO "service_role";
GRANT DELETE ON public."food_items" TO "service_role";
GRANT INSERT ON public."product_categories" TO "authenticated";
GRANT SELECT ON public."product_categories" TO "authenticated";
GRANT UPDATE ON public."product_categories" TO "authenticated";
GRANT DELETE ON public."product_categories" TO "authenticated";
GRANT INSERT ON public."product_categories" TO "service_role";
GRANT SELECT ON public."product_categories" TO "service_role";
GRANT UPDATE ON public."product_categories" TO "service_role";
GRANT DELETE ON public."product_categories" TO "service_role";
GRANT INSERT ON public."recipes" TO "authenticated";
GRANT SELECT ON public."recipes" TO "authenticated";
GRANT UPDATE ON public."recipes" TO "authenticated";
GRANT DELETE ON public."recipes" TO "authenticated";
GRANT INSERT ON public."recipes" TO "service_role";
GRANT SELECT ON public."recipes" TO "service_role";
GRANT UPDATE ON public."recipes" TO "service_role";
GRANT DELETE ON public."recipes" TO "service_role";
GRANT INSERT ON public."cash_activity" TO "authenticated";
GRANT SELECT ON public."cash_activity" TO "authenticated";
GRANT UPDATE ON public."cash_activity" TO "authenticated";
GRANT DELETE ON public."cash_activity" TO "authenticated";
GRANT INSERT ON public."cash_activity" TO "service_role";
GRANT SELECT ON public."cash_activity" TO "service_role";
GRANT UPDATE ON public."cash_activity" TO "service_role";
GRANT DELETE ON public."cash_activity" TO "service_role";
GRANT INSERT ON public."business_accounts" TO "authenticated";
GRANT SELECT ON public."business_accounts" TO "authenticated";
GRANT UPDATE ON public."business_accounts" TO "authenticated";
GRANT DELETE ON public."business_accounts" TO "authenticated";
GRANT INSERT ON public."business_accounts" TO "service_role";
GRANT SELECT ON public."business_accounts" TO "service_role";
GRANT UPDATE ON public."business_accounts" TO "service_role";
GRANT DELETE ON public."business_accounts" TO "service_role";
GRANT INSERT ON public."bug_reports" TO "authenticated";
GRANT SELECT ON public."bug_reports" TO "authenticated";
GRANT UPDATE ON public."bug_reports" TO "authenticated";
GRANT DELETE ON public."bug_reports" TO "authenticated";
GRANT INSERT ON public."bug_reports" TO "service_role";
GRANT SELECT ON public."bug_reports" TO "service_role";
GRANT UPDATE ON public."bug_reports" TO "service_role";
GRANT DELETE ON public."bug_reports" TO "service_role";
GRANT INSERT ON public."tenant_usage_metrics" TO "authenticated";
GRANT SELECT ON public."tenant_usage_metrics" TO "authenticated";
GRANT UPDATE ON public."tenant_usage_metrics" TO "authenticated";
GRANT DELETE ON public."tenant_usage_metrics" TO "authenticated";
GRANT INSERT ON public."tenant_usage_metrics" TO "service_role";
GRANT SELECT ON public."tenant_usage_metrics" TO "service_role";
GRANT UPDATE ON public."tenant_usage_metrics" TO "service_role";
GRANT DELETE ON public."tenant_usage_metrics" TO "service_role";
GRANT INSERT ON public."tenant_activity_log" TO "authenticated";
GRANT SELECT ON public."tenant_activity_log" TO "authenticated";
GRANT UPDATE ON public."tenant_activity_log" TO "authenticated";
GRANT DELETE ON public."tenant_activity_log" TO "authenticated";
GRANT INSERT ON public."tenant_activity_log" TO "service_role";
GRANT SELECT ON public."tenant_activity_log" TO "service_role";
GRANT UPDATE ON public."tenant_activity_log" TO "service_role";
GRANT DELETE ON public."tenant_activity_log" TO "service_role";
GRANT INSERT ON public."platform_admins" TO "authenticated";
GRANT SELECT ON public."platform_admins" TO "authenticated";
GRANT UPDATE ON public."platform_admins" TO "authenticated";
GRANT DELETE ON public."platform_admins" TO "authenticated";
GRANT INSERT ON public."platform_admins" TO "service_role";
GRANT SELECT ON public."platform_admins" TO "service_role";
GRANT UPDATE ON public."platform_admins" TO "service_role";
GRANT DELETE ON public."platform_admins" TO "service_role";
GRANT INSERT ON public."user_tenant_assignments" TO "authenticated";
GRANT SELECT ON public."user_tenant_assignments" TO "authenticated";
GRANT UPDATE ON public."user_tenant_assignments" TO "authenticated";
GRANT DELETE ON public."user_tenant_assignments" TO "authenticated";
GRANT INSERT ON public."user_tenant_assignments" TO "service_role";
GRANT SELECT ON public."user_tenant_assignments" TO "service_role";
GRANT UPDATE ON public."user_tenant_assignments" TO "service_role";
GRANT DELETE ON public."user_tenant_assignments" TO "service_role";
GRANT INSERT ON public."account_businesses" TO "authenticated";
GRANT SELECT ON public."account_businesses" TO "authenticated";
GRANT UPDATE ON public."account_businesses" TO "authenticated";
GRANT DELETE ON public."account_businesses" TO "authenticated";
GRANT INSERT ON public."account_businesses" TO "service_role";
GRANT SELECT ON public."account_businesses" TO "service_role";
GRANT UPDATE ON public."account_businesses" TO "service_role";
GRANT DELETE ON public."account_businesses" TO "service_role";
GRANT INSERT ON public."tip_employees" TO "authenticated";
GRANT SELECT ON public."tip_employees" TO "authenticated";
GRANT UPDATE ON public."tip_employees" TO "authenticated";
GRANT DELETE ON public."tip_employees" TO "authenticated";
GRANT INSERT ON public."tip_employees" TO "service_role";
GRANT SELECT ON public."tip_employees" TO "service_role";
GRANT UPDATE ON public."tip_employees" TO "service_role";
GRANT DELETE ON public."tip_employees" TO "service_role";
GRANT INSERT ON public."recipe_size_pricing" TO "authenticated";
GRANT SELECT ON public."recipe_size_pricing" TO "authenticated";
GRANT UPDATE ON public."recipe_size_pricing" TO "authenticated";
GRANT DELETE ON public."recipe_size_pricing" TO "authenticated";
GRANT INSERT ON public."recipe_size_pricing" TO "service_role";
GRANT SELECT ON public."recipe_size_pricing" TO "service_role";
GRANT UPDATE ON public."recipe_size_pricing" TO "service_role";
GRANT DELETE ON public."recipe_size_pricing" TO "service_role";
GRANT INSERT ON public."tip_weekly_data" TO "authenticated";
GRANT SELECT ON public."tip_weekly_data" TO "authenticated";
GRANT UPDATE ON public."tip_weekly_data" TO "authenticated";
GRANT DELETE ON public."tip_weekly_data" TO "authenticated";
GRANT INSERT ON public."tip_weekly_data" TO "service_role";
GRANT SELECT ON public."tip_weekly_data" TO "service_role";
GRANT UPDATE ON public."tip_weekly_data" TO "service_role";
GRANT DELETE ON public."tip_weekly_data" TO "service_role";
GRANT INSERT ON public."tip_employee_hours" TO "authenticated";
GRANT SELECT ON public."tip_employee_hours" TO "authenticated";
GRANT UPDATE ON public."tip_employee_hours" TO "authenticated";
GRANT DELETE ON public."tip_employee_hours" TO "authenticated";
GRANT INSERT ON public."tip_employee_hours" TO "service_role";
GRANT SELECT ON public."tip_employee_hours" TO "service_role";
GRANT UPDATE ON public."tip_employee_hours" TO "service_role";
GRANT DELETE ON public."tip_employee_hours" TO "service_role";
GRANT INSERT ON public."v_food_pricing" TO "authenticated";
GRANT SELECT ON public."v_food_pricing" TO "authenticated";
GRANT UPDATE ON public."v_food_pricing" TO "authenticated";
GRANT DELETE ON public."v_food_pricing" TO "authenticated";
GRANT INSERT ON public."v_food_pricing" TO "service_role";
GRANT SELECT ON public."v_food_pricing" TO "service_role";
GRANT UPDATE ON public."v_food_pricing" TO "service_role";
GRANT DELETE ON public."v_food_pricing" TO "service_role";
GRANT INSERT ON public."tenant_branding" TO "authenticated";
GRANT SELECT ON public."tenant_branding" TO "authenticated";
GRANT UPDATE ON public."tenant_branding" TO "authenticated";
GRANT DELETE ON public."tenant_branding" TO "authenticated";
GRANT INSERT ON public."tenant_branding" TO "service_role";
GRANT SELECT ON public."tenant_branding" TO "service_role";
GRANT UPDATE ON public."tenant_branding" TO "service_role";
GRANT DELETE ON public."tenant_branding" TO "service_role";
GRANT INSERT ON public."recipe_size_bases" TO "authenticated";
GRANT SELECT ON public."recipe_size_bases" TO "authenticated";
GRANT UPDATE ON public."recipe_size_bases" TO "authenticated";
GRANT DELETE ON public."recipe_size_bases" TO "authenticated";
GRANT INSERT ON public."recipe_size_bases" TO "service_role";
GRANT SELECT ON public."recipe_size_bases" TO "service_role";
GRANT UPDATE ON public."recipe_size_bases" TO "service_role";
GRANT DELETE ON public."recipe_size_bases" TO "service_role";
GRANT INSERT ON public."v_ingredients" TO "authenticated";
GRANT SELECT ON public."v_ingredients" TO "authenticated";
GRANT UPDATE ON public."v_ingredients" TO "authenticated";
GRANT DELETE ON public."v_ingredients" TO "authenticated";
GRANT INSERT ON public."v_ingredients" TO "service_role";
GRANT SELECT ON public."v_ingredients" TO "service_role";
GRANT UPDATE ON public."v_ingredients" TO "service_role";
GRANT DELETE ON public."v_ingredients" TO "service_role";
GRANT INSERT ON public."v_product_pricing" TO "authenticated";
GRANT SELECT ON public."v_product_pricing" TO "authenticated";
GRANT UPDATE ON public."v_product_pricing" TO "authenticated";
GRANT DELETE ON public."v_product_pricing" TO "authenticated";
GRANT INSERT ON public."v_product_pricing" TO "service_role";
GRANT SELECT ON public."v_product_pricing" TO "service_role";
GRANT UPDATE ON public."v_product_pricing" TO "service_role";
GRANT DELETE ON public."v_product_pricing" TO "service_role";
GRANT INSERT ON public."time_clock_missing_requests" TO "authenticated";
GRANT SELECT ON public."time_clock_missing_requests" TO "authenticated";
GRANT UPDATE ON public."time_clock_missing_requests" TO "authenticated";
GRANT DELETE ON public."time_clock_missing_requests" TO "authenticated";
GRANT INSERT ON public."time_clock_missing_requests" TO "service_role";
GRANT SELECT ON public."time_clock_missing_requests" TO "service_role";
GRANT UPDATE ON public."time_clock_missing_requests" TO "service_role";
GRANT DELETE ON public."time_clock_missing_requests" TO "service_role";
GRANT INSERT ON public."user_profiles" TO "authenticated";
GRANT SELECT ON public."user_profiles" TO "authenticated";
GRANT UPDATE ON public."user_profiles" TO "authenticated";
GRANT DELETE ON public."user_profiles" TO "authenticated";
GRANT INSERT ON public."user_profiles" TO "service_role";
GRANT SELECT ON public."user_profiles" TO "service_role";
GRANT UPDATE ON public."user_profiles" TO "service_role";
GRANT DELETE ON public."user_profiles" TO "service_role";
GRANT INSERT ON public."subscription_plan_modules" TO "authenticated";
GRANT SELECT ON public."subscription_plan_modules" TO "authenticated";
GRANT UPDATE ON public."subscription_plan_modules" TO "authenticated";
GRANT DELETE ON public."subscription_plan_modules" TO "authenticated";
GRANT INSERT ON public."subscription_plan_modules" TO "service_role";
GRANT SELECT ON public."subscription_plan_modules" TO "service_role";
GRANT UPDATE ON public."subscription_plan_modules" TO "service_role";
GRANT DELETE ON public."subscription_plan_modules" TO "service_role";
GRANT INSERT ON public."tenant_module_subscriptions" TO "authenticated";
GRANT SELECT ON public."tenant_module_subscriptions" TO "authenticated";
GRANT UPDATE ON public."tenant_module_subscriptions" TO "authenticated";
GRANT DELETE ON public."tenant_module_subscriptions" TO "authenticated";
GRANT INSERT ON public."tenant_module_subscriptions" TO "service_role";
GRANT SELECT ON public."tenant_module_subscriptions" TO "service_role";
GRANT UPDATE ON public."tenant_module_subscriptions" TO "service_role";
GRANT DELETE ON public."tenant_module_subscriptions" TO "service_role";
GRANT INSERT ON public."tenant_module_overrides" TO "authenticated";
GRANT SELECT ON public."tenant_module_overrides" TO "authenticated";
GRANT UPDATE ON public."tenant_module_overrides" TO "authenticated";
GRANT DELETE ON public."tenant_module_overrides" TO "authenticated";
GRANT INSERT ON public."tenant_module_overrides" TO "service_role";
GRANT SELECT ON public."tenant_module_overrides" TO "service_role";
GRANT UPDATE ON public."tenant_module_overrides" TO "service_role";
GRANT DELETE ON public."tenant_module_overrides" TO "service_role";
GRANT INSERT ON public."modules" TO "authenticated";
GRANT SELECT ON public."modules" TO "authenticated";
GRANT UPDATE ON public."modules" TO "authenticated";
GRANT DELETE ON public."modules" TO "authenticated";
GRANT INSERT ON public."modules" TO "service_role";
GRANT SELECT ON public."modules" TO "service_role";
GRANT UPDATE ON public."modules" TO "service_role";
GRANT DELETE ON public."modules" TO "service_role";
GRANT INSERT ON public."tenant_coffee_vendors" TO "authenticated";
GRANT SELECT ON public."tenant_coffee_vendors" TO "authenticated";
GRANT UPDATE ON public."tenant_coffee_vendors" TO "authenticated";
GRANT DELETE ON public."tenant_coffee_vendors" TO "authenticated";
GRANT INSERT ON public."tenant_coffee_vendors" TO "service_role";
GRANT SELECT ON public."tenant_coffee_vendors" TO "service_role";
GRANT UPDATE ON public."tenant_coffee_vendors" TO "service_role";
GRANT DELETE ON public."tenant_coffee_vendors" TO "service_role";
GRANT INSERT ON public."tenant_coffee_products" TO "authenticated";
GRANT SELECT ON public."tenant_coffee_products" TO "authenticated";
GRANT UPDATE ON public."tenant_coffee_products" TO "authenticated";
GRANT DELETE ON public."tenant_coffee_products" TO "authenticated";
GRANT INSERT ON public."tenant_coffee_products" TO "service_role";
GRANT SELECT ON public."tenant_coffee_products" TO "service_role";
GRANT UPDATE ON public."tenant_coffee_products" TO "service_role";
GRANT DELETE ON public."tenant_coffee_products" TO "service_role";
GRANT INSERT ON public."subscription_plans" TO "authenticated";
GRANT SELECT ON public."subscription_plans" TO "authenticated";
GRANT UPDATE ON public."subscription_plans" TO "authenticated";
GRANT DELETE ON public."subscription_plans" TO "authenticated";
GRANT INSERT ON public."subscription_plans" TO "service_role";
GRANT SELECT ON public."subscription_plans" TO "service_role";
GRANT UPDATE ON public."subscription_plans" TO "service_role";
GRANT DELETE ON public."subscription_plans" TO "service_role";
GRANT INSERT ON public."growth_tracker_monthly" TO "authenticated";
GRANT SELECT ON public."growth_tracker_monthly" TO "authenticated";
GRANT UPDATE ON public."growth_tracker_monthly" TO "authenticated";
GRANT DELETE ON public."growth_tracker_monthly" TO "authenticated";
GRANT INSERT ON public."growth_tracker_monthly" TO "service_role";
GRANT SELECT ON public."growth_tracker_monthly" TO "service_role";
GRANT UPDATE ON public."growth_tracker_monthly" TO "service_role";
GRANT DELETE ON public."growth_tracker_monthly" TO "service_role";
GRANT INSERT ON public."maintenance_tasks" TO "authenticated";
GRANT SELECT ON public."maintenance_tasks" TO "authenticated";
GRANT UPDATE ON public."maintenance_tasks" TO "authenticated";
GRANT DELETE ON public."maintenance_tasks" TO "authenticated";
GRANT INSERT ON public."maintenance_tasks" TO "service_role";
GRANT SELECT ON public."maintenance_tasks" TO "service_role";
GRANT UPDATE ON public."maintenance_tasks" TO "service_role";
GRANT DELETE ON public."maintenance_tasks" TO "service_role";
GRANT INSERT ON public."equipment" TO "authenticated";
GRANT SELECT ON public."equipment" TO "authenticated";
GRANT UPDATE ON public."equipment" TO "authenticated";
GRANT DELETE ON public."equipment" TO "authenticated";
GRANT INSERT ON public."equipment" TO "service_role";
GRANT SELECT ON public."equipment" TO "service_role";
GRANT UPDATE ON public."equipment" TO "service_role";
GRANT DELETE ON public."equipment" TO "service_role";
GRANT INSERT ON public."equipment_attachments" TO "authenticated";
GRANT SELECT ON public."equipment_attachments" TO "authenticated";
GRANT UPDATE ON public."equipment_attachments" TO "authenticated";
GRANT DELETE ON public."equipment_attachments" TO "authenticated";
GRANT INSERT ON public."equipment_attachments" TO "service_role";
GRANT SELECT ON public."equipment_attachments" TO "service_role";
GRANT UPDATE ON public."equipment_attachments" TO "service_role";
GRANT DELETE ON public."equipment_attachments" TO "service_role";
GRANT INSERT ON public."maintenance_logs" TO "authenticated";
GRANT SELECT ON public."maintenance_logs" TO "authenticated";
GRANT UPDATE ON public."maintenance_logs" TO "authenticated";
GRANT DELETE ON public."maintenance_logs" TO "authenticated";
GRANT INSERT ON public."maintenance_logs" TO "service_role";
GRANT SELECT ON public."maintenance_logs" TO "service_role";
GRANT UPDATE ON public."maintenance_logs" TO "service_role";
GRANT DELETE ON public."maintenance_logs" TO "service_role";
GRANT INSERT ON public."coffee_order_history" TO "authenticated";
GRANT SELECT ON public."coffee_order_history" TO "authenticated";
GRANT UPDATE ON public."coffee_order_history" TO "authenticated";
GRANT DELETE ON public."coffee_order_history" TO "authenticated";
GRANT INSERT ON public."coffee_order_history" TO "service_role";
GRANT SELECT ON public."coffee_order_history" TO "service_role";
GRANT UPDATE ON public."coffee_order_history" TO "service_role";
GRANT DELETE ON public."coffee_order_history" TO "service_role";
GRANT INSERT ON public."admin_task_categories" TO "authenticated";
GRANT SELECT ON public."admin_task_categories" TO "authenticated";
GRANT UPDATE ON public."admin_task_categories" TO "authenticated";
GRANT DELETE ON public."admin_task_categories" TO "authenticated";
GRANT INSERT ON public."admin_task_categories" TO "service_role";
GRANT SELECT ON public."admin_task_categories" TO "service_role";
GRANT UPDATE ON public."admin_task_categories" TO "service_role";
GRANT DELETE ON public."admin_task_categories" TO "service_role";
GRANT INSERT ON public."admin_task_comments" TO "authenticated";
GRANT SELECT ON public."admin_task_comments" TO "authenticated";
GRANT UPDATE ON public."admin_task_comments" TO "authenticated";
GRANT DELETE ON public."admin_task_comments" TO "authenticated";
GRANT INSERT ON public."admin_task_comments" TO "service_role";
GRANT SELECT ON public."admin_task_comments" TO "service_role";
GRANT UPDATE ON public."admin_task_comments" TO "service_role";
GRANT DELETE ON public."admin_task_comments" TO "service_role";
GRANT INSERT ON public."admin_task_history" TO "authenticated";
GRANT SELECT ON public."admin_task_history" TO "authenticated";
GRANT UPDATE ON public."admin_task_history" TO "authenticated";
GRANT DELETE ON public."admin_task_history" TO "authenticated";
GRANT INSERT ON public."admin_task_history" TO "service_role";
GRANT SELECT ON public."admin_task_history" TO "service_role";
GRANT UPDATE ON public."admin_task_history" TO "service_role";
GRANT DELETE ON public."admin_task_history" TO "service_role";
GRANT INSERT ON public."license_codes" TO "authenticated";
GRANT SELECT ON public."license_codes" TO "authenticated";
GRANT UPDATE ON public."license_codes" TO "authenticated";
GRANT DELETE ON public."license_codes" TO "authenticated";
GRANT INSERT ON public."license_codes" TO "service_role";
GRANT SELECT ON public."license_codes" TO "service_role";
GRANT UPDATE ON public."license_codes" TO "service_role";
GRANT DELETE ON public."license_codes" TO "service_role";
GRANT INSERT ON public."platform_cost_settings" TO "authenticated";
GRANT SELECT ON public."platform_cost_settings" TO "authenticated";
GRANT UPDATE ON public."platform_cost_settings" TO "authenticated";
GRANT DELETE ON public."platform_cost_settings" TO "authenticated";
GRANT INSERT ON public."platform_cost_settings" TO "service_role";
GRANT SELECT ON public."platform_cost_settings" TO "service_role";
GRANT UPDATE ON public."platform_cost_settings" TO "service_role";
GRANT DELETE ON public."platform_cost_settings" TO "service_role";
GRANT INSERT ON public."alfred_confirmation_tokens" TO "authenticated";
GRANT SELECT ON public."alfred_confirmation_tokens" TO "authenticated";
GRANT UPDATE ON public."alfred_confirmation_tokens" TO "authenticated";
GRANT DELETE ON public."alfred_confirmation_tokens" TO "authenticated";
GRANT INSERT ON public."alfred_confirmation_tokens" TO "service_role";
GRANT SELECT ON public."alfred_confirmation_tokens" TO "service_role";
GRANT UPDATE ON public."alfred_confirmation_tokens" TO "service_role";
GRANT DELETE ON public."alfred_confirmation_tokens" TO "service_role";
GRANT INSERT ON public."admin_tasks" TO "authenticated";
GRANT SELECT ON public."admin_tasks" TO "authenticated";
GRANT UPDATE ON public."admin_tasks" TO "authenticated";
GRANT DELETE ON public."admin_tasks" TO "authenticated";
GRANT INSERT ON public."admin_tasks" TO "service_role";
GRANT SELECT ON public."admin_tasks" TO "service_role";
GRANT UPDATE ON public."admin_tasks" TO "service_role";
GRANT DELETE ON public."admin_tasks" TO "service_role";
GRANT INSERT ON public."maintenance_task_attachments" TO "authenticated";
GRANT SELECT ON public."maintenance_task_attachments" TO "authenticated";
GRANT UPDATE ON public."maintenance_task_attachments" TO "authenticated";
GRANT DELETE ON public."maintenance_task_attachments" TO "authenticated";
GRANT INSERT ON public."maintenance_task_attachments" TO "service_role";
GRANT SELECT ON public."maintenance_task_attachments" TO "service_role";
GRANT UPDATE ON public."maintenance_task_attachments" TO "service_role";
GRANT DELETE ON public."maintenance_task_attachments" TO "service_role";
GRANT INSERT ON public."referral_codes" TO "authenticated";
GRANT SELECT ON public."referral_codes" TO "authenticated";
GRANT UPDATE ON public."referral_codes" TO "authenticated";
GRANT DELETE ON public."referral_codes" TO "authenticated";
GRANT INSERT ON public."referral_codes" TO "service_role";
GRANT SELECT ON public."referral_codes" TO "service_role";
GRANT UPDATE ON public."referral_codes" TO "service_role";
GRANT DELETE ON public."referral_codes" TO "service_role";
GRANT INSERT ON public."referral_redemptions" TO "authenticated";
GRANT SELECT ON public."referral_redemptions" TO "authenticated";
GRANT UPDATE ON public."referral_redemptions" TO "authenticated";
GRANT DELETE ON public."referral_redemptions" TO "authenticated";
GRANT INSERT ON public."referral_redemptions" TO "service_role";
GRANT SELECT ON public."referral_redemptions" TO "service_role";
GRANT UPDATE ON public."referral_redemptions" TO "service_role";
GRANT DELETE ON public."referral_redemptions" TO "service_role";
GRANT INSERT ON public."reseller_invoices" TO "authenticated";
GRANT SELECT ON public."reseller_invoices" TO "authenticated";
GRANT UPDATE ON public."reseller_invoices" TO "authenticated";
GRANT DELETE ON public."reseller_invoices" TO "authenticated";
GRANT INSERT ON public."reseller_invoices" TO "service_role";
GRANT SELECT ON public."reseller_invoices" TO "service_role";
GRANT UPDATE ON public."reseller_invoices" TO "service_role";
GRANT DELETE ON public."reseller_invoices" TO "service_role";
GRANT INSERT ON public."overhead_settings" TO "authenticated";
GRANT SELECT ON public."overhead_settings" TO "authenticated";
GRANT UPDATE ON public."overhead_settings" TO "authenticated";
GRANT DELETE ON public."overhead_settings" TO "authenticated";
GRANT INSERT ON public."overhead_settings" TO "service_role";
GRANT SELECT ON public."overhead_settings" TO "service_role";
GRANT UPDATE ON public."overhead_settings" TO "service_role";
GRANT DELETE ON public."overhead_settings" TO "service_role";
GRANT INSERT ON public."overhead_items" TO "authenticated";
GRANT SELECT ON public."overhead_items" TO "authenticated";
GRANT UPDATE ON public."overhead_items" TO "authenticated";
GRANT DELETE ON public."overhead_items" TO "authenticated";
GRANT INSERT ON public."overhead_items" TO "service_role";
GRANT SELECT ON public."overhead_items" TO "service_role";
GRANT UPDATE ON public."overhead_items" TO "service_role";
GRANT DELETE ON public."overhead_items" TO "service_role";
GRANT INSERT ON public."shift_templates" TO "authenticated";
GRANT SELECT ON public."shift_templates" TO "authenticated";
GRANT UPDATE ON public."shift_templates" TO "authenticated";
GRANT DELETE ON public."shift_templates" TO "authenticated";
GRANT INSERT ON public."shift_templates" TO "service_role";
GRANT SELECT ON public."shift_templates" TO "service_role";
GRANT UPDATE ON public."shift_templates" TO "service_role";
GRANT DELETE ON public."shift_templates" TO "service_role";
GRANT INSERT ON public."time_off_requests" TO "authenticated";
GRANT SELECT ON public."time_off_requests" TO "authenticated";
GRANT UPDATE ON public."time_off_requests" TO "authenticated";
GRANT DELETE ON public."time_off_requests" TO "authenticated";
GRANT INSERT ON public."time_off_requests" TO "service_role";
GRANT SELECT ON public."time_off_requests" TO "service_role";
GRANT UPDATE ON public."time_off_requests" TO "service_role";
GRANT DELETE ON public."time_off_requests" TO "service_role";
GRANT INSERT ON public."shifts" TO "authenticated";
GRANT SELECT ON public."shifts" TO "authenticated";
GRANT UPDATE ON public."shifts" TO "authenticated";
GRANT DELETE ON public."shifts" TO "authenticated";
GRANT INSERT ON public."shifts" TO "service_role";
GRANT SELECT ON public."shifts" TO "service_role";
GRANT UPDATE ON public."shifts" TO "service_role";
GRANT DELETE ON public."shifts" TO "service_role";
GRANT INSERT ON public."time_clock_entries" TO "authenticated";
GRANT SELECT ON public."time_clock_entries" TO "authenticated";
GRANT UPDATE ON public."time_clock_entries" TO "authenticated";
GRANT DELETE ON public."time_clock_entries" TO "authenticated";
GRANT INSERT ON public."time_clock_entries" TO "service_role";
GRANT SELECT ON public."time_clock_entries" TO "service_role";
GRANT UPDATE ON public."time_clock_entries" TO "service_role";
GRANT DELETE ON public."time_clock_entries" TO "service_role";
GRANT INSERT ON public."time_clock_breaks" TO "authenticated";
GRANT SELECT ON public."time_clock_breaks" TO "authenticated";
GRANT UPDATE ON public."time_clock_breaks" TO "authenticated";
GRANT DELETE ON public."time_clock_breaks" TO "authenticated";
GRANT INSERT ON public."time_clock_breaks" TO "service_role";
GRANT SELECT ON public."time_clock_breaks" TO "service_role";
GRANT UPDATE ON public."time_clock_breaks" TO "service_role";
GRANT DELETE ON public."time_clock_breaks" TO "service_role";
GRANT INSERT ON public."recipe_vendors" TO "authenticated";
GRANT SELECT ON public."recipe_vendors" TO "authenticated";
GRANT UPDATE ON public."recipe_vendors" TO "authenticated";
GRANT DELETE ON public."recipe_vendors" TO "authenticated";
GRANT INSERT ON public."recipe_vendors" TO "service_role";
GRANT SELECT ON public."recipe_vendors" TO "service_role";
GRANT UPDATE ON public."recipe_vendors" TO "service_role";
GRANT DELETE ON public."recipe_vendors" TO "service_role";
GRANT INSERT ON public."feature_reviews" TO "authenticated";
GRANT SELECT ON public."feature_reviews" TO "authenticated";
GRANT UPDATE ON public."feature_reviews" TO "authenticated";
GRANT DELETE ON public."feature_reviews" TO "authenticated";
GRANT INSERT ON public."feature_reviews" TO "service_role";
GRANT SELECT ON public."feature_reviews" TO "service_role";
GRANT UPDATE ON public."feature_reviews" TO "service_role";
GRANT DELETE ON public."feature_reviews" TO "service_role";
GRANT INSERT ON public."time_clock_edit_requests" TO "authenticated";
GRANT SELECT ON public."time_clock_edit_requests" TO "authenticated";
GRANT UPDATE ON public."time_clock_edit_requests" TO "authenticated";
GRANT DELETE ON public."time_clock_edit_requests" TO "authenticated";
GRANT INSERT ON public."time_clock_edit_requests" TO "service_role";
GRANT SELECT ON public."time_clock_edit_requests" TO "service_role";
GRANT UPDATE ON public."time_clock_edit_requests" TO "service_role";
GRANT DELETE ON public."time_clock_edit_requests" TO "service_role";
GRANT INSERT ON public."tenant_role_settings" TO "authenticated";
GRANT SELECT ON public."tenant_role_settings" TO "authenticated";
GRANT UPDATE ON public."tenant_role_settings" TO "authenticated";
GRANT DELETE ON public."tenant_role_settings" TO "authenticated";
GRANT INSERT ON public."tenant_role_settings" TO "service_role";
GRANT SELECT ON public."tenant_role_settings" TO "service_role";
GRANT UPDATE ON public."tenant_role_settings" TO "service_role";
GRANT DELETE ON public."tenant_role_settings" TO "service_role";
GRANT INSERT ON public."vertical_templates" TO "authenticated";
GRANT SELECT ON public."vertical_templates" TO "authenticated";
GRANT UPDATE ON public."vertical_templates" TO "authenticated";
GRANT DELETE ON public."vertical_templates" TO "authenticated";
GRANT INSERT ON public."vertical_templates" TO "service_role";
GRANT SELECT ON public."vertical_templates" TO "service_role";
GRANT UPDATE ON public."vertical_templates" TO "service_role";
GRANT DELETE ON public."vertical_templates" TO "service_role";
GRANT INSERT ON public."help_content" TO "authenticated";
GRANT SELECT ON public."help_content" TO "authenticated";
GRANT UPDATE ON public."help_content" TO "authenticated";
GRANT DELETE ON public."help_content" TO "authenticated";
GRANT INSERT ON public."help_content" TO "service_role";
GRANT SELECT ON public."help_content" TO "service_role";
GRANT UPDATE ON public."help_content" TO "service_role";
GRANT DELETE ON public."help_content" TO "service_role";
GRANT INSERT ON public."verticals" TO "authenticated";
GRANT SELECT ON public."verticals" TO "authenticated";
GRANT UPDATE ON public."verticals" TO "authenticated";
GRANT DELETE ON public."verticals" TO "authenticated";
GRANT INSERT ON public."verticals" TO "service_role";
GRANT SELECT ON public."verticals" TO "service_role";
GRANT UPDATE ON public."verticals" TO "service_role";
GRANT DELETE ON public."verticals" TO "service_role";
GRANT INSERT ON public."ical_subscriptions" TO "authenticated";
GRANT SELECT ON public."ical_subscriptions" TO "authenticated";
GRANT UPDATE ON public."ical_subscriptions" TO "authenticated";
GRANT DELETE ON public."ical_subscriptions" TO "authenticated";
GRANT INSERT ON public."ical_subscriptions" TO "service_role";
GRANT SELECT ON public."ical_subscriptions" TO "service_role";
GRANT UPDATE ON public."ical_subscriptions" TO "service_role";
GRANT DELETE ON public."ical_subscriptions" TO "service_role";
GRANT INSERT ON public."calendar_events" TO "authenticated";
GRANT SELECT ON public."calendar_events" TO "authenticated";
GRANT UPDATE ON public."calendar_events" TO "authenticated";
GRANT DELETE ON public."calendar_events" TO "authenticated";
GRANT INSERT ON public."calendar_events" TO "service_role";
GRANT SELECT ON public."calendar_events" TO "service_role";
GRANT UPDATE ON public."calendar_events" TO "service_role";
GRANT DELETE ON public."calendar_events" TO "service_role";
GRANT INSERT ON public."documents" TO "authenticated";
GRANT SELECT ON public."documents" TO "authenticated";
GRANT UPDATE ON public."documents" TO "authenticated";
GRANT DELETE ON public."documents" TO "authenticated";
GRANT INSERT ON public."documents" TO "service_role";
GRANT SELECT ON public."documents" TO "service_role";
GRANT UPDATE ON public."documents" TO "service_role";
GRANT DELETE ON public."documents" TO "service_role";
GRANT INSERT ON public."square_employee_mappings" TO "authenticated";
GRANT SELECT ON public."square_employee_mappings" TO "authenticated";
GRANT UPDATE ON public."square_employee_mappings" TO "authenticated";
GRANT DELETE ON public."square_employee_mappings" TO "authenticated";
GRANT INSERT ON public."square_employee_mappings" TO "service_role";
GRANT SELECT ON public."square_employee_mappings" TO "service_role";
GRANT UPDATE ON public."square_employee_mappings" TO "service_role";
GRANT DELETE ON public."square_employee_mappings" TO "service_role";
GRANT INSERT ON public."document_categories" TO "authenticated";
GRANT SELECT ON public."document_categories" TO "authenticated";
GRANT UPDATE ON public."document_categories" TO "authenticated";
GRANT DELETE ON public."document_categories" TO "authenticated";
GRANT INSERT ON public."document_categories" TO "service_role";
GRANT SELECT ON public."document_categories" TO "service_role";
GRANT UPDATE ON public."document_categories" TO "service_role";
GRANT DELETE ON public."document_categories" TO "service_role";
GRANT INSERT ON public."document_acknowledgments" TO "authenticated";
GRANT SELECT ON public."document_acknowledgments" TO "authenticated";
GRANT UPDATE ON public."document_acknowledgments" TO "authenticated";
GRANT DELETE ON public."document_acknowledgments" TO "authenticated";
GRANT INSERT ON public."document_acknowledgments" TO "service_role";
GRANT SELECT ON public."document_acknowledgments" TO "service_role";
GRANT UPDATE ON public."document_acknowledgments" TO "service_role";
GRANT DELETE ON public."document_acknowledgments" TO "service_role";
GRANT INSERT ON public."resellers" TO "authenticated";
GRANT SELECT ON public."resellers" TO "authenticated";
GRANT UPDATE ON public."resellers" TO "authenticated";
GRANT DELETE ON public."resellers" TO "authenticated";
GRANT INSERT ON public."resellers" TO "service_role";
GRANT SELECT ON public."resellers" TO "service_role";
GRANT UPDATE ON public."resellers" TO "service_role";
GRANT DELETE ON public."resellers" TO "service_role";
GRANT INSERT ON public."reseller_volume_tiers" TO "authenticated";
GRANT SELECT ON public."reseller_volume_tiers" TO "authenticated";
GRANT UPDATE ON public."reseller_volume_tiers" TO "authenticated";
GRANT DELETE ON public."reseller_volume_tiers" TO "authenticated";
GRANT INSERT ON public."reseller_volume_tiers" TO "service_role";
GRANT SELECT ON public."reseller_volume_tiers" TO "service_role";
GRANT UPDATE ON public."reseller_volume_tiers" TO "service_role";
GRANT DELETE ON public."reseller_volume_tiers" TO "service_role";
GRANT INSERT ON public."conversations" TO "authenticated";
GRANT SELECT ON public."conversations" TO "authenticated";
GRANT UPDATE ON public."conversations" TO "authenticated";
GRANT DELETE ON public."conversations" TO "authenticated";
GRANT INSERT ON public."conversations" TO "service_role";
GRANT SELECT ON public."conversations" TO "service_role";
GRANT UPDATE ON public."conversations" TO "service_role";
GRANT DELETE ON public."conversations" TO "service_role";
GRANT INSERT ON public."conversation_participants" TO "authenticated";
GRANT SELECT ON public."conversation_participants" TO "authenticated";
GRANT UPDATE ON public."conversation_participants" TO "authenticated";
GRANT DELETE ON public."conversation_participants" TO "authenticated";
GRANT INSERT ON public."conversation_participants" TO "service_role";
GRANT SELECT ON public."conversation_participants" TO "service_role";
GRANT UPDATE ON public."conversation_participants" TO "service_role";
GRANT DELETE ON public."conversation_participants" TO "service_role";
GRANT INSERT ON public."messages" TO "authenticated";
GRANT SELECT ON public."messages" TO "authenticated";
GRANT UPDATE ON public."messages" TO "authenticated";
GRANT DELETE ON public."messages" TO "authenticated";
GRANT INSERT ON public."messages" TO "service_role";
GRANT SELECT ON public."messages" TO "service_role";
GRANT UPDATE ON public."messages" TO "service_role";
GRANT DELETE ON public."messages" TO "service_role";
GRANT INSERT ON public."time_off_accrual_log" TO "authenticated";
GRANT SELECT ON public."time_off_accrual_log" TO "authenticated";
GRANT UPDATE ON public."time_off_accrual_log" TO "authenticated";
GRANT DELETE ON public."time_off_accrual_log" TO "authenticated";
GRANT INSERT ON public."time_off_accrual_log" TO "service_role";
GRANT SELECT ON public."time_off_accrual_log" TO "service_role";
GRANT UPDATE ON public."time_off_accrual_log" TO "service_role";
GRANT DELETE ON public."time_off_accrual_log" TO "service_role";
GRANT INSERT ON public."time_off_policies" TO "authenticated";
GRANT SELECT ON public."time_off_policies" TO "authenticated";
GRANT UPDATE ON public."time_off_policies" TO "authenticated";
GRANT DELETE ON public."time_off_policies" TO "authenticated";
GRANT INSERT ON public."time_off_policies" TO "service_role";
GRANT SELECT ON public."time_off_policies" TO "service_role";
GRANT UPDATE ON public."time_off_policies" TO "service_role";
GRANT DELETE ON public."time_off_policies" TO "service_role";
GRANT INSERT ON public."time_off_balances" TO "authenticated";
GRANT SELECT ON public."time_off_balances" TO "authenticated";
GRANT UPDATE ON public."time_off_balances" TO "authenticated";
GRANT DELETE ON public."time_off_balances" TO "authenticated";
GRANT INSERT ON public."time_off_balances" TO "service_role";
GRANT SELECT ON public."time_off_balances" TO "service_role";
GRANT UPDATE ON public."time_off_balances" TO "service_role";
GRANT DELETE ON public."time_off_balances" TO "service_role";
GRANT INSERT ON public."budget_chart_of_accounts" TO "authenticated";
GRANT SELECT ON public."budget_chart_of_accounts" TO "authenticated";
GRANT UPDATE ON public."budget_chart_of_accounts" TO "authenticated";
GRANT DELETE ON public."budget_chart_of_accounts" TO "authenticated";
GRANT INSERT ON public."budget_chart_of_accounts" TO "service_role";
GRANT SELECT ON public."budget_chart_of_accounts" TO "service_role";
GRANT UPDATE ON public."budget_chart_of_accounts" TO "service_role";
GRANT DELETE ON public."budget_chart_of_accounts" TO "service_role";
GRANT INSERT ON public."budget_fiscal_years" TO "authenticated";
GRANT SELECT ON public."budget_fiscal_years" TO "authenticated";
GRANT UPDATE ON public."budget_fiscal_years" TO "authenticated";
GRANT DELETE ON public."budget_fiscal_years" TO "authenticated";
GRANT INSERT ON public."budget_fiscal_years" TO "service_role";
GRANT SELECT ON public."budget_fiscal_years" TO "service_role";
GRANT UPDATE ON public."budget_fiscal_years" TO "service_role";
GRANT DELETE ON public."budget_fiscal_years" TO "service_role";
GRANT INSERT ON public."budget_import_logs" TO "authenticated";
GRANT SELECT ON public."budget_import_logs" TO "authenticated";
GRANT UPDATE ON public."budget_import_logs" TO "authenticated";
GRANT DELETE ON public."budget_import_logs" TO "authenticated";
GRANT INSERT ON public."budget_import_logs" TO "service_role";
GRANT SELECT ON public."budget_import_logs" TO "service_role";
GRANT UPDATE ON public."budget_import_logs" TO "service_role";
GRANT DELETE ON public."budget_import_logs" TO "service_role";
GRANT INSERT ON public."employee_unavailability" TO "authenticated";
GRANT SELECT ON public."employee_unavailability" TO "authenticated";
GRANT UPDATE ON public."employee_unavailability" TO "authenticated";
GRANT DELETE ON public."employee_unavailability" TO "authenticated";
GRANT INSERT ON public."employee_unavailability" TO "service_role";
GRANT SELECT ON public."employee_unavailability" TO "service_role";
GRANT UPDATE ON public."employee_unavailability" TO "service_role";
GRANT DELETE ON public."employee_unavailability" TO "service_role";
GRANT INSERT ON public."budget_line_items" TO "authenticated";
GRANT SELECT ON public."budget_line_items" TO "authenticated";
GRANT UPDATE ON public."budget_line_items" TO "authenticated";
GRANT DELETE ON public."budget_line_items" TO "authenticated";
GRANT INSERT ON public."budget_line_items" TO "service_role";
GRANT SELECT ON public."budget_line_items" TO "service_role";
GRANT UPDATE ON public."budget_line_items" TO "service_role";
GRANT DELETE ON public."budget_line_items" TO "service_role";
GRANT INSERT ON public."connecteam_settings" TO "authenticated";
GRANT SELECT ON public."connecteam_settings" TO "authenticated";
GRANT UPDATE ON public."connecteam_settings" TO "authenticated";
GRANT DELETE ON public."connecteam_settings" TO "authenticated";
GRANT INSERT ON public."connecteam_settings" TO "service_role";
GRANT SELECT ON public."connecteam_settings" TO "service_role";
GRANT UPDATE ON public."connecteam_settings" TO "service_role";
GRANT DELETE ON public."connecteam_settings" TO "service_role";
GRANT INSERT ON public."budget_forecast_scenarios" TO "authenticated";
GRANT SELECT ON public."budget_forecast_scenarios" TO "authenticated";
GRANT UPDATE ON public."budget_forecast_scenarios" TO "authenticated";
GRANT DELETE ON public."budget_forecast_scenarios" TO "authenticated";
GRANT INSERT ON public."budget_forecast_scenarios" TO "service_role";
GRANT SELECT ON public."budget_forecast_scenarios" TO "service_role";
GRANT UPDATE ON public."budget_forecast_scenarios" TO "service_role";
GRANT DELETE ON public."budget_forecast_scenarios" TO "service_role";
GRANT INSERT ON public."budget_seasonal_patterns" TO "authenticated";
GRANT SELECT ON public."budget_seasonal_patterns" TO "authenticated";
GRANT UPDATE ON public."budget_seasonal_patterns" TO "authenticated";
GRANT DELETE ON public."budget_seasonal_patterns" TO "authenticated";
GRANT INSERT ON public."budget_seasonal_patterns" TO "service_role";
GRANT SELECT ON public."budget_seasonal_patterns" TO "service_role";
GRANT UPDATE ON public."budget_seasonal_patterns" TO "service_role";
GRANT DELETE ON public."budget_seasonal_patterns" TO "service_role";
GRANT INSERT ON public."budget_forecast_line_items" TO "authenticated";
GRANT SELECT ON public."budget_forecast_line_items" TO "authenticated";
GRANT UPDATE ON public."budget_forecast_line_items" TO "authenticated";
GRANT DELETE ON public."budget_forecast_line_items" TO "authenticated";
GRANT INSERT ON public."budget_forecast_line_items" TO "service_role";
GRANT SELECT ON public."budget_forecast_line_items" TO "service_role";
GRANT UPDATE ON public."budget_forecast_line_items" TO "service_role";
GRANT DELETE ON public."budget_forecast_line_items" TO "service_role";
GRANT INSERT ON public."budget_forecast_drivers" TO "authenticated";
GRANT SELECT ON public."budget_forecast_drivers" TO "authenticated";
GRANT UPDATE ON public."budget_forecast_drivers" TO "authenticated";
GRANT DELETE ON public."budget_forecast_drivers" TO "authenticated";
GRANT INSERT ON public."budget_forecast_drivers" TO "service_role";
GRANT SELECT ON public."budget_forecast_drivers" TO "service_role";
GRANT UPDATE ON public."budget_forecast_drivers" TO "service_role";
GRANT DELETE ON public."budget_forecast_drivers" TO "service_role";
GRANT INSERT ON public."training_attendance" TO "authenticated";
GRANT SELECT ON public."training_attendance" TO "authenticated";
GRANT UPDATE ON public."training_attendance" TO "authenticated";
GRANT DELETE ON public."training_attendance" TO "authenticated";
GRANT INSERT ON public."training_attendance" TO "service_role";
GRANT SELECT ON public."training_attendance" TO "service_role";
GRANT UPDATE ON public."training_attendance" TO "service_role";
GRANT DELETE ON public."training_attendance" TO "service_role";
GRANT INSERT ON public."employee_certifications" TO "authenticated";
GRANT SELECT ON public."employee_certifications" TO "authenticated";
GRANT UPDATE ON public."employee_certifications" TO "authenticated";
GRANT DELETE ON public."employee_certifications" TO "authenticated";
GRANT INSERT ON public."employee_certifications" TO "service_role";
GRANT SELECT ON public."employee_certifications" TO "service_role";
GRANT UPDATE ON public."employee_certifications" TO "service_role";
GRANT DELETE ON public."employee_certifications" TO "service_role";
GRANT INSERT ON public."connecteam_employee_mappings" TO "authenticated";
GRANT SELECT ON public."connecteam_employee_mappings" TO "authenticated";
GRANT UPDATE ON public."connecteam_employee_mappings" TO "authenticated";
GRANT DELETE ON public."connecteam_employee_mappings" TO "authenticated";
GRANT INSERT ON public."connecteam_employee_mappings" TO "service_role";
GRANT SELECT ON public."connecteam_employee_mappings" TO "service_role";
GRANT UPDATE ON public."connecteam_employee_mappings" TO "service_role";
GRANT DELETE ON public."connecteam_employee_mappings" TO "service_role";
GRANT INSERT ON public."training_classes" TO "authenticated";
GRANT SELECT ON public."training_classes" TO "authenticated";
GRANT UPDATE ON public."training_classes" TO "authenticated";
GRANT DELETE ON public."training_classes" TO "authenticated";
GRANT INSERT ON public."training_classes" TO "service_role";
GRANT SELECT ON public."training_classes" TO "service_role";
GRANT UPDATE ON public."training_classes" TO "service_role";
GRANT DELETE ON public."training_classes" TO "service_role";
GRANT INSERT ON public."certification_types" TO "authenticated";
GRANT SELECT ON public."certification_types" TO "authenticated";
GRANT UPDATE ON public."certification_types" TO "authenticated";
GRANT DELETE ON public."certification_types" TO "authenticated";
GRANT INSERT ON public."certification_types" TO "service_role";
GRANT SELECT ON public."certification_types" TO "service_role";
GRANT UPDATE ON public."certification_types" TO "service_role";
GRANT DELETE ON public."certification_types" TO "service_role";
GRANT INSERT ON public."time_clock_audit_events" TO "authenticated";
GRANT SELECT ON public."time_clock_audit_events" TO "authenticated";
GRANT UPDATE ON public."time_clock_audit_events" TO "authenticated";
GRANT DELETE ON public."time_clock_audit_events" TO "authenticated";
GRANT INSERT ON public."time_clock_audit_events" TO "service_role";
GRANT SELECT ON public."time_clock_audit_events" TO "service_role";
GRANT UPDATE ON public."time_clock_audit_events" TO "service_role";
GRANT DELETE ON public."time_clock_audit_events" TO "service_role";
GRANT SELECT ON public."timesheet_approvals" TO "authenticated";
GRANT INSERT ON public."timesheet_approvals" TO "service_role";
GRANT SELECT ON public."timesheet_approvals" TO "service_role";
GRANT UPDATE ON public."timesheet_approvals" TO "service_role";
GRANT DELETE ON public."timesheet_approvals" TO "service_role";
GRANT INSERT ON public."timesheet_approval_history" TO "authenticated";
GRANT SELECT ON public."timesheet_approval_history" TO "authenticated";
GRANT UPDATE ON public."timesheet_approval_history" TO "authenticated";
GRANT DELETE ON public."timesheet_approval_history" TO "authenticated";
GRANT INSERT ON public."timesheet_approval_history" TO "service_role";
GRANT SELECT ON public."timesheet_approval_history" TO "service_role";
GRANT UPDATE ON public."timesheet_approval_history" TO "service_role";
GRANT DELETE ON public."timesheet_approval_history" TO "service_role";
GRANT INSERT ON public."staff_identity_history" TO "authenticated";
GRANT SELECT ON public."staff_identity_history" TO "authenticated";
GRANT UPDATE ON public."staff_identity_history" TO "authenticated";
GRANT DELETE ON public."staff_identity_history" TO "authenticated";
GRANT INSERT ON public."staff_identity_history" TO "service_role";
GRANT SELECT ON public."staff_identity_history" TO "service_role";
GRANT UPDATE ON public."staff_identity_history" TO "service_role";
GRANT DELETE ON public."staff_identity_history" TO "service_role";
GRANT SELECT ON public."tip_payout_approval_history" TO "authenticated";
GRANT INSERT ON public."tip_payout_approval_history" TO "service_role";
GRANT SELECT ON public."tip_payout_approval_history" TO "service_role";
GRANT UPDATE ON public."tip_payout_approval_history" TO "service_role";
GRANT DELETE ON public."tip_payout_approval_history" TO "service_role";
GRANT SELECT ON public."tip_payout_approvals" TO "authenticated";
GRANT INSERT ON public."tip_payout_approvals" TO "service_role";
GRANT SELECT ON public."tip_payout_approvals" TO "service_role";
GRANT UPDATE ON public."tip_payout_approvals" TO "service_role";
GRANT DELETE ON public."tip_payout_approvals" TO "service_role";
GRANT INSERT ON public."user_pay_rates" TO "authenticated";
GRANT SELECT ON public."user_pay_rates" TO "authenticated";
GRANT UPDATE ON public."user_pay_rates" TO "authenticated";
GRANT DELETE ON public."user_pay_rates" TO "authenticated";
GRANT INSERT ON public."user_pay_rates" TO "service_role";
GRANT SELECT ON public."user_pay_rates" TO "service_role";
GRANT UPDATE ON public."user_pay_rates" TO "service_role";
GRANT DELETE ON public."user_pay_rates" TO "service_role";
GRANT INSERT ON public."tenants" TO "authenticated";
GRANT SELECT ON public."tenants" TO "authenticated";
GRANT UPDATE ON public."tenants" TO "authenticated";
GRANT DELETE ON public."tenants" TO "authenticated";
GRANT INSERT ON public."tenants" TO "service_role";
GRANT SELECT ON public."tenants" TO "service_role";
GRANT UPDATE ON public."tenants" TO "service_role";
GRANT DELETE ON public."tenants" TO "service_role";
GRANT INSERT ON public."compliance_workflow_links" TO "authenticated";
GRANT SELECT ON public."compliance_workflow_links" TO "authenticated";
GRANT UPDATE ON public."compliance_workflow_links" TO "authenticated";
GRANT DELETE ON public."compliance_workflow_links" TO "authenticated";
GRANT INSERT ON public."compliance_workflow_links" TO "service_role";
GRANT SELECT ON public."compliance_workflow_links" TO "service_role";
GRANT UPDATE ON public."compliance_workflow_links" TO "service_role";
GRANT DELETE ON public."compliance_workflow_links" TO "service_role";
GRANT INSERT ON public."compliance_workflow_receipts" TO "authenticated";
GRANT SELECT ON public."compliance_workflow_receipts" TO "authenticated";
GRANT UPDATE ON public."compliance_workflow_receipts" TO "authenticated";
GRANT DELETE ON public."compliance_workflow_receipts" TO "authenticated";
GRANT INSERT ON public."compliance_workflow_receipts" TO "service_role";
GRANT SELECT ON public."compliance_workflow_receipts" TO "service_role";
GRANT UPDATE ON public."compliance_workflow_receipts" TO "service_role";
GRANT DELETE ON public."compliance_workflow_receipts" TO "service_role";
GRANT SELECT ON public."audit_logs" TO "authenticated";
GRANT INSERT ON public."audit_logs" TO "service_role";
GRANT SELECT ON public."audit_logs" TO "service_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
NOTIFY pgrst, 'reload schema';
