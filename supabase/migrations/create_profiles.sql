create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  sex         text check (sex in ('male', 'female')),
  date_of_birth date,
  height_cm   numeric(5, 1),
  weight_kg   numeric(5, 1),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Row-level security
alter table profiles enable row level security;

create policy "Users can read their own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = user_id);
