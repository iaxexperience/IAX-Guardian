import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText, Send, Upload, Loader2, Bot, User as UserIcon, Wand2, Download, Printer, Save,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { extractTextFromFile, parseContractFields, analyzeContract, analyzeValues, generateContractNumber, detectTypeFromText } from "../utils/pdfAnalyzer";
import { callLlmApi, analyzeContractWithLlm } from "../utils/llmService";
import { downloadAsPdf, downloadAsDocx } from "../utils/documentExport";
import AnalysisAlert, { type AnalysisResult } from "../components/AnalysisAlert";
import { toast } from "@/hooks/use-toast";

const CHAT_SYSTEM_PROMPT = `Você é um assistente jurídico especializado em análise de contratos brasileiros.
Quando o usuário enviar um contrato para análise, identifique:
- Cláusulas abusivas (multas excessivas, renúncia de direitos, rescisão unilateral, etc.)
- Valor contratual
- Nome das partes (contratante e contratada)
- Data de início e fim do contrato
- Objeto do contrato
- Alertas e observações importantes
Seja detalhado e use linguagem jurídica formal em português do Brasil.
Quando o usuário pedir para gerar um contrato, gere o texto completo com cláusulas profissionais.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function ChatIA() {
  const { contratos, addContrato, modelos, addLog, setores, appConfig } = useData();
  const { currentUser } = useAuth();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // --- Local fallback response ---
  function generateLocalResponse(userMsg: string): string {
    const msg = userMsg.toLowerCase();
    const typeMap: Record<string, string> = {
      'serviço': 'Serviço', 'prestação de serviço': 'Serviço',
      'fornecimento': 'Fornecimento', 'material': 'Fornecimento',
      'obra': 'Obra', 'construção': 'Obra', 'reforma': 'Obra',
      'locação': 'Locação', 'aluguel': 'Locação',
      'consultoria': 'Consultoria', 'assessoria': 'Consultoria',
      'nda': 'NDA', 'confidencialidade': 'NDA', 'sigilo': 'NDA',
    };
    let detectedType = '';
    for (const [kw, tipo] of Object.entries(typeMap)) {
      if (msg.includes(kw)) { detectedType = tipo; break; }
    }
    if (detectedType) {
      return `🔍 Identifiquei que você precisa de um contrato do tipo **${detectedType}**.\n\n` +
        `💡 Para uma análise completa com extração de cláusulas abusivas, valor, partes e datas, configure uma LLM em **Configurações** ou faça **upload de um PDF/DOCX** para análise automática.\n\n` +
        `📚 **Modelos disponíveis:** ${modelos.map(m => m.tipo).join(', ') || 'Nenhum'}`;
    }
    return `🤖 Posso ajudar com análise de contratos! Tente:\n\n` +
      `• **Upload de PDF/DOCX** — Análise automática com extração de dados\n` +
      `• "Analisar contrato de prestação de serviços"\n` +
      `• "Quais cláusulas abusivas existem neste contrato?"\n` +
      `• "Gerar contrato de fornecimento de materiais"\n\n` +
      `💡 Para respostas mais completas, configure uma LLM em **Configurações**.`;
  }

  // --- Send chat message ---
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const apiMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const llmResponse = await callLlmApi(appConfig, apiMessages, CHAT_SYSTEM_PROMPT);

      let response: string;
      if (llmResponse) {
        response = llmResponse;
        if (currentUser) addLog(currentUser.id, currentUser.nome, "Chat IA (LLM)", `Provider: ${appConfig.llmProvider}, Comando: ${userMsg.content.substring(0, 50)}...`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
        response = generateLocalResponse(userMsg.content);
        if (currentUser) addLog(currentUser.id, currentUser.nome, "Chat IA (local)", `Comando: ${userMsg.content.substring(0, 60)}...`);
      }

      const assistantMsg: ChatMessage = { role: "assistant", content: response, timestamp: new Date().toISOString() };
      setChatMessages(prev => [...prev, assistantMsg]);

      const contractMatch = response.match(/---\n\n([\s\S]+?)\n\n---/);
      if (contractMatch) {
        setGeneratedContract(contractMatch[1]);
      } else if (response.length > 200 && (response.includes('CLÁUSULA') || response.includes('CONTRAT'))) {
        setGeneratedContract(response);
      }

      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Erro ao processar a solicitação. Tente novamente.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, modelos, addLog, currentUser, appConfig, chatMessages]);

  // --- Upload handler ---
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');
    if (!isPdf && !isDocx) return;

    setAnalysisLoading(true);
    setAnalysisResult(null);

    try {
      toast({ title: "🔍 Analisando documento", description: "Processando arquivo para análise inteligente..." });
      const text = await extractTextFromFile(file, appConfig);

      if (!text || text.trim().length < 10) {
        toast({ title: "⚠️ Erro na extração", description: "Não foi possível extrair texto do documento.", variant: "destructive" });
        return;
      }

      const cleanText = text.trim();
      const fields = parseContractFields(text);
      const analysis = analyzeContract(text);
      const valueAnalysis = analyzeValues(text);

      const autoNumero = fields.numero || generateContractNumber(contratos.map(c => c.numero));
      let allFindings = [...analysis.findings, ...valueAnalysis.alertas];
      let hasAbusive = analysis.hasAbusiveClauses;

      let summary = `📄 **Análise do documento "${file.name}":**\n\n` +
        `• Nº do Contrato: ${autoNumero}\n` +
        (fields.empresa ? `• Empresa: ${fields.empresa}\n` : "") +
        (fields.objeto ? `• Objeto: ${fields.objeto}\n` : "") +
        (fields.valor ? `• Valor: ${fields.valor}\n` : "") +
        (fields.tipo ? `• Tipo identificado: ${fields.tipo}\n` : "") +
        (fields.dataInicio ? `• Data início: ${fields.dataInicio}\n` : "") +
        (fields.dataVencimento ? `• Data vencimento: ${fields.dataVencimento}\n` : "");

      const llmResult = await (async () => {
        if (appConfig.llmApiKey && appConfig.llmStatus === 'connected') {
          toast({ title: "🧠 IA Analisando Documento", description: "Extraindo riscos, cláusulas e resumo estruturado..." });
          return analyzeContractWithLlm(appConfig, text);
        }
        return null;
      })();

      if (llmResult) {
        summary += `\n🧠 **Análise aprofundada via IA (${appConfig.llmProvider?.toUpperCase()}):**\n`;
        if (llmResult.empresa) summary += `• Empresa (IA): ${llmResult.empresa}\n`;
        if (llmResult.descricaoObjeto) summary += `• Objeto (IA): ${llmResult.descricaoObjeto}\n`;
        if (llmResult.valorTotal) summary += `• Valor total (IA): ${llmResult.valorTotal}\n`;
        if (llmResult.dataInicio) summary += `• Início (IA): ${llmResult.dataInicio}\n`;
        if (llmResult.dataVencimento) summary += `• Vencimento (IA): ${llmResult.dataVencimento}\n`;
        if (llmResult.tipoServico) summary += `• Tipo (IA): ${llmResult.tipoServico}\n`;

        if (llmResult.clausulasAbusivas.length > 0) {
          hasAbusive = true;
          summary += `\n⚠️ **Cláusulas abusivas detectadas pela IA:**\n`;
          llmResult.clausulasAbusivas.forEach(c => {
            const icon = c.severidade === 'alta' ? '🔴' : c.severidade === 'media' ? '🟡' : '🟢';
            summary += `${icon} [${c.severidade.toUpperCase()}] ${c.descricao}\n`;
            allFindings.push(`⚠️ [IA] ${c.descricao}`);
          });
        } else {
          summary += `\n✅ Nenhuma cláusula abusiva detectada pela IA.\n`;
        }

        if (llmResult.alertas.length > 0) {
          summary += `\n📝 **Observações da IA:**\n`;
          llmResult.alertas.forEach(a => {
            summary += `• ${a}\n`;
            allFindings.push(`ℹ️ [IA] ${a}`);
          });
        }
      } else {
        summary += `\n**Análise de cláusulas (local):**\n` +
          (analysis.findings.length > 0 ? analysis.findings.join("\n") : "✅ Nenhuma irregularidade detectada") +
          (valueAnalysis.alertas.length > 0 ? "\n\n**Análise de valores:**\n" + valueAnalysis.alertas.join("\n") : "");
      }

      setChatMessages(prev => [
        ...prev,
        { role: "user", content: `📎 Upload: ${file.name}`, timestamp: new Date().toISOString() },
        { role: "assistant", content: summary, timestamp: new Date().toISOString() },
      ]);

      setAnalysisResult({
        hasAbusiveClauses: hasAbusive,
        missingSignature: analysis.missingSignature,
        findings: allFindings,
        autoFilled: !!fields.numero || !!fields.empresa,
      });

      const source = llmResult ? 'IA (LLM + local)' : 'IA (local)';
      if (currentUser) {
        addLog(currentUser.id, currentUser.nome, "Contrato analisado via Chat IA", `Arquivo: ${file.name} via ${source}`);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setAnalysisLoading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }, [contratos, addLog, currentUser, appConfig]);

  // --- Save generated contract ---
  const handleSaveContract = () => {
    if (!generatedContract) return;
    const numero = generateContractNumber(contratos.map(c => c.numero));
    addContrato({
      numero,
      descricao: "Contrato gerado via IA",
      empresa: "[Preencher]",
      objeto: "Gerado automaticamente",
      tipo: "Serviço",
      idSetor: setores[0]?.id || "",
      valor: "",
      status: "Vigente",
      dataInicio: new Date().toLocaleDateString("pt-BR"),
      dataVencimento: "",
      criadoPor: currentUser?.id || 'sistema',
    });
    if (currentUser) {
      addLog(currentUser.id, currentUser.nome, "Contrato salvo via Chat IA", `Nº: ${numero}`);
    }
    toast({ title: "✅ Contrato salvo", description: `Contrato ${numero} salvo. Edite os detalhes na página Contratos.` });
    setGeneratedContract(null);
  };

  const handleDownloadContract = (format: 'pdf' | 'docx') => {
    if (!generatedContract) return;
    const safeName = `contrato_gerado_${Date.now()}`;
    if (format === 'pdf') {
      downloadAsPdf(generatedContract, safeName);
    } else {
      downloadAsDocx(generatedContract, safeName);
    }
  };

  // Get last analysis content for the preview panel
  const lastAnalysisContent = (() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'assistant' && chatMessages[i].content.length > 50) {
        return chatMessages[i].content;
      }
    }
    return null;
  })();

  const previewContent = generatedContract || lastAnalysisContent;

  const handleDownloadAnalysis = (format: 'pdf' | 'docx') => {
    if (!previewContent) return;
    const safeName = `analise_contrato_${Date.now()}`;
    // Clean markdown bold markers for export
    const cleanText = previewContent.replace(/\*\*(.*?)\*\*/g, '$1');
    if (format === 'pdf') {
      downloadAsPdf(cleanText, safeName);
    } else {
      downloadAsDocx(cleanText, safeName);
    }
  };

  const handlePrintAnalysis = () => {
    if (!previewContent) return;
    const cleanText = previewContent.replace(/\*\*(.*?)\*\*/g, '$1');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Análise de Contrato</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
        pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 13px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>📄 Análise de Contrato — ${new Date().toLocaleDateString('pt-BR')}</h1>
      <pre>${cleanText}</pre>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Chat IA — Análise de Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envie contratos para análise inteligente: cláusulas abusivas, valores, partes, datas e alertas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${appConfig.llmStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {appConfig.llmStatus === 'connected' ? `🟢 ${appConfig.llmProvider?.toUpperCase()}` : '🔵 Modo local'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: "70vh" }}>
        {/* Chat Panel */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Assistente Jurídico IA</h3>
                <p className="text-[10px] text-muted-foreground">
                  Análise de cláusulas abusivas, valores, partes e prazos
                </p>
              </div>
            </div>
            <input ref={uploadRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleUpload} />
            <button onClick={() => uploadRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload PDF/DOCX
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(70vh - 120px)" }}>
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Análise Inteligente de Contratos</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Faça upload de um PDF/DOCX para análise automática ou digite uma pergunta sobre contratos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 max-w-lg">
                  {[
                    "Analisar cláusulas abusivas do meu contrato",
                    "Quais os riscos deste contrato?",
                    "Gerar contrato de prestação de serviços",
                  ].map((s) => (
                    <button key={s} onClick={() => setChatInput(s)}
                      className="px-3 py-1.5 rounded-full border border-border text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground border border-border/50"
                  }`}>
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : <span key={j}>{part}</span>
                    )}
                  </div>
                  <p className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Analisando contrato...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <button onClick={() => uploadRef.current?.click()} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Upload PDF/DOCX">
                <Upload className="w-4 h-4 text-muted-foreground" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Pergunte sobre contratos ou faça upload para análise..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Analysis / Preview Panel */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {generatedContract ? '📄 Contrato Gerado' : '📋 Análise do Contrato'}
            </h3>
            {previewContent && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {generatedContract && (
                  <button onClick={handleSaveContract}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                    <Save className="w-3 h-3" /> Salvar
                  </button>
                )}
                <button onClick={() => handleDownloadAnalysis('pdf')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button onClick={() => handleDownloadAnalysis('docx')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Download className="w-3 h-3" /> DOCX
                </button>
                <button onClick={handlePrintAnalysis}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {previewContent ? (
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {previewContent.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                  part.startsWith("**") && part.endsWith("**")
                    ? <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  A análise do contrato aparecerá aqui.<br />
                  Use o chat ou faça upload de um PDF/DOCX.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Alert */}
      <AnalysisAlert
        result={analysisResult}
        loading={analysisLoading}
        onClose={() => { setAnalysisResult(null); setAnalysisLoading(false); }}
      />
    </motion.div>
  );
}
