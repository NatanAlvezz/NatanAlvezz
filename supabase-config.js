// LEADS IMÓVEIS | SUPABASE — CONFIGURAÇÃO PÚBLICA FINAL
// Esta chave é publishable e pode ser usada no navegador.
// Nunca coloque service_role ou outra chave secreta no GitHub.

window.LEADS_SUPABASE_URL = 'https://zyfbgydbwsvbaogbxzrd.supabase.co';
window.LEADS_SUPABASE_ANON_KEY = 'sb_publishable_AP670pbIpkD_KleT7VaQ3Q_BTsBh8yh';

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('Leads Imóveis: biblioteca Supabase não carregou.');
} else {
  window.leadsSupabaseClient = window.supabase.createClient(
    window.LEADS_SUPABASE_URL,
    window.LEADS_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } }
    }
  );
  window.supabaseClient = window.leadsSupabaseClient;
  console.log('Leads Imóveis: Supabase conectado.');
}
