/* ============================================================
   PROTECAO DE LOGIN (auth-guard) — Leads Imóveis CRM
   ------------------------------------------------------------
   COMO USAR: no seu index.html, dentro do <head>, adicione
   estas duas linhas ANTES de qualquer outro <script>:

     <script src="supabase-config.js"></script>
     <script src="auth-guard.js"></script>

   O que este arquivo faz:
     1. Esconde o sistema até confirmar que alguém está logado.
     2. Se ninguém estiver logado, envia para a página login.html.
     3. Mostra um botão "Sair" discreto no canto da tela.

   Você não precisa alterar nada aqui.
   ============================================================ */

(function () {
  "use strict";

  var LOGIN_PAGE = "login.html";

  // Se por engano este arquivo for incluído na própria página de
  // login, não faz nada (evita ficar redirecionando em círculo).
  if (window.location.pathname.toLowerCase().indexOf("login.html") !== -1) {
    return;
  }

  // 1) Esconde a página imediatamente, para o conteúdo não
  //    "piscar" antes da verificação do login.
  var hide = document.createElement("style");
  hide.id = "auth-guard-hide";
  hide.textContent = "html{visibility:hidden !important}";
  (document.head || document.documentElement).appendChild(hide);

  function reveal() {
    var el = document.getElementById("auth-guard-hide");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function goToLogin() {
    window.location.replace(LOGIN_PAGE);
  }

  function configOk() {
    var url = window.SUPABASE_URL;
    var key = window.SUPABASE_ANON_KEY;
    return (
      typeof url === "string" &&
      url.indexOf("https://") === 0 &&
      url.indexOf("COLE_AQUI") === -1 &&
      typeof key === "string" &&
      key.length > 20 &&
      key.indexOf("COLE_AQUI") === -1
    );
  }

  // 2) Carrega a biblioteca oficial do Supabase e valida a sessão.
  var lib = document.createElement("script");
  lib.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  lib.onload = start;
  lib.onerror = goToLogin; // sem conexão: mantém o sistema fechado
  (document.head || document.documentElement).appendChild(lib);

  function start() {
    try {
      if (!configOk() || !window.supabase) {
        return goToLogin();
      }

      var sb = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );

      // Fica disponível caso o sistema precise no futuro (fase 2).
      window.sbAuthClient = sb;

      sb.auth.getSession().then(function (res) {
        var session = res && res.data ? res.data.session : null;
        if (!session) {
          return goToLogin();
        }
        reveal();
        addLogoutButton(sb);
      }, goToLogin);

      // Se a sessão terminar (saiu em outra aba, por exemplo),
      // volta para a tela de login.
      sb.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT") {
          goToLogin();
        }
      });
    } catch (e) {
      goToLogin();
    }
  }

  // 3) Botão "Sair" fixo no canto inferior direito.
  function addLogoutButton(sb) {
    function mount() {
      if (document.getElementById("auth-guard-sair")) return;

      var btn = document.createElement("button");
      btn.id = "auth-guard-sair";
      btn.type = "button";
      btn.title = "Sair do sistema";
      btn.textContent = "Sair";
      btn.style.cssText =
        "position:fixed;left:16px;bottom:16px;z-index:2147483647;" +
        "font:600 13px/1 Inter,system-ui,-apple-system,sans-serif;" +
        "letter-spacing:.03em;color:#EDE6D6;" +
        "background:rgba(18,22,30,.92);" +
        "border:1px solid rgba(201,168,106,.45);" +
        "padding:10px 18px;border-radius:999px;cursor:pointer;" +
        "box-shadow:0 4px 14px rgba(0,0,0,.35);" +
        "transition:background .18s ease,color .18s ease;";

      btn.onmouseenter = function () {
        btn.style.background = "rgba(201,168,106,.95)";
        btn.style.color = "#10131A";
      };
      btn.onmouseleave = function () {
        btn.style.background = "rgba(18,22,30,.92)";
        btn.style.color = "#EDE6D6";
      };
      btn.onclick = function () {
        btn.disabled = true;
        btn.textContent = "Saindo...";
        sb.auth.signOut().then(goToLogin, goToLogin);
      };

      document.body.appendChild(btn);
    }

    if (document.body) {
      mount();
    } else {
      document.addEventListener("DOMContentLoaded", mount);
    }
  }
})();
