import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Clear potential legacy session
        localStorage.removeItem('lwp_session');

        // Initial session check
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await fetchUserData(session.user.id);
            }
            setLoading(false);
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await fetchUserData(session.user.id);
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserData = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', userId)
                .single();

            if (data && !error) {
                setCurrentUser({
                    id: data.id,
                    nome: data.nome,
                    login: data.login,
                    email: data.email,
                    senhaHash: 'auth_managed',
                    idSetor: data.id_setor,
                    role: data.role as 'admin' | 'setor',
                    status: data.status === 'active' ? 'ativo' : 'inativo',
                    criadoEm: data.criado_em,
                });
            } else if (error && error.code === 'PGRST116') { // PGRST116: JSON object requested, but no rows returned
                // If profile missing, create one automatically
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: newUser, error: insertError } = await supabase.from('usuarios').insert({
                        id: user.id,
                        nome: user.user_metadata?.nome || user.email?.split('@')[0] || 'Novo Usuário',
                        login: user.user_metadata?.login || user.email?.split('@')[0] || 'user',
                        email: user.email,
                        role: 'admin', // Default first user to admin
                        status: 'active',
                        senha_hash: 'auth_managed'
                    }).select().single();

                    if (newUser && !insertError) {
                        setCurrentUser({
                            id: newUser.id,
                            nome: newUser.nome,
                            login: newUser.login,
                            email: newUser.email,
                            senhaHash: 'auth_managed',
                            idSetor: newUser.id_setor,
                            role: newUser.role as 'admin' | 'setor',
                            status: newUser.status === 'active' ? 'ativo' : 'inativo',
                            criadoEm: newUser.criado_em,
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching user data:', err);
        }
    };

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'Erro ao realizar login.' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Carregando...</div>;
    }

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            isAdmin: currentUser?.role === 'admin',
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

