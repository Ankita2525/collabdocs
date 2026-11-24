-- Demo users (fixed ids so the seed is idempotent). Demo authentication only.
insert into users (id, email, name) values
  ('11111111-1111-4111-8111-111111111111', 'alice@collabdocs.demo', 'Alice Johnson'),
  ('22222222-2222-4222-8222-222222222222', 'bob@collabdocs.demo',   'Bob Smith'),
  ('33333333-3333-4333-8333-333333333333', 'carol@collabdocs.demo', 'Carol Diaz')
on conflict (id) do nothing;
