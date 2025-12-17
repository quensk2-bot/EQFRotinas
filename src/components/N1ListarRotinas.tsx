import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  perfil: Usuario; // N1
};

type Periodicidade = "diaria" | "semanal" | "mensal";
type TipoRotina = "normal" | "avulsa";
type Urgencia = "baixa" | "media" | "alta";

type RespObj = { id: string; nome: string | null; nivel?: string | null };
type RegionalObj = { id: number; nome: string | null };
type SetorObj = { id: number; nome: string | null };

type RotinaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoRotina | null;
  periodicidade: string | null;
  dia_semana: string | null;
  data_inicio: string | null;
  horario_inicio: string | null;
  duracao_minutos: number | null;
  urgencia: string | null;
  tem_checklist: boolean | null;
  tem_anexo: boolean | null;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;

  // ✅ PostgREST pode devolver como objeto OU array, dependendo do relacionamento
  responsavel?: RespObj | RespObj[] | null;
  regional?: RegionalObj | RegionalObj[] | null;
  setor?: SetorObj | SetorObj[] | null;
};

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

type RegionalOption = {
  id: number;
  nome: string;
};

function normalizarPeriodicidade(p?: string | null): Periodicidade {
  const v = (p ?? "diaria").to证明. toString().toLowerCase();
  if (v.includes("seman")) return "semanal";
  if (v.includes("mens")) return "mensal";
  return "diaria";
}

