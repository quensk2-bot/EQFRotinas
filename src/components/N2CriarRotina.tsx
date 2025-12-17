import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  usuarioLogado: Usuario;
};

type Periodicidade = "diaria" | "semanal" | "mensal";
type TipoRotina = "normal" | "avulsa";
type SlotStatus = "livre" | "limite" | "bloqueado";

type RotinaPadraoRow = {
  id: string; // uuid
  titulo: string;
  descricao: string | null;
  sugestao_duracao_minutos: number | null;
  periodicidade: string | null;

  urgencia?: string | null;
  tipo?: string | null;
  dia_semana?: string | null;
  tem_checklist?: boolean | null;
  tem_anexo?: boolean | null;

  departamento_id: number | null;
  setor_id: number | null;
};

type Responsavel = {
  id: string;
  nome: string;
  nivel: string; // "N2" | "N3"
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function normalizarPeriodicidade(p?: string | null): Periodicidade {
  const v = (p ?? "diaria").toString().toLowerCase();
  if (v.includes("seman")) return "semanal";
  if (v.includes("mens")) return "mensal";
  return "diaria";
}

function normalizarDiaSemana(d?: string | null): "" | "2" | "3" | "4" | "5" | "6" | "7" {
  const v = (d ?? "").toString().trim();
  if (v === "2" || v === "3" || v === "4" || v === "5" || v === "6" || v === "7") return v;
  return "";
}

// --------- AGENDA (DATA) ---------
function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinToTimeHHMM(hhmm: string, addMin: number) {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;

  const total = h * 60 + m + addMin;
  const h2 = Math.max(0, Math.min(23, Math.floor(total / 60)));
  const m2 = ((total % 60) + 60) % 60;
  return `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
}

// -----------------------------------------------------------------------------
// ✅ Helper robusto: chama Edge Function via fetch e SEMPRE traz body (ok/erro)
// -----------------------------------------------------------------------------
async function callEdgeFunction<T = any>(name: string, payload: any) {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

  if (!baseUrl || !anonKey) {
    return {
      ok: false as const,
      status: 0,
      statusText: "ENV_MISSING",
      raw: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não encontrados (confira seu .env e reinicie o Vite).",
      json: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sem sessão ativa (access_token). Faça login novamente.");

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
      ok: false as const,
      status: res.status,
      statusText: res.statusText,
      raw: text,
      json,
    };
  }

  return {
    ok: true as const,
    status: res.status,
    json: json as T,
    raw: text,
  };
}

export default function N2CriarRotina({ usuarioLogado }: Props) {
  const [aba, setAba] = useState<"MODELO" | "AVULSA">("MODELO");

  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [erroModelos, setErroModelos] = useState<string | null>(null);
  const [modelos, setModelos] = useState<RotinaPadraoRow[]>([]);
  const [modeloId, setModeloId] = useState<string>("");

  const [carregandoResp, setCarregandoResp] = useState(false);
  const [erroResp, setErroResp] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  // campos rotina
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("60");

  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diaSemana, setDiaSemana] = useState<"" | "2" | "3" | "4" | "5" | "6" | "7">("2");

  const [dataInicio, setDataInicio] = useState<string>("");
  const [horarioInicio, setHorarioInicio] = useState<string>("08:00");

  // AVULSA: editável
  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  const deptId = usuarioLogado.departamento_id ?? null;
  const setorId = usuarioLogado.setor_id ?? null;
  const regId = usuarioLogado.regional_id ?? null;

  const isModoModelo = aba === "MODELO";
  const isModoAvulsa = aba === "AVULSA";

  const btnSecondary: React.CSSProperties = {
    ...styles.button,
    background: "transparent",
    color: theme.colors.textSoft ?? "#e5e7eb",
    border: `1px solid ${theme.colors.borderSoft ?? "rgba(148,163,184,0.35)"}`,
  };

  const btnPrimary: React.CSSProperties = {
    ...styles.button,
    background: theme.colors.neonGreen ?? "#22c55e",
    color: "#022c22",
    border: "none",
  };

  const modeloSelecionado = useMemo(() => {
    if (!modeloId) return null;
    return modelos.find((m) => String(m.id) === String(modeloId)) ?? null;
  }, [modelos, modeloId]);

  const responsavelSelecionado = useMemo(
    () => responsaveis.find((r) => r.id === responsavelId) ?? null,
    [responsaveis, responsavelId]
  );

  // ✅ flags efetivas
  const flagsEfetivas = useMemo(() => {
    if (isModoModelo) {
      return {
        temChecklist: !!modeloSelecionado?.tem_checklist,
        temAnexo: !!modeloSelecionado?.tem_anexo,
      };
    }
    return { temChecklist, temAnexo };
  }, [isModoModelo, modeloSelecionado, temChecklist, temAnexo]);

  // -------------------------------------------------------------------------
  // ✅ SLOT STATUS: max 2 rotinas no mesmo horário POR RESPONSÁVEL (usuário)
  // -------------------------------------------------------------------------
  const [slotCount, setSlotCount] = useState<number>(0);
  const [slotLoading, setSlotLoading] = useState(false);

  const slotStatus: SlotStatus = useMemo(() => {
    if (slotCount >= 2) return "bloqueado";
    if (slotCount === 1) return "limite";
    return "livre";
  }, [slotCount]);

  const slotBadgeStyle = useMemo<React.CSSProperties>(() => {
    if (slotStatus === "bloqueado") {
      return {
        border: "1px solid rgba(248,113,113,0.55)",
        background: "rgba(248,113,113,0.10)",
        color: "#fecaca",
      };
    }
    if (slotStatus === "limite") {
      return {
        border: `1px solid ${theme.colors.neonOrange ?? "#fb923c"}`,
        background: "rgba(251,146,60,0.10)",
        color: theme.colors.neonOrange ?? "#fb923c",
      };
    }
    return {
      border: `1px solid ${theme.colors.neonGreen ?? "#22c55e"}`,
      background: "rgba(34,197,94,0.10)",
      color: theme.colors.neonGreen ?? "#22c55e",
    };
  }, [slotStatus]);

  useEffect(() => {
    const run = async () => {
      if (!responsavelId) return;
      if (!dataInicio || !horarioInicio) return;

      setSlotLoading(true);
      try {
        const { count, error } = await supabase
          .from("rotinas")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", responsavelId)
          .eq("data_inicio", dataInicio)
          .eq("horario_inicio", horarioInicio);

        if (error) throw error;
        setSlotCount(count ?? 0);
      } catch (e) {
        console.error("Erro ao checar slot (N2):", e);
        setSlotCount(0);
      } finally {
        setSlotLoading(false);
      }
    };

    void run();
  }, [responsavelId, dataInicio, horarioInicio]);

  // -------------------------------------------------------------------------
  // carregar responsáveis (N2/N3 da mesma regional)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const run = async () => {
      setCarregandoResp(true);
      setErroResp(null);

      try {
        if (!deptId || !setorId || !regId) {
          setResponsaveis([{ id: usuarioLogado.id, nome: usuarioLogado.nome, nivel: usuarioLogado.nivel }]);
          setResponsavelId(usuarioLogado.id);
          return;
        }

        const { data, error } = await supabase
          .from("usuarios")
          .select("id,nome,nivel,departamento_id,setor_id,regional_id,ativo")
          .eq("departamento_id", deptId)
          .eq("setor_id", setorId)
          .eq("regional_id", regId)
          .eq("ativo", true)
          .in("nivel", ["N2", "N3"])
          .order("nivel", { ascending: true })
          .order("nome", { ascending: true });

        if (error) throw error;

        const lista: Responsavel[] = (data ?? []).map((u: any) => ({
          id: String(u.id),
          nome: String(u.nome),
          nivel: String(u.nivel),
        }));

        if (!lista.some((r) => r.id === usuarioLogado.id)) {
          lista.unshift({ id: usuarioLogado.id, nome: usuarioLogado.nome, nivel: usuarioLogado.nivel });
        }

        setResponsaveis(lista);
        setResponsavelId((prev) => prev || usuarioLogado.id);
      } catch (e: any) {
        console.error("Erro ao carregar responsáveis N2/N3:", e);
        setErroResp(e.message ?? "Erro ao carregar responsáveis.");
        setResponsaveis([{ id: usuarioLogado.id, nome: usuarioLogado.nome, nivel: usuarioLogado.nivel }]);
        setResponsavelId(usuarioLogado.id);
      } finally {
        setCarregandoResp(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId, setorId, regId, usuarioLogado.id]);

  // -------------------------------------------------------------------------
  // carregar modelos (N1) do mesmo dept/setor
  // -------------------------------------------------------------------------
  useEffect(() => {
    const run = async () => {
      setCarregandoModelos(true);
      setErroModelos(null);

      try {
        if (!deptId || !setorId) {
          setModelos([]);
          return;
        }

        const { data, error } = await supabase
          .from("rotinas_padrao")
          .select(
            `
            id, titulo, descricao,
            sugestao_duracao_minutos,
            periodicidade, dia_semana,
            tem_checklist, tem_anexo,
            urgencia, tipo,
            departamento_id, setor_id
          `
          )
          .eq("departamento_id", deptId)
          .eq("setor_id", setorId)
          .order("titulo", { ascending: true });

        if (error) throw error;
        setModelos((data ?? []) as RotinaPadraoRow[]);
      } catch (e: any) {
        console.error("Erro ao carregar modelos N1:", e);
        setErroModelos(e.message ?? "Erro ao carregar modelos.");
        setModelos([]);
      } finally {
        setCarregandoModelos(false);
      }
    };

    void run();
  }, [deptId, setorId]);

  // -------------------------------------------------------------------------
  // trocar aba
  // -------------------------------------------------------------------------
  useEffect(() => {
    setStatusMsg(null);
    setDetails(null);

    if (aba === "AVULSA") {
      setModeloId("");
      return;
    }
  }, [aba]);

  // -------------------------------------------------------------------------
  // aplicar modelo selecionado
  // -------------------------------------------------------------------------
  const handleSelecionarModelo = (id: string) => {
    setModeloId(id);

    const m = modelos.find((x) => String(x.id) === id);
    if (!m) return;

    setTitulo(m.titulo ?? "");
    setDescricao(m.descricao ?? "");
    setDuracaoMinutos(m.sugestao_duracao_minutos != null ? String(m.sugestao_duracao_minutos) : "60");

    const per = normalizarPeriodicidade(m.periodicidade);
    setPeriodicidade(per);

    const ds = normalizarDiaSemana(m.dia_semana);
    if (ds) setDiaSemana(ds);

    setTemChecklist(!!m.tem_checklist);
    setTemAnexo(!!m.tem_anexo);
  };

  // -------------------------------------------------------------------------
  // valida limite 2 por slot (por usuário)
  // -------------------------------------------------------------------------
  const validarLimiteHorario = async (responsavel: string, dataISO: string, hora: string) => {
    if (!responsavel) return { ok: false, msg: "Selecione um responsável." };
    if (!dataISO || !hora) return { ok: false, msg: "Informe data e horário." };

    const { count, error } = await supabase
      .from("rotinas")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_id", responsavel)
      .eq("data_inicio", dataISO)
      .eq("horario_inicio", hora);

    if (error) {
      console.error("Erro ao validar limite de horário (por usuário):", error);
      return { ok: true, msg: "" }; // falha silenciosa
    }

    if ((count ?? 0) >= 2) {
      return {
        ok: false,
        msg: `Limite atingido: o responsável já possui 2 rotinas em ${dataISO} às ${hora}.`,
      };
    }

    return { ok: true, msg: "" };
  };

  // -------------------------------------------------------------------------
  // submit
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!deptId || !setorId || !regId) {
      setStatusMsg("❌ Seu usuário não está amarrado em Departamento/Setor/Regional.");
      return;
    }

    if (!responsavelId) {
      setStatusMsg("❌ Selecione um responsável.");
      return;
    }

    if (isModoModelo && !modeloSelecionado) {
      setStatusMsg("❌ Selecione um modelo do N1.");
      return;
    }

    const minutos = Number(duracaoMinutos);
    if (!Number.isFinite(minutos) || minutos <= 0) {
      setStatusMsg("❌ Duração inválida (precisa ser > 0).");
      return;
    }

    if (!dataInicio) {
      setStatusMsg("❌ Selecione a data de início.");
      return;
    }
    if (!horarioInicio) {
      setStatusMsg("❌ Selecione o horário.");
      return;
    }

    setLoading(true);
    setStatusMsg("⏳ Validando horário...");
    setDetails(null);

    try {
      const limite = await validarLimiteHorario(responsavelId, dataInicio, horarioInicio);
      if (!limite.ok) {
        setStatusMsg(`❌ ${limite.msg}`);
        setLoading(false);
        return;
      }

      setStatusMsg("⏳ Criando rotina...");

      const tipo: TipoRotina = isModoAvulsa ? "avulsa" : "normal";

      const tituloEfetivo = isModoModelo ? (modeloSelecionado?.titulo ?? titulo) : titulo;
      const descricaoEfetiva = isModoModelo ? (modeloSelecionado?.descricao ?? "") : descricao;

      const periodicidadeEfetiva: Periodicidade = isModoAvulsa
        ? "diaria"
        : isModoModelo
        ? normalizarPeriodicidade(modeloSelecionado?.periodicidade ?? "diaria")
        : periodicidade;

      const body = {
        titulo: (tituloEfetivo ?? "").trim(),
        descricao: (descricaoEfetiva ?? "").trim() || null,

        duracao_minutos: minutos,
        tipo,
        periodicidade: periodicidadeEfetiva,

        dia_semana: tipo === "avulsa" ? null : periodicidadeEfetiva === "semanal" ? diaSemana : null,

        data_inicio: dataInicio,
        horario_inicio: horarioInicio,

        tem_checklist: flagsEfetivas.temChecklist,
        tem_anexo: flagsEfetivas.temAnexo,

        responsavel_id: responsavelId,
        criador_id: usuarioLogado.id,

        departamento_id: deptId,
        setor_id: setorId,
        regional_id: regId,

        rotina_padrao_id: isModoModelo ? modeloSelecionado!.id : null,
      };

      const result = await callEdgeFunction("eqf-create-rotina-diaria", body);

      if (!result.ok) {
        const step = result.json?.step ?? null;
        const msg = result.json?.message ?? result.json?.error ?? null;

        setStatusMsg(`❌ Erro na função${step ? ` (${step})` : ""}: ${msg ?? `HTTP ${result.status} ${result.statusText}`}`);
        setDetails(
          JSON.stringify(
            {
              http: { status: result.status, statusText: result.statusText },
              json: result.json,
              raw: result.raw,
              sent_body: body,
            },
            null,
            2
          )
        );
        setLoading(false);
        return;
      }

      setStatusMsg("✅ Rotina criada com sucesso!");
      setDetails(JSON.stringify(result.json ?? {}, null, 2));

      // limpa
      setModeloId("");
      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("60");
      setPeriodicidade("diaria");
      setDiaSemana("2");
      setDataInicio("");
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);
    } catch (err: any) {
      console.error("Erro ao criar rotina (N2):", err);
      setStatusMsg(`❌ Erro: ${err?.message ?? String(err)}`);
      setDetails(JSON.stringify({ err, note: "Se for erro da Function, use o details para ver o body." }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  // travas
  const disabledTituloDescricao = isModoModelo;
  const disabledPeriodicidade = isModoModelo;
  const disabledDiaSemana = isModoAvulsa;

  return (
    <section style={{ display: "grid", gap: 12 }}>
      {/* ABAS */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setAba("MODELO")}
          style={{
            ...btnSecondary,
            opacity: aba === "MODELO" ? 1 : 0.65,
            borderColor: aba === "MODELO" ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.borderSoft ?? "#334155",
            color: aba === "MODELO" ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.textSoft ?? "#e5e7eb",
          }}
        >
          Criar por Modelo (N1)
        </button>

        <button
          type="button"
          onClick={() => setAba("AVULSA")}
          style={{
            ...btnSecondary,
            opacity: aba === "AVULSA" ? 1 : 0.65,
            borderColor: aba === "AVULSA" ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.borderSoft ?? "#334155",
            color: aba === "AVULSA" ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.textSoft ?? "#e5e7eb",
          }}
        >
          Rotina Avulsa (1 dia)
        </button>
      </div>

      {/* STATUS SLOT */}
      <div
        style={{
          border: `1px solid ${theme.colors.borderSoft ?? "#334155"}`,
          borderRadius: 14,
          padding: 10,
          background: "rgba(2,6,23,0.35)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
          <b style={{ color: theme.colors.textSoft ?? "#e5e7eb" }}>Regra:</b> máximo <b>2 rotinas</b> no mesmo dia/horário{" "}
          <b>por responsável</b>.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              ...slotBadgeStyle,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
          >
            {slotLoading
              ? "CHECANDO..."
              : slotCount >= 2
              ? "SLOT BLOQUEADO (2/2)"
              : slotCount === 1
              ? "SLOT NO LIMITE (1/2)"
              : "SLOT LIVRE (0/2)"}
          </span>

          <button
            type="button"
            onClick={() => setHorarioInicio((h) => addMinToTimeHHMM(h, 30))}
            style={{ ...btnSecondary, padding: "3px 10px", fontSize: 12 }}
          >
            +30 min
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        {/* MODELO */}
        {isModoModelo && (
          <div>
            <label style={styles.label}>Selecionar um modelo de rotina (N1)</label>
            <select value={modeloId} onChange={(e) => handleSelecionarModelo(e.target.value)} style={styles.input} disabled={carregandoModelos}>
              <option value="">— selecione —</option>
              {modelos.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.titulo}
                </option>
              ))}
            </select>

            {carregandoModelos && (
              <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af", marginTop: 6 }}>Carregando modelos...</div>
            )}
            {erroModelos && (
              <div style={{ fontSize: 12, color: theme.colors.neonOrange ?? "#fb923c", marginTop: 6 }}>{erroModelos}</div>
            )}
            {!carregandoModelos && !erroModelos && modelos.length === 0 && (
              <div style={{ fontSize: 12, color: theme.colors.neonOrange ?? "#fb923c", marginTop: 6 }}>
                Nenhum modelo encontrado para o seu Departamento/Setor.
              </div>
            )}
          </div>
        )}

        {/* RESPONSÁVEL */}
        <div>
          <label style={styles.label}>Responsável (N2 ou N3 da sua regional)</label>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} style={styles.input} disabled={carregandoResp} required>
            <option value="">— selecione —</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} ({r.nivel})
              </option>
            ))}
          </select>

          {carregandoResp && (
            <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af", marginTop: 6 }}>Carregando responsáveis...</div>
          )}
          {erroResp && <div style={{ fontSize: 12, color: theme.colors.neonOrange ?? "#fb923c", marginTop: 6 }}>{erroResp}</div>}
        </div>

        {/* TÍTULO */}
        <div>
          <label style={styles.label}>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required disabled={disabledTituloDescricao} />
        </div>

        {/* DESCRIÇÃO */}
        <div>
          <label style={styles.label}>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={styles.textarea} disabled={disabledTituloDescricao} />
        </div>

        {/* DURAÇÃO + PERIODICIDADE + DIA */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,1fr)" }}>
          <div>
            <label style={styles.label}>Duração (min)</label>
            <input type="number" min={1} value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} style={styles.input} />
          </div>

          <div>
            <label style={styles.label}>Periodicidade</label>
            <select
              value={isModoAvulsa ? "diaria" : periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
              style={styles.input}
              disabled={isModoAvulsa || disabledPeriodicidade}
            >
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>

            {isModoModelo && (
              <div style={{ marginTop: 4, fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
                Obs.: a periodicidade é definida no <b>Modelo (N1)</b>.
              </div>
            )}
          </div>

          <div>
            <label style={styles.label}>Dia da semana</label>
            <select value={diaSemana} onChange={(e) => setDiaSemana(e.target.value as any)} style={styles.input} disabled={disabledDiaSemana}>
              <option value="2">Segunda</option>
              <option value="3">Terça</option>
              <option value="4">Quarta</option>
              <option value="5">Quinta</option>
              <option value="6">Sexta</option>
              <option value="7">Sábado</option>
            </select>

            {!isModoAvulsa && periodicidade !== "semanal" && (
              <div style={{ marginTop: 4, fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
                Obs.: o dia da semana só é aplicado quando a periodicidade for <b>Semanal</b>.
              </div>
            )}
          </div>
        </div>

        {/* DATA + HORÁRIO */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={styles.label}>Data de início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} required min={todayISO()} />

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <button type="button" onClick={() => setDataInicio(todayISO())} style={{ ...btnSecondary, padding: "3px 10px", fontSize: 12 }}>
                Hoje
              </button>
              <button type="button" onClick={() => setDataInicio(addDaysISO(todayISO(), 1))} style={{ ...btnSecondary, padding: "3px 10px", fontSize: 12 }}>
                Amanhã
              </button>
              <button type="button" onClick={() => setDataInicio(addDaysISO(todayISO(), 7))} style={{ ...btnSecondary, padding: "3px 10px", fontSize: 12 }}>
                +7 dias
              </button>
              <button type="button" onClick={() => setDataInicio("")} style={{ ...btnSecondary, padding: "3px 10px", fontSize: 12, opacity: 0.85 }}>
                Limpar
              </button>
            </div>
          </div>

          <div>
            <label style={styles.label}>Horário (livre para N2)</label>
            <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={styles.input} required />
            <div style={{ marginTop: 4, fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
              Regra: máximo <b>2 rotinas</b> por horário para o <b>mesmo responsável</b>.
            </div>
          </div>
        </div>

        {/* FLAGS */}
        {isModoAvulsa ? (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.colors.textSoft ?? "#e5e7eb" }}>
              <input type="checkbox" checked={temChecklist} onChange={(e) => setTemChecklist(e.target.checked)} />
              Terá checklist?
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.colors.textSoft ?? "#e5e7eb" }}>
              <input type="checkbox" checked={temAnexo} onChange={(e) => setTemAnexo(e.target.checked)} />
              Terá anexo?
            </label>
          </div>
        ) : (
          <div
            style={{
              border: `1px dashed ${theme.colors.borderSoft ?? "#334155"}`,
              borderRadius: 12,
              padding: 10,
              fontSize: 12,
              color: theme.colors.textMuted ?? "#9ca3af",
            }}
          >
            <strong>Definições do modelo (N1):</strong>{" "}
            Checklist: <b>{flagsEfetivas.temChecklist ? "Sim" : "Não"}</b> • Anexo: <b>{flagsEfetivas.temAnexo ? "Sim" : "Não"}</b>
            <div style={{ marginTop: 4 }}>
              Obs.: essas opções são definidas no <b>Modelo</b> pelo N1 e <b>não podem</b> ser alteradas aqui.
            </div>
          </div>
        )}

        {/* RESUMO */}
        <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
          <strong>Resumo:</strong>{" "}
          {responsavelSelecionado ? `${responsavelSelecionado.nome} (${responsavelSelecionado.nivel})` : "Responsável não selecionado"} •{" "}
          {isModoAvulsa ? "Avulsa (1 dia)" : `Modelo ${modeloId ? modeloId : "(não selecionado)"}`}
        </div>

        <button
          type="submit"
          disabled={loading || (isModoModelo && !modeloId) || slotStatus === "bloqueado"}
          style={{
            ...btnPrimary,
            opacity: loading || slotStatus === "bloqueado" ? 0.65 : 1,
            cursor: slotStatus === "bloqueado" ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Criando..." : slotStatus === "bloqueado" ? "Slot cheio (2/2)" : "Criar rotina"}
        </button>
      </form>

      {statusMsg && <div style={{ fontSize: 13, color: statusMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca" }}>{statusMsg}</div>}

      {details && (
        <pre
          style={{
            background: "#000",
            color: "#4ade80",
            padding: 12,
            borderRadius: 8,
            maxHeight: 260,
            overflow: "auto",
            fontSize: 11,
          }}
        >
          {details}
        </pre>
      )}
    </section>
  );
}
