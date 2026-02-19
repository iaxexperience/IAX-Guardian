import type { AppConfig } from '../types';

// ─── Shared LLM API call ─────────────────────────────────────────
// Supports Anthropic, Google Gemini and OpenAI-compatible providers

export async function callLlmApi(
    config: AppConfig,
    messages: { role: string; content: string; imageBase64?: string }[],
    systemPrompt: string,
): Promise<string | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;

    // Merge custom training/instructions if available
    let finalSystemPrompt = systemPrompt;

    if (config.llmTone || config.llmSpecialization) {
        finalSystemPrompt += `\n\nPERSONA E ESTILO:\n`;
        if (config.llmTone) finalSystemPrompt += `- Tom de voz: ${config.llmTone}\n`;
        if (config.llmSpecialization) finalSystemPrompt += `- Especialização: ${config.llmSpecialization}\n`;
    }

    if (config.llmCustomPrompt) {
        finalSystemPrompt += `\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${config.llmCustomPrompt}`;
    }

    if (config.llmExamples && config.llmExamples.length > 0) {
        finalSystemPrompt += `\n\nEXEMPLOS DE COMPORTAMENTO (FEW-SHOT):\n`;
        config.llmExamples.forEach((ex, i) => {
            finalSystemPrompt += `Exemplo ${i + 1}:\nUsuário: ${ex.user}\nAssistente: ${ex.assistant}\n\n`;
        });
    }

    if (config.llmKnowledgeBase) {
        finalSystemPrompt += `\n\nBASE DE CONHECIMENTO / CONTEXTO:\n${config.llmKnowledgeBase}`;
    }

    try {
        if (config.llmProvider === 'anthropic') {
            const baseUrl = config.llmBaseUrl || 'https://api.anthropic.com/v1';
            const resp = await fetch(`${baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'x-api-key': config.llmApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: config.llmModel || 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    system: finalSystemPrompt,
                    messages: messages.map((m) => {
                        const content: any[] = [{ type: 'text', text: m.content }];
                        if (m.imageBase64) {
                            content.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: m.imageBase64,
                                },
                            });
                        }
                        return {
                            role: m.role as 'user' | 'assistant',
                            content,
                        };
                    }),
                    temperature: config.llmTemperature ?? 0.7,
                    top_p: config.llmTopP ?? 1,
                }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.content?.[0]?.text || null;
        }

        if (config.llmProvider === 'google') {
            const baseUrl =
                config.llmBaseUrl ||
                'https://generativelanguage.googleapis.com/v1beta';
            const model = config.llmModel || 'gemini-2.0-flash';
            const url = `${baseUrl}/models/${model}:generateContent?key=${config.llmApiKey}`;

            // Convert chat messages to Gemini format
            const contents = messages.map((m) => {
                const parts: any[] = [{ text: m.content }];
                if (m.imageBase64) {
                    parts.push({
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: m.imageBase64,
                        }
                    });
                }
                return {
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts,
                };
            });

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: finalSystemPrompt }] },
                    contents,
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: config.llmTemperature ?? 0.7,
                        topP: config.llmTopP ?? 1,
                    },
                }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }

        // OpenAI-compatible (OpenAI, DeepSeek, Groq, Mistral, xAI, custom…)
        const baseUrl = config.llmBaseUrl || 'https://api.openai.com/v1';
        const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.llmApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.llmModel || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    ...messages.map(m => {
                        if (m.imageBase64) {
                            return {
                                role: m.role,
                                content: [
                                    { type: 'text', text: m.content },
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.imageBase64}` } }
                                ]
                            };
                        }
                        return { role: m.role, content: m.content };
                    })
                ],
                max_tokens: 4096,
                temperature: config.llmTemperature ?? 0.7,
                top_p: config.llmTopP ?? 1,
                frequency_penalty: config.llmFrequencyPenalty ?? 0,
                presence_penalty: config.llmPresencePenalty ?? 0,
            }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

// ─── LLM-powered contract analysis ──────────────────────────────
// Returns structured data extracted from contract text, or null if LLM unavailable

export interface LlmContractAnalysis {
    dataInicio?: string;
    dataVencimento?: string;
    valorTotal?: string;
    empresa?: string;
    tipoServico?: string;
    descricaoObjeto?: string;
    clausulasAbusivas: { descricao: string; severidade: 'alta' | 'media' | 'baixa' }[];
    alertas: string[];
}

