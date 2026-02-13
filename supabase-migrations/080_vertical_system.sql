-- =====================================================
-- VERTICAL CONFIGURATION SYSTEM
-- Transforms the platform from single-vertical (coffee)
-- into a multi-vertical SaaS (coffee, pizza, pastry, etc.)
-- Each vertical defines its own terms, theme, workflows,
-- and starter templates that drive the entire UI.
-- =====================================================

-- =====================================================
-- 1. VERTICALS TABLE
-- Core configuration for each business vertical
-- =====================================================
CREATE TABLE IF NOT EXISTS verticals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,                          -- URL-friendly key: 'coffee-shop', 'pizzeria'
    product_name TEXT NOT NULL,                         -- Branded name: 'CoffeeSuite', 'PizzaSuite'
    display_name TEXT NOT NULL,                         -- Human label: 'Coffee Shop', 'Pizzeria'
    is_published BOOLEAN DEFAULT false,                 -- Visible on public landing pages
    is_system BOOLEAN DEFAULT true,                     -- true = platform-defined, false = reseller-created
    theme JSONB NOT NULL DEFAULT '{}',                  -- { primaryColor, secondaryColor, accentColor, backgroundColor, logoUrl, iconEmoji, loadingText }
    terms JSONB NOT NULL DEFAULT '{}',                  -- { recipe: { singular, plural }, ingredient: { singular, plural }, ... }
    workflows JSONB NOT NULL DEFAULT '{}',              -- Feature flags: { sizeVariants, batchScaling, locationTracking, ... }
    suggested_modules TEXT[] DEFAULT ARRAY[]::TEXT[],    -- Module IDs recommended for this vertical
    landing_content JSONB NOT NULL DEFAULT '{}',        -- { headline, subheadline, heroImage, ctaText }
    domains TEXT[] DEFAULT ARRAY[]::TEXT[],              -- Custom domains for domain-based routing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. VERTICAL TEMPLATES TABLE
-- Starter data templates seeded when a tenant onboards
-- =====================================================
CREATE TABLE IF NOT EXISTS vertical_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
    template_type TEXT NOT NULL,                        -- 'ingredient', 'recipe', 'equipment', 'category'
    name TEXT NOT NULL,                                 -- Display name of the template item
    data JSONB NOT NULL,                                -- Type-specific payload (cost, ingredients, maintenance, etc.)
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. ADD VERTICAL_ID TO TENANTS
-- Links each tenant to its vertical configuration
-- =====================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES verticals(id);

-- =====================================================
-- 4. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants(vertical_id);
CREATE INDEX IF NOT EXISTS idx_vertical_templates_vertical_type ON vertical_templates(vertical_id, template_type);
CREATE INDEX IF NOT EXISTS idx_verticals_slug ON verticals(slug);
CREATE INDEX IF NOT EXISTS idx_verticals_published ON verticals(is_published) WHERE is_published = true;

-- =====================================================
-- 5. ROW LEVEL SECURITY — VERTICALS
-- =====================================================
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;

-- Published verticals are readable by everyone (public landing pages)
CREATE POLICY "Anyone can view published verticals" ON verticals
    FOR SELECT USING (is_published = true);

-- Authenticated users can view all verticals (vertical picker during onboarding)
CREATE POLICY "Authenticated users can view all verticals" ON verticals
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Platform admins can manage all verticals
CREATE POLICY "Platform admins can insert verticals" ON verticals
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can update verticals" ON verticals
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can delete verticals" ON verticals
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- 6. ROW LEVEL SECURITY — VERTICAL TEMPLATES
-- =====================================================
ALTER TABLE vertical_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read templates (needed during onboarding seed)
CREATE POLICY "Authenticated users can view templates" ON vertical_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can insert templates" ON vertical_templates
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can update templates" ON vertical_templates
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can delete templates" ON vertical_templates
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- SUCCESS
-- =====================================================
-- Vertical system schema created:
--
-- Tables:
--   verticals            — one row per business vertical
--   vertical_templates   — starter ingredients, recipes, equipment per vertical
--
-- Tenants now have:
--   vertical_id          — FK to the vertical they belong to
--
-- RLS:
--   Published verticals readable by anyone (landing pages)
--   All verticals readable by authenticated users (onboarding)
--   Templates readable by authenticated users
--   Platform admins have full CRUD on both tables
