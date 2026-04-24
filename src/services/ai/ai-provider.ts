import { AiProviderConfig, ChatMessage } from '../../types/ai';

interface ProviderRequest {
  url: string;
  body: object;
  headers: Record<string, string>;
}

/** Strip the "data:image/...;base64," prefix, returning raw base64. */
function toRawBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function cleanEndpoint(raw: string, isOpenAI = false): string {
  let clean = raw.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (isOpenAI && clean.endsWith('/v1')) {
    clean = clean.slice(0, -3);
  }
  return clean;
}

function buildOllamaRequest(config: AiProviderConfig, messages: ChatMessage[]): ProviderRequest {
  const endpoint = cleanEndpoint(config.endpoint);
  return {
    url: `${endpoint}/api/chat`,
    body: {
      model: config.model,
      messages: messages.map(m => {
        const base: Record<string, any> = { role: m.role, content: m.content };
        if (m.images && m.images.length > 0) {
          // Ollama expects raw base64 strings (no data URL prefix)
          base.images = m.images.map(toRawBase64);
        }
        return base;
      }),
      stream: false,
      options: {
        temperature: config.temperature ?? 0.3,
        ...(config.maxTokens ? { num_predict: config.maxTokens } : {}),
      },
    },
    headers: { 'Content-Type': 'application/json' },
  };
}

function buildOpenAIRequest(config: AiProviderConfig, messages: ChatMessage[]): ProviderRequest {
  const endpoint = cleanEndpoint(config.endpoint, true);
  return {
    url: `${endpoint}/v1/chat/completions`,
    body: {
      model: config.model,
      messages: messages.map(m => {
        if (m.images && m.images.length > 0) {
          // OpenAI vision format: content is an array of parts
          const parts: any[] = [];
          if (m.content) {
            parts.push({ type: 'text', text: m.content });
          }
          for (const img of m.images) {
            parts.push({ type: 'image_url', image_url: { url: img } });
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      }),
      stream: false,
      temperature: config.temperature ?? 0.3,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
    },
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
  };
}

export function buildRequest(config: AiProviderConfig, messages: ChatMessage[]): ProviderRequest {
  if (config.type === 'ollama') {
    return buildOllamaRequest(config, messages);
  }
  return buildOpenAIRequest(config, messages);
}

export function extractContent(config: AiProviderConfig, data: any): string {
  if (config.type === 'ollama') {
    return data.message?.content ?? '';
  }
  return data.choices?.[0]?.message?.content ?? '';
}
