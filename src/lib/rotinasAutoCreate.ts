import { supabase } from "./supabaseClient";

type Periodicidade = "diaria" | "semanal" | "quinzenal" | "mensal";

export type RotinaPadraoAuto = {
  id: string;
  titulo: string;
  descricao: string | null;
  sugestao_duracao_minutos: number | null;
  horario_inicio: string | null;
  periodicidade: string | null;
  dia_semana: string | null;
  tem_checklist: boolean | null;
  tem_anexo: boolean | null;
  regionais_ids?: number[] | null;
  grupo_regional_id?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  departamento_id: number | null;
  setor_id: number | null;
  grupo_id: number | null;
};

export type UsuarioAuto = {
  id: string;
  nivel: string;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  grupo_id: number | null;
};

type EdgeResult<T = any> =
  | { ok: true; status: number; json: T; raw: string }
  | { ok: false; status: number; statusText: string; raw: string; json: any };

function normalizarPeriodicidade(p?: string | null): Periodicidade {
  const v = (p ?? "diaria").toString().toLowerCase();
  if (v.includes("quinz")) return "quinzenal";
  if (v.includes("seman")) return "semanal";
  if (v.includes("mens")) return "mensal";
  return "diaria";
}

function parseDiasSemana(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((d) => d.trim())
    .filter((d) => ["2", "3", "4", "5", "6", "7"].includes(d));
}

function nextDateForWeekday(baseISO: string, dia: "2" | "3" | "4" | "5" | "6" | "7"): string {
  const base = new Date(baseISO + "T00:00:00");
  const alvoJs = { "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6 }[dia];
  const baseJs = base.getDay();
  const diff = (alvoJs - baseJs + 7) % 7;
  const d = new Date(base);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function callEdgeFunction<T = any>(name: string, payload: any): Promise<EdgeResult<T>> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

  if (!baseUrl || !anonKey) {
    return {
      ok: false,
      status: 0,
      statusText: "ENV_MISSING",
      raw: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nao encontrados.",
      json: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sem sessao ativa (access_token).");

  const url = `${baseUrl}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      raw: text,
      json,
    };
  }

  return {
    ok: true,
    status: res.status,
    json: json as T,
    raw: text,
  };
}

function buildBodiesFromModelo(modelo: RotinaPadraoAuto, usuario: UsuarioAuto, criadorId?: string | null) {
  const periodicidadeModelo = normalizarPeriodicidade(modelo.periodicidade);
  const periodicidadeEdge = periodicidadeModelo === "quinzenal" ? "semanal" : periodicidadeModelo;

  const dias =
    periodicidadeModelo === "semanal" || periodicidadeModelo === "quinzenal"
      ? parseDiasSemana(modelo.dia_semana)
      : [];

  if ((periodicidadeModelo === "semanal" || periodicidadeModelo === "quinzenal") && dias.length === 0) {
    return { bodies: [], erro: "modelo_sem_dias_semana" };
  }

  const titulo = (modelo.titulo ?? "").trim();
  const descricao = (modelo.descricao ?? titulo).trim() || titulo;
  const duracao = modelo.sugestao_duracao_minutos ?? 60;

  const diasParaCriar = periodicidadeEdge === "semanal" ? (dias.length ? dias : [null]) : [null];
  const dataBase = (modelo.data_inicio ?? "").trim() || todayISO();
  const dataFim = (modelo.data_fim ?? "").trim() || null;

  const bodies = diasParaCriar.map((dia) => {
    const dataInicio =
      periodicidadeEdge === "semanal" && dia
        ? nextDateForWeekday(dataBase, dia as "2" | "3" | "4" | "5" | "6" | "7")
        : dataBase;

    return {
      titulo,
      descricao,
      duracao_minutos: duracao,
      tipo: "normal",
      urgencia: "baixa",
      periodicidade: periodicidadeEdge,
      dia_semana: dia,
      data_inicio: dataInicio,
      data_fim: dataFim,
      horario_inicio: modelo.horario_inicio ?? null,
      tem_checklist: !!modelo.tem_checklist,
      tem_anexo: !!modelo.tem_anexo,
      responsavel_id: usuario.id,
      criador_id: criadorId ?? usuario.id,
      departamento_id: usuario.departamento_id ?? modelo.departamento_id ?? null,
      setor_id: usuario.setor_id ?? modelo.setor_id ?? null,
      regional_id: usuario.regional_id ?? null,
      grupo_id: usuario.grupo_id ?? modelo.grupo_id ?? null,
      rotina_padrao_id: modelo.id,
    };
  });

  return { bodies, erro: null as string | null };
}

export async function criarRotinasAutomaticasParaUsuario(params: {
  modelos: RotinaPadraoAuto[];
  usuario: UsuarioAuto;
  criadorId?: string | null;
  grupoRegionalId?: number | null;
}) {
  let ok = 0;
  const erros: string[] = [];

  for (const modelo of params.modelos) {
    const regionais = Array.isArray(modelo.regionais_ids)
      ? modelo.regionais_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (regionais.length > 0) {
      if (params.usuario.regional_id == null || !regionais.includes(params.usuario.regional_id)) {
        continue;
      }
    }
    const { bodies, erro } = buildBodiesFromModelo(modelo, params.usuario, params.criadorId);
    if (erro) {
      erros.push(`${modelo.id}:${erro}`);
      continue;
    }
    for (const body of bodies) {
      const grupoRegionalId =
        (modelo as RotinaPadraoAuto).grupo_regional_id ?? params.grupoRegionalId ?? null;
      const needsRegionalPatch = grupoRegionalId == null && params.usuario.regional_id != null;

      if (grupoRegionalId == null) {
        body.regional_id = null;
      }

      const result = await callEdgeFunction("eqf-create-rotina-diaria", body);
      if (result.ok) {
        ok += 1;
        if (needsRegionalPatch) {
          const createdId =
            (result as any)?.json?.id ??
            (result as any)?.json?.rotina_id ??
            (result as any)?.json?.rotina?.id ??
            (result as any)?.json?.data?.id ??
            null;

          if (createdId) {
            const { error: updErr } = await supabase
              .from("rotinas")
              .update({ regional_id: params.usuario.regional_id })
              .eq("id", createdId);
            if (updErr) {
              erros.push(`${modelo.id}:patch:${updErr.message}`);
            }
          } else {
            const { data: rotData, error: rotErr } = await supabase
              .from("rotinas")
              .select("id")
              .eq("responsavel_id", params.usuario.id)
              .eq("rotina_padrao_id", modelo.id)
              .eq("grupo_id", params.usuario.grupo_id ?? modelo.grupo_id ?? null)
              .eq("data_inicio", body.data_inicio)
              .eq("horario_inicio", body.horario_inicio ?? null)
              .order("created_at", { ascending: false })
              .limit(1);

            if (rotErr) {
              erros.push(`${modelo.id}:patch:${rotErr.message}`);
            } else if (rotData && rotData[0]?.id) {
              const { error: updErr } = await supabase
                .from("rotinas")
                .update({ regional_id: params.usuario.regional_id })
                .eq("id", rotData[0].id);
              if (updErr) {
                erros.push(`${modelo.id}:patch:${updErr.message}`);
              }
            }
          }
        }
      } else {
        const raw = (result.raw ?? "").toString().slice(0, 300);
        erros.push(`${modelo.id}:${result.status}:${result.statusText}:${raw}`);
      }
    }
  }

  return { ok, erros };
}