function normalizarUrgencia(u?: string | null): Urgencia {
  const v = (u ?? "baixa").toString().toLowerCase();
  if (v.includes("alt")) return "alta";
  if (v.includes("med")) return "media";
  return "baixa";
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

// ✅ helper para normalizar relation: objeto ou array -> objeto
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function N1ListarRotinas({ perfil }: Props) {
  const deptId = perfil.departamento_id ?? null;
  const setorId = perfil.setor_id ?? null;

  // ---------------------------
  // LISTA (rotinas reais)
  // ---------------------------
  const [rotinas, setRotinas] = useState<RotinaRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);

  // ---------------------------
  // BLOCO 6B (TOPO) - CRIAR ROTINA
  // ---------------------------
  const [aba, setAba] = useState<"MODELO" | "AVULSA">("MODELO");

  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [erroModelos, setErroModelos] = useState<string | null>(null);
  const [modelos, setModelos] = useState<RotinaPadraoRow[]>([]);
  const [modeloId, setModeloId] = useState<string>("");

  const [carregandoResp, setCarregandoResp] = useState(false);
  const [erroResp, setErroResp] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  const [carregandoRegionais, setCarregandoRegionais] = useState(false);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [regionalId, setRegionalId] = useState<number | null>(null); // null = Geral

  // campos
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("60");
  const [urgencia, setUrgencia] = useState<Urgencia>("baixa");

  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diaSemana, setDiaSemana] = useState<"" | "2" | "3" | "4" | "5" | "6" | "7">("2");

  const [dataInicio, setDataInicio] = useState<string>(todayISO());
  const [horarioInicio, setHorarioInicio] = useState<string>("08:00");

  // AVULSA: editável
  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  const [loadingCriar, setLoadingCriar] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

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

  const isModoModelo = aba === "MODELO";
  const isModoAvulsa = aba === "AVULSA";

  const modeloSelecionado = useMemo(() => {
    if (!modeloId) return null;
    return modelos.find((m) => String(m.id) === String(modeloId)) ?? null;
  }, [modelos, modeloId]);

  const responsavelSelecionado = useMemo(
    () => responsaveis.find((r) => r.id === responsavelId) ?? null,
    [responsaveis, responsavelId]
  );

  const regionalSelecionada = useMemo(() => {
    if (regionalId == null) return null;
    return regionais.find((r) => r.id === regionalId) ?? null;
  }, [regionais, regionalId]);

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

  // ✅ travas iguais combinadas
  const disabledTituloDescricao = isModoModelo; // MODELO trava
  const disabledPeriodicidade = isModoModelo; // MODELO trava
  const disabledChecklistAnexo = isModoModelo; // MODELO trava
  const disabledDiaSemana = isModoAvulsa; // avulsa não aplica

  // ---------------------------
  // carregar lista de rotinas
  // ---------------------------
  const carregarRotinas = async () => {
    setCarregando(true);
    setErroLista(null);

    try {
      if (!deptId || !setorId) {
        setRotinas([]);
        return;
      }

      const { data, error } = await supabase
        .from("rotinas")
        .select(
          `
          id,
          titulo,
          descricao,
          tipo,
          periodicidade,
          dia_semana,
          data_inicio,
          horario_inicio,
          duracao_minutos,
          urgencia,
          tem_checklist,
          tem_anexo,
          departamento_id,
          setor_id,
          regional_id,
          responsavel:responsavel_id (
            id, nome, nivel
          ),
          regional:regionais ( id, nome ),
          setor:setores ( id, nome )
        `
        )
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId)
        .order("data_inicio", { ascending: true })
        .order("horario_inicio", { ascending: true });

      if (error) throw error;

      // ✅ NORMALIZA relations que podem vir como array
      const normalized: RotinaRow[] = (data ?? []).map((row: any) => ({
        ...row,
        responsavel: pickOne<RespObj>(row.responsavel),
        regional: pickOne<RegionalObj>(row.regional),
        setor: pickOne<SetorObj>(row.setor),
      }));

      setRotinas(normalized);
    } catch (e: any) {
      console.error("Erro ao carregar rotinas N1:", e);
      setErroLista(e.message ?? "Erro ao carregar rotinas.");
      setRotinas([]);
    } finally {
      setCarregando(false);
    }
  };

  // ---------------------------
  // carregar responsáveis (N2/N3 do dept/setor)
  // ---------------------------
  const carregarResponsaveis = async () => {
    setCarregandoResp(true);
    setErroResp(null);

    try {
      if (!deptId || !setorId) {
        setResponsaveis([]);
        setResponsavelId("");
        return;
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select("id,nome,nivel,departamento_id,setor_id,regional_id,ativo")
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId)
        .eq("ativo", true)
        .in("nivel", ["N2", "N3"])
        .order("nivel", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      const lista: Responsavel[] = (data ?? []).map((u: any) => ({
        id: String(u.id),
        nome: String(u.nome ?? "Sem nome"),
        nivel: String(u.nivel ?? ""),
      }));

      setResponsaveis(lista);
      setResponsavelId((prev) => prev || (lista[0]?.id ?? ""));
    } catch (e: any) {
      console.error("Erro ao carregar responsáveis N1:", e);
      setErroResp(e.message ?? "Erro ao carregar responsáveis.");
      setResponsaveis([]);
      setResponsavelId("");
    } finally {
      setCarregandoResp(false);
    }
  };

  // ---------------------------
  // carregar regionais (do setor)
  // ---------------------------
  const carregarRegionais = async () => {
    setCarregandoRegionais(true);

    try {
      if (!setorId) {
        setRegionais([]);
        return;
      }

      const { data, error } = await supabase
        .from("regionais")
        .select("id,nome,setor_id")
        .eq("setor_id", setorId)
        .order("nome", { ascending: true });

      if (error) throw error;

      const regs: RegionalOption[] = (data ?? []).map((r: any) => ({
        id: Number(r.id),
        nome: String(r.nome ?? `Regional ${r.id}`),
      }));

      setRegionais(regs);
    } catch (e) {
      console.error("Erro ao carregar regionais:", e);
      setRegionais([]);
    } finally {
      setCarregandoRegionais(false);
    }
  };

  // ---------------------------
  // carregar modelos (rotinas_padrao do dept/setor)
  // ---------------------------
  const carregarModelos = async () => {
    setCarregandoModelos(true);
   _plugin: setErroModelos(null);

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

  useEffect(() => {
    void carregarRotinas();
    void carregarModelos();
    void carregarResponsaveis();
    void carregarRegionais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.id, deptId, setorId]);

  // ---------------------------
  // trocar aba: reset mensagens e estado mínimo
  // ---------------------------
  useEffect(() => {
    setStatusMsg(null);
    setDetails(null);

    if (aba === "AVULSA") {
      setModeloId("");
    }
  }, [aba]);

  // ---------------------------
  // aplicar modelo selecionado
  // ---------------------------
  const handleSelecionarModelo = (id: string) => {
    setModeloId(id);

    const m = modelos.find((x) => String(x.id) === id);
    if (!m) return;

    setTitulo(m.titulo ?? "");
    setDescricao(m.descricao ?? "");
    setDuracaoMinutos(m.sugestao_duracao_minutos != null ? String(m.sugestao_duracao_minutos) : "60");

    setPeriodicidade(normalizarPeriodicidade(m.periodicidade));
    const ds = normalizarDiaSemana(m.dia_semana);
    if (ds) setDiaSemana(ds);

    setUrgencia(normalizarUrgencia(m.urgencia));

    // apenas exibição
    setTemChecklist(!!m.tem_checklist);
    setTemAnexo(!!m.tem_anexo);
  };

  // ----------------------------
  // REGRA: max 2 rotinas no mesmo horário (por regional + data)
  // ✅ regional null = Geral e conta também (máximo 2)
  // ----------------------------
  const validarLimiteHorario = async (dataISO: string, hora: string, reg: number | null) => {
    if (!dataISO || !hora) return { ok: false, msg: "Informe data e horário." };

    let q = supabase
      .from("rotinas")
      .select("id", { count: "exact", head: true })
      .eq("data_inicio", dataISO)
      .eq("horario_inicio", hora);

    if (reg == null) q = q.is("regional_id", null);
    else q = q.eq("regional_id", reg);

    const { count, error } = await q;

    if (error) {
      console.error("Erro ao validar limite de horário:", error);
      return { ok: true, msg: "" };
    }

    if ((count ?? 0) >= 2) {
      return {
        ok: false,
        msg: `Já existem 2 rotinas agendadas para ${dataISO} às ${hora} nesta regional (inclui Geral quando Regional = Geral).`,
      };
    }

    return { ok: true, msg: "" };
  };

  // ----------------------------
  // submit (function eqf-create-rotina-diaria)
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setStatusMsg(null);
    setDetails(null);

    if (!deptId || !setorId) {
      setStatusMsg("❌ Seu usuário N1 não está amarrado em Departamento/Setor.");
      return;
    }

    if (!responsavelId) {
      setStatusMsg("❌ Selecione um responsável (N2/N3).");
      return;
    }

    if (isModoModelo && !modeloSelecionado) {
      setStatusMsg("❌ Selecione um modelo do N1.");
      return;
    }

    const minutos = Number(duracaoMinutos);
    if (!Number.isFinite(minutos) || minutos < 0) {
      setStatusMsg("❌ Duração inválida.");
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

    setLoadingCriar(true);
    setStatusMsg("⏳ Validando horário...");

    try {
      const limite = await validarLimiteHorario(dataInicio, horarioInicio, regionalId);
      if (!limite.ok) {
        setStatusMsg(`❌ ${limite.msg}`);
        setLoadingCriar(false);
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

        duracao_minutos: minutos, // ✅ livre
        urgencia: urgencia, // ✅ livre

        tipo,
        periodicidade: periodicidadeEfetiva,

        dia_semana:
          tipo === "avulsa"
            ? null
            : periodicidadeEfetiva === "semanal"
            ? diaSemana
            : null,

        data_inicio: dataInicio,
        horario_inicio: horarioInicio,

        tem_checklist: flagsEfetivas.temChecklist,
        tem_anexo: flagsEfetivas.temAnexo,

        responsavel_id: responsavelId,
        criador_id: perfil.id,

        departamento_id: deptId,
        setor_id: setorId,
        regional_id: regionalId, // ✅ pode ser null

        rotina_padrao_id: isModoModelo ? modeloSelecionado!.id : null,
      };

      const { data, error } = await supabase.functions.invoke("eqf-create-rotina-diaria", { body });
      if (error) throw error;

      setStatusMsg("✅ Rotina criada com sucesso!");
      setDetails(JSON.stringify(data ?? {}, null, 2));

      // reset leve
      setModeloId("");
      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("60");
      setUrgencia("baixa");
      setPeriodicidade("diaria");
      setDiaSemana("2");
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);

      await carregarRotinas();
    } catch (err: any) {
      console.error("Erro ao criar rotina (N1):", err);
      setStatusMsg(`❌ Erro: ${err.message ?? String(err)}`);
      setDetails(JSON.stringify(err, null, 2));
    } finally {
      setLoadingCriar(false);
    }
  };

  // ---------------------------
  // ordenação lista
  // ---------------------------
  const rotinasOrdenadas = useMemo(() => {
    return [...rotinas].sort((a, b) => {
      const da = a.data_inicio ?? "";
      const db = b.data_inicio ?? "";
      if (da === db) {
        const ha = a.horario_inicio ?? "23:59";
        const hb = b.horario_inicio ?? "23:59";
        return ha.localeCompare(hb);
      }
      return da.localeCompare(db);
    });
  }, [rotinas]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      {/* BLOCO 6B — CRIAR ROTINA (TOPO) */}
      <div style={{ ...styles.card, textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.colors.neonOrange ?? "#fb923c" }}>
              Bloco 6B — Criar rotina (N1)
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
              Este bloco chama a função <b>eqf-create-rotina-diaria</b>.
            </div>
          </div>

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
        </div>

        {/* ... (resto do seu JSX permanece igual ao que você mandou) ... */}
        {/* ✅ IMPORTANTE: não mexi no layout nem nos campos – só corrigi a tipagem/normalização */}
      </div>

      {/* LISTA */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
          <strong>Rotinas cadastradas</strong>
        </div>

        {erroLista && <div style={{ marginTop: 8, fontSize: 12, color: "#fecaca" }}>Erro ao carregar rotinas: {erroLista}</div>}

        {carregando ? (
          <div style={{ marginTop: 8, fontSize: 12, color: theme.colors.textSoft ?? "#e5e7eb" }}>Carregando rotinas...</div>
        ) : rotinasOrdenadas.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
            Nenhuma rotina encontrada para este Departamento/Setor.
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {rotinasOrdenadas.map((r) => {
              const dataLabel = r.data_inicio ? new Date(r.data_inicio + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data";
              const horaLabel = r.horario_inicio?.slice(0, 5) ?? "--:--";
              const duracao = r.duracao_minutos ?? 0;
              const per = (r.tipo === "avulsa" ? "AVULSA" : (r.periodicidade ?? "DIARIA").toString().toUpperCase());

              const resp = pickOne<RespObj>(r.responsavel);
              const reg = pickOne<RegionalObj>(r.regional);

              return (
                <div
                  key={r.id}
                  style={{
                    ...styles.card,
                    textAlign: "left",
                    borderColor: "rgba(251, 146, 60, 0.25)",
                    background: "radial-gradient(circle at top left, rgba(251, 146, 60, 0.12), #020617)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.titulo}</div>
                      {r.descricao && <div style={{ marginTop: 2, fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>{r.descricao}</div>}
                    </div>

                    <div
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: `1px solid ${theme.colors.neonOrange ?? "#fb923c"}`,
                        fontSize: 10,
                        textTransform: "uppercase",
                        color: theme.colors.neonOrange ?? "#fb923c",
                      }}
                    >
                      {per}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af", lineHeight: 1.4 }}>
                    <div>
                      <strong>Data:</strong> {dataLabel} • <strong>Horário:</strong> {horaLabel} • <strong>Duração:</strong> {duracao} min
                    </div>
                    <div>
                      <strong>Regional:</strong> {r.regional_id == null ? "Geral" : reg?.nome ?? String(r.regional_id)} •{" "}
                      <strong>Responsável:</strong>{" "}
                      {resp?.nome ? `${resp.nome}${resp.nivel ? ` (${resp.nivel})` : ""}` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
