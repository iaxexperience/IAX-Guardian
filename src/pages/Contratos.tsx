import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, FileText, Pencil, Trash2, Clock, X, AlertCircle, Eye, Download, Upload, Send, Loader2 } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import ContratoViewer from "../components/ContratoViewer";
import AnalysisAlert, { type AnalysisResult } from "../components/AnalysisAlert";
import { extractTextFromPdf, extractTextFromDocx, parseContractFields, analyzeContract, analyzeValues, generateContractNumber } from "../utils/pdfAnalyzer";
import { analyzeContractWithLlm } from "../utils/llmService";
import { brToIso, isoToBr } from "../utils/dateUtils";

const statusStyle: Record<string, string> = {
  Vigente: "bg-success/10 text-success",
  Vencendo: "bg-warning/10 text-warning",
  Vencido: "bg-destructive/10 text-destructive",
  Encerrado: "bg-muted text-muted-foreground",
};

// ─── Component ──────────────────────────────────────────────────

export default function Contratos() {
  const { contratos, addContrato, updateContrato, deleteContrato, setores, getSetorNome, addLog, enviarWebhook, addAlerta, appConfig } = useData();
  const { currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterSetor, setFilterSetor] = useState<string>("");

  // PDF viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerData, setViewerData] = useState<{ pdf?: string; nome?: string; numero: string; objeto?: string; empresa?: string; status?: string; vencimento?: string }>({ numero: '' });

  // Webhook state
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);

  // Form fields
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [objeto, setObjeto] = useState("");
  const [tipo, setTipo] = useState("Serviço");
  const [idSetor, setIdSetor] = useState("");
  const [valor, setValor] = useState("");
  const [statusContrato, setStatusContrato] = useState<'Vigente' | 'Vencendo' | 'Vencido' | 'Encerrado'>('Vigente');
  const [dataInicio, setDataInicio] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [arquivoPdf, setArquivoPdf] = useState<string | undefined>(undefined);
  const [nomeArquivo, setNomeArquivo] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Filter by sector for non-admin
  const visibleContracts = isAdmin
    ? contratos
    : contratos.filter(c => c.idSetor === currentUser?.idSetor);

  const filtered = visibleContracts.filter(c => {
    const s = search.toLowerCase();
    const matchesSearch =
      c.numero.toLowerCase().includes(s) ||
      c.empresa.toLowerCase().includes(s) ||
      c.objeto.toLowerCase().includes(s) ||
      getSetorNome(c.idSetor).toLowerCase().includes(s) ||
      c.idSetor.toLowerCase().includes(s);
    const matchesFilter = !filterSetor || c.idSetor === filterSetor;
    return matchesSearch && matchesFilter;
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNumero(""); setDescricao(""); setEmpresa(""); setObjeto("");
    setTipo("Serviço"); setIdSetor(isAdmin ? "" : (currentUser?.idSetor || ""));
    setValor(""); setStatusContrato('Vigente');
    setDataInicio(""); setDataVencimento("");
    setArquivoPdf(undefined); setNomeArquivo(undefined);
    setError(null);
  };

  const handleNew = () => {
    resetForm();
    setIdSetor(isAdmin ? "" : (currentUser?.idSetor || ""));
    setShowForm(true);
  };

  const handleEdit = (c: typeof contratos[0]) => {
    setEditingId(c.id);
    setNumero(c.numero);
    setDescricao(c.descricao);
    setEmpresa(c.empresa);
    setObjeto(c.objeto);
    setTipo(c.tipo);
    setIdSetor(c.idSetor);
    setValor(c.valor);
    setStatusContrato(c.status);
    setDataInicio(brToIso(c.dataInicio));
    setDataVencimento(brToIso(c.dataVencimento));
    setArquivoPdf(c.arquivoPdf);
    setNomeArquivo(c.nomeArquivo);
    setShowForm(true);
    setError(null);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isPdf && !isDocx) {
      setError('Apenas arquivos PDF ou DOCX são permitidos.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Limite de 10MB.');
      return;
    }

    // Read file as base64 (for storage / PDF viewer)
    const dataUri = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setArquivoPdf(dataUri);
    setNomeArquivo(file.name);
    setError(null);

    // Open form if not open
    if (!showForm) {
      setShowForm(true);
      setEditingId(null);
    }

    // Start analysis
    setAnalysisLoading(true);
    setAnalysisResult(null);

    const checkAutoStatus = (venc: string) => {
      if (!venc) return;
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const [y, m, d] = venc.split('-').map(Number);
      const vencDate = new Date(y, m - 1, d);

      if (vencDate < now) setStatusContrato('Vencido');
      else if (vencDate.getTime() - now.getTime() <= thirtyDays) setStatusContrato('Vencendo');
      else setStatusContrato('Vigente');
    };

    try {
      toast({
        title: "🔍 Transcrevendo...",
        description: `Processando "${file.name}" para extração de texto...`
      });

      // Extract text from PDF or DOCX
      const text = isDocx
        ? await extractTextFromDocx(file)
        : await extractTextFromPdf(dataUri);

      // Auto-fill form fields from extracted text (local regex)
      let autoFilled = false;
      let fields: any = {};
      if (text.length > 20) {
        fields = parseContractFields(text);
        const autoNumero = fields.numero || generateContractNumber(contratos.map(c => c.numero));
        if (!numero) { setNumero(autoNumero); autoFilled = true; }
        if (fields.empresa && !empresa) { setEmpresa(fields.empresa); autoFilled = true; }
        if (fields.objeto && !descricao) { setDescricao(fields.objeto); setObjeto(fields.objeto); autoFilled = true; }
        if (fields.valor) { setValor(fields.valor); autoFilled = true; }
        if (fields.dataInicio) { setDataInicio(fields.dataInicio); autoFilled = true; }
        if (fields.dataVencimento) {
          setDataVencimento(fields.dataVencimento);
          checkAutoStatus(fields.dataVencimento);
          autoFilled = true;
        }
        if (fields.tipo) { setTipo(fields.tipo); autoFilled = true; }
      } else {
        if (!numero) {
          setNumero(generateContractNumber(contratos.map(c => c.numero)));
          autoFilled = true;
        }
      }

      // Local AI analysis — clauses + signatures
      const analysis = analyzeContract(text);
      const valueAnalysis = analyzeValues(text);
      let allFindings = [...analysis.findings, ...valueAnalysis.alertas];
      let hasAbusive = analysis.hasAbusiveClauses;

      // LLM-powered deep analysis (if configured)
      const llmResult = await (async () => {
        if (appConfig.llmApiKey && appConfig.llmStatus === 'connected') {
          toast({
            title: "🧠 IA Analisando Contrato",
            description: "Identificando cláusulas, valores e datas com alta precisão..."
          });
          return analyzeContractWithLlm(appConfig, text);
        }
        return null;
      })();

      if (llmResult) {
        // Override fields with LLM results (higher accuracy)
        if (llmResult.empresa && !empresa) { setEmpresa(llmResult.empresa); autoFilled = true; }
        if (llmResult.descricaoObjeto && !descricao) { setDescricao(llmResult.descricaoObjeto); setObjeto(llmResult.descricaoObjeto); autoFilled = true; }
        if (llmResult.valorTotal) { setValor(llmResult.valorTotal); autoFilled = true; }
        if (llmResult.dataInicio) {
          const normalized = llmResult.dataInicio.includes('/') ? brToIso(llmResult.dataInicio) : llmResult.dataInicio;
          setDataInicio(normalized); autoFilled = true;
        }
        if (llmResult.dataVencimento) {
          const normalized = llmResult.dataVencimento.includes('/') ? brToIso(llmResult.dataVencimento) : llmResult.dataVencimento;
          setDataVencimento(normalized);
          checkAutoStatus(normalized);
          autoFilled = true;
        }
        if (llmResult.tipoServico) { setTipo(llmResult.tipoServico); autoFilled = true; }

        // Merge LLM abusive clauses
        if (llmResult.clausulasAbusivas.length > 0) {
          hasAbusive = true;
          llmResult.clausulasAbusivas.forEach(c => {
            const icon = c.severidade === 'alta' ? '🔴' : c.severidade === 'media' ? '⚠️' : '⚡';
            allFindings.push(`${icon} [IA] ${c.descricao}`);
          });
        }
        // Merge LLM alerts
        llmResult.alertas.forEach(a => {
          allFindings.push(`ℹ️ [IA] ${a}`);
        });
      }

      let dateFindings: string[] = [];
      if (fields.dataInicio || (llmResult && llmResult.dataInicio)) dateFindings.push(`📅 Data de início identificada`);
      else dateFindings.push(`❓ Data de início não encontrada no texto`);

      if (fields.dataVencimento || (llmResult && llmResult.dataVencimento)) dateFindings.push(`📅 Data de vencimento identificada`);
      else dateFindings.push(`❓ Data de vencimento não encontrada no texto`);

      setAnalysisResult({
        hasAbusiveClauses: hasAbusive,
        missingSignature: analysis.missingSignature,
        findings: [...allFindings, ...dateFindings],
        autoFilled,
      });

      toast({
        title: "✅ Análise concluída",
        description: autoFilled
          ? "Os campos do formulário foram preenchidos automaticamente."
          : "Documento analisado com sucesso."
      });

      // Generate persistent alerts if critical issues found
      if (hasAbusive) {
        addAlerta({
          tipo: 'clausula_abusiva',
          mensagem: `Cláusula(s) abusiva(s) detectada(s) no documento "${file.name}"`,
          empresa: empresa || undefined,
          urgencia: 'alta',
        });
      }
      if (analysis.missingSignature) {
        addAlerta({
          tipo: 'geral',
          mensagem: `Assinatura não identificada no documento "${file.name}"`,
          empresa: empresa || undefined,
          urgencia: 'media',
        });
      }

      const analysisSource = llmResult ? 'IA (LLM + local)' : 'IA (local)';
      addLog(currentUser!.id, currentUser!.nome, 'Análise IA executada', `Arquivo: ${file.name} — ${allFindings.length} achado(s) via ${analysisSource}`);
    } catch (err) {
      console.warn('Analysis failed:', err);
      setAnalysisResult({
        hasAbusiveClauses: false,
        missingSignature: false,
        findings: ['⚡ Não foi possível analisar o documento automaticamente'],
        autoFilled: false,
      });
    } finally {
      setAnalysisLoading(false);
    }
  }, [showForm, numero, empresa, descricao, valor, dataInicio, dataVencimento, addAlerta, addLog, currentUser, appConfig]);

  const handleSave = () => {
    setError(null);
    if (!numero.trim() || !descricao.trim() || !empresa.trim() || !idSetor) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (editingId) {
      updateContrato(editingId, {
        numero: numero.trim(), descricao: descricao.trim(), empresa: empresa.trim(),
        objeto: objeto.trim() || descricao.trim(), tipo, idSetor, valor, status: statusContrato,
        dataInicio: isoToBr(dataInicio), dataVencimento: isoToBr(dataVencimento), arquivoPdf, nomeArquivo,
      });
      addLog(currentUser!.id, currentUser!.nome, 'Contrato editado', `Contrato: ${numero.trim()}`);
    } else {
      addContrato({
        numero: numero.trim(), descricao: descricao.trim(), empresa: empresa.trim(),
        objeto: objeto.trim() || descricao.trim(), tipo, idSetor, valor, status: statusContrato,
        dataInicio: isoToBr(dataInicio), dataVencimento: isoToBr(dataVencimento), criadoPor: currentUser!.id, arquivoPdf, nomeArquivo,
      });
      addLog(currentUser!.id, currentUser!.nome, 'Contrato criado', `Contrato: ${numero.trim()}`);
    }
    resetForm();
  };

  const handleDelete = (c: typeof contratos[0]) => {
    if (!isAdmin) return;
    if (!confirm(`Deseja excluir o contrato "${c.numero}"? Ele será mantido no registro para auditoria.`)) return;
    deleteContrato(c.id, currentUser!.id);
    addLog(currentUser!.id, currentUser!.nome, 'Contrato excluído', `Contrato: ${c.numero} (soft-delete para auditoria)`);
  };

  const handleView = (c: typeof contratos[0]) => {
    setViewerData({
      pdf: c.arquivoPdf,
      nome: c.nomeArquivo,
      numero: c.numero,
      objeto: c.objeto,
      empresa: c.empresa,
      status: c.status,
      vencimento: c.dataVencimento
    });
    setViewerOpen(true);
  };

  const handleDownload = (c: typeof contratos[0]) => {
    if (!c.arquivoPdf) return;
    const link = document.createElement('a');
    link.href = c.arquivoPdf;
    link.download = c.nomeArquivo || `${c.numero}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendToIA = async (c: typeof contratos[0]) => {
    setSendingWebhook(c.id);
    const payload = {
      contratoId: c.id,
      numero: c.numero,
      descricao: c.descricao,
      empresa: c.empresa,
      objeto: c.objeto,
      tipo: c.tipo,
      valor: c.valor,
      status: c.status,
      dataInicio: c.dataInicio,
      dataVencimento: c.dataVencimento,
      temPdf: !!c.arquivoPdf,
    };
    const result = await enviarWebhook('gptmaker', payload);
    if (result.ok) {
      addLog(currentUser!.id, currentUser!.nome, 'Contrato enviado para IA', `Contrato: ${c.numero}`);
      addAlerta({
        tipo: 'analise_ia',
        mensagem: `Contrato ${c.numero} enviado para análise da IA`,
        idContrato: c.id,
        numeroContrato: c.numero,
        empresa: c.empresa,
        urgencia: 'media',
      });
    } else {
      addLog(currentUser!.id, currentUser!.nome, 'Falha ao enviar para IA', `Contrato: ${c.numero} — ${result.error}`);
      setError(result.error || 'Erro ao enviar para IA');
    }
    setSendingWebhook(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Gerencie todos os contratos da instituição" : `Contratos do setor: ${getSetorNome(currentUser?.idSetor || '')}`}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
        >
          <Plus className="w-4 h-4" /> Novo Contrato
        </button>
      </div>

      {/* Global error */}
      <AnimatePresence>
        {error && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            <button onClick={() => setError(null)} className="ml-auto p-1 rounded hover:bg-destructive/10"><X className="w-3 h-3" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border border-border p-6 space-y-4"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? "Editar Contrato" : "Novo Contrato"}
              </h3>
              <button onClick={resetForm} className="p-1 rounded hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nº Contrato *</label>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FAP-2026-XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Empresa *</label>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option>Serviço</option>
                  <option>Fornecimento</option>
                  <option>Obra</option>
                  <option>Consultoria</option>
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">Descrição / Objeto *</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do contrato"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Setor *</label>
                <select value={idSetor} onChange={(e) => setIdSetor(e.target.value)} disabled={!isAdmin}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60">
                  <option value="">Selecione...</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor</label>
                <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 0,00"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={statusContrato} onChange={(e) => setStatusContrato(e.target.value as typeof statusContrato)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option>Vigente</option>
                  <option>Vencendo</option>
                  <option>Vencido</option>
                  <option>Encerrado</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data Início</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data Vencimento</label>
                <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>

              {/* PDF Upload */}
              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-xs font-medium text-muted-foreground">Arquivo PDF</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload PDF/DOCX
                  </button>
                  {nomeArquivo && (
                    <span className="text-xs text-success truncate max-w-[160px]" title={nomeArquivo}>
                      ✓ {nomeArquivo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                {editingId ? "Salvar Alterações" : "Criar Contrato"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nº, empresa ou objeto..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
          />
        </div>
        {isAdmin && (
          <select
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground"
          >
            <option value="">Todos os setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Nº Contrato</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Objeto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Vencimento</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${c.arquivoPdf ? 'text-primary' : 'text-muted-foreground'}`} />
                      {c.numero}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{c.empresa}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{c.objeto}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.tipo}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{getSetorNome(c.idSetor)}</td>
                  <td className="px-5 py-3.5 font-medium text-foreground hidden md:table-cell">{c.valor}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.dataVencimento}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => handleView(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Visualizar">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {c.arquivoPdf && (
                        <button onClick={() => handleDownload(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Baixar PDF">
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Editar">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                      <button
                        onClick={() => handleSendToIA(c)}
                        disabled={sendingWebhook === c.id}
                        className="p-1.5 rounded-md hover:bg-accent/10 transition-colors disabled:opacity-50"
                        title="Enviar para análise IA"
                      >
                        {sendingWebhook === c.id
                          ? <Loader2 className="w-4 h-4 text-accent animate-spin" />
                          : <Send className="w-4 h-4 text-accent" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum contrato encontrado.</div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <ContratoViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        arquivoPdf={viewerData.pdf}
        nomeArquivo={viewerData.nome}
        numeroContrato={viewerData.numero}
        objeto={viewerData.objeto}
        empresa={viewerData.empresa}
        status={viewerData.status}
        vencimento={viewerData.vencimento}
      />

      {/* AI Analysis Alert */}
      <AnalysisAlert
        result={analysisResult}
        loading={analysisLoading}
        onClose={() => { setAnalysisResult(null); setAnalysisLoading(false); }}
      />
    </motion.div>
  );
}
