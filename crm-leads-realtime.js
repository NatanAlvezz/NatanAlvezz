// ============================================================
// LEADS IMÓVEIS
// PAINEL DE LEADS DO SITE EM TEMPO REAL
// ============================================================

(function () {
  "use strict";

  const state = {
    supabase: null,
    user: null,
    channel: null,
    leads: [],
    open: false,
    loading: false,
    alertados: new Set(),
  };

  const SELECT_FIELDS = [
    "id",
    "name",
    "phone",
    "email",
    "intent",
    "neighborhood",
    "budget",
    "property_type",
    "bedrooms",
    "consent_to_contact",
    "status",
    "summary",
    "assigned_user_id",
    "assigned_at",
    "first_contact_at",
    "created_at",
    "updated_at",
  ].join(",");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function onlyDigits(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function formatDate(value) {
    if (!value) return "Agora";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Agora";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function leadIsAvailable(lead) {
    return (
      !lead.assigned_user_id &&
      ["new", "qualified"].includes(lead.status)
    );
  }

  function leadBelongsToMe(lead) {
    return (
      Boolean(state.user?.id) &&
      lead.assigned_user_id === state.user.id
    );
  }

  function leadShouldAlert(lead) {
    if (!leadIsAvailable(lead)) return false;

    return (
      lead.status === "qualified" ||
      (
        Boolean(lead.consent_to_contact) &&
        Boolean(lead.phone || lead.email)
      )
    );
  }

  function getStoredAlerts() {
    try {
      const stored = sessionStorage.getItem(
        "leads_site_alerts_seen"
      );

      if (!stored) return;

      const ids = JSON.parse(stored);

      if (Array.isArray(ids)) {
        state.alertados = new Set(ids);
      }
    } catch (error) {
      console.warn(
        "Não foi possível carregar alertas anteriores.",
        error
      );
    }
  }

  function saveStoredAlerts() {
    try {
      sessionStorage.setItem(
        "leads_site_alerts_seen",
        JSON.stringify([...state.alertados])
      );
    } catch (error) {
      console.warn(
        "Não foi possível salvar alertas.",
        error
      );
    }
  }

  function injectStyles() {
    if (document.getElementById("leads-realtime-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "leads-realtime-styles";

    style.textContent = `
      #leadRealtimeButton {
        position: fixed;
        right: 18px;
        top: 88px;
        z-index: 99991;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 999px;
        padding: 11px 16px;
        background: rgba(10,20,34,.94);
        color: #fff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 16px 40px rgba(0,0,0,.28);
        backdrop-filter: blur(14px);
        display: flex;
        align-items: center;
        gap: 9px;
      }

      #leadRealtimeButton:hover {
        transform: translateY(-1px);
      }

      #leadRealtimeCount {
        min-width: 23px;
        height: 23px;
        padding: 0 6px;
        border-radius: 999px;
        background: #d7aa55;
        color: #07111d;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 900;
      }

      #leadRealtimeDrawer {
        position: fixed;
        top: 138px;
        right: 18px;
        width: min(430px, calc(100vw - 28px));
        max-height: calc(100vh - 160px);
        z-index: 99992;
        background: rgba(8,18,31,.97);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 24px;
        color: #fff;
        box-shadow: 0 28px 80px rgba(0,0,0,.42);
        backdrop-filter: blur(20px);
        overflow: hidden;
        display: none;
      }

      #leadRealtimeDrawer.is-open {
        display: block;
        animation: leadDrawerIn .22s ease-out;
      }

      @keyframes leadDrawerIn {
        from {
          opacity: 0;
          transform: translateY(-8px) scale(.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .lead-realtime-header {
        padding: 18px 20px;
        border-bottom: 1px solid rgba(255,255,255,.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .lead-realtime-header h3 {
        margin: 0;
        font-size: 17px;
      }

      .lead-realtime-close {
        border: 0;
        border-radius: 12px;
        width: 36px;
        height: 36px;
        background: rgba(255,255,255,.08);
        color: #fff;
        cursor: pointer;
        font-size: 18px;
      }

      .lead-realtime-content {
        padding: 16px;
        overflow-y: auto;
        max-height: calc(100vh - 230px);
      }

      .lead-section-title {
        margin: 5px 3px 12px;
        font-size: 12px;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: rgba(255,255,255,.58);
      }

      .lead-card {
        background: rgba(255,255,255,.065);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 18px;
        padding: 15px;
        margin-bottom: 12px;
      }

      .lead-card.is-qualified {
        border-color: rgba(215,170,85,.5);
        box-shadow: inset 0 0 0 1px rgba(215,170,85,.08);
      }

      .lead-card-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .lead-name {
        font-size: 15px;
        font-weight: 800;
      }

      .lead-time {
        font-size: 11px;
        color: rgba(255,255,255,.55);
        white-space: nowrap;
      }

      .lead-summary {
        font-size: 13px;
        line-height: 1.5;
        color: rgba(255,255,255,.82);
        margin: 8px 0;
      }

      .lead-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 10px 0 13px;
      }

      .lead-tag {
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        font-size: 11px;
        color: rgba(255,255,255,.8);
      }

      .lead-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .lead-action {
        border: 0;
        border-radius: 12px;
        min-height: 40px;
        padding: 9px 13px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .lead-action-primary {
        background: #d7aa55;
        color: #07111d;
      }

      .lead-action-secondary {
        background: rgba(255,255,255,.1);
        color: #fff;
      }

      .lead-action:disabled {
        opacity: .55;
        cursor: wait;
      }

      .lead-empty {
        padding: 26px 15px;
        text-align: center;
        color: rgba(255,255,255,.58);
        font-size: 13px;
      }

      #leadRealtimeToastContainer {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 99999;
        display: grid;
        gap: 10px;
        width: min(390px, calc(100vw - 28px));
      }

      .lead-toast {
        background: rgba(8,18,31,.98);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 18px;
        padding: 15px 16px;
        color: #fff;
        box-shadow: 0 22px 60px rgba(0,0,0,.4);
        animation: leadToastIn .25s ease-out;
      }

      .lead-toast strong {
        display: block;
        margin-bottom: 5px;
      }

      .lead-toast p {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
        color: rgba(255,255,255,.78);
      }

      @keyframes leadToastIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 650px) {
        #leadRealtimeButton {
          top: auto;
          bottom: 82px;
          right: 12px;
        }

        #leadRealtimeDrawer {
          top: 12px;
          right: 12px;
          max-height: calc(100vh - 24px);
        }

        .lead-realtime-content {
          max-height: calc(100vh - 92px);
        }

        #leadRealtimeToastContainer {
          right: 12px;
          bottom: 145px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createInterface() {
    if (document.getElementById("leadRealtimeButton")) {
      return;
    }

    const button = document.createElement("button");
    button.id = "leadRealtimeButton";
    button.type = "button";
    button.innerHTML = `
      <span>🔥 Leads do site</span>
      <span id="leadRealtimeCount">0</span>
    `;

    const drawer = document.createElement("aside");
    drawer.id = "leadRealtimeDrawer";

    drawer.innerHTML = `
      <div class="lead-realtime-header">
        <div>
          <h3>Atendimentos do site</h3>
        </div>

        <button
          type="button"
          class="lead-realtime-close"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <div
        id="leadRealtimeContent"
        class="lead-realtime-content"
      >
        <div class="lead-empty">
          Carregando atendimentos...
        </div>
      </div>
    `;

    const toastContainer = document.createElement("div");
    toastContainer.id = "leadRealtimeToastContainer";

    document.body.appendChild(button);
    document.body.appendChild(drawer);
    document.body.appendChild(toastContainer);

    button.addEventListener("click", function () {
      state.open = !state.open;
      drawer.classList.toggle("is-open", state.open);

      if (state.open) {
        loadLeads();
      }
    });

    drawer
      .querySelector(".lead-realtime-close")
      .addEventListener("click", function () {
        state.open = false;
        drawer.classList.remove("is-open");
      });

    drawer.addEventListener("click", handleDrawerClick);
  }

  function showToast(title, message, duration = 6500) {
    const container = document.getElementById(
      "leadRealtimeToastContainer"
    );

    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "lead-toast";

    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    `;

    container.prepend(toast);

    window.setTimeout(function () {
      toast.remove();
    }, duration);
  }

  function createLeadCard(lead, mine) {
    const tags = [
      lead.intent,
      lead.neighborhood,
      lead.budget,
      lead.property_type,
      lead.bedrooms
        ? `${lead.bedrooms} quarto(s)`
        : null,
    ].filter(Boolean);

    const phone = onlyDigits(lead.phone);

    const whatsappNumber = phone.startsWith("55")
      ? phone
      : phone
      ? `55${phone}`
      : "";

    const whatsappLink = whatsappNumber
      ? `https://wa.me/${whatsappNumber}`
      : "";

    const actions = mine
      ? `
        ${
          whatsappLink
            ? `
              <a
                class="lead-action lead-action-primary"
                href="${escapeHtml(whatsappLink)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir WhatsApp
              </a>
            `
            : ""
        }

        <button
          type="button"
          class="lead-action lead-action-secondary"
          data-contacted-lead="${escapeHtml(lead.id)}"
        >
          Marcar contato iniciado
        </button>
      `
      : `
        <button
          type="button"
          class="lead-action lead-action-primary"
          data-claim-lead="${escapeHtml(lead.id)}"
        >
          Assumir atendimento
        </button>
      `;

    return `
      <article
        class="lead-card ${
          lead.status === "qualified"
            ? "is-qualified"
            : ""
        }"
      >
        <div class="lead-card-top">
          <div class="lead-name">
            ${escapeHtml(lead.name || "Novo interessado")}
          </div>

          <div class="lead-time">
            ${escapeHtml(formatDate(lead.created_at))}
          </div>
        </div>

        <div class="lead-summary">
          ${escapeHtml(
            lead.summary ||
            "Novo atendimento iniciado pelo site."
          )}
        </div>

        <div class="lead-meta">
          ${tags
            .map(
              tag => `
                <span class="lead-tag">
                  ${escapeHtml(tag)}
                </span>
              `
            )
            .join("")}
        </div>

        <div class="lead-actions">
          ${actions}
        </div>
      </article>
    `;
  }

  function render() {
    const content = document.getElementById(
      "leadRealtimeContent"
    );

    const count = document.getElementById(
      "leadRealtimeCount"
    );

    if (!content || !count) return;

    const available = state.leads.filter(leadIsAvailable);
    const mine = state.leads.filter(leadBelongsToMe);

    count.textContent = String(available.length);

    let html = "";

    html += `
      <div class="lead-section-title">
        Disponíveis agora · ${available.length}
      </div>
    `;

    if (available.length) {
      html += available
        .map(lead => createLeadCard(lead, false))
        .join("");
    } else {
      html += `
        <div class="lead-empty">
          Nenhum lead disponível neste momento.
        </div>
      `;
    }

    html += `
      <div class="lead-section-title">
        Meus atendimentos · ${mine.length}
      </div>
    `;

    if (mine.length) {
      html += mine
        .map(lead => createLeadCard(lead, true))
        .join("");
    } else {
      html += `
        <div class="lead-empty">
          Você ainda não assumiu nenhum lead do site.
        </div>
      `;
    }

    content.innerHTML = html;
  }

  async function loadLeads() {
    if (
      state.loading ||
      !state.supabase ||
      !state.user?.id
    ) {
      return;
    }

    state.loading = true;

    try {
      const filter = [
        "assigned_user_id.is.null",
        `assigned_user_id.eq.${state.user.id}`,
      ].join(",");

      const { data, error } = await state.supabase
        .from("site_leads")
        .select(SELECT_FIELDS)
        .or(filter)
        .in("status", [
          "new",
          "qualified",
          "assigned",
          "contacted",
        ])
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        throw error;
      }

      state.leads = Array.isArray(data) ? data : [];

      render();

      for (const lead of state.leads) {
        if (
          leadShouldAlert(lead) &&
          !state.alertados.has(lead.id)
        ) {
          state.alertados.add(lead.id);
          saveStoredAlerts();

          showToast(
            "🔥 Novo lead qualificado",
            lead.summary ||
            `${lead.name || "Cliente"} aguarda atendimento.`
          );
        }
      }
    } catch (error) {
      console.error(
        "Erro carregando leads do site:",
        error
      );
    } finally {
      state.loading = false;
    }
  }

  async function claimLead(leadId, button) {
    if (!leadId || !state.supabase) return;

    const lead = state.leads.find(
      item => item.id === leadId
    );

    button.disabled = true;
    button.textContent = "Assumindo...";

    try {
      const { data, error } = await state.supabase.rpc(
        "claim_site_lead",
        {
          p_lead_id: leadId,
        }
      );

      if (error) {
        throw error;
      }

      if (data?.claimed === true) {
        showToast(
          "Atendimento atribuído a você",
          lead?.name
            ? `${lead.name} agora está em seus atendimentos.`
            : "O novo lead agora está em seus atendimentos."
        );

        window.dispatchEvent(
          new CustomEvent("leads:site-lead-claimed", {
            detail: {
              lead,
              result: data,
            },
          })
        );

        await loadLeads();
        return;
      }

      showToast(
        "Lead já assumido",
        data?.message ||
        "Outro corretor assumiu este atendimento primeiro."
      );

      await loadLeads();
    } catch (error) {
      console.error(
        "Erro ao assumir atendimento:",
        error
      );

      showToast(
        "Não foi possível assumir",
        "Atualize o painel e tente novamente."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Assumir atendimento";
    }
  }

  async function markContacted(leadId, button) {
    if (!leadId || !state.supabase) return;

    button.disabled = true;
    button.textContent = "Salvando...";

    try {
      const now = new Date().toISOString();

      const { error } = await state.supabase
        .from("site_leads")
        .update({
          status: "contacted",
          first_contact_at: now,
        })
        .eq("id", leadId)
        .eq("assigned_user_id", state.user.id);

      if (error) {
        throw error;
      }

      showToast(
        "Contato registrado",
        "O início do atendimento foi salvo."
      );

      await loadLeads();
    } catch (error) {
      console.error(
        "Erro marcando contato:",
        error
      );

      showToast(
        "Erro ao registrar contato",
        "Tente novamente."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Marcar contato iniciado";
    }
  }

  function handleDrawerClick(event) {
    const claimButton = event.target.closest(
      "[data-claim-lead]"
    );

    if (claimButton) {
      claimLead(
        claimButton.dataset.claimLead,
        claimButton
      );

      return;
    }

    const contactedButton = event.target.closest(
      "[data-contacted-lead]"
    );

    if (contactedButton) {
      markContacted(
        contactedButton.dataset.contactedLead,
        contactedButton
      );
    }
  }

  function subscribeRealtime() {
    if (!state.supabase || !state.user?.id) return;

    if (state.channel) {
      state.supabase.removeChannel(state.channel);
      state.channel = null;
    }

    state.channel = state.supabase
      .channel(`crm-site-leads-${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_leads",
        },
        function (payload) {
          const lead = payload.new;

          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            if (
              leadShouldAlert(lead) &&
              !state.alertados.has(lead.id)
            ) {
              state.alertados.add(lead.id);
              saveStoredAlerts();

              showToast(
                "🔥 Novo lead do site",
                lead.summary ||
                `${lead.name || "Cliente"} está aguardando atendimento.`
              );
            }
          }

          loadLeads();
        }
      )
      .subscribe(function (status, error) {
        console.log(
          "Realtime site_leads:",
          status
        );

        if (error) {
          console.error(
            "Erro na inscrição Realtime:",
            error
          );
        }

        if (status === "SUBSCRIBED") {
          loadLeads();
        }
      });
  }

  async function init() {
    state.supabase = window.supabaseClient;

    if (!state.supabase) {
      console.error(
        "Supabase não carregado. Verifique supabase-config.js."
      );

      return;
    }

    const {
      data: { session },
      error,
    } = await state.supabase.auth.getSession();

    if (error) {
      console.error(
        "Erro lendo sessão do CRM:",
        error
      );

      return;
    }

    if (!session?.user) {
      console.warn(
        "Painel de leads não iniciado: usuário não autenticado."
      );

      return;
    }

    state.user = session.user;

    getStoredAlerts();
    injectStyles();
    createInterface();

    await loadLeads();
    subscribeRealtime();

    // Recuperação quando o computador ou celular volta à tela.

    document.addEventListener(
      "visibilitychange",
      function () {
        if (!document.hidden) {
          loadLeads();
        }
      }
    );

    // Segurança extra caso o WebSocket tenha sido interrompido.

    window.setInterval(function () {
      if (!document.hidden) {
        loadLeads();
      }
    }, 30000);

    window.addEventListener("online", function () {
      loadLeads();
      subscribeRealtime();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
