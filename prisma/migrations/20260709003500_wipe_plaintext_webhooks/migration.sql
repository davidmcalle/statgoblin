-- Webhook URLs move to encrypted-at-rest storage (AES-256-GCM, app-side).
-- Existing rows hold plaintext from before the change: clear them — GMs
-- re-paste the URL once and it lands encrypted.
UPDATE "campaigns" SET "discord_webhook_url" = '' WHERE "discord_webhook_url" <> '';
