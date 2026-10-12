-- service_role (the secret key) bypasses RLS but, like any role, still needs
-- table-level privileges -- and this project's default privileges did not
-- give it any on these tables (0006 only granted to authenticated). Without
-- them every Admin-API query fails with "permission denied", which broke the
-- RLS test's fixture setup and its afterAll cleanup. service_role is only
-- ever used server-side / in test tooling, never shipped to the browser.
grant select, insert, update, delete on households to service_role;
grant select, insert, update, delete on household_members to service_role;
grant select, insert, update, delete on household_invites to service_role;
grant select, insert, update, delete on todo_lists to service_role;
grant select, insert, update, delete on todo_items to service_role;
grant select, insert, update, delete on shopping_lists to service_role;
grant select, insert, update, delete on shopping_items to service_role;
