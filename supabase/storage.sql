-- Taskforge Phase 4 supplement: enable image attachments via Supabase Storage.
-- Run this file in Supabase Dashboard > SQL Editor.

-- Create the bucket (public read for MVP; tighten with RLS as needed).
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to this bucket.
drop policy if exists "taskforge upload attachments" on storage.objects;
create policy "taskforge upload attachments"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'task-attachments');

-- Allow authenticated users to update their own uploads.
drop policy if exists "taskforge update attachments" on storage.objects;
create policy "taskforge update attachments"
    on storage.objects for update to authenticated
    using (bucket_id = 'task-attachments' and owner = auth.uid());

-- Public read (bucket is public but keep an explicit policy for clarity).
drop policy if exists "taskforge read attachments" on storage.objects;
create policy "taskforge read attachments"
    on storage.objects for select using (bucket_id = 'task-attachments');

-- Allow users to remove their own uploads.
drop policy if exists "taskforge delete attachments" on storage.objects;
create policy "taskforge delete attachments"
    on storage.objects for delete to authenticated
    using (bucket_id = 'task-attachments' and owner = auth.uid());
