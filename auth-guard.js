// =========================================================
// LEADS IMÓVEIS CRM — AUTH GUARD PROFISSIONAL
// Só entra usuário logado, aprovado e ativo.
// =========================================================

(function () {
  "use strict";

  const LOGIN_PAGE = "login.html";

  function isLoginPage() {
    return location.pathname.toLowerCase().includes(LOGIN_PAGE);
  }

  function goLogin(reason = "") {
    if (isLoginPage()) return;

    const next = encodeURIComponent(location.pathname + location.search);
    const url = reason
      ? `${LOGIN_PAGE}?reason=${encodeURIComponent(reason)}&next=${next}`
      : `${LOGIN_PAGE}?next=${next}`;

    location.href = url;
  }

  async function waitSupabaseClient() {
    for (let i = 0; i < 40; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  async function checkAccess() {
    const client = await waitSupabaseClient();

    if (!client) {
      goLogin("supabase");
      return;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError || !sessionData?.session) {
      goLogin("login");
      return;
    }

    const user = sessionData.session.user;

    let { data: profile, error } = await client
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      await client.from("user_profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Corretor",
        role: "corretor",
        approved: false,
        active: true
      });

      await client.auth.signOut();
      goLogin("pending");
      return;
    }

    if (error) {
      console.error("Erro ao verificar perfil:", error);
      await client.auth.signOut();
      goLogin("profile");
      return;
    }

    if (!profile.active) {
      await client.auth.signOut();
      goLogin("inactive");
      return;
    }

    if (!profile.approved) {
      await client.auth.signOut();
      goLogin("pending");
      return;
    }

    window.currentUserProfile = profile;

    document.documentElement.dataset.userRole = profile.role;
  }

  if (!isLoginPage()) {
    checkAccess();
  }
})();
