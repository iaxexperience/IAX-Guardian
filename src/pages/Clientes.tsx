import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Users, Building2, Phone, Mail, MapPin, MoreHorizontal } from "lucide-react";

const clientes = [
  { id: 1, nomeFantasia: "TecSistemas", razaoSocial: "TecSistemas Informática Ltda", cnpj: "12.345.678/0001-90", classificacao: "Matriz", cidade: "João Pessoa - PB", contato: "Carlos Silva", email: "carlos@tecsistemas.com", telefone: "(83) 3333-4444" },
  { id: 2, nomeFantasia: "MedClean", razaoSocial: "MedClean Produtos Hospitalares S.A.", cnpj: "98.765.432/0001-10", classificacao: "Matriz", cidade: "Recife - PE", contato: "Maria Santos", email: "maria@medclean.com", telefone: "(81) 2222-3333" },
  { id: 3, nomeFantasia: "Construtora Norte", razaoSocial: "Construtora Norte Engenharia Ltda", cnpj: "11.222.333/0001-44", classificacao: "Filial", cidade: "Campina Grande - PB", contato: "João Oliveira", email: "joao@construtoranorte.com", telefone: "(83) 9999-8888" },
  { id: 4, nomeFantasia: "Alimentos Brasil", razaoSocial: "Alimentos Brasil Distribuidora", cnpj: "55.666.777/0001-88", classificacao: "Parceiro", cidade: "Natal - RN", contato: "Ana Souza", email: "ana@alimentosbrasil.com", telefone: "(84) 7777-6666" },
  { id: 5, nomeFantasia: "Seg Total", razaoSocial: "Seg Total Segurança Patrimonial Ltda", cnpj: "33.444.555/0001-22", classificacao: "Matriz", cidade: "João Pessoa - PB", contato: "Pedro Lima", email: "pedro@segtotal.com", telefone: "(83) 5555-1111" },
];

const classStyle: Record<string, string> = {
  Matriz: "bg-info/10 text-info",
  Filial: "bg-accent/10 text-accent",
  Parceiro: "bg-success/10 text-success",
};

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = clientes.filter(
    (c) =>
      c.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
      c.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de empresas e pessoas físicas contratadas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* New Client Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-6 space-y-6"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <h3 className="text-lg font-semibold text-foreground">Cadastro de Novo Cliente</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome Fantasia</label>
              <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Razão Social</label>
              <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
              <input placeholder="00.000.000/0001-00" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Classificação</label>
              <select className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                <option>Matriz</option>
                <option>Filial</option>
                <option>Parceiro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inscrição Estadual</label>
              <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inscrição Municipal</label>
              <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" /> Endereço
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">CEP</label>
                <input placeholder="00000-000" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Logradouro</label>
                <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bairro</label>
                <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" /> Contato Principal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <input className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <input type="email" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input placeholder="(00) 0000-0000" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Salvar Cliente
            </button>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, razão social ou CNPJ..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
        />
      </div>

      {/* Client cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200 group"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{c.nomeFantasia}</h3>
                  <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${classStyle[c.classificacao]}`}>
                {c.classificacao}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 truncate">{c.razaoSocial}</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {c.cidade}</div>
              <div className="flex items-center gap-2"><Users className="w-3 h-3" /> {c.contato}</div>
              <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {c.email}</div>
              <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {c.telefone}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
