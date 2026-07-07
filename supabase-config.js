// Leads Imóveis CRM · Supabase Fase 2
// Esta chave é pública/publishable. Nunca coloque service_role ou senha do banco no frontend.
window.LEADS_SUPABASE_URL = 'https://zyfbgydbwsvbaogbxzrd.supabase.co';
window.LEADS_SUPABASE_KEY = 'sb_publishable_AP670pbIpkD_KleT7VaQ3Q_BTsBh8yh';

if (!window.supabase) {
  console.error('Biblioteca Supabase não carregou. Verifique sua conexão ou o CDN no index.html/login.html.');
} else {
  window.supabaseClient = window.supabase.createClient(
    window.LEADS_SUPABASE_URL,
    window.LEADS_SUPABASE_KEY
  );
}
