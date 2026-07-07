const DEFAULT_SUPABASE_URL = 'https://zyfbgydbwsvbaogbxzrd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_AP670pbIpkD_KleT7VaQ3Q_BTsBh8yh';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function extractOutputText(payload) {
  if (payload?.output_text) return payload.output_text;
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function compactPayload(input, maxLength = 12000) {
  const text = JSON.stringify(input, null, 2);
  return text.length > maxLength ? text.slice(0, maxLength) + '\n...[contexto reduzido]' : text;
}

async function validateSupabaseUser(token) {
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return json(res, 500, { error: 'OPENAI_API_KEY não configurada na Vercel.' });
    }

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return json(res, 401, { error: 'Sessão do Supabase não encontrada.' });
    }

    const user = await validateSupabaseUser(token);
    if (!user?.id) {
      return json(res, 401, { error: 'Usuário não autenticado no Supabase.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const question = String(body.question || '').trim();
    if (!question) {
      return json(res, 400, { error: 'Pergunta vazia.' });
    }

    const context = compactPayload({ context: body.context || {}, history: body.history || [] });
    const system = `Você é LAI, a IA consultiva da Leads Imóveis, uma imobiliária premium em Florianópolis/SC.

Missão: ajudar corretores e gestor a vender mais, atender melhor e manter o CRM organizado.

Use o contexto do CRM enviado pelo sistema. Responda em português do Brasil, com tom profissional, direto, motivador e comercial. Seja prático como um gerente de vendas imobiliárias de alto padrão.

Você pode ajudar com: follow-up, mensagens de WhatsApp, roteiro de ligação, objeções, captação de imóveis, anúncios premium, resumo diário, prioridades, match entre lead e imóvel, proposta comercial, treinamento de corretor e organização do funil.

Regras:
- Não invente dados que não estejam no CRM. Quando faltar informação, diga o que precisa ser cadastrado.
- Não prometa resultado garantido.
- Evite orientação jurídica ou financeira definitiva; recomende validação com profissional quando necessário.
- Não exponha dados pessoais desnecessários; use apenas o que ajuda no atendimento.
- Sempre que possível, entregue passos claros e mensagens prontas para copiar e colar.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.5',
        reasoning: { effort: 'low' },
        instructions: system,
        input: [
          { role: 'developer', content: `Contexto resumido do CRM:\n${context}` },
          { role: 'user', content: question },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, response.status, { error: payload?.error?.message || 'Erro ao consultar a OpenAI.' });
    }

    const reply = extractOutputText(payload) || 'Não consegui gerar uma resposta agora. Tente novamente com uma pergunta mais objetiva.';
    return json(res, 200, { reply });
  } catch (error) {
    return json(res, 500, { error: error?.message || 'Erro interno na IA.' });
  }
}
