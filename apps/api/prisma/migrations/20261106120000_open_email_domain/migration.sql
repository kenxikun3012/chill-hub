-- The college has no email domain, so the placeholder default no longer applies: any email can sign up.
-- Only the untouched placeholder is cleared; a domain an admin chose is kept.
UPDATE "settings"
SET "value" = '[]'::jsonb
WHERE "key" = 'allowed_email_domains' AND "value" = '["yourcollege.edu"]'::jsonb;
