create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null default 'Shopping',
  created_at timestamptz not null default now()
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  quantity text,
  checked boolean not null default false,
  position numeric not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shopping_items_list_id_idx on shopping_items (list_id);
create index shopping_items_household_id_idx on shopping_items (household_id);
