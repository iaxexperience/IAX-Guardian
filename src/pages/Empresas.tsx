import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Building2, Upload, Image } from "lucide-react";

const empresas = [
  { id: 1, nome: "Fundação Assistencial da Paraíba", sigla: "FAP", logo: null },
  { id: 2, nome: "Hospital Regional de Campina Grande", sigla: "HRCG", logo: null },
  { id: 3, nome: "Centro de Saúde Integrada", sigla: "CSI", logo: null },
];

export default function Empresas() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = empresas.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Empresas Contratadas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as empresas que contratam os serviços</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Nova Empresa
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-6 space-y-4"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <h3 className="text-lg font-semibold text-foreground">Nova Empresa Contratada</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome da Empresa</label>
              <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Logomarca</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                  <Upload className="w-4 h-4" /> Upload
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Salvar
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="bg-card rounded-xl border border-border p-6 flex items-center gap-4 hover:shadow-md transition-all"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">{e.nome}</h3>
              <p className="text-xs text-muted-foreground">{e.sigla}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
