-- RLS policies gate which *rows* a role can see/touch, but Postgres still
-- requires baseline table-level privileges before RLS is even evaluated.
-- Explicit here rather than relying on this project's default privileges.
grant usage on schema public to anon, authenticated;

grant select, insert, update on households to authenticated;
grant select, insert on household_members to authenticated;
grant select, insert on household_invites to authenticated;
grant select, insert, update, delete on todo_lists to authenticated;
grant select, insert, update, delete on todo_items to authenticated;
grant select, insert, update, delete on shopping_lists to authenticated;
grant select, insert, update, delete on shopping_items to authenticated;