const CONTRACT_ANALYSIS_PROMPT = `Você é um analista jurídico especializado em contratos brasileiros. Analise o texto do contrato fornecido e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem explicações) com a seguinte estrutura:

{
  "dataInicio": "YYYY-MM-DD (OBRIGATÓRIO: Use a data de assinatura/celebração do contrato como data de início oficial)",
  "dataVencimento": "YYYY-MM-DD (vencimento ou término)",
  "valorTotal": "valor SOMADO como string (Ex: R$ 15.000,00. IMPORTANTE: Some Implantação + Recorrência/Mensalidades + Manutenção + Atualizações)",
  "empresa": "nome da empresa contratada",
  "tipoServico": "Serviço|Fornecimento|Obra|Consultoria|Locação",
  "descricaoObjeto": "descrição resumida (máx 200 chars)",
  "clausulasAbusivas": [
    { "descricao": "descrição", "severidade": "alta|media|baixa" }
  ],
  "alertas": ["Soma realizada: [detalhar itens somados aqui]", "outras observações"]
}

REGRAS CRÍTICAS:
1. DATA DE INÍCIO: Use sempre a data de assinatura ou celebração encontrada no contrato (geralmente no final).
2. VALOR TOTAL: Você DEVE identificar e SOMAR todos os valores: Taxa de Implantação + Valor das Parcelas/Recorrência (multiplique pelo número de meses se necessário) + Manutenção. Detalhe o cálculo no campo 'alertas'.
3. FORMATO DE DATA: Use estritamente YYYY-MM-DD.
4. JSON APENAS: Não inclua texto fora do objeto JSON.`;

export async function analyzeContractWithLlm(
    config: AppConfig,
    contractText: string,
): Promise<LlmContractAnalysis | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;
    if (!contractText || contractText.trim().length < 50) return null;

    // Limit text to avoid token overflow but prioritize both start and end
    // Signature dates are often at the very end of Brazilian contracts
    let processedText = contractText;
    if (contractText.length > 12000) {
        const start = contractText.substring(0, 6000);
        const end = contractText.substring(contractText.length - 6000);
        processedText = `${start}\n\n[... TEXTO INTERMEDIÁRIO OMITIDO ...]\n\n${end}`;
    }

    const response = await callLlmApi(
        config,
        [{ role: 'user', content: `Analise o seguinte contrato:\n\n${processedText}` }],
        CONTRACT_ANALYSIS_PROMPT,
    );

    if (!response) return null;

    try {
        // Extract JSON from response — handle cases where LLM wraps in markdown
        let jsonStr = response.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        // Also handle if wrapped in just curly braces with leading text
        const braceStart = jsonStr.indexOf('{');
        const braceEnd = jsonStr.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
            jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
        }

        const parsed = JSON.parse(jsonStr);

        return {
            dataInicio: parsed.dataInicio || undefined,
            dataVencimento: parsed.dataVencimento || undefined,
            valorTotal: parsed.valorTotal || undefined,
            empresa: parsed.empresa || undefined,
            tipoServico: parsed.tipoServico || undefined,
            descricaoObjeto: parsed.descricaoObjeto || undefined,
            clausulasAbusivas: Array.isArray(parsed.clausulasAbusivas)
                ? parsed.clausulasAbusivas
                : [],
            alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
        };
    } catch {
        console.warn('LLM contract analysis: failed to parse JSON response');
        return null;
    }
}

// ─── AI Audit Log Summary ────────────────────────────────────────

export async function generateAuditSummary(
    config: AppConfig,
    logs: { usuario: string; acao: string; detalhes: string; data: string }[]
): Promise<string | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;
    if (logs.length === 0) return "Nenhum log disponível para análise.";

    const logsText = logs.map(l =>
        `[${l.data}] ${l.usuario}: ${l.acao} - ${l.detalhes}`
    ).join('\n');

    const prompt = `Você é um Auditor Profissional de TI e Segurança Cibernética. Analise os seguintes logs de atividade do sistema "Legal Whisperer Pro" e gere um resumo executivo de alto nível.

ESTRUTURA DESEJADA (Use Markdown):
1. **Visão Geral**: Resumo em 2 frases da atividade recente.
2. **Tendências e Padrões**: Quais ações são mais frequentes? Algum horário de pico?
3. **Riscos e Alertas**: Identifique logins falhos, exclusões de contratos ou alterações críticas de configuração.
4. **Recomendações**: 3 ações práticas para melhorar a segurança ou eficiência.

LOGS PARA ANÁLISE:
${logsText}`;

    return await callLlmApi(
        config,
        [{ role: 'user', content: prompt }],
        "Você é um especialista em auditoria e segurança. Seja conciso, profissional e focado em riscos."
    );
}
