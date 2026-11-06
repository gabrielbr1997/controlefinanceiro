-- Fluxo Pessoal: tabela de dados por usuário, com acesso restrito ao dono da linha.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb
             check (octet_length(data::text) < 2000000),
  updated_at timestamptz not null default now()
);

-- Segurança em nível de linha: sem estas regras, qualquer pessoa com a chave pública leria tudo.
alter table public.user_data enable row level security;

drop policy if exists user_data_select_own on public.user_data;
drop policy if exists user_data_insert_own on public.user_data;
drop policy if exists user_data_update_own on public.user_data;
drop policy if exists user_data_delete_own on public.user_data;

create policy user_data_select_own on public.user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_data_insert_own on public.user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_data_update_own on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_data_delete_own on public.user_data
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Visitantes sem login não têm nenhum acesso à tabela.
revoke all on public.user_data from anon;

-- Atualiza a data de modificação a cada alteração.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_updated_at on public.user_data;
create trigger user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- Permite que a própria pessoa exclua a conta de acesso. Os dados dela somem junto (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Telegram: vínculo entre a conta e o chat do bot.
-- A pessoa só consegue gerar o código; quem grava o chat_id é o servidor do bot (chave de serviço).
create table if not exists public.telegram_links (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  code            text unique,
  code_expires_at timestamptz,
  chat_id         bigint unique,
  linked_at       timestamptz
);

alter table public.telegram_links enable row level security;

drop policy if exists tg_select_own on public.telegram_links;
drop policy if exists tg_insert_own on public.telegram_links;
drop policy if exists tg_update_own on public.telegram_links;
drop policy if exists tg_delete_own on public.telegram_links;

create policy tg_select_own on public.telegram_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tg_insert_own on public.telegram_links
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tg_update_own on public.telegram_links
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tg_delete_own on public.telegram_links
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.telegram_links from anon, authenticated;
grant select, delete on public.telegram_links to authenticated;
grant insert (user_id, code, code_expires_at) on public.telegram_links to authenticated;
grant update (user_id, code, code_expires_at) on public.telegram_links to authenticated;
