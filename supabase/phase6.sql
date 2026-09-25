-- Taskforge Phase 6 supplement: task numbers, sprints, notifications, realtime.
-- Run this file in Supabase Dashboard > SQL Editor.

-------------------- 1. Task numbers (TF-1, TF-2, ...) --------------------
alter table public.tasks add column if not exists number integer;

create or replace function public.assign_task_number()
returns trigger
language plpgsql
as $$
begin
    if new.number is null then
        select coalesce(max(number), 0) + 1 into new.number
        from public.tasks where project_id = new.project_id;
    end if;
    return new;
end;
$$;

drop trigger if exists tasks_assign_number on public.tasks;
create trigger tasks_assign_number
    before insert on public.tasks
    for each row execute procedure public.assign_task_number();

-- Backfill existing tasks (project scoped ordering).
with numbered as (
    select id, row_number() over (partition by project_id order by created_at) as rn
    from public.tasks
    where number is null
)
update public.tasks t set number = n.rn from numbered n where t.id = n.id;

create unique index if not exists tasks_project_number_unique on public.tasks(project_id, number);

-------------------- 2. Sprints --------------------
create table if not exists public.sprints (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    goal text,
    start_date date,
    end_date date,
    status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
    created_at timestamptz not null default timezone('utc', now()),
    unique (project_id, name)
);

alter table public.tasks add column if not exists sprint_id uuid references public.sprints(id) on delete set null;

alter table public.sprints enable row level security;
drop policy if exists sprint_access on public.sprints;
create policy sprint_access on public.sprints for all
    using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)))
    with check (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));

grant select, insert, update, delete on public.sprints to authenticated;

-------------------- 3. Notifications --------------------
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete cascade,
    comment_id uuid references public.comments(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    type text not null,
    read boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications enable row level security;
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select using (user_id = auth.uid());
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated with check (true);
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (user_id = auth.uid());
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

-------------------- 4. Realtime publication --------------------
-- Enable table-level replication for realtime. Safe to run multiple times.
do $$ begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
        alter publication supabase_realtime add table public.tasks;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
        alter publication supabase_realtime add table public.comments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log') then
        alter publication supabase_realtime add table public.activity_log;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
        alter publication supabase_realtime add table public.notifications;
    end if;
end $$;
