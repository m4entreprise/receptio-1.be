-- Backfill staff entries for owners who were created before the auto-link was added.
-- For each owner without a staff_id who has at least a first name, create a staff
-- entry from their profile info and link it.
DO $$
DECLARE
  rec         RECORD;
  new_staff_id UUID;
BEGIN
  FOR rec IN
    SELECT u.id          AS user_id,
           COALESCE(u.first_name, '')  AS first_name,
           COALESCE(u.last_name,  '')  AS last_name,
           u.company_id,
           c.phone_number
    FROM   users     u
    JOIN   companies c ON c.id = u.company_id
    WHERE  u.role     = 'owner'
      AND  u.staff_id IS NULL
      AND  u.first_name IS NOT NULL
  LOOP
    INSERT INTO staff (company_id, first_name, last_name, phone_number)
    VALUES (rec.company_id, rec.first_name, rec.last_name, rec.phone_number)
    RETURNING id INTO new_staff_id;

    UPDATE users SET staff_id = new_staff_id WHERE id = rec.user_id;
  END LOOP;
END;
$$;
