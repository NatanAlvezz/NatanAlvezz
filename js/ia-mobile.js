(function fixAIMobileNameAndMinimize() {
  function getRightbar() {
    return document.getElementById("rightbar");
  }

  function closeAI() {
    const rightbar = getRightbar();
    if (!rightbar) return;

    rightbar.classList.remove("open");
    document.body.classList.remove("ai-open");
  }

  function openAI() {
    const rightbar = getRightbar();
    if (!rightbar) return;

    rightbar.classList.add("open");
    document.body.classList.add("ai-open");
  }

  function toggleAI() {
    const rightbar = getRightbar();
    if (!rightbar) return;

    if (rightbar.classList.contains("open")) {
      closeAI();
    } else {
      openAI();
    }
  }

  function injectStyle() {
    if (document.getElementById("iaMobileExternalStyle")) return;

    const style = document.createElement("style");
    style.id = "iaMobileExternalStyle";
    style.innerHTML = `
      @media (max-width: 980px) {
        .rightbar {
          position: fixed !important;
          top: 0 !important;
          right: -100% !important;
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100dvh !important;
          z-index: 99999 !important;
          padding: 0 !important;
          background: rgba(6,7,9,.98) !important;
          transition: right .22s ease !important;
          overflow-y: auto !important;
        }

        .rightbar.open {
          right: 0 !important;
        }

        body.ai-open {
          overflow: hidden !important;
        }

        .ai-close-mobile {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid rgba(216,181,109,.45) !important;
          background: linear-gradient(135deg, rgba(216,181,109,.28), rgba(216,181,109,.08)) !important;
          color: #fff3cf !important;
          border-radius: 14px !important;
          padding: 9px 12px !important;
          font-weight: 900 !important;
          font-size: 13px !important;
          margin-left: auto !important;
        }

        .mobile-ai-toggle {
          display: grid !important;
          position: fixed !important;
          right: 16px !important;
          bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
          z-index: 99998 !important;
          min-width: 118px !important;
          height: 52px !important;
          border-radius: 999px !important;
          border: 1px solid rgba(216,181,109,.44) !important;
          background: radial-gradient(circle, rgba(216,181,109,.36), #090909) !important;
          color: #fff0bd !important;
          box-shadow: 0 10px 30px rgba(0,0,0,.42) !important;
          font-weight: 900 !important;
          padding: 0 16px !important;
        }

        body.ai-open .mobile-ai-toggle {
          display: none !important;
        }

        .rightbar .ai-head {
          position: sticky !important;
          top: 0 !important;
          z-index: 100000 !important;
          background: rgba(6,7,9,.97) !important;
          border-bottom: 1px solid rgba(216,181,109,.25) !important;
          padding: 14px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renameAI() {
    const orb = document.querySelector(".ai-orb");
    if (orb) orb.innerHTML = "Agente<br>IA";

    const title = document.querySelector(".ai-head h2");
    if (title) title.textContent = "Agente IA de Corretor";

    const mobileBtn = document.querySelector(".mobile-ai-toggle");
    if (mobileBtn) {
      mobileBtn.textContent = "Agente IA";
      mobileBtn.onclick = function(e) {
        e.preventDefault();
        toggleAI();
      };
    }

    document.querySelectorAll("#mobileNav button").forEach(function(btn) {
      if (btn.dataset.view === "ia") {
        btn.onclick = function(e) {
          e.preventDefault();
          toggleAI();
        };
      }
    });
  }

  function injectCloseButton() {
    const rightbar = getRightbar();
    if (!rightbar) return;

    const head = rightbar.querySelector(".ai-head");
    if (!head) return;

    if (document.getElementById("aiCloseMobileBtn")) return;

    const btn = document.createElement("button");
    btn.id = "aiCloseMobileBtn";
    btn.type = "button";
    btn.className = "ai-close-mobile";
    btn.innerHTML = "← Voltar ao CRM";
    btn.onclick = closeAI;

    head.appendChild(btn);
  }

  function start() {
    injectStyle();
    renameAI();
    injectCloseButton();

    if (window.innerWidth <= 980) {
      closeAI();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  setTimeout(start, 800);
  setTimeout(start, 1800);
})();
