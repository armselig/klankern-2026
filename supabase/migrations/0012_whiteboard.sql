-- Shared whiteboard (plan milestone 9): one board per household, and one row
-- per finished stroke. Strokes sync like list items, through postgres_changes
-- on the household channel, so RLS stays the only security boundary.

create table boards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null default 'Whiteboard',
  created_at timestamptz not null default now(),
  -- One board per household for now. Unique rather than a rule in the client,
  -- so two members opening the whiteboard for the first time at the same
  -- moment can't create two boards. Drop it when several boards are wanted.
  constraint boards_household_id_key unique (household_id),
  -- Target of the composite foreign key on board_strokes.
  constraint boards_id_household_id_key unique (id, household_id)
);

create table board_strokes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  household_id uuid not null,
  -- '#rrggbb'. The client offers a fixed palette; the format is checked here
  -- because the value ends up in an SVG attribute on every member's screen.
  color text not null,
  -- Pen width and points are in board units: the board is 4000 wide and 3000
  -- high on every screen, and each client scales it to its own size.
  width integer not null,
  -- The stroke's points as a flat array [x0, y0, x1, y1, ...].
  points jsonb not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- household_id is denormalized for RLS and the Realtime filter; the
  -- composite key keeps it equal to the board's, so a stroke can't claim one
  -- household for the policy while hanging on another household's board.
  constraint board_strokes_board_fkey foreign key (board_id, household_id)
    references boards (id, household_id) on delete cascade,
  constraint board_strokes_color_format check (color ~ '^#[0-9a-f]{6}$'),
  constraint board_strokes_width_range check (width between 1 and 200),
  -- At most 1000 points per stroke: every stroke travels whole in a Realtime
  -- payload, and RLS can't limit the size of a row a member may insert.
  constraint board_strokes_points_shape check (
    case
      when jsonb_typeof(points) = 'array' then
        jsonb_array_length(points) between 2 and 2000
        and jsonb_array_length(points) % 2 = 0
        and not jsonb_path_exists(points, '$[*] ? (@.type() != "number" || @ < 0 || @ > 4000)')
      else false
    end
  )
);

-- For the cascade from boards.
create index board_strokes_board_id_idx on board_strokes (board_id);
-- For loading a board: its live strokes, paged by id. Partial, because erased
-- strokes stay as rows (soft delete) and would otherwise be scanned too.
create index board_strokes_live_idx on board_strokes (board_id, id) where deleted_at is null;
create index board_strokes_created_by_idx on board_strokes (created_by);

alter table boards enable row level security;
alter table board_strokes enable row level security;

create policy "members rw boards" on boards
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members rw board strokes" on board_strokes
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Only what the app does: a board is created once and never changed, and a
-- stroke is drawn or soft-deleted (an UPDATE), never hard-deleted. A hard
-- delete would also be invisible to the other members, since Realtime is
-- subscribed to INSERT and UPDATE only.
revoke all on boards, board_strokes from public, anon, authenticated;
grant select, insert on boards to authenticated;
grant select, insert, update on board_strokes to authenticated;
grant select, insert, update, delete on boards, board_strokes to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.board_strokes;
