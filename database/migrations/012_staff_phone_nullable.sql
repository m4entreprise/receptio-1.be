-- Allow staff members to be created without a phone number (e.g. during onboarding or invitation)
ALTER TABLE staff ALTER COLUMN phone_number DROP NOT NULL;
