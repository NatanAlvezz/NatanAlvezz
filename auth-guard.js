// Leads Imóveis · proteção segura do CRM interno
(function () {
  "use strict";

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const publicPages = new Set(["", "index.html", "login.html"]);
  if (publicPages.has(page)) return;

  window.__LEADS_AUTH_READY__ = (async function () {
    for (let attempt = 0; attempt < 100 && !window.supabaseClient; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const client = window.supabaseClient;
    if (!client || !client.auth) {
      location.replace("login.html?reason=supabase&next=crm.html");
      return null;
    }

    try {
      const result = await client.auth.getSession();
      const session = result && result.data ? result.data.session : null;
      if (result.error || !session) {
        location.replace("login.html?reason=login&next=crm.html");
        return null;
      }

      window.__LEADS_AUTH_SESSION__ = session;
      window.__LEADS_CURRENT_USER_ID__ = session.user && session.user.id ? session.user.id : null;
      window.__LEADS_CURRENT_USER_EMAIL__ = session.user && session.user.email ? session.user.email : "";
      return session;
    } catch (error) {
      console.warn("Falha ao validar a sessão do CRM:", error);
      location.replace("login.html?reason=auth&next=crm.html");
      return null;
    }
  })();
})();
