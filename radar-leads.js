(function () {
  "use strict";

  if (window.__LEADS_RADAR_STARTED__) return;
  window.__LEADS_RADAR_STARTED__ = true;

  const RADAR_ENDPOINT =
    "https://zyfbgydbwsvbaogbxzrd.supabase.co/functions/v1/bright-task";

  const CAPTURE_ENDPOINT =
    "https://zyfbgydbwsvbaogbxzrd.supabase.co/functions/v1/captacao-publica";

  const SESSION_KEY = "leads_radar_session_id";
  const CONSENT_KEY = "leads_radar_consent";
  const LAST_VISIT_KEY = "leads_radar_last_visit";
  const INITIAL_EVENT_KEY = "leads_radar_initial_event_sent";

  let sessionId = localStorage.getItem(SESSION_KEY) || "";
  let initialized = false;
  let sessionPromise = null;

  function clean(value, maxLength = 500) {
    const text = String(value ?? "").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  function digits(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function getUtmData() {
    const params = new URLSearchParams(window.location.search);

    return {
      utm_source: clean(params.get("utm_source"), 200),
      utm_medium: clean(params.get("utm_medium"), 200),
      utm_campaign: clean(params.get("utm_campaign"), 300),
      utm_content: clean(params.get("utm_content"), 300),
      utm_term: clean(params.get("utm_term"), 300)
    };
  }

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  }

  function findPropertyContainer(element) {
    if (!(element instanceof Element)) return null;

    return element.closest(
      ".property-card,[data-property-code],[data-property-id],[data-code]"
    );
  }

  function getPropertyCode(element) {
    const container = findPropertyContainer(element);

    if (!container) return null;

    const directCode =
      container.getAttribute("data-property-code") ||
      container.dataset?.propertyCode ||
      container.getAttribute("data-code") ||
      container.dataset?.code ||
      null;

    if (directCode) return clean(directCode, 80);

    const codeNode = container.querySelector(
      ".property-code,[data-property-code],[data-code]"
    );

    const codeText = clean(codeNode?.textContent, 100);

    if (codeText) return codeText;

    const match = (container.textContent || "").match(
      /\b(?:LI|LID|COD|CODE)[-\s]?[A-Z0-9]+\b/i
    );

    return match
      ? clean(match[0].replace(/\s+/g, "-").toUpperCase(), 80)
      : null;
  }

  async function parseResponse(response) {
    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.ok === false) {
      throw new Error(
        body.message ||
        body.error ||
        `HTTP ${response.status}`
      );
    }

    return body;
  }

  async function sendEvent(eventType, details = {}) {
    if (!hasConsent()) return null;

    const payload = {
      session_id: sessionId || null,
      event_type: eventType,
      page_url: window.location.href,
      referrer: document.referrer || null,
      consent_analytics: true,
      consent_marketing: false,
      ...getUtmData(),
      ...details
    };

    try {
      const response = await fetch(RADAR_ENDPOINT, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        keepalive: true,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await parseResponse(response);

      if (
        result.session_id &&
        result.session_id !== sessionId
      ) {
        sessionId = result.session_id;
        localStorage.setItem(SESSION_KEY, sessionId);
      }

      window.dispatchEvent(
        new CustomEvent("leads-radar-update", {
          detail: result
        })
      );

      console.info(
        `[Radar Leads IA] ${eventType}`,
        result
      );

      return result;
    } catch (error) {
      console.warn(
        `[Radar Leads IA] Evento não enviado: ${eventType}`,
        error
      );

      return null;
    }
  }

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (!hasConsent()) return "";

    if (!sessionPromise) {
      sessionPromise = sendEvent("page_view", {
        surface: "site_start",
        event_key: `initial:${location.pathname}:${Date.now()}`
      }).finally(() => {
        sessionPromise = null;
      });
    }

    await sessionPromise;
    return sessionId;
  }

  async function registerInitialVisit() {
    if (!hasConsent()) return;

    if (!sessionId) {
      await ensureSession();
      sessionStorage.setItem(INITIAL_EVENT_KEY, "yes");
      return;
    }

    if (
      sessionStorage.getItem(INITIAL_EVENT_KEY) === "yes"
    ) {
      return;
    }

    sessionStorage.setItem(INITIAL_EVENT_KEY, "yes");

    await sendEvent("page_view", {
      surface: "page_load",
      event_key: `page:${location.pathname}:${Math.floor(
        Date.now() / 30000
      )}`
    });
  }

  function createConsentBanner() {
    if (localStorage.getItem(CONSENT_KEY)) return;

    const style = document.createElement("style");
    style.id = "leads-radar-consent-style";

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

    const banner = document.createElement("section");
    banner.className = "leads-radar-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute(
      "aria-label",
      "Preferências de privacidade"
    );

    banner.innerHTML = `
      <strong>Experiência personalizada na Leads Imóveis</strong>

      <p>
        Podemos registrar quais imóveis e recursos despertam mais
        interesse para melhorar seu atendimento. Não registramos
        senhas neste rastreamento.
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
      .querySelector(".leads-radar-reject")
      ?.addEventListener("click", () => {
        localStorage.setItem(
          CONSENT_KEY,
          "rejected"
        );

        banner.remove();
      });

    banner
      .querySelector(".leads-radar-accept")
      ?.addEventListener("click", async () => {
        localStorage.setItem(
          CONSENT_KEY,
          "accepted"
        );

        banner.remove();
        await startTracking();
      });
  }

  function injectCaptureForm() {
    if (document.getElementById("captacao-publica")) return;

    const contact = document.getElementById("contato");
    const parent = contact?.parentElement;

    if (!contact || !parent) return;

    const style = document.createElement("style");
    style.id = "leads-capture-form-style";

    style.textContent = `
      .capture-section {
        position: relative;
        padding: 74px 0;
        color: #071422;
        background:
          linear-gradient(
            160deg,
            #effbff,
            #d9f4ff 46%,
            #f9fdff
          );
        overflow: hidden;
      }

      .capture-section::before {
        content: "";
        position: absolute;
        width: 440px;
        height: 440px;
        right: -170px;
        top: -210px;
        border-radius: 50%;
        background: rgba(116,213,255,.22);
        filter: blur(8px);
      }

      .capture-shell {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100% - 28px));
        margin-inline: auto;
        display: grid;
        grid-template-columns:
          minmax(0,.85fr)
          minmax(460px,1.15fr);
        gap: 34px;
        align-items: center;
      }

      .capture-copy {
        padding: 22px;
      }

      .capture-kicker {
        display: inline-flex;
        padding: 7px 12px;
        border-radius: 999px;
        color: #0b3c55;
        background: rgba(116,213,255,.20);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.1px;
        text-transform: uppercase;
      }

      .capture-copy h2 {
        margin: 14px 0 12px;
        font-size: clamp(32px,4vw,52px);
        line-height: 1.04;
        letter-spacing: -1.7px;
      }

      .capture-copy p {
        max-width: 560px;
        margin: 0;
        color: #3b6075;
        font-size: 16px;
        line-height: 1.7;
      }

      .capture-benefits {
        display: grid;
        gap: 10px;
        margin: 24px 0 0;
        padding: 0;
        list-style: none;
      }

      .capture-benefits li {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        color: #173e58;
        font-size: 13px;
        font-weight: 750;
      }

      .capture-benefits li::before {
        content: "✓";
        width: 24px;
        height: 24px;
        flex: 0 0 24px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        color: #fff;
        background: #0d3b55;
        font-size: 12px;
      }

      .capture-card {
        padding: 24px;
        border: 1px solid rgba(111,174,202,.38);
        border-radius: 28px;
        background:
          linear-gradient(
            145deg,
            rgba(255,255,255,.96),
            rgba(230,248,255,.86)
          );
        box-shadow:
          0 28px 68px rgba(4,26,42,.16),
          inset 0 1px 0 rgba(255,255,255,.9);
        backdrop-filter: blur(18px);
      }

      .capture-card-head {
        margin-bottom: 18px;
      }

      .capture-card-head strong {
        display: block;
        font-size: 20px;
      }

      .capture-card-head span {
        display: block;
        margin-top: 5px;
        color: #527487;
        font-size: 12px;
        line-height: 1.5;
      }

      .capture-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
      }

      .capture-field {
        display: grid;
        gap: 6px;
      }

      .capture-field.full {
        grid-column: 1 / -1;
      }

      .capture-field label {
        color: #244c61;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .3px;
      }

      .capture-field input,
      .capture-field select,
      .capture-field textarea {
        width: 100%;
        min-height: 46px;
        padding: 11px 13px;
        border: 1px solid rgba(111,174,202,.40);
        border-radius: 13px;
        color: #071422;
        background: rgba(255,255,255,.92);
        font: inherit;
        outline: 0;
        transition: .18s;
      }

      .capture-field textarea {
        min-height: 104px;
        resize: vertical;
      }

      .capture-field input:focus,
      .capture-field select:focus,
      .capture-field textarea:focus {
        border-color: #54bfe9;
        box-shadow:
          0 0 0 4px rgba(84,191,233,.13);
      }

      .capture-honeypot {
        position: absolute !important;
        left: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .capture-consent {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        margin: 15px 0;
        color: #385e72;
        font-size: 11px;
        line-height: 1.5;
      }

      .capture-consent input {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        margin-top: 1px;
        accent-color: #0d3b55;
      }

      .capture-submit {
        width: 100%;
        min-height: 50px;
        border: 0;
        border-radius: 15px;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #071422,
            #1d5877
          );
        box-shadow:
          0 15px 34px rgba(7,20,34,.22);
        font:
          900 13px/1
          Inter,
          system-ui,
          sans-serif;
        cursor: pointer;
        transition: .2s;
      }

      .capture-submit:hover {
        transform: translateY(-2px);
        filter: brightness(1.08);
      }

      .capture-submit:disabled {
        opacity: .65;
        cursor: wait;
        transform: none;
      }

      .capture-status {
        min-height: 20px;
        margin: 10px 2px 0;
        color: #1e657f;
        font-size: 12px;
        font-weight: 800;
      }

      .capture-status.error {
        color: #a12837;
      }

      .capture-status.success {
        color: #167047;
      }

      @media (max-width: 900px) {
        .capture-shell {
          grid-template-columns: 1fr;
        }

        .capture-copy {
          padding: 0;
        }

        .capture-card {
          padding: 20px;
        }
      }

      @media (max-width: 620px) {
        .capture-section {
          padding: 54px 0;
        }

        .capture-grid {
          grid-template-columns: 1fr;
        }

        .capture-field.full {
          grid-column: auto;
        }

        .capture-copy h2 {
          font-size: 36px;
        }

        .capture-card {
          border-radius: 22px;
          padding: 17px;
        }
      }
    `;

    document.head.appendChild(style);

    const section = document.createElement("section");
    section.className = "capture-section";
    section.id = "captacao-publica";

    section.setAttribute(
      "aria-labelledby",
      "captureTitle"
    );

    section.innerHTML = `
      <div class="capture-shell">

        <div class="capture-copy">
          <span class="capture-kicker">
            Proprietários
          </span>

          <h2 id="captureTitle">
            Venda ou alugue seu imóvel com uma
            operação profissional.
          </h2>

          <p>
            Envie as informações iniciais. A oportunidade
            entra imediatamente no radar da Leads Imóveis
            e nossa equipe organiza o próximo contato.
          </p>

          <ul class="capture-benefits">
            <li>
              Atendimento humano com apoio de tecnologia
              e CRM.
            </li>

            <li>
              Apresentação profissional e divulgação
              integrada.
            </li>

            <li>
              Seus dados são usados somente para este
              atendimento.
            </li>
          </ul>
        </div>

        <form
          class="capture-card"
          id="formCaptacao"
          novalidate
        >
          <div class="capture-card-head">
            <strong>
              Quero anunciar meu imóvel
            </strong>

            <span>
              Preencha os dados abaixo. Campos com *
              são obrigatórios.
            </span>
          </div>

          <div class="capture-grid">

            <div class="capture-field">
              <label for="capNome">
                Seu nome *
              </label>

              <input
                id="capNome"
                name="nome_proprietario"
                autocomplete="name"
                maxlength="120"
                required
              >
            </div>

            <div class="capture-field">
              <label for="capTelefone">
                WhatsApp com DDD *
              </label>

              <input
                id="capTelefone"
                name="telefone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                maxlength="20"
                placeholder="(48) 99999-9999"
                required
              >
            </div>

            <div class="capture-field">
              <label for="capTipo">
                Tipo do imóvel
              </label>

              <select
                id="capTipo"
                name="tipo_imovel"
              >
                <option value="">
                  Selecione
                </option>

                <option>
                  Apartamento
                </option>

                <option>
                  Casa
                </option>

                <option>
                  Cobertura
                </option>

                <option>
                  Terreno
                </option>

                <option>
                  Comercial
                </option>

                <option>
                  Outro
                </option>
              </select>
            </div>

            <div class="capture-field">
              <label for="capBairro">
                Bairro
              </label>

              <input
                id="capBairro"
                name="bairro"
                autocomplete="address-level3"
                maxlength="80"
                placeholder="Ex.: Ingleses, Jurerê"
              >
            </div>

            <div class="capture-field full">
              <label for="capPreco">
                Valor desejado
              </label>

              <input
                id="capPreco"
                name="preco"
                inputmode="decimal"
                maxlength="60"
                placeholder="Ex.: R$ 850.000 ou R$ 4.500/mês"
              >
            </div>

            <div class="capture-field full">
              <label for="capNotas">
                Conte um pouco sobre o imóvel
              </label>

              <textarea
                id="capNotas"
                name="notas"
                maxlength="1000"
                placeholder="Dormitórios, vagas, estado do imóvel, objetivo de venda ou locação..."
              ></textarea>
            </div>

            <div
              class="capture-honeypot"
              aria-hidden="true"
            >
              <label for="capWebsite">
                Website
              </label>

              <input
                id="capWebsite"
                name="website"
                tabindex="-1"
                autocomplete="off"
              >
            </div>
          </div>

          <label class="capture-consent">
            <input
              type="checkbox"
              id="capConsent"
              required
            >

            <span>
              Autorizo a Leads Imóveis a usar estes
              dados para entrar em contato sobre a
              venda ou locação do meu imóvel, conforme
              a LGPD.
            </span>
          </label>

          <button
            class="capture-submit"
            type="submit"
          >
            Quero vender ou alugar meu imóvel
          </button>

          <div
            class="capture-status"
            id="captureStatus"
            aria-live="polite"
          ></div>
        </form>
      </div>
    `;

    parent.insertBefore(section, contact);

    document
      .querySelectorAll(".owner-cta")
      .forEach((link) => {
        link.setAttribute(
          "href",
          "#captacao-publica"
        );

        link.removeAttribute("target");
        link.removeAttribute("rel");

        link.addEventListener("click", (event) => {
          event.preventDefault();

          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

          window.setTimeout(() => {
            document
              .getElementById("capNome")
              ?.focus({
                preventScroll: true
              });
          }, 650);
        });
      });

    const form =
      document.getElementById("formCaptacao");

    const status =
      document.getElementById("captureStatus");

    const submit =
      form?.querySelector(
        "button[type='submit']"
      );

    form?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        status.className = "capture-status";
        status.textContent = "";

        if (!form.reportValidity()) return;

        const phone = digits(
          form.elements.telefone?.value
        );

        if (
          phone.length < 10 ||
          phone.length > 13
        ) {
          status.classList.add("error");
          status.textContent =
            "Confira o WhatsApp e informe o DDD.";

          form.elements.telefone?.focus();
          return;
        }

        submit.disabled = true;
        submit.textContent =
          "Enviando com segurança…";

        try {
          const body = Object.fromEntries(
            new FormData(form).entries()
          );

          body.consentimento_contato =
            document
              .getElementById("capConsent")
              ?.checked === true;

          body.pagina = window.location.href;

          const response = await fetch(
            CAPTURE_ENDPOINT,
            {
              method: "POST",
              mode: "cors",
              cache: "no-store",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(body)
            }
          );

          const data = await response
            .json()
            .catch(() => ({}));

          if (!response.ok || !data.ok) {
            throw new Error(
              data.message ||
              data.error ||
              "Não foi possível enviar agora."
            );
          }

          status.classList.add("success");

          status.textContent =
            data.message ||
            "Recebemos seus dados. Nossa equipe entrará em contato.";

          form.reset();

          void sendEvent(
            "contact_submitted",
            {
              surface:
                "public_capture_form"
            }
          );
        } catch (error) {
          console.error(
            "[Captação pública]",
            error
          );

          status.classList.add("error");

          status.textContent =
            error.message ||
            "Não foi possível enviar. Tente novamente.";
        } finally {
          submit.disabled = false;

          submit.textContent =
            "Quero vender ou alugar meu imóvel";
        }
      }
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

        if (!target) return;

        const propertyCode =
          getPropertyCode(target);

        const galleryControl =
          target.closest(
            "[data-gallery],.gallery-arrow,.property-photo,.property-image"
          );

        if (
          galleryControl &&
          propertyCode
        ) {
          await ensureSession();

          void sendEvent(
            "gallery_open",
            {
              property_code: propertyCode,
              surface: "property_gallery"
            }
          );

          return;
        }

        const whatsappLink =
          target.closest(
            'a[href*="wa.me"],a[href*="whatsapp.com"],a[href*="api.whatsapp.com"],[data-whatsapp]'
          );

        if (whatsappLink) {
          await ensureSession();

          void sendEvent(
            "whatsapp_click",
            {
              property_code: propertyCode,
              surface: propertyCode
                ? "property_whatsapp"
                : "general_whatsapp"
            }
          );

          return;
        }

        const chatButton =
          target.closest(
            "#openAi,#openLia,#liaButton,.lia-button,.ai-button,[data-open-lia],[data-open-ai]"
          );

        if (chatButton) {
          await ensureSession();

          void sendEvent(
            "chat_opened",
            {
              property_code: propertyCode,
              surface: "lia_button"
            }
          );

          return;
        }

        const propertyOpen =
          target.closest(
            ".property-media a,.property-body h3 a,.small-button:not(.dark)"
          );

        if (
          propertyOpen &&
          propertyCode
        ) {
          await ensureSession();

          void sendEvent(
            "property_view",
            {
              property_code: propertyCode,
              surface: "property_open"
            }
          );

          return;
        }

        const purposeButton =
          target.closest("[data-purpose]");

        if (purposeButton) {
          await ensureSession();

          void sendEvent(
            "filter_used",
            {
              filter_name: "purpose",
              purpose: clean(
                purposeButton.getAttribute(
                  "data-purpose"
                ),
                80
              ),
              surface: "purpose_button"
            }
          );
        }
      },
      {
        passive: true
      }
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

        await ensureSession();

        const identity = [
          form.id,
          form.className,
          form.getAttribute("name")
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          identity.includes("assistant") ||
          identity.includes("chat") ||
          identity.includes("lia")
        ) {
          void sendEvent(
            "chat_message",
            {
              property_code:
                getPropertyCode(form),

              surface:
                form.id ||
                "lia_chat_form"
            }
          );

          return;
        }

        const hasContactField =
          form.querySelector(
            'input[type="tel"],input[type="email"],input[name*="phone" i],input[name*="telefone" i],input[name*="whatsapp" i],input[name*="email" i]'
          );

        if (
          hasContactField &&
          form.id !== "formCaptacao"
        ) {
          void sendEvent(
            "contact_submitted",
            {
              property_code:
                getPropertyCode(form),

              surface:
                form.id ||
                "contact_form"
            }
          );
        }
      },
      true
    );
  }

  function bindFilterEvents() {
    document
      .querySelectorAll(
        "#purposeFilter,#neighborhoodFilter,#typeFilter,#codeFilter,[data-leads-filter]"
      )
      .forEach((field) => {
        field.addEventListener(
          "change",
          async () => {
            await ensureSession();

            void sendEvent(
              "filter_used",
              {
                filter_name:
                  field.id ||
                  field.getAttribute(
                    "name"
                  ) ||
                  "site_filter",

                surface:
                  "property_search"
              }
            );
          }
        );
      });
  }

  async function startTracking() {
    if (
      initialized ||
      !hasConsent()
    ) {
      return;
    }

    initialized = true;

    const previousVisit = Number(
      localStorage.getItem(
        LAST_VISIT_KEY
      ) || "0"
    );

    const now = Date.now();

    await registerInitialVisit();

    if (
      previousVisit &&
      now - previousVisit >
        6 * 60 * 60 * 1000
    ) {
      void sendEvent(
        "return_visit",
        {
          surface:
            "returning_visitor"
        }
      );
    }

    localStorage.setItem(
      LAST_VISIT_KEY,
      String(now)
    );

    bindClickEvents();
    bindFormEvents();
    bindFilterEvents();

    window.setTimeout(() => {
      if (!document.hidden) {
        void sendEvent(
          "engaged_60s",
          {
            duration_seconds: 60,
            surface: "site_engagement",
            event_key:
              `engaged60:${location.pathname}`
          }
        );
      }
    }, 60000);
  }

  function initialize() {
    injectCaptureForm();
    createConsentBanner();

    if (hasConsent()) {
      void startTracking();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
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
          SESSION_KEY
        )
      );
    },

    getConsent() {
      return localStorage.getItem(
        CONSENT_KEY
      );
    },

    reset() {
      localStorage.removeItem(
        SESSION_KEY
      );

      localStorage.removeItem(
        CONSENT_KEY
      );

      localStorage.removeItem(
        LAST_VISIT_KEY
      );

      sessionStorage.removeItem(
        INITIAL_EVENT_KEY
      );

      sessionId = "";
      initialized = false;
    }
  };
})();
