import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Setor, User, Contrato, LogEntry, Alerta, AppConfig, ModeloContrato } from '../types';
import { supabase } from '@/integrations/supabase/client';

// --- Simple hash for passwords (sync, deterministic) ---
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

// --- Seed data ---
const SEED_SETORES: Setor[] = [
    { id: 's1', nome: 'Tecnologia da Informação' },
    { id: 's2', nome: 'Logística' },
    { id: 's3', nome: 'Infraestrutura' },
    { id: 's4', nome: 'Nutrição' },
    { id: 's5', nome: 'Saúde' },
    { id: 's6', nome: 'Segurança' },
    { id: 's7', nome: 'Administrativo' },
    { id: 's8', nome: 'Recursos Humanos' },
    { id: 's9', nome: 'Jurídico' },
];

const SEED_USERS: User[] = [
    { id: 'u0', nome: 'Administrador', login: 'admin', senhaHash: simpleHash('admin123'), idSetor: null, role: 'admin', status: 'ativo', criadoEm: '2026-01-01T00:00:00' },
    { id: 'u1', nome: 'Carlos Silva', login: 'carlos', senhaHash: simpleHash('123456'), idSetor: 's1', role: 'setor', status: 'ativo', criadoEm: '2026-01-15T00:00:00' },
    { id: 'u2', nome: 'Maria Santos', login: 'maria', senhaHash: simpleHash('123456'), idSetor: 's2', role: 'setor', status: 'ativo', criadoEm: '2026-01-15T00:00:00' },
    { id: 'u3', nome: 'Pedro Lima', login: 'pedro', senhaHash: simpleHash('123456'), idSetor: 's6', role: 'setor', status: 'inativo', criadoEm: '2026-01-20T00:00:00' },
];

const SEED_CONTRATOS: Contrato[] = [
    { id: 'c1', numero: 'FAP-2026-0247', descricao: 'Manutenção de equipamentos de TI', empresa: 'TecSistemas Ltda', objeto: 'Manutenção de equipamentos de TI', tipo: 'Serviço', idSetor: 's1', valor: 'R$ 48.000,00', status: 'Vigente', dataInicio: '14/02/2026', dataVencimento: '14/08/2026', criadoPor: 'u0', criadoEm: '2026-02-14T00:00:00' },
    { id: 'c2', numero: 'FAP-2026-0246', descricao: 'Fornecimento de materiais de limpeza hospitalar', empresa: 'MedClean S.A.', objeto: 'Fornecimento de materiais de limpeza hospitalar', tipo: 'Fornecimento', idSetor: 's2', valor: 'R$ 120.000,00', status: 'Vigente', dataInicio: '01/01/2026', dataVencimento: '02/05/2026', criadoPor: 'u0', criadoEm: '2026-01-01T00:00:00' },
    { id: 'c3', numero: 'FAP-2026-0245', descricao: 'Reforma do bloco B', empresa: 'Construtora Norte', objeto: 'Reforma do bloco B', tipo: 'Obra', idSetor: 's3', valor: 'R$ 350.000,00', status: 'Vencendo', dataInicio: '01/06/2025', dataVencimento: '28/02/2026', criadoPor: 'u0', criadoEm: '2025-06-01T00:00:00' },
    { id: 'c4', numero: 'FAP-2026-0244', descricao: 'Fornecimento de alimentação', empresa: 'Alimentos Brasil', objeto: 'Fornecimento de alimentação', tipo: 'Fornecimento', idSetor: 's4', valor: 'R$ 200.000,00', status: 'Vigente', dataInicio: '01/03/2026', dataVencimento: '10/11/2026', criadoPor: 'u0', criadoEm: '2026-03-01T00:00:00' },
    { id: 'c5', numero: 'FAP-2025-0243A', descricao: 'Vigilância patrimonial', empresa: 'Seg Total Ltda', objeto: 'Vigilância patrimonial', tipo: 'Serviço', idSetor: 's6', valor: 'R$ 96.000,00', status: 'Vencido', dataInicio: '01/01/2025', dataVencimento: '01/01/2026', criadoPor: 'u0', criadoEm: '2025-01-01T00:00:00' },
    { id: 'c6', numero: 'FAP-2025-0242', descricao: 'Exames laboratoriais', empresa: 'Lab Análises Clínicas', objeto: 'Exames laboratoriais', tipo: 'Serviço', idSetor: 's5', valor: 'R$ 75.000,00', status: 'Encerrado', dataInicio: '01/04/2025', dataVencimento: '01/10/2025', criadoPor: 'u0', criadoEm: '2025-04-01T00:00:00' },
];

