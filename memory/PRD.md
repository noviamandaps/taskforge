# Taskforge — Phase 1 PRD

## Product
Taskforge is a dense but calm Jira/Notion-inspired task workspace for teams.

## Phase 1 shipped scope
- Supabase email/password authentication
- Automatic first workspace creation with `owner` membership
- Workspace switcher foundation with role-aware schema (`owner`, `admin`, `member`, `guest`)
- Responsive sidebar, topbar search trigger, create menu, theme toggle, and command palette shell
- Supabase Postgres schema covering workspaces, members, projects, statuses, labels, tasks, dependencies, comments, attachments, and activity log
- Row Level Security policies isolating all data by workspace

## Next phases
- Project creation and project views (Board, List, Table, Timeline)
- Task detail peek/full page and Notion-style editor
- Comments, activity, notifications, saved views, and keyboard shortcuts