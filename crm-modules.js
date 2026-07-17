/* Leads Imóveis · funções compartilhadas dos módulos internos do CRM */
(function () {
  "use strict";

  const CHANNELS = new Map();
  let toastTimer = null;

  window.$ = (selector, root = document) => root.querySelector(selector);
  window.$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  window.params = () => new URLSearchParams(window.location.search);
  window.digits = (value) => String(value ?? "").replace(/\D+/g, "");
  window.norm = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  window.esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  window.money = (value) => {
    if (value === null || value === undefined || value === "") return "Valor não informado";
    const number = Number(String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(number)) return String(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    }).format(number);
  };

  window.dateBR = (value) => {
    if (!value) return "Não informado";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(date);
  };

  window.toast = (message, type = "info") => {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = String(message || "");
    el.dataset.type = type;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
  };

  async function waitForClient(timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.supabaseClient?.auth) return window.supabaseClient;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("SUPABASE_CLIENT_UNAVAILABLE");
  }

  window.getDb = () => {
    if (!window.supabaseClient?.auth) {
      throw new Error("O Supabase ainda não foi inicializado.");
    }
    return window.supabaseClient;
  };

  function currentInternalPath() {
    const path = `${location.pathname}${location.search}`;
    return path.startsWith("/") ? path : "/crm.html";
  }

  window.requireSession = async () => {
    try {
      if (window.__LEADS_AUTH_READY__) {
        const guardedSession = await window.__LEADS_AUTH_READY__;
        if (!guardedSession) return null;
      }

      const client = await waitForClient();
      const { data, error } = await client.auth.getSession();
      const session = data?.session || null;
      if (error || !session) {
        const next = encodeURIComponent(currentInternalPath());
        location.replace(`login.html?reason=login&next=${next}`);
        return null;
      }

      // Confere a autorização sem impedir o uso quando uma política de leitura
      // de perfil estiver temporariamente indisponível.
      try {
        const { data: profile, error: profileError } = await client
          .from("user_profiles")
          .select("approved,active,role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profileError && profile && (profile.approved !== true || profile.active !== true)) {
          await client.auth.signOut();
          const next = encodeURIComponent(currentInternalPath());
          location.replace(`login.html?reason=pending&next=${next}`);
          return null;
        }
      } catch (profileCheckError) {
        console.warn("[CRM] Verificação de perfil indisponível:", profileCheckError);
      }

      return session;
    } catch (error) {
      console.error("[CRM] Falha ao validar a sessão:", error);
      const next = encodeURIComponent(currentInternalPath());
      location.replace(`login.html?reason=supabase&next=${next}`);
      return null;
    }
  };

  const NAV_ITEMS = [
    ["crm.html", "◈", "CRM completo"],
    ["crm-leads.html", "◆", "Leads"],
    ["crm-imoveis.html", "⌂", "Imóveis"],
    ["crm-captacao-especial.html", "◎", "Captação Especial"],
    ["crm-proprietarios.html", "⌖", "Proprietários"],
    ["crm.html?open=ai", "✦", "IA Consultiva"]
  ];

  window.renderNav = (activeFile = "") => {
    const nav = document.getElementById("moduleNav");
    if (!nav) return;
    const current = activeFile || (location.pathname.split("/").pop() || "crm.html");
    nav.innerHTML = NAV_ITEMS.map(([href, icon, label]) => {
      const file = href.split("?")[0];
      const active = file === current ? " active" : "";
      return `<a class="module-link${active}" href="${href}"><span aria-hidden="true">${icon}</span>${label}</a>`;
    }).join("");
  };

  window.subscribeTable = (table, callback) => {
    if (!table || typeof callback !== "function") return null;
    let client;
    try {
      client = window.getDb();
    } catch (error) {
      console.warn(`[CRM] Realtime não iniciado em ${table}:`, error);
      return null;
    }

    if (CHANNELS.has(table)) return CHANNELS.get(table);
    let timer = null;
    const safelyRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        Promise.resolve(callback()).catch((error) => {
          console.error(`[CRM] Falha ao atualizar ${table}:`, error);
        });
      }, 350);
    };

    const channel = client
      .channel(`crm-module-${table}-${crypto.randomUUID?.() || Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, safelyRefresh)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[CRM] Realtime ${table}: ${status}. A atualização periódica continuará funcionando.`);
        }
      });

    CHANNELS.set(table, channel);
    return channel;
  };

  async function internalPageExists(url) {
    try {
      const parsed = new URL(url, location.href);
      const response = await fetch(parsed.pathname, {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin"
      });
      return response.ok;
    } catch (error) {
      console.warn("[CRM] Não foi possível validar a rota:", error);
      return true; // Não bloqueia a navegação por uma falha de rede.
    }
  }

  // Proteção adicional: se um arquivo interno for removido do deploy no futuro,
  // o corretor permanece no CRM em vez de cair na página pública de erro.
  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const raw = link.getAttribute("href") || "";
    if (!/^crm(?:-[a-z0-9-]+)?\.html(?:[?#].*)?$/i.test(raw)) return;

    event.preventDefault();
    const exists = await internalPageExists(raw);
    if (exists) {
      location.href = raw;
    } else {
      toast("Este módulo ainda não foi publicado. O CRM principal continuará aberto.", "error");
      console.error(`[CRM] Rota ausente no deploy: ${raw}`);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[CRM] Erro não tratado:", event.reason);
    toast("Não foi possível concluir esta operação. Atualize a página e tente novamente.", "error");
  });

  window.addEventListener("error", (event) => {
    if (event?.target && (event.target.tagName === "SCRIPT" || event.target.tagName === "LINK")) {
      const source = event.target.src || event.target.href || "arquivo externo";
      console.error(`[CRM] Falha ao carregar ${source}`);
      toast("Um arquivo necessário não carregou. Faça Ctrl + Shift + R.", "error");
    }
  }, true);
})();
