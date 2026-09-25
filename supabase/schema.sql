-- Taskforge Phase 1 foundation
-- Run this file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.task_priority as enum ('no_priority', 'urgent', 'high', 'medium', 'low');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 80),
    slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_members (
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role public.workspace_role not null default 'member',
    joined_at timestamptz not null default timezone('utc', now()),
    primary key (workspace_id, user_id)
);

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 100),
    key text not null check (key ~ '^[A-Z0-9]{2,8}$'),
    description text,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (workspace_id, key)
);

create table if not exists public.statuses (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    color text not null default '#94a3b8',
    position integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    unique (project_id, name)
);

create table if not exists public.labels (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    color text not null default '#6366f1',
    created_at timestamptz not null default timezone('utc', now()),
    unique (workspace_id, name)
);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    status_id uuid references public.statuses(id) on delete set null,
    parent_id uuid references public.tasks(id) on delete set null,
    title text not null check (char_length(title) between 1 and 300),
    description jsonb not null default '{}'::jsonb,
    assignee_id uuid references auth.users(id) on delete set null,
    priority public.task_priority not null default 'no_priority',
    due_date date,
    sprint text,
    position numeric not null default 0,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_labels (
    task_id uuid not null references public.tasks(id) on delete cascade,
    label_id uuid not null references public.labels(id) on delete cascade,
    primary key (task_id, label_id)
);

create table if not exists public.task_dependencies (
    task_id uuid not null references public.tasks(id) on delete cascade,
    depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
    dependency_type text not null default 'blocks' check (dependency_type in ('blocks', 'relates_to')),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (task_id, depends_on_task_id),
    check (task_id <> depends_on_task_id)
);

create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    author_id uuid not null references auth.users(id) on delete cascade,
    parent_id uuid references public.comments(id) on delete cascade,
    body jsonb not null default '{}'::jsonb,
    edited_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attachments (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete cascade,
    comment_id uuid references public.comments(id) on delete cascade,
    uploaded_by uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    file_name text not null,
    mime_type text,
    file_size bigint,
    created_at timestamptz not null default timezone('utc', now()),
    check (task_id is not null or comment_id is not null)
);

create table if not exists public.activity_log (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    action text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists projects_workspace_idx on public.projects(workspace_id);
create index if not exists tasks_project_status_idx on public.tasks(project_id, status_id);
create index if not exists activity_workspace_created_idx on public.activity_log(workspace_id, created_at desc);

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at before update on public.workspaces for each row execute procedure public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments for each row execute procedure public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid());
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.statuses enable row level security;
alter table public.labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists workspace_read on public.workspaces;
create policy workspace_read on public.workspaces for select using (owner_id = auth.uid() or public.is_workspace_member(id));
drop policy if exists workspace_create on public.workspaces;
create policy workspace_create on public.workspaces for insert with check (owner_id = auth.uid());
drop policy if exists workspace_update on public.workspaces;
create policy workspace_update on public.workspaces for update using (owner_id = auth.uid() or public.is_workspace_admin(id));
drop policy if exists workspace_delete on public.workspaces;
create policy workspace_delete on public.workspaces for delete using (owner_id = auth.uid());

drop policy if exists member_read on public.workspace_members;
create policy member_read on public.workspace_members for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists member_create on public.workspace_members;
create policy member_create on public.workspace_members for insert with check (public.is_workspace_admin(workspace_id) or exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()));
drop policy if exists member_update on public.workspace_members;
create policy member_update on public.workspace_members for update using (public.is_workspace_admin(workspace_id));
drop policy if exists member_delete on public.workspace_members;
create policy member_delete on public.workspace_members for delete using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

drop policy if exists project_access on public.projects;
create policy project_access on public.projects for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists status_access on public.statuses;
create policy status_access on public.statuses for all using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))) with check (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists label_access on public.labels;
create policy label_access on public.labels for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists task_access on public.tasks;
create policy task_access on public.tasks for all using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))) with check (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists task_label_access on public.task_labels;
create policy task_label_access on public.task_labels for all using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id))) with check (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists dependency_access on public.task_dependencies;
create policy dependency_access on public.task_dependencies for all using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id))) with check (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists comment_access on public.comments;
create policy comment_access on public.comments for all using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id))) with check (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists attachment_access on public.attachments;
create policy attachment_access on public.attachments for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists activity_access on public.activity_log;
create policy activity_access on public.activity_log for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;