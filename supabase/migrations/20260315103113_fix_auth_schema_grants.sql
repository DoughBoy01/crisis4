/*
  # Fix Auth Schema Grants

  ## Problem
  Supabase Auth was returning "Database error querying schema" (HTTP 500)
  on login attempts. This is caused by the supabase_auth_admin role
  lacking USAGE privilege on the public schema, which the auth service
  needs to resolve types and functions during authentication.

  ## Fix
  Grant USAGE on public schema to supabase_auth_admin and authenticator roles.
  Also ensure the pgcrypto extension functions are accessible for password hashing.
*/

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO authenticator;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticator;
