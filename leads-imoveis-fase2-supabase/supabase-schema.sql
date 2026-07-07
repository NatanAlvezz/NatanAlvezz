-- Leads Imóveis CRM · Fase 2 Supabase
-- Cole este arquivo em Supabase > SQL Editor > Run.

-- 1) Tabela principal de sincronização do CRM.
create table if not exists public.crm_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Atualiza updated_at automaticamente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_crm_state_updated_at on public.crm_state;
create trigger set_crm_state_updated_at
before update on public.crm_state
for each row execute function public.set_updated_at();

-- 2) Segurança: somente usuários autenticados acessam a base.
alter table public.crm_state enable row level security;

drop policy if exists "Equipe logada pode ler CRM" on public.crm_state;
create policy "Equipe logada pode ler CRM"
on public.crm_state for select
to authenticated
using (true);

drop policy if exists "Equipe logada pode criar CRM" on public.crm_state;
create policy "Equipe logada pode criar CRM"
on public.crm_state for insert
to authenticated
with check (true);

drop policy if exists "Equipe logada pode atualizar CRM" on public.crm_state;
create policy "Equipe logada pode atualizar CRM"
on public.crm_state for update
to authenticated
using (true)
with check (true);

-- 3) Realtime: coloca a tabela na publicação do Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.crm_state;
exception
  when duplicate_object then null;
end $$;

-- 4) Bucket para fotos dos imóveis. Público para facilitar anúncios e cards.
-- Não envie documentos pessoais/contratos para este bucket público.
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do update set public = excluded.public;

-- 5) Políticas do Storage para usuários logados.
drop policy if exists "Equipe logada pode ver fotos" on storage.objects;
create policy "Equipe logada pode ver fotos"
on storage.objects for select
to authenticated
using (bucket_id = 'property-photos');

drop policy if exists "Equipe logada pode enviar fotos" on storage.objects;
create policy "Equipe logada pode enviar fotos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'property-photos');

drop policy if exists "Equipe logada pode atualizar fotos" on storage.objects;
create policy "Equipe logada pode atualizar fotos"
on storage.objects for update
to authenticated
using (bucket_id = 'property-photos')
with check (bucket_id = 'property-photos');

drop policy if exists "Equipe logada pode apagar fotos" on storage.objects;
create policy "Equipe logada pode apagar fotos"
on storage.objects for delete
to authenticated
using (bucket_id = 'property-photos');
