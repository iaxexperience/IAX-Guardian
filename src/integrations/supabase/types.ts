export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          criado_em: string
          empresa: string | null
          id: string
          id_contrato: string | null
          lido: boolean
          mensagem: string
          numero_contrato: string | null
          tipo: string
          urgencia: string
        }
        Insert: {
          criado_em?: string
          empresa?: string | null
          id?: string
          id_contrato?: string | null
          lido?: boolean
          mensagem: string
          numero_contrato?: string | null
          tipo?: string
          urgencia?: string
        }
        Update: {
          criado_em?: string
          empresa?: string | null
          id?: string
          id_contrato?: string | null
          lido?: boolean
          mensagem?: string
          numero_contrato?: string | null
          tipo?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          arquivo_pdf: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string
          data_vencimento: string
          descricao: string
          empresa: string
          excluido: boolean
          excluido_em: string | null
          excluido_por: string | null
          id: string
          id_setor: string
          nome_arquivo: string | null
          numero: string
          objeto: string
          status: string
          tipo: string
          valor: string
        }
        Insert: {
          arquivo_pdf?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string
          data_vencimento?: string
          descricao?: string
          empresa: string
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          id_setor: string
          nome_arquivo?: string | null
          numero: string
          objeto?: string
          status?: string
          tipo?: string
          valor?: string
        }
        Update: {
          arquivo_pdf?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string
          data_vencimento?: string
          descricao?: string
          empresa?: string
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          id_setor?: string
          nome_arquivo?: string | null
          numero?: string
          objeto?: string
          status?: string
          tipo?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "usuarios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_id_setor_fkey"
            columns: ["id_setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          acao: string
          detalhes: string
          id: string
          id_usuario: string
          nome_usuario: string
          timestamp: string
        }
        Insert: {
          acao: string
          detalhes?: string
          id?: string
          id_usuario: string
          nome_usuario: string
          timestamp?: string
        }
        Update: {
          acao?: string
          detalhes?: string
          id?: string
          id_usuario?: string
          nome_usuario?: string
          timestamp?: string
        }
        Relationships: []
      }
      modelos_contratos: {
        Row: {
          atualizado_em: string | null
          conteudo: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          nome: string
          tags: string[]
          tipo: string
        }
        Insert: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          nome: string
          tags?: string[]
          tipo?: string
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          nome?: string
          tags?: string[]
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_contratos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_contratos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          criado_em: string
          id: string
          id_setor: string | null
          login: string
          nome: string
          role: string
          senha_hash: string
          status: string
        }
        Insert: {
          criado_em?: string
          id?: string
          id_setor?: string | null
          login: string
          nome: string
          role?: string
          senha_hash: string
          status?: string
        }
        Update: {
          criado_em?: string
          id?: string
          id_setor?: string | null
          login?: string
          nome?: string
          role?: string
          senha_hash?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_id_setor_fkey"
            columns: ["id_setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      usuarios_public: {
        Row: {
          criado_em: string | null
          id: string | null
          id_setor: string | null
          login: string | null
          nome: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string | null
          id_setor?: string | null
          login?: string | null
          nome?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string | null
          id_setor?: string | null
          login?: string | null
          nome?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_id_setor_fkey"
            columns: ["id_setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
