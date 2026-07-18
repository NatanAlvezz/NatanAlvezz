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

  const PENDING_CAPTURE_KEY = "leads_pending_capture_conversion_v1";

  function showConversionNotice(message, isError = false) {
    const previous = document.getElementById("leadsConversionNotice");
    if (previous) previous.remove();

    const notice = document.createElement("div");
    notice.id = "leadsConversionNotice";
    notice.setAttribute("role", "status");
    notice.textContent = message;
    Object.assign(notice.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "999999",
      maxWidth: "390px",
      padding: "13px 16px",
      borderRadius: "14px",
      border: `1px solid ${isError ? "rgba(255,111,117,.48)" : "rgba(86,213,138,.45)"}`,
      background: isError ? "rgba(76,18,24,.96)" : "rgba(8,54,34,.96)",
      color: "#fff",
      boxShadow: "0 18px 55px rgba(0,0,0,.38)",
      font: "700 12px/1.45 Inter,system-ui,sans-serif"
    });
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 5200);
  }

  function setPendingCapture(captureId) {
    const id = String(captureId || "").trim();
    if (!id) return;
    sessionStorage.setItem(PENDING_CAPTURE_KEY, JSON.stringify({ id, createdAt: Date.now() }));
  }

  function getPendingCapture() {
    try {
      const value = JSON.parse(sessionStorage.getItem(PENDING_CAPTURE_KEY) || "null");
      if (!value?.id || Date.now() - Number(value.createdAt || 0) > 30 * 60 * 1000) {
        sessionStorage.removeItem(PENDING_CAPTURE_KEY);
        return null;
      }
      return value;
    } catch (_) {
      sessionStorage.removeItem(PENDING_CAPTURE_KEY);
      return null;
    }
  }

  function clearPendingCapture() {
    sessionStorage.removeItem(PENDING_CAPTURE_KEY);
  }

  async function currentSession(client) {
    if (window.__LEADS_AUTH_SESSION__?.user) return window.__LEADS_AUTH_SESSION__;
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  async function recentPropertyIds(client, userId) {
    const { data, error } = await client
      .from("crm_properties")
      .select("id")
      .eq("captured_by_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return new Set((data || []).map((item) => String(item.id)));
  }

  function installCaptureConversionPatch() {
    if (page !== "crm.html" || window.__LEADS_CAPTURE_CONVERSION_PATCH__) return true;

    const originalConvertCapture = window.crmConvertCapture;
    const originalSaveProperty = window.crmSaveProperty;
    const originalOpenProperty = window.crmOpenProperty;

    if (
      typeof originalConvertCapture !== "function" ||
      typeof originalSaveProperty !== "function"
    ) {
      return false;
    }

    window.__LEADS_CAPTURE_CONVERSION_PATCH__ = true;
    let propertySaveInProgress = false;

    window.crmConvertCapture = function patchedConvertCapture(captureId) {
      setPendingCapture(captureId);
      return originalConvertCapture.apply(this, arguments);
    };

    if (typeof originalOpenProperty === "function") {
      window.crmOpenProperty = function patchedOpenProperty(propertyId) {
        if (!propertyId) clearPendingCapture();
        return originalOpenProperty.apply(this, arguments);
      };
    }

    window.crmSaveProperty = async function patchedSaveProperty(propertyId) {
      const pending = !propertyId ? getPendingCapture() : null;

      if (!pending) {
        return originalSaveProperty.apply(this, arguments);
      }

      const client = window.supabaseClient;

      if (!client?.from || !client?.rpc) {
        showConversionNotice(
          "Imóvel salvo, mas o vínculo da captação não pôde ser iniciado.",
          true
        );
        return originalSaveProperty.apply(this, arguments);
      }

      let beforeIds = new Set();
      let userId = null;

      try {
        const session = await currentSession(client);
        userId = session?.user?.id || null;

        if (userId) {
          beforeIds = await recentPropertyIds(client, userId);
        }
      } catch (error) {
        console.warn(
          "[Captação → imóvel] Não foi possível preparar a comparação:",
          error
        );
      }

      propertySaveInProgress = true;

      try {
        await originalSaveProperty.apply(this, arguments);
      } finally {
        propertySaveInProgress = false;
      }

      if (!userId) return;

      let newPropertyId = null;

      try {
        for (
          let attempt = 0;
          attempt < 7 && !newPropertyId;
          attempt += 1
        ) {
          const { data, error } = await client
            .from("crm_properties")
            .select("id,updated_at")
            .eq("captured_by_id", userId)
            .order("updated_at", { ascending: false })
            .limit(20);

          if (error) throw error;

          newPropertyId =
            (data || [])
              .map((item) => String(item.id))
              .find((id) => !beforeIds.has(id)) || null;

          if (!newPropertyId) {
            await new Promise((resolve) => setTimeout(resolve, 260));
          }
        }

        if (!newPropertyId) {
          console.warn(
            "[Captação → imóvel] Nenhum imóvel novo foi identificado; vínculo mantido pendente."
          );
          return;
        }

        const captureId = Number(pending.id);

        if (!Number.isFinite(captureId)) {
          throw new Error("Identificador de captação inválido.");
        }

        const { error } = await client.rpc(
          "leads_vincular_captacao_imovel",
          {
            p_captacao_id: captureId,
            p_property_id: newPropertyId
          }
        );

        if (error) throw error;

        clearPendingCapture();

        showConversionNotice(
          "Captação convertida e vinculada ao imóvel com sucesso."
        );
      } catch (error) {
        console.error("[Captação → imóvel] Falha no vínculo:", error);

        showConversionNotice(
          "O imóvel foi salvo, mas o vínculo da captação falhou. Tente converter novamente.",
          true
        );
      }
    };

    const modal = document.getElementById("modal");

    modal?.addEventListener("close", () => {
      if (!propertySaveInProgress) {
        clearPendingCapture();
      }
    });

    return true;
  }

  function scheduleCaptureConversionPatch() {
    if (installCaptureConversionPatch()) return;

    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (
        installCaptureConversionPatch() ||
        attempts >= 40
      ) {
        window.clearInterval(timer);
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleCaptureConversionPatch,
      { once: true }
    );
  } else {
    scheduleCaptureConversionPatch();
  }
})();
