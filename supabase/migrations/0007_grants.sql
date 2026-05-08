-- Grant the application role (`app`) the privileges it needs on every table
-- + sequence + function in the public schema. Migrations are imported as
-- `postgres` (the SQL importer uses postgres), so tables are owned by
-- postgres and need explicit grants for the app role.
--
-- ALTER DEFAULT PRIVILEGES ensures future tables created by `postgres`
-- (e.g. via ad-hoc admin migrations) automatically get the same grants.

grant usage on schema public to app;

grant select, insert, update, delete on all tables in schema public to app;
grant usage, select on all sequences in schema public to app;
grant execute on all functions in schema public to app;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to app;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to app;
alter default privileges for role postgres in schema public
  grant execute on functions to app;
