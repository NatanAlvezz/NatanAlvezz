
hoje 19:26

Texto colado(52).txt
Documento
revise agora presciso terminar 

Pensou por 15s


Pensou por 12s


No campo do commit, coloque exatamente:

feat: adicionar provedor seguro da OpenAI
Depois clique em Commit & Push.


uffa deu certo

Pensou por 31s
Deu certo o commit, mas na conferência apareceu que o arquivo recebeu texto da conversa, não o código TypeScript. Ele está no caminho correto, então não precisa criar pastas novamente.

Faça somente esta correção:

Baixe o arquivo limpo: 

Abra o arquivo baixado e pressione Ctrl+A e Ctrl+C.

No editor, abra:

supabase/functions/_shared/openai-provider.ts
Pressione Ctrl+A, Ctrl+V e Ctrl+S.

Ainda não faça outro commit. Quando terminar, responda: código correto colado.


colado

Agora faça o commit:

fix: corrigir código do provedor OpenAI
Clique em Commit & Push.

Quando concluir, responda: commit corrigido.


ok

Pensou por 36s
O commit ainda ficou com texto antigo acima do código. Tentei corrigir diretamente, mas o GitHub bloqueou novamente com erro 403.

Agora faça somente isto no arquivo aberto:

Pressione Ctrl+A.

Apague tudo.

Abra este arquivo: 

Copie todo o conteúdo dele.

Cole no openai-provider.ts.

Confira que a primeira linha ficou:

// Leads Imóveis · OpenAI Provider
Faça o commit:

fix: limpar e corrigir provedor OpenAI
Depois responda: arquivo limpo confirmado.


PROVEDOR-OPENAI-CORRETO.ts


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
PROVEDOR-OPENAI-CORRETO.ts


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
