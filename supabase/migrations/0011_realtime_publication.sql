-- Realtime only broadcasts changes for tables in this publication; without it
-- postgres_changes subscriptions succeed but never receive an event.
-- Replica identity stays at its default: the app listens to INSERT and UPDATE
-- only (deletes are soft, i.e. UPDATEs), so old-row data isn't needed.
alter publication supabase_realtime add table public.todo_items, public.shopping_items;
