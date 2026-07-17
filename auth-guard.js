// Leads Imóveis · proteção segura das páginas internas do CRM
(function () {
  "use strict";

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const publicPages = new Set(["", "index.html", "login.html", "imovel.html", "404.html"]);
  if (publicPages.has(page)) return;

  const nextPath = `${location.pathname}${location.search}`;
  const redirectToLogin = (reason) => {
    const next = encodeURIComponent(nextPath.startsWith("/") ? nextPath : "/crm.html");
    location.replace(`login.html?reason=${encodeURIComponent(reason)}&next=${next}`);
  };

  window.__LEADS_AUTH_READY__ = (async function () {
    for (let attempt = 0; attempt < 120 && !window.supabaseClient; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const client = window.supabaseClient;
    if (!client?.auth) {
      redirectToLogin("supabase");
      return null;
    }

    try {
      const { data, error } = await client.auth.getSession();
      const session = data?.session || null;
      if (error || !session) {
        redirectToLogin("login");
        return null;
      }

      window.__LEADS_AUTH_SESSION__ = session;
      window.__LEADS_CURRENT_USER_ID__ = session.user?.id || null;
      window.__LEADS_CURRENT_USER_EMAIL__ = session.user?.email || "";
      return session;
    } catch (error) {
      console.warn("Falha ao validar a sessão do CRM:", error);
      redirectToLogin("auth");
      return null;
    }
  })();
})();
