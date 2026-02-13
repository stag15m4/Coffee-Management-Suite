-- =====================================================
-- FIX: PIZZERIA VERTICAL THEME COLORS
-- The original seed used cream/yellow tones that looked
-- washed out with red primary. Updated to clean white
-- background with light-red accent for better contrast.
-- Also darkened secondary for readability.
-- =====================================================

UPDATE verticals
SET theme = jsonb_set(
    jsonb_set(
        jsonb_set(
            theme,
            '{backgroundColor}', '"#FFFFFF"'
        ),
        '{accentColor}', '"#FFEBEE"'
    ),
    '{secondaryColor}', '"#2E3A2C"'
)
WHERE slug = 'pizzeria';
