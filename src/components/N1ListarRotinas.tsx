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

  // PostgREST pode devolver como objeto OU array, dependendo do relacionamento
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
  regional_id: number | null;
  grupo_id: number | null;
};


function normalizarPeriodicidade(p?: string | null): Periodicidade {
  const v = (p ?? "diaria").toString().toLowerCase();
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

// helper para normalizar relation: objeto ou array -> objeto
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
  const [aba] = useState<"AVULSA">("AVULSA");

  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [erroModelos, setErroModelos] = useState<string | null>(null);
  const [modelos, setModelos] = useState<RotinaPadraoRow[]>([]);
  const [modeloId, setModeloId] = useState<string>("");

  const [carregandoResp, setCarregandoResp] = useState(false);
  const [erroResp, setErroResp] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  // regional vem do responsavel selecionado; nao ha seletor manual

  // campos
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("60");
  const [urgencia, setUrgencia] = useState<Urgencia>("baixa");

  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diaSemana, setDiaSemana] = useState<"" | "2" | "3" | "4" | "5" | "6" | "7">("2");

  const [dataInicio, setDataInicio] = useState<string>(todayISO());
  const [horarioInicio, setHorarioInicio] = useState<string>("08:00");

  // AVULSA: editavel
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

  const isModoModelo = false;
  const isModoAvulsa = true;

  const modeloSelecionado = useMemo(() => {
    if (!modeloId) return null;
    return modelos.find((m) => String(m.id) === String(modeloId)) ?? null;
  }, [modelos, modeloId]);

  const responsavelSelecionado = useMemo(
    () => responsaveis.find((r) => r.id === responsavelId) ?? null,
    [responsaveis, responsavelId]
  );

  // flags efetivas
  const flagsEfetivas = useMemo(() => {
    if (isModoModelo) {
      return {
        temChecklist: !!modeloSelecionado?.tem_checklist,
        temAnexo: !!modeloSelecionado?.tem_anexo,
      };
    }
    return { temChecklist, temAnexo };
  }, [isModoModelo, modeloSelecionado, temChecklist, temAnexo]);

  // travas iguais combinadas
  const disabledTituloDescricao = isModoModelo; // MODELO trava
  const disabledPeriodicidade = isModoModelo; // MODELO trava
  const disabledChecklistAnexo = isModoModelo; // MODELO trava
  const disabledDiaSemana = isModoAvulsa; // avulsa nao aplica

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

      // NORMALIZA relations que podem vir como array
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
  // carregar responsaveis (N2/N3 do dept/setor)
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
        .select("id,nome,nivel,departamento_id,setor_id,regional_id,grupo_id,ativo")
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
        regional_id: u.regional_id != null ? Number(u.regional_id) : null,
        grupo_id: u.grupo_id != null ? Number(u.grupo_id) : null,
      }));
      const selfId = String(perfil.id);
      const selfNome = String(perfil.nome ?? "Eu");
      if (!lista.some((u) => u.id === selfId)) {
        lista.unshift({
          id: selfId,
          nome: selfNome,
          nivel: perfil.nivel,
          regional_id: perfil.regional_id ?? null,
          grupo_id: perfil.grupo_id ?? null,
        });
      }

      setResponsaveis(lista);
      setResponsavelId((prev) => prev || (lista[0]?.id ?? ""));
    } catch (e: any) {
      console.error("Erro ao carregar responsaveis N1:", e);
      setErroResp(e.message ?? "Erro ao carregar responsaveis.");
      setResponsaveis([]);
      setResponsavelId("");
    } finally {
      setCarregandoResp(false);
    }
  };

  // ---------------------------
  // carregar modelos (rotinas_padrao do dept/setor)
  // ---------------------------
  const carregarModelos = async () => {
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

  useEffect(() => {
    void carregarRotinas();
    void carregarModelos();
    void carregarResponsaveis();
    // regional vem do responsavel selecionado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.id, deptId, setorId]);

  // ---------------------------
  // trocar aba: reset mensagens e estado minimo
  // ---------------------------
  useEffect(() => {
    setStatusMsg(null);
    setDetails(null);
    setModeloId("");
  }, []);

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

    // apenas exibicao
    setTemChecklist(!!m.tem_checklist);
    setTemAnexo(!!m.tem_anexo);
  };

  // ----------------------------
  // submit (function eqf-create-rotina-diaria)
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setStatusMsg(null);
    setDetails(null);

    if (!deptId || !setorId) {
      setStatusMsg("Erro: Seu usuario N1 nao esta amarrado em Departamento/Setor.");
      return;
    }

    if (!responsavelId) {
      setStatusMsg("Selecione um responsavel (N2/N3).");
      return;
    }

    const grupoIdEfetivo = responsavelSelecionado?.grupo_id ?? (perfil as any)?.grupo_id ?? null;
    if (!grupoIdEfetivo) {
      setStatusMsg("Responsavel precisa estar vinculado a um grupo.");
      return;
    }

    if (isModoModelo && !modeloSelecionado) {
      setStatusMsg("Selecione um modelo do N1.");
      return;
    }

    const minutos = Number(duracaoMinutos);
    if (!Number.isFinite(minutos) || minutos < 0) {
      setStatusMsg("Duracao invalida.");
      return;
    }

    if (!dataInicio) {
      setStatusMsg("Selecione a data de inicio.");
      return;
    }
    if (!horarioInicio) {
      setStatusMsg("Selecione o horario.");
      return;
    }

    setLoadingCriar(true);
    setStatusMsg("Criando rotina...");

    try {
      const { data: grupoData, error: grupoError } = await supabase
        .from("grupos")
        .select("id,departamento_id,setor_id,regional_id,ativo")
        .eq("id", grupoIdEfetivo)
        .single();
      if (grupoError) throw grupoError;
      if (!grupoData || grupoData.ativo === false) {
        setStatusMsg("Grupo inativo ou inexistente.");
        return;
      }
      if (grupoData.departamento_id !== deptId || grupoData.setor_id !== setorId) {
        setStatusMsg("Grupo nao pertence ao mesmo departamento/setor.");
        return;
      }
      const regionalIdEfetivo = grupoData.regional_id ?? null;

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

        duracao_minutos: minutos, // livre
        urgencia: urgencia, // livre

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
        grupo_id: grupoIdEfetivo,
        departamento_id: deptId,
        setor_id: setorId,
        regional_id: regionalIdEfetivo,

        rotina_padrao_id: isModoModelo ? modeloSelecionado!.id : null,
      };

      const { data, error } = await supabase.functions.invoke("eqf-create-rotina-diaria", { body });
      if (error) throw error;

      setStatusMsg("Rotina criada com sucesso!");
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
      setStatusMsg(`Erro: ${err.message ?? String(err)}`);
      setDetails(JSON.stringify(err, null, 2));
    } finally {
      setLoadingCriar(false);
    }
  };

  // ---------------------------
  // ordenacao lista
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
      {/* BLOCO 6B - CRIAR ROTINA (TOPO) */}
      <div style={{ ...styles.card, textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.colors.neonOrange ?? "#fb923c" }}>
              Bloco 6B - Criar rotina (N1)
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
              Este bloco chama a funcao <b>eqf-create-rotina-diaria</b>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                ...btnSecondary,
                borderColor: theme.colors.neonGreen ?? "#22c55e",
                color: theme.colors.neonGreen ?? "#22c55e",
                cursor: "default",
              }}
            >
              Rotina Avulsa (1 dia)
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div>
              <label style={styles.label}>Responsavel</label>
              <select
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                style={styles.input}
                disabled={carregandoResp}
              >
                <option value="">Selecione</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} ({r.nivel})
                  </option>
                ))}
              </select>
              {erroResp && <div style={{ marginTop: 6, fontSize: 12, color: "#fecaca" }}>{erroResp}</div>}
            </div>

            <div>
              <label style={styles.label}>Data de inicio</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Horario</label>
              <input
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div>
            <label style={styles.label}>Titulo</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={styles.input}
              disabled={disabledTituloDescricao}
            />
          </div>

          <div>
            <label style={styles.label}>Descricao</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              style={styles.textarea}
              disabled={disabledTituloDescricao}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={styles.label}>Duracao (min)</label>
              <input
                type="number"
                min={1}
                value={duracaoMinutos}
                onChange={(e) => setDuracaoMinutos(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Urgencia</label>
              <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)} style={styles.input}>
                <option value="baixa">Baixa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Periodicidade</label>
              <input value="Diaria (fixo)" disabled style={{ ...styles.input, color: "#9ca3af" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: theme.colors.textSoft }}>
              <input
                type="checkbox"
                checked={flagsEfetivas.temChecklist}
                onChange={(e) => setTemChecklist(e.target.checked)}
                disabled={disabledChecklistAnexo}
              />
              Tem checklist
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: theme.colors.textSoft }}>
              <input
                type="checkbox"
                checked={flagsEfetivas.temAnexo}
                onChange={(e) => setTemAnexo(e.target.checked)}
                disabled={disabledChecklistAnexo}
              />
              Exige anexo
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" style={btnPrimary} disabled={loadingCriar}>
              {loadingCriar ? "Salvando..." : "Salvar rotina"}
            </button>
            {statusMsg && <div style={{ fontSize: 12, color: theme.colors.textSoft }}>{statusMsg}</div>}
          </div>

          {details && (
            <pre style={{ margin: 0, fontSize: 11, color: theme.colors.textMuted, whiteSpace: "pre-wrap" }}>
              {details}
            </pre>
          )}
        </form>
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
                      <strong>Data:</strong> {dataLabel} - <strong>Horario:</strong> {horaLabel} - <strong>Duracao:</strong> {duracao} min
                    </div>
                    <div>
                      <strong>Regional:</strong> {r.regional_id == null ? "Geral" : reg?.nome ?? String(r.regional_id)} -{" "}
                      <strong>Responsavel:</strong>{" "}
                      {resp?.nome ? `${resp.nome}${resp.nivel ? ` (${resp.nivel})` : ""}` : "-"}
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


