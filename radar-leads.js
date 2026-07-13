(function () {
  "use strict";

  if (window.__LEADS_RADAR_STARTED__) {
    return;
  }

  window.__LEADS_RADAR_STARTED__ = true;

  const ENDPOINT =
    "https://zyfbgydbwsvbaogbxzrd.supabase.co/functions/v1/bright-task";

  const SESSION_KEY = "leads_radar_session_id";
  const CONSENT_KEY = "leads_radar_consent";
  const LAST_VISIT_KEY = "leads_radar_last_visit";

  let sessionId =
    localStorage.getItem(SESSION_KEY) || "";

  let initialized = false;
  let creatingSession = null;

  function clean(value, maximumLength = 500) {
    const text = String(value ?? "").trim();

    if (!text) {
      return null;
    }

    return text.slice(0, maximumLength);
  }

  function getUtmData() {
    const params = new URLSearchParams(
      window.location.search,
    );

    return {
      utm_source: clean(
        params.get("utm_source"),
        200,
      ),

      utm_medium: clean(
        params.get("utm_medium"),
        200,
      ),

      utm_campaign: clean(
        params.get("utm_campaign"),
        300,
      ),

      utm_content: clean(
        params.get("utm_content"),
        300,
      ),

      utm_term: clean(
        params.get("utm_term"),
        300,
      ),
    };
  }

  function findPropertyContainer(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    return element.closest(
      [
        "[data-property-code]",
        "[data-code]",
        "[data-property-id]",
        ".property-card",
        ".property-item",
        ".property",
        ".imovel-card",
        ".property-slide",
      ].join(","),
    );
  }

  function getPropertyCode(element) {
    const container =
      findPropertyContainer(element);

    if (!container) {
      return null;
    }

    const directCode =
      container.getAttribute(
        "data-property-code",
      ) ||
      container.getAttribute("data-code") ||
      container.getAttribute(
        "data-property-id",
      ) ||
      container.dataset?.propertyCode ||
      container.dataset?.code ||
      container.dataset?.id;

    if (directCode) {
      return clean(directCode, 80);
    }

    const codeElement =
      container.querySelector(
        [
          "[data-property-code]",
          "[data-code]",
          ".property-code",
          ".codigo-imovel",
          ".property-reference",
          ".reference",
        ].join(","),
      );

    const codeText =
      codeElement?.textContent ||
      container.textContent ||
      "";

    const match = codeText.match(
      /\b(?:LI|LID|COD|CODE)[-\s]?[A-Z0-9]+\b/i,
    );

    return match
      ? clean(
          match[0]
            .replace(/\s+/g, "-")
            .toUpperCase(),
          80,
        )
      : null;
  }

  async function sendEvent(
    eventType,
    details = {},
  ) {
    if (
      localStorage.getItem(CONSENT_KEY) !==
      "accepted"
    ) {
      return null;
    }

    const payload = {
      session_id: sessionId || null,
      event_type: eventType,

      page_url: window.location.href,
      referrer: document.referrer || null,

      consent_analytics: true,
      consent_marketing: false,

      ...getUtmData(),
      ...details,
    };

    try {
      const response = await fetch(
        ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          keepalive: true,

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(payload),
        },
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (
        !response.ok ||
        result.ok === false
      ) {
        throw new Error(
          result.message ||
            result.error ||
            `HTTP ${response.status}`,
        );
      }

      if (
        result.session_id &&
        result.session_id !== sessionId
      ) {
        sessionId = result.session_id;

        localStorage.setItem(
          SESSION_KEY,
          sessionId,
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "leads-radar-update",
          {
            detail: result,
          },
        ),
      );

      console.info(
        "[Radar Leads IA]",
        eventType,
        result,
      );

      return result;
    } catch (error) {
      console.warn(
        "[Radar Leads IA] Evento não enviado:",
        eventType,
        error,
      );

      return null;
    }
  }

  async function ensureSession() {
    if (sessionId) {
      return sessionId;
    }

    if (!creatingSession) {
      creatingSession = sendEvent(
        "page_view",
        {
          surface: "site_start",
        },
      ).finally(() => {
        creatingSession = null;
      });
    }

    await creatingSession;

    return sessionId;
  }

  function createConsentBanner() {
    if (
      localStorage.getItem(CONSENT_KEY)
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "leads-radar-consent-style";

    style.textContent = `
      .leads-radar-consent {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        max-width: 760px;
        margin: 0 auto;
        padding: 17px;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 18px;
        background: rgba(7,18,29,.96);
        box-shadow: 0 22px 65px rgba(0,0,0,.42);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        color: #fff;
        font-family: Inter, Arial, sans-serif;
      }

      .leads-radar-consent strong {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        line-height: 1.3;
      }

      .leads-radar-consent p {
        margin: 0;
        color: rgba(255,255,255,.76);
        font-size: 12px;
        line-height: 1.5;
      }

      .leads-radar-consent-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 13px;
      }

      .leads-radar-consent button {
        min-height: 38px;
        border: 0;
        border-radius: 11px;
        padding: 9px 14px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .leads-radar-reject {
        background: rgba(255,255,255,.10);
        color: #fff;
      }

      .leads-radar-accept {
        background: #9ad8f3;
        color: #07131b;
      }

      @media (max-width: 600px) {
        .leads-radar-consent {
          left: 10px;
          right: 10px;
          bottom: 10px;
          padding: 15px;
        }

        .leads-radar-consent-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
      }
    `;

    document.head.appendChild(style);

    const banner =
      document.createElement("section");

    banner.className =
      "leads-radar-consent";

    banner.setAttribute(
      "role",
      "dialog",
    );

    banner.setAttribute(
      "aria-label",
      "Preferências de privacidade",
    );

    banner.innerHTML = `
      <strong>
        Experiência personalizada na Leads Imóveis
      </strong>

      <p>
        Podemos registrar quais imóveis e recursos despertam
        mais interesse para melhorar seu atendimento.
        Não registramos senhas nem o conteúdo das conversas
        neste rastreamento.
      </p>

      <div class="leads-radar-consent-actions">
        <button
          type="button"
          class="leads-radar-reject"
        >
          Continuar sem personalização
        </button>

        <button
          type="button"
          class="leads-radar-accept"
        >
          Aceitar
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    banner
      .querySelector(
        ".leads-radar-reject",
      )
      .addEventListener(
        "click",
        () => {
          localStorage.setItem(
            CONSENT_KEY,
            "rejected",
          );

          banner.remove();
        },
      );

    banner
      .querySelector(
        ".leads-radar-accept",
      )
      .addEventListener(
        "click",
        async () => {
          localStorage.setItem(
            CONSENT_KEY,
            "accepted",
          );

          banner.remove();

          await startTracking();
        },
      );
  }

  function bindClickEvents() {
    document.addEventListener(
      "click",
      async (event) => {
        const target =
          event.target instanceof Element
            ? event.target
            : null;

        if (!target) {
          return;
        }

        const whatsappLink =
          target.closest(
            [
              'a[href*="wa.me"]',
              'a[href*="whatsapp.com"]',
              'a[href*="api.whatsapp.com"]',
              "[data-whatsapp]",
            ].join(","),
          );

        if (whatsappLink) {
          await ensureSession();

          sendEvent(
            "whatsapp_click",
            {
              property_code:
                getPropertyCode(
                  whatsappLink,
                ),

              surface: "whatsapp_link",
            },
          );

          return;
        }

        const chatButton =
          target.closest(
            [
              "#openAi",
              "#openLia",
              "#liaButton",
              ".lia-button",
              ".ai-button",
              "[data-open-lia]",
              "[data-open-ai]",
            ].join(","),
          );

        if (chatButton) {
          await ensureSession();

          sendEvent(
            "chat_opened",
            {
              property_code:
                getPropertyCode(chatButton),

              surface: "lia_button",
            },
          );

          return;
        }

        const galleryButton =
          target.closest(
            [
              "[data-gallery]",
              ".gallery-button",
              ".property-gallery",
              ".property-photo",
              ".property-image",
            ].join(","),
          );

        if (galleryButton) {
          const propertyCode =
            getPropertyCode(
              galleryButton,
            );

          if (propertyCode) {
            await ensureSession();

            sendEvent(
              "gallery_open",
              {
                property_code:
                  propertyCode,

                surface:
                  "property_gallery",
              },
            );
          }

          return;
        }

        const favoriteButton =
          target.closest(
            [
              "[data-favorite]",
              ".favorite-button",
              ".property-favorite",
              ".btn-favorite",
            ].join(","),
          );

        if (favoriteButton) {
          await ensureSession();

          sendEvent(
            "favorite",
            {
              property_code:
                getPropertyCode(
                  favoriteButton,
                ),

              surface: "favorite_button",
            },
          );

          return;
        }

        const propertyContainer =
          findPropertyContainer(target);

        if (propertyContainer) {
          const propertyCode =
            getPropertyCode(
              propertyContainer,
            );

          if (propertyCode) {
            await ensureSession();

            sendEvent(
              "property_view",
              {
                property_code:
                  propertyCode,

                surface:
                  "property_card",
              },
            );
          }
        }

        const purposeButton =
          target.closest(
            "[data-purpose]",
          );

        if (purposeButton) {
          await ensureSession();

          sendEvent(
            "filter_used",
            {
              filter_name: "purpose",

              purpose: clean(
                purposeButton.getAttribute(
                  "data-purpose",
                ),
                80,
              ),

              surface:
                "purpose_button",
            },
          );
        }
      },
      {
        passive: true,
      },
    );
  }

  function bindFormEvents() {
    document.addEventListener(
      "submit",
      async (event) => {
        const form = event.target;

        if (
          !(form instanceof HTMLFormElement)
        ) {
          return;
        }

        const formIdentity = [
          form.id,
          form.className,
          form.getAttribute("name"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const isChatForm =
          formIdentity.includes("chat") ||
          formIdentity.includes("lia") ||
          formIdentity.includes("assistant");

        await ensureSession();

        if (isChatForm) {
          sendEvent(
            "chat_message",
            {
              property_code:
                getPropertyCode(form),

              surface:
                form.id ||
                "lia_chat_form",
            },
          );

          return;
        }

        const hasContactField =
          form.querySelector(
            [
              'input[type="tel"]',
              'input[type="email"]',
              'input[name*="phone" i]',
              'input[name*="telefone" i]',
              'input[name*="whatsapp" i]',
              'input[name*="email" i]',
            ].join(","),
          );

        if (hasContactField) {
          sendEvent(
            "contact_submitted",
            {
              property_code:
                getPropertyCode(form),

              surface:
                form.id ||
                "contact_form",
            },
          );
        }
      },
      true,
    );
  }

  function bindFilterEvents() {
    const selectors = [
      "#purposeFilter",
      "#neighborhoodFilter",
      "#typeFilter",
      "#bedroomsFilter",
      "[data-leads-filter]",
    ];

    document
      .querySelectorAll(
        selectors.join(","),
      )
      .forEach((field) => {
        field.addEventListener(
          "change",
          async () => {
            await ensureSession();

            sendEvent(
              "filter_used",
              {
                filter_name:
                  field.id ||
                  field.getAttribute(
                    "name",
                  ) ||
                  "site_filter",

                surface:
                  "property_search",
              },
            );
          },
        );
      });
  }

  async function startTracking() {
    if (initialized) {
      return;
    }

    if (
      localStorage.getItem(CONSENT_KEY) !==
      "accepted"
    ) {
      return;
    }

    initialized = true;

    const previousVisit = Number(
      localStorage.getItem(
        LAST_VISIT_KEY,
      ) || "0",
    );

    const currentTime = Date.now();

    await ensureSession();

    if (sessionId) {
      await sendEvent(
        "page_view",
        {
          surface: "page_load",
        },
      );
    }

    if (
      previousVisit > 0 &&
      currentTime - previousVisit >
        6 * 60 * 60 * 1000
    ) {
      sendEvent(
        "return_visit",
        {
          surface:
            "returning_visitor",
        },
      );
    }

    localStorage.setItem(
      LAST_VISIT_KEY,
      String(currentTime),
    );

    bindClickEvents();
    bindFormEvents();
    bindFilterEvents();

    window.setTimeout(() => {
      if (!document.hidden) {
        sendEvent(
          "engaged_60s",
          {
            duration_seconds: 60,
            surface:
              "site_engagement",
          },
        );
      }
    }, 60000);
  }

  function initialize() {
    createConsentBanner();

    if (
      localStorage.getItem(CONSENT_KEY) ===
      "accepted"
    ) {
      startTracking();
    }
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
    );
  } else {
    initialize();
  }

  window.LeadsRadar = {
    track: sendEvent,

    getSessionId() {
      return (
        sessionId ||
        localStorage.getItem(
          SESSION_KEY,
        )
      );
    },

    getConsent() {
      return localStorage.getItem(
        CONSENT_KEY,
      );
    },

    reset() {
      localStorage.removeItem(
        SESSION_KEY,
      );

      localStorage.removeItem(
        CONSENT_KEY,
      );

      localStorage.removeItem(
        LAST_VISIT_KEY,
      );

      sessionId = "";
      initialized = false;
    },
  };
})();
