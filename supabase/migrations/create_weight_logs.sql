create table if not exists weight_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  logged_date  date not null,
  weight_kg    numeric(5, 1) not null,
  created_at   timestamptz default now(),
  unique (user_id, logged_date)
);

alter table weight_logs enable row level security;

create policy "Users can read their own weight logs"
  on weight_logs for select using (auth.uid() = user_id);

create policy "Users can insert their own weight logs"
  on weight_logs for insert with check (auth.uid() = user_id);

create policy "Users can update their own weight logs"
  on weight_logs for update using (auth.uid() = user_id);

create policy "Users can delete their own weight logs"
  on weight_logs for delete using (auth.uid() = user_id);
