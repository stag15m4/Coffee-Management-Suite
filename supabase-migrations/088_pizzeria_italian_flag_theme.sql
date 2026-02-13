-- Update pizzeria theme to official Italian flag colors
-- Red #CD212A (primary/action), Green #006B35 (text), White #F4F9FF (accent), White #FFFFFF (background)

UPDATE verticals
SET theme = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                theme,
                '{primaryColor}', '"#CD212A"'       -- Italian flag red (buttons, active states)
            ),
            '{secondaryColor}', '"#006B35"'         -- Italian flag green, darkened for text readability
        ),
        '{accentColor}', '"#F4F9FF"'                -- Flag white with cool tint (cards, backgrounds)
    ),
    '{backgroundColor}', '"#FFFFFF"'                -- White base
)
WHERE slug = 'pizzeria';
