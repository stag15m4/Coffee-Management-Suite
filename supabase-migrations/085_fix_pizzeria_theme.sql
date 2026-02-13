-- =====================================================
-- FIX: VERTICAL THEME BACKGROUNDS
-- Switch all verticals from cream (#FFFDF7) to clean
-- white (#FFFFFF). Also fix pizzeria accent/secondary.
-- =====================================================

-- All verticals: cream background → white
UPDATE verticals
SET theme = jsonb_set(theme, '{backgroundColor}', '"#FFFFFF"')
WHERE theme->>'backgroundColor' = '#FFFDF7';

-- Pizzeria: fix accent and secondary for better contrast
UPDATE verticals
SET theme = jsonb_set(
    jsonb_set(
        theme,
        '{accentColor}', '"#FFEBEE"'
    ),
    '{secondaryColor}', '"#2E3A2C"'
)
WHERE slug = 'pizzeria';
