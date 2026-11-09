-- Demo data was retired.
-- This migration is a no-op so a fresh database does not insert
-- @campulse.demo users, is_demo incidents, or demo-u2 fixtures.
-- Production already removed that data in 0007_remove_demo_data.sql.
-- The cross-university test creates its own throwaway fixtures.

select 1;
