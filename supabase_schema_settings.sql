-- ==============================================================================
-- BKI ACADEMY - CENTRAL APP SETTINGS
-- ==============================================================================
-- Run once in the Supabase SQL editor. Stores settings that must be the same for
-- every admin (e.g. the SLA threshold) instead of per-browser localStorage.
-- Safe to re-run.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT,
    -- sla_days must be a whole number of days between 1 and 365
    -- (CASE guarantees the numeric cast only runs for that key)
    CONSTRAINT app_settings_sla_days_valid CHECK (
        CASE
            WHEN key <> 'sla_days' THEN true
            WHEN jsonb_typeof(value) <> 'number' THEN false
            ELSE (value::text)::numeric = floor((value::text)::numeric)
                 AND (value::text)::numeric BETWEEN 1 AND 365
        END
    )
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only signed-in users can read or change settings (the anon key alone cannot).
DROP POLICY IF EXISTS "Authenticated can read settings" ON app_settings;
CREATE POLICY "Authenticated can read settings"
    ON app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert settings" ON app_settings;
CREATE POLICY "Authenticated can insert settings"
    ON app_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update settings" ON app_settings;
CREATE POLICY "Authenticated can update settings"
    ON app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Default SLA threshold: 4 days
INSERT INTO app_settings (key, value) VALUES ('sla_days', '4'::jsonb)
ON CONFLICT (key) DO NOTHING;
