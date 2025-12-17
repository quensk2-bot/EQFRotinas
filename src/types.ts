// src/types.ts
export type HealthData = any;

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  nivel: "ADM" | "N0" | "N1" | "N2" | "N3" | "N99";
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
};

export type TipoItemRotina = "valor" | "texto" | "moeda" | "booleano";

export type ChecklistItemPadrao = {
  ordem: number;
  descricao: string;
  tipo: TipoItemRotina;
  valor_padrao_numerico?: number | null;
  valor_padrao_texto?: string | null;
  exige_anexo?: boolean;
};

export type AnexoPadrao = {
  ordem: number;
  descricao: string;
  obrigatorio: boolean;
};

export type RotinaPadrao = {
  id: string;
  titulo: string;
  descricao: string | null;
  sugestao_duracao_minutos: number | null;

  periodicidade: "diaria" | "semanal" | "mensal";

  checklist_padrao: ChecklistItemPadrao[] | null;

  anexos_padrao?: AnexoPadrao[] | null;
  tipos_itens?: Record<string, TipoItemRotina> | null;
  exige_anexos?: boolean;

  arquivo_modelo_nome?: string | null;
  arquivo_modelo_url?: string | null;

  criado_por_id?: string | null;
  criado_em?: string;
  atualizado_em?: string;
};
