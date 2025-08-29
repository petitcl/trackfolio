DO $$
BEGIN
--   Test users to wipe data for 
  CREATE TEMP TABLE target_users(user_id uuid);
  INSERT INTO target_users(user_id) VALUES
    ('47604fcf-9912-4a59-90ef-9502e98a243d'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1');

  DELETE FROM transactions t
  USING target_users u
  WHERE t.user_id = u.user_id;

  DELETE FROM user_symbol_prices p
  USING target_users u
  WHERE p.user_id = u.user_id;

  DELETE FROM portfolio_snapshots s
  USING target_users u
  WHERE s.user_id = u.user_id;

  DELETE FROM symbols sym
  USING target_users u
  WHERE sym.created_by_user_id = u.user_id;

  DROP TABLE target_users;
END $$;