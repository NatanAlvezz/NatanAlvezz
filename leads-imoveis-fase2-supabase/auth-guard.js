// Protege o CRM: só entra quem estiver logado no Supabase Auth.
(async function protectCRM(){
  const client = window.supabaseClient;
  if (!client) return;

  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'login.html') return;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error('Erro ao verificar sessão:', error);
    location.href = 'login.html';
    return;
  }

  if (!data.session) {
    location.href = 'login.html';
  }
})();
