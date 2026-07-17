
hoje 19:26

Texto colado(52).txt
Documento
revise agora presciso terminar 

Pensou por 15s


Pensou por 12s


Pensou por 18s
O erro apareceu porque o arquivo já existe no caminho correto, mas está vazio.

Agora não crie outro arquivo.

Cancele a janela do erro.

Na lateral do editor, abra:

supabase
└── functions
    └── _shared
        └── openai-provider.ts
Baixe e abra o código correto:


No arquivo baixado, pressione Ctrl+A e Ctrl+C.

Volte ao arquivo vazio no editor, pressione Ctrl+A, Ctrl+V e depois Ctrl+S.

Quando aparecer o código dentro do arquivo, responda:

código colado


código colado

Pensou por 12s
O código ainda está apenas no editor local; no GitHub o arquivo continua vazio.

Agora faça o commit:

Clique no ícone Source Control na lateral esquerda — símbolo de ramificação.

Na caixa de mensagem, escreva:

feat: adicionar provedor seguro da OpenAI
Clique em Commit & Push. Caso apareça apenas Commit, clique nele e depois em Sync Changes.

Quando concluir, responda: commit realizado.


There was an error committing your changes: A file with the same name already exists. Please choose a different name and try again.

Esse erro ocorre porque o editor está tentando criar outro arquivo, mas o arquivo vazio já existe no GitHub.

Faça assim:

Feche a mensagem de erro.

Abra Source Control na lateral esquerda.

Localize openai-provider.ts com a letra A ao lado.

Clique com o botão direito e escolha Discard Changes.

Pressione Ctrl+R para atualizar o editor.

Na lateral, abra o arquivo que já existe:

supabase/functions/_shared/openai-provider.ts
Cole novamente o código correto:


Pressione Ctrl+S.

No Source Control, o arquivo deverá aparecer com a letra M, não A. Depois faça o commit:

feat: adicionar provedor seguro da OpenAI
Clique em Commit & Push e responda apareceu M.


This repository's code is being indexed right now. Try again in a few minutes.
repo:NatanAlvezz/NatanAlvezz supabase/functions/_shared/openai-provider.ts

Pensou por 21s
Essa mensagem é apenas da busca de código do GitHub. Você entrou no campo de pesquisa; não precisa aguardar a indexação. O arquivo correto ainda existe, mas continua vazio.

Agora faça somente isto no editor parecido com VS Code:

Ctrl + Shift + E
Isso abrirá o Explorador de arquivos na lateral esquerda.

Responda: explorador aberto.


NatanAlvezz/supabase/functions/_shared
/openai-provider.ts

Perfeito. Esse é o caminho correto:

NatanAlvezz/supabase/functions/_shared/openai-provider.ts
Agora dê dois cliques em openai-provider.ts para abrir o arquivo no editor.

Depois responda: arquivo aberto.


Biblioteca
/
openai-provider.ts


// Leads Imóveis · OpenAI Provider
// Uso exclusivo nas Supabase Edge Functions.
// A chave deve existir somente em OPENAI_API_KEY nos Secrets do Supabase.

export type OpenAIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenAIProviderResult = {
  content: string;
  provider: "openai";
  model: string;
};

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(name) || fallback).trim();
}

function clean(value: unknown, max = 12000): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 18000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractResponseText(data: Record<string, unknown>): string {
  const direct = clean(data.output_text, 12000);
  if (direct) return direct;

  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;

      const text = clean(
        (part as Record<string, unknown>).text,
        12000,
      );

      if (text) return text;
    }
  }

  return "";
}

export async function callOpenAI(
  systemPrompt: string,
  history: OpenAIMessage[],
  userMessage: string,
): Promise<OpenAIProviderResult> {
  const apiKey = env("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_KEY_MISSING");
  }

  const model = env("OPENAI_MODEL", "gpt-5-mini");

  const input = [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: systemPrompt,
        },
      ],
    },
    ...history.slice(-8).map((message) => ({
      role: message.role,
      content: [
        {
          type: "input_text",
          text: clean(message.content, 1400),
        },
      ],
    })),
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: clean(userMessage, 4000),
        },
      ],
    },
  ];

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 1000,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = clean(
      (data as Record<string, any>)?.error?.message,
      350,
    );

    throw new Error(
      `OPENAI_${response.status}${errorMessage ? `:${errorMessage}` : ""}`,
    );
  }

  const content = extractResponseText(
    data as Record<string, unknown>,
  );

  if (!content) {
    throw new Error("OPENAI_EMPTY");
  }

  return {
    content,
    provider: "openai",
    model,
  };
}
Biblioteca
/
openai-provider.ts


// Leads Imóveis · OpenAI Provider
// Uso exclusivo nas Supabase Edge Functions.
// A chave deve existir somente em OPENAI_API_KEY nos Secrets do Supabase.

export type OpenAIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenAIProviderResult = {
  content: string;
  provider: "openai";
  model: string;
};

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(name) || fallback).trim();
}

function clean(value: unknown, max = 12000): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 18000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractResponseText(data: Record<string, unknown>): string {
  const direct = clean(data.output_text, 12000);
  if (direct) return direct;

  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;

      const text = clean(
        (part as Record<string, unknown>).text,
        12000,
      );

      if (text) return text;
    }
  }

  return "";
}

export async function callOpenAI(
  systemPrompt: string,
  history: OpenAIMessage[],
  userMessage: string,
): Promise<OpenAIProviderResult> {
  const apiKey = env("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_KEY_MISSING");
  }

  const model = env("OPENAI_MODEL", "gpt-5-mini");

  const input = [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: systemPrompt,
        },
      ],
    },
    ...history.slice(-8).map((message) => ({
      role: message.role,
      content: [
        {
          type: "input_text",
          text: clean(message.content, 1400),
        },
      ],
    })),
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: clean(userMessage, 4000),
        },
      ],
    },
  ];

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 1000,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = clean(
      (data as Record<string, any>)?.error?.message,
      350,
    );

    throw new Error(
      `OPENAI_${response.status}${errorMessage ? `:${errorMessage}` : ""}`,
    );
  }

  const content = extractResponseText(
    data as Record<string, unknown>,
  );

  if (!content) {
    throw new Error("OPENAI_EMPTY");
  }

  return {
    content,
    provider: "openai",
    model,
  };
}