const DEFAULT_CONFIG: AppConfig = {};

// --- LocalStorage helpers ---
const LS_KEYS = {
    setores: 'lwp_setores',
    usuarios: 'lwp_usuarios',
    contratos: 'lwp_contratos',
    logs: 'lwp_logs',
    alertas: 'lwp_alertas',
    appConfig: 'lwp_appConfig',
    modelos: 'lwp_modelos',
    seeded: 'lwp_seeded',
};

function loadLS<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function saveLS<T>(key: string, data: T) {
    localStorage.setItem(key, JSON.stringify(data));
}

// --- Context ---
interface DataContextType {
    // Setores
    setores: Setor[];
    addSetor: (nome: string) => Setor | null;
    updateSetor: (id: string, nome: string) => boolean;
    deleteSetor: (id: string) => boolean;
    getSetorNome: (id: string) => string;
    // Usuarios
    usuarios: User[];
    addUsuario: (data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }) => User | null;
    updateUsuario: (id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }) => boolean;
    toggleUsuarioStatus: (id: string) => boolean;
    findUserByLogin: (login: string) => User | undefined;
    validatePassword: (user: User, password: string) => boolean;
    // Contratos
    contratos: Contrato[];
    addContrato: (data: Omit<Contrato, 'id' | 'criadoEm'>) => Contrato;
    updateContrato: (id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>) => boolean;
    deleteContrato: (id: string, userId: string) => boolean;
    contratosExcluidos: Contrato[];
    // Alertas
    alertas: Alerta[];
    addAlerta: (data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>) => Alerta;
    marcarAlertaLido: (id: string) => void;
    deleteAlerta: (id: string) => void;
    contratosVencendo: Contrato[];
    // AppConfig
    appConfig: AppConfig;
    setAppConfig: (cfg: Partial<AppConfig>) => void;
    // Logs
    logs: LogEntry[];
    addLog: (idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => void;
    // Webhook
    enviarWebhook: (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
    // Utility
    simpleHash: (str: string) => string;
    // Modelos
    modelos: ModeloContrato[];
    addModelo: (data: Omit<ModeloContrato, 'id' | 'criadoEm'>) => ModeloContrato;
    updateModelo: (id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>) => boolean;
    deleteModelo: (id: string) => boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within DataProvider');
    return ctx;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Parse DD/MM/YYYY to Date
function parseDateBR(str: string): Date | null {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [setores, setSetores] = useState<Setor[]>(() => {
        if (!localStorage.getItem(LS_KEYS.seeded)) {
            saveLS(LS_KEYS.setores, SEED_SETORES);
            saveLS(LS_KEYS.usuarios, SEED_USERS);
            saveLS(LS_KEYS.contratos, SEED_CONTRATOS);
            saveLS(LS_KEYS.logs, []);
            saveLS(LS_KEYS.alertas, []);
            saveLS(LS_KEYS.appConfig, DEFAULT_CONFIG);
            localStorage.setItem(LS_KEYS.seeded, 'true');
            return SEED_SETORES;
        }
        return loadLS<Setor[]>(LS_KEYS.setores, SEED_SETORES);
    });
    const [usuarios, setUsuarios] = useState<User[]>(() => loadLS<User[]>(LS_KEYS.usuarios, SEED_USERS));
    const [contratos, setContratos] = useState<Contrato[]>(() => loadLS<Contrato[]>(LS_KEYS.contratos, SEED_CONTRATOS));
    const [logs, setLogs] = useState<LogEntry[]>(() => loadLS<LogEntry[]>(LS_KEYS.logs, []));
    const [alertas, setAlertas] = useState<Alerta[]>(() => loadLS<Alerta[]>(LS_KEYS.alertas, []));
    const [appConfig, setAppConfigState] = useState<AppConfig>(() => loadLS<AppConfig>(LS_KEYS.appConfig, DEFAULT_CONFIG));
    const [modelos, setModelos] = useState<ModeloContrato[]>(() => loadLS<ModeloContrato[]>(LS_KEYS.modelos, []));
    const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const configLoaded = useRef(false);

    // Auto-update statuses based on dates
    useEffect(() => {
        const checkStatuses = () => {
            const now = new Date();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            let changed = false;

            const updatedContratos = contratos.map(c => {
                if (c.status === 'Encerrado' || c.excluido) return c;

                const venc = parseDateBR(c.dataVencimento);
                if (!venc) return c;

                let newStatus = c.status;
                if (venc < now) {
                    newStatus = 'Vencido';
                } else if (venc.getTime() - now.getTime() <= thirtyDays) {
                    newStatus = 'Vencendo';
                } else {
                    newStatus = 'Vigente';
                }

                if (newStatus !== c.status) {
                    changed = true;
                    return { ...c, status: newStatus as any };
                }
                return c;
            });

            if (changed) {
                setContratos(updatedContratos);
            }
        };

        checkStatuses();
        // Check once an hour if app stays open
        const interval = setInterval(checkStatuses, 3600000);
        return () => clearInterval(interval);
    }, [contratos.length]);

    // Load config from database on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const { data } = await supabase
                    .from('app_config')
                    .select('config')
                    .eq('id', 'default')
                    .single();
                if (data?.config && typeof data.config === 'object') {
                    const dbConfig = data.config as Record<string, unknown>;
                    setAppConfigState(prev => {
                        const merged = { ...prev, ...dbConfig } as AppConfig;
                        saveLS(LS_KEYS.appConfig, merged);
                        return merged;
                    });
                }
            } catch {
                // fallback to localStorage
            }
            configLoaded.current = true;
        };
        loadConfig();
    }, []);

    // Persist on change
    useEffect(() => { saveLS(LS_KEYS.setores, setores); }, [setores]);
    useEffect(() => { saveLS(LS_KEYS.usuarios, usuarios); }, [usuarios]);
    useEffect(() => { saveLS(LS_KEYS.contratos, contratos); }, [contratos]);
    useEffect(() => { saveLS(LS_KEYS.logs, logs); }, [logs]);
    useEffect(() => { saveLS(LS_KEYS.alertas, alertas); }, [alertas]);
    useEffect(() => {
        saveLS(LS_KEYS.appConfig, appConfig);
        // Debounced save to database via edge function
        if (configLoaded.current) {
            if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
            configSaveTimer.current = setTimeout(async () => {
                try {
                    await fetch(
                        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/save-config`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ config: JSON.parse(JSON.stringify(appConfig)) }),
                        }
                    );
                } catch {
                    // fallback silently
                }
            }, 1000);
        }
    }, [appConfig]);
    useEffect(() => { saveLS(LS_KEYS.modelos, modelos); }, [modelos]);

    // --- Active contracts (exclude soft-deleted) ---
    const contratosAtivos = useMemo(() => contratos.filter(c => !c.excluido), [contratos]);
    const contratosExcluidos = useMemo(() => contratos.filter(c => c.excluido), [contratos]);

    // --- Contracts approaching expiry ---
    const contratosVencendo = useMemo(() => {
        const now = new Date();
        const limit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return contratosAtivos.filter(c => {
            if (c.status === 'Encerrado') return false;
            const venc = parseDateBR(c.dataVencimento);
            if (!venc) return false;
            return venc <= limit;
        });
    }, [contratosAtivos]);

    // --- Alertas ---
    const addAlerta = useCallback((data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>): Alerta => {
        const novo: Alerta = {
            ...data,
            id: 'al_' + generateId(),
            lido: false,
            criadoEm: new Date().toISOString(),
        };
        setAlertas(prev => [novo, ...prev]);
        return novo;
    }, []);

    const marcarAlertaLido = useCallback((id: string) => {
        setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
    }, []);

    const deleteAlerta = useCallback((id: string) => {
        setAlertas(prev => prev.filter(a => a.id !== id));
    }, []);

    // --- Setores ---
    const addSetor = useCallback((nome: string): Setor | null => {
        const trimmed = nome.trim();
        if (!trimmed) return null;
        if (setores.some(s => s.nome.toLowerCase() === trimmed.toLowerCase())) return null;
        const novo: Setor = { id: 'st_' + generateId(), nome: trimmed };
        setSetores(prev => [...prev, novo]);
        return novo;
    }, [setores]);

    const updateSetor = useCallback((id: string, nome: string): boolean => {
        const trimmed = nome.trim();
        if (!trimmed) return false;
        if (setores.some(s => s.id !== id && s.nome.toLowerCase() === trimmed.toLowerCase())) return false;
        setSetores(prev => prev.map(s => s.id === id ? { ...s, nome: trimmed } : s));
        return true;
    }, [setores]);

    const deleteSetor = useCallback((id: string): boolean => {
        if (usuarios.some(u => u.idSetor === id)) return false;
        if (contratos.some(c => c.idSetor === id)) return false;
        setSetores(prev => prev.filter(s => s.id !== id));
        return true;
    }, [usuarios, contratos]);

    const getSetorNome = useCallback((id: string): string => {
        return setores.find(s => s.id === id)?.nome || '—';
    }, [setores]);

    // --- Usuarios ---
    const addUsuario = useCallback((data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }): User | null => {
        if (usuarios.some(u => u.login.toLowerCase() === data.login.toLowerCase())) return null;
        const novo: User = {
            id: 'us_' + generateId(),
            nome: data.nome,
            login: data.login,
            senhaHash: simpleHash(data.senha),
            idSetor: data.idSetor,
            role: data.role,
            status: data.status,
            criadoEm: new Date().toISOString(),
        };
        setUsuarios(prev => [...prev, novo]);
        return novo;
    }, [usuarios]);

    const updateUsuario = useCallback((id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }): boolean => {
        if (data.login && usuarios.some(u => u.id !== id && u.login.toLowerCase() === data.login!.toLowerCase())) return false;
        setUsuarios(prev => prev.map(u => {
            if (u.id !== id) return u;
            const updated = { ...u };
            if (data.nome !== undefined) updated.nome = data.nome;
            if (data.login !== undefined) updated.login = data.login;
            if (data.idSetor !== undefined) updated.idSetor = data.idSetor;
            if (data.role !== undefined) updated.role = data.role;
            if (data.status !== undefined) updated.status = data.status;
            if (data.senha) updated.senhaHash = simpleHash(data.senha);
            return updated;
        }));
        return true;
    }, [usuarios]);

    const toggleUsuarioStatus = useCallback((id: string): boolean => {
        setUsuarios(prev => prev.map(u => {
            if (u.id === id) {
                const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo';
                addAlerta({
                    tipo: 'geral',
                    urgencia: 'media',
                    mensagem: `Status do usuário ${u.nome} alterado para ${newStatus.toUpperCase()}`,
                    empresa: 'Gestão de Acessos'
                });
                return { ...u, status: newStatus };
            }
            return u;
        }));
        return true;
    }, [addAlerta]);

    const findUserByLogin = useCallback((login: string): User | undefined => {
        return usuarios.find(u => u.login.toLowerCase() === login.toLowerCase());
    }, [usuarios]);

    const validatePassword = useCallback((user: User, password: string): boolean => {
        return user.senhaHash === simpleHash(password);
    }, []);

    // --- Contratos ---
    const addContrato = useCallback((data: Omit<Contrato, 'id' | 'criadoEm'>): Contrato => {
        const novo: Contrato = {
            ...data,
            id: 'ct_' + generateId(),
            criadoEm: new Date().toISOString(),
        };
        setContratos(prev => [...prev, novo]);
        return novo;
    }, []);

    const updateContrato = useCallback((id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>): boolean => {
        setContratos(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        return true;
    }, []);

    const deleteContrato = useCallback((id: string, userId: string): boolean => {
        setContratos(prev => prev.map(c => {
            if (c.id === id) {
                addAlerta({
                    tipo: 'geral',
                    urgencia: 'alta',
                    mensagem: `Contrato excluído: ${c.numero} — ${c.empresa}`,
                    empresa: 'Auditoria de Contratos'
                });
                return {
                    ...c,
                    excluido: true,
                    excluidoPor: userId,
                    excluidoEm: new Date().toISOString(),
                };
            }
            return c;
        }));
        return true;
    }, [addAlerta]);


    // --- AppConfig ---
    const setAppConfig = useCallback((cfg: Partial<AppConfig>) => {
        setAppConfigState(prev => ({ ...prev, ...cfg }));
    }, []);

    // --- Logs ---
    const addLog = useCallback((idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => {
        const entry: LogEntry = {
            id: 'lg_' + generateId(),
            idUsuario,
            nomeUsuario,
            acao,
            detalhes,
            timestamp: new Date().toISOString(),
        };
        setLogs(prev => [entry, ...prev]);
    }, []);

    // --- Webhook ---
    const enviarWebhook = useCallback(async (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
        const url = tipo === 'gptmaker' ? appConfig.webhookGptMaker : appConfig.webhookN8n;
        if (!url) {
            return { ok: false, error: `URL do webhook ${tipo} não configurada. Configure em Configurações → Integrações.` };
        }
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                return { ok: false, error: `Webhook retornou status ${resp.status}` };
            }
            return { ok: true };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            return { ok: false, error: msg };
        }
    }, [appConfig.webhookGptMaker, appConfig.webhookN8n]);

    // --- Modelos CRUD ---
    const addModelo = useCallback((data: Omit<ModeloContrato, 'id' | 'criadoEm'>): ModeloContrato => {
        const modelo: ModeloContrato = { ...data, id: generateId(), criadoEm: new Date().toISOString() };
        setModelos(prev => [...prev, modelo]);
        return modelo;
    }, []);

    const updateModelo = useCallback((id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>): boolean => {
        setModelos(prev => prev.map(m => m.id === id ? { ...m, ...data, atualizadoEm: new Date().toISOString() } : m));
        return true;
    }, []);

    const deleteModelo = useCallback((id: string): boolean => {
        setModelos(prev => prev.filter(m => m.id !== id));
        return true;
    }, []);

    return (
        <DataContext.Provider value={{
            setores, addSetor, updateSetor, deleteSetor, getSetorNome,
            usuarios, addUsuario, updateUsuario, toggleUsuarioStatus, findUserByLogin, validatePassword,
            contratos: contratosAtivos, addContrato, updateContrato, deleteContrato, contratosExcluidos,
            alertas, addAlerta, marcarAlertaLido, deleteAlerta, contratosVencendo,
            appConfig, setAppConfig,
            logs, addLog,
            enviarWebhook,
            simpleHash,
            modelos, addModelo, updateModelo, deleteModelo,
        }}>
            {children}
        </DataContext.Provider>
    );
}
