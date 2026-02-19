import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Setor, User, Contrato, LogEntry, Alerta, AppConfig, ModeloContrato } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface DataContextType {
    // Setores
    setores: Setor[];
    addSetor: (nome: string) => Promise<Setor | null>;
    updateSetor: (id: string, nome: string) => Promise<boolean>;
    deleteSetor: (id: string) => Promise<boolean>;
    getSetorNome: (id: string) => string;
    // Usuarios
    usuarios: User[];
    addUsuario: (data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }) => Promise<User | null>;
    updateUsuario: (id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }) => Promise<boolean>;
    toggleUsuarioStatus: (id: string) => Promise<boolean>;
    findUserByLogin: (login: string) => User | undefined;
    // Contratos
    contratos: Contrato[];
    addContrato: (data: Omit<Contrato, 'id' | 'criadoEm'>) => Promise<Contrato | null>;
    updateContrato: (id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>) => Promise<boolean>;
    deleteContrato: (id: string, userId: string) => Promise<boolean>;
    contratosExcluidos: Contrato[];
    // Alertas
    alertas: Alerta[];
    addAlerta: (data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>) => Promise<Alerta | null>;
    marcarAlertaLido: (id: string) => Promise<void>;
    deleteAlerta: (id: string) => Promise<void>;
    contratosVencendo: Contrato[];
    // AppConfig
    appConfig: AppConfig;
    setAppConfig: (cfg: Partial<AppConfig>) => Promise<void>;
    // Logs
    logs: LogEntry[];
    addLog: (idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => Promise<void>;
    // Webhook
    enviarWebhook: (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
    // Modelos
    modelos: ModeloContrato[];
    addModelo: (data: Omit<ModeloContrato, 'id' | 'criadoEm'>) => Promise<ModeloContrato | null>;
    updateModelo: (id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>) => Promise<boolean>;
    deleteModelo: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within DataProvider');
    return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [setores, setSetores] = useState<Setor[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [appConfig, setAppConfigState] = useState<AppConfig>({});
    const [modelos, setModelos] = useState<ModeloContrato[]>([]);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            const [
                { data: sData },
                { data: uData },
                { data: cData },
                { data: lData },
                { data: aData },
                { data: configData },
                { data: mData }
            ] = await Promise.all([
                supabase.from('setores').select('*'),
                supabase.from('usuarios').select('*'),
                supabase.from('contratos').select('*'),
                supabase.from('logs').select('*').order('timestamp', { ascending: false }),
                supabase.from('alertas').select('*').order('criado_em', { ascending: false }),
                supabase.from('app_config').select('config').eq('id', 'default').single(),
                supabase.from('modelos_contratos').select('*')
            ]);

            if (sData) setSetores(sData.map(s => ({ id: s.id, nome: s.nome })));
            if (uData) setUsuarios(uData.map(u => ({
                id: u.id,
                nome: u.nome,
                login: u.login,
                email: u.email,
                senhaHash: 'auth_managed',
                idSetor: u.id_setor,
                role: u.role as 'admin' | 'setor',
                status: u.status === 'active' ? 'ativo' : 'inativo',
                criadoEm: u.criado_em
            })));
            if (cData) setContratos(cData.map(c => ({
                id: c.id,
                numero: c.numero,
                empresa: c.empresa,
                objeto: c.objeto || '',
                descricao: c.descricao || '',
                valor: c.valor || '',
                tipo: c.tipo || '',
                idSetor: c.id_setor,
                status: c.status as any,
                dataInicio: new Date(c.data_inicio).toLocaleDateString('pt-BR'),
                dataVencimento: new Date(c.data_vencimento).toLocaleDateString('pt-BR'),
                criadoPor: c.criado_por || '',
                criadoEm: c.criado_em,
                arquivoPdf: c.arquivo_pdf || undefined,
                nomeArquivo: c.nome_arquivo || undefined,
                excluido: c.excluido,
                excluidoPor: c.excluido_por || undefined,
                excluidoEm: c.excluido_em || undefined,
            })));
            if (lData) setLogs(lData.map(l => ({
                id: l.id,
                idUsuario: l.id_usuario,
                nomeUsuario: l.nome_usuario,
                acao: l.acao,
                detalhes: l.detalhes || '',
                timestamp: l.timestamp
            })));
            if (aData) setAlertas(aData.map(a => ({
                id: a.id,
                tipo: a.tipo as any,
                mensagem: a.mensagem,
                urgencia: a.urgencia as any,
                lido: a.lido,
                criadoEm: a.criado_em,
                idContrato: a.id_contrato || undefined,
                numeroContrato: a.numero_contrato || undefined,
                empresa: a.empresa || undefined,
            })));
            if (configData?.config) setAppConfigState(configData.config as AppConfig);
            if (mData) setModelos(mData.map(m => ({
                id: m.id,
                nome: m.nome,
                tipo: m.tipo,
                descricao: m.descricao || '',
                tags: m.tags || [],
                conteudo: m.conteudo,
                criadoPor: m.criado_por || '',
                criadoEm: m.criado_em,
                atualizadoEm: m.atualizado_em || undefined,
            })));
        };

        fetchData();
    }, []);

    // --- Computed ---
    const contratosAtivos = useMemo(() => contratos.filter(c => !c.excluido), [contratos]);
    const contratosExcluidos = useMemo(() => contratos.filter(c => c.excluido), [contratos]);
    const contratosVencendo = useMemo(() => contratosAtivos.filter(c => c.status === 'Vencendo'), [contratosAtivos]);

    // --- Setores ---
    const addSetor = useCallback(async (nome: string): Promise<Setor | null> => {
        const { data, error } = await supabase.from('setores').insert({ nome }).select().single();
        if (data && !error) {
            const novo = { id: data.id, nome: data.nome };
            setSetores(prev => [...prev, novo]);
            return novo;
        }
        return null;
    }, []);

    const updateSetor = useCallback(async (id: string, nome: string): Promise<boolean> => {
        const { error } = await supabase.from('setores').update({ nome }).eq('id', id);
        if (!error) {
            setSetores(prev => prev.map(s => s.id === id ? { ...s, nome } : s));
            return true;
        }
        return false;
    }, []);

    const deleteSetor = useCallback(async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('setores').delete().eq('id', id);
        if (!error) {
            setSetores(prev => prev.filter(s => s.id !== id));
            return true;
        }
        return false;
    }, []);

    const getSetorNome = useCallback((id: string): string => {
        return setores.find(s => s.id === id)?.nome || '—';
    }, [setores]);

    // --- Usuarios ---
    const addUsuario = useCallback(async (data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }): Promise<User | null> => {
        const { data: dbData, error } = await supabase.from('usuarios').insert({
            nome: data.nome,
            login: data.login,
            email: data.email,
            id_setor: data.idSetor,
            role: data.role,
            status: data.status === 'ativo' ? 'active' : 'inactive'
        }).select().single();

        if (dbData && !error) {
            const novo: User = {
                id: dbData.id,
                nome: dbData.nome,
                login: dbData.login,
                email: dbData.email,
                senhaHash: 'auth_managed',
                idSetor: dbData.id_setor,
                role: dbData.role as any,
                status: dbData.status === 'active' ? 'ativo' : 'inativo',
                criadoEm: dbData.criado_em,
            };
            setUsuarios(prev => [...prev, novo]);
            return novo;
        }
        return null;
    }, []);

    const updateUsuario = useCallback(async (id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }): Promise<boolean> => {
        const dbUpdate: any = {};
        if (data.nome) dbUpdate.nome = data.nome;
        if (data.login) dbUpdate.login = data.login;
        if (data.idSetor !== undefined) dbUpdate.id_setor = data.idSetor;
        if (data.role) dbUpdate.role = data.role;
        if (data.status) dbUpdate.status = data.status === 'ativo' ? 'active' : 'inactive';

        const { error } = await supabase.from('usuarios').update(dbUpdate).eq('id', id);
        if (!error) {
            setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
            return true;
        }
        return false;
    }, []);

    const toggleUsuarioStatus = useCallback(async (id: string): Promise<boolean> => {
        const user = usuarios.find(u => u.id === id);
        if (!user) return false;
        const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
        const { error } = await supabase.from('usuarios').update({
            status: newStatus === 'ativo' ? 'active' : 'inactive'
        }).eq('id', id);

        if (!error) {
            setUsuarios(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
            return true;
        }
        return false;
    }, [usuarios]);

    const findUserByLogin = useCallback((login: string): User | undefined => {
        return usuarios.find(u => u.login.toLowerCase() === login.toLowerCase());
    }, [usuarios]);

    // --- Contratos ---
    const addContrato = useCallback(async (data: Omit<Contrato, 'id' | 'criadoEm'>): Promise<Contrato | null> => {
        const [d, m, y] = data.dataInicio.split('/').map(Number);
        const [vd, vm, vy] = data.dataVencimento.split('/').map(Number);

        const { data: dbData, error } = await supabase.from('contratos').insert({
            numero: data.numero,
            empresa: data.empresa,
            objeto: data.objeto,
            descricao: data.descricao,
            valor: data.valor,
            tipo: data.tipo,
            id_setor: data.idSetor,
            status: data.status,
            data_inicio: `${y}-${m}-${d}`,
            data_vencimento: `${vy}-${vm}-${vd}`,
            criado_por: data.criadoPor,
            arquivo_pdf: data.arquivoPdf,
            nome_arquivo: data.nomeArquivo,
        }).select().single();

        if (dbData && !error) {
            const novo: Contrato = { ...data, id: dbData.id, criadoEm: dbData.criado_em };
            setContratos(prev => [...prev, novo]);
            return novo;
        }
        return null;
    }, []);

    const updateContrato = useCallback(async (id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>): Promise<boolean> => {
        const dbUpdate: any = {};
        if (data.numero) dbUpdate.numero = data.numero;
        if (data.empresa) dbUpdate.empresa = data.empresa;
        if (data.status) dbUpdate.status = data.status;
        // ... handle other fields mapping

        const { error } = await supabase.from('contratos').update(dbUpdate).eq('id', id);
        if (!error) {
            setContratos(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
            return true;
        }
        return false;
    }, []);

    const deleteContrato = useCallback(async (id: string, userId: string): Promise<boolean> => {
        const { error } = await supabase.from('contratos').update({
            excluido: true,
            excluido_por: userId,
            excluido_em: new Date().toISOString()
        }).eq('id', id);

        if (!error) {
            setContratos(prev => prev.map(c => c.id === id ? { ...c, excluido: true, excluidoPor: userId, excluidoEm: new Date().toISOString() } : c));
            return true;
        }
        return false;
    }, []);

    // --- Alertas ---
    const addAlerta = useCallback(async (data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>): Promise<Alerta | null> => {
        const { data: dbData, error } = await supabase.from('alertas').insert({
            tipo: data.tipo,
            mensagem: data.mensagem,
            urgencia: data.urgencia,
            id_contrato: data.idContrato,
            numero_contrato: data.numeroContrato,
            empresa: data.empresa,
        }).select().single();

        if (dbData && !error) {
            const novo: Alerta = { ...data, id: dbData.id, criadoEm: dbData.criado_em, lido: false };
            setAlertas(prev => [novo, ...prev]);
            return novo;
        }
        return null;
    }, []);

    const marcarAlertaLido = useCallback(async (id: string) => {
        const { error } = await supabase.from('alertas').update({ lido: true }).eq('id', id);
        if (!error) {
            setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
        }
    }, []);

    const deleteAlerta = useCallback(async (id: string) => {
        const { error } = await supabase.from('alertas').delete().eq('id', id);
        if (!error) {
            setAlertas(prev => prev.filter(a => a.id !== id));
        }
    }, []);

    // --- Logs ---
    const addLog = useCallback(async (idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => {
        const { data, error } = await supabase.from('logs').insert({
            id_usuario: idUsuario,
            nome_usuario: nomeUsuario,
            acao,
            detalhes
        }).select().single();

        if (data && !error) {
            setLogs(prev => [{
                id: data.id,
                idUsuario,
                nomeUsuario,
                acao,
                detalhes,
                timestamp: data.timestamp
            }, ...prev]);
        }
    }, []);

    // --- AppConfig ---
    const setAppConfig = useCallback(async (cfg: Partial<AppConfig>) => {
        const newConfig = { ...appConfig, ...cfg };
        const { error } = await supabase.from('app_config').update({ config: newConfig }).eq('id', 'default');
        if (!error) {
            setAppConfigState(newConfig);
        }
    }, [appConfig]);

    // --- Webhook ---
    const enviarWebhook = useCallback(async (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
        const url = tipo === 'gptmaker' ? appConfig.webhookGptMaker : appConfig.webhookN8n;
        if (!url) return { ok: false, error: `URL do webhook ${tipo} não configurada.` };
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            return { ok: resp.ok, error: resp.ok ? undefined : `Status ${resp.status}` };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    }, [appConfig]);

    // --- Modelos ---
    const addModelo = useCallback(async (data: Omit<ModeloContrato, 'id' | 'criadoEm'>): Promise<ModeloContrato | null> => {
        const { data: dbData, error } = await supabase.from('modelos_contratos').insert({
            nome: data.nome,
            tipo: data.tipo,
            descricao: data.descricao,
            conteudo: data.conteudo,
            tags: data.tags,
            criado_por: data.criadoPor
        }).select().single();

        if (dbData && !error) {
            const novo: ModeloContrato = { ...data, id: dbData.id, criadoEm: dbData.criado_em };
            setModelos(prev => [...prev, novo]);
            return novo;
        }
        return null;
    }, []);

    const updateModelo = useCallback(async (id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>): Promise<boolean> => {
        const { error } = await supabase.from('modelos_contratos').update({
            nome: data.nome,
            tipo: data.tipo,
            descricao: data.descricao,
            conteudo: data.conteudo,
            tags: data.tags,
            atualizado_em: new Date().toISOString()
        }).eq('id', id);

        if (!error) {
            setModelos(prev => prev.map(m => m.id === id ? { ...m, ...data, atualizadoEm: new Date().toISOString() } : m));
            return true;
        }
        return false;
    }, []);

    const deleteModelo = useCallback(async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('modelos_contratos').delete().eq('id', id);
        if (!error) {
            setModelos(prev => prev.filter(m => m.id !== id));
            return true;
        }
        return false;
    }, []);

    return (
        <DataContext.Provider value={{
            setores, addSetor, updateSetor, deleteSetor, getSetorNome,
            usuarios, addUsuario, updateUsuario, toggleUsuarioStatus, findUserByLogin,
            contratos: contratosAtivos, addContrato, updateContrato, deleteContrato, contratosExcluidos,
            alertas, addAlerta, marcarAlertaLido, deleteAlerta, contratosVencendo,
            appConfig, setAppConfig,
            logs, addLog,
            enviarWebhook,
            modelos, addModelo, updateModelo, deleteModelo,
        }}>
            {children}
        </DataContext.Provider>
    );
}

