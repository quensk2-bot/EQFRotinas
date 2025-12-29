// src/components/N2CriarRotina.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  usuarioLogado: Usuario;
};

type Periodicidade = "diaria" | "semanal" | "quinzenal" | "mensal";
type SlotStatus = "livre" | "limite" | "bloqueado";

type RotinaPadraoRow = {
  id: string;
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
  grupo_id: number | null;
};

type Responsavel = {
  id: string;
  nome: string;
  nivel: string;
};

type GrupoOption = {
  id: number;
  nome: string;
  departamento_id: number;
  setor_id: number;
  regional_id: number;
  ativo: boolean;
};

function normalizarPeriodicidade(p?: string | null): Periodicidade {
  const v = (p ?? "diaria").toString().toLowerCase();
  if (v.includes("quinz")) return "quinzenal";
  if (v.includes("seman")) return "semanal";
  if (v.includes("mens")) return "mensal";
  return "diaria";
}

function normalizarDiaSemana(d?: string | null): "" | "2" | "3" | "4" | "5" | "6" | "7" {
  const v = (d ?? "").toString().trim();
  if (v === "2" || v === "3" || v === "4" || v === "5" || v === "6" || v === "7") return v;
  return "";
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function callEdgeFunction<T = any>(name: string, payload: any) {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

  if (!baseUrl || !anonKey) {
    return {
      ok: false as const,
      status: 0,
      statusText: "ENV_MISSING",
      raw: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nao encontrados.",
      json: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sem sessao ativa (access_token). Faca login novamente.");

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
  const [modeloSelecionado, setModeloSelecionado] = useState<RotinaPadraoRow | null>(null);

  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [grupoId, setGrupoId] = useState<string>("");
  const [erroGrupos, setErroGrupos] = useState<string | null>(null);

  const [carregandoResp, setCarregandoResp] = useState(false);
  const [erroResp, setErroResp] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("60");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diasSemana, setDiasSemana] = useState<string[]>(["2"]);
  const [dataInicio, setDataInicio] = useState<string>(todayISO());
  const [horarioInicio, setHorarioInicio] = useState<string>("08:00");

  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  const deptId = usuarioLogado.departamento_id ?? null;
  const setorId = usuarioLogado.setor_id ?? null;
  const regId = usuarioLogado.regional_id ?? null;

  const isModoModelo = aba === "MODELO";
  const lockModelo = isModoModelo && !!modeloSelecionado;

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

  useEffect(() => {
    if (!modeloId) {
      setModeloSelecionado(null);
      return;
    }
    const m = modelos.find((x) => String(x.id) === String(modeloId)) ?? null;
    setModeloSelecionado(m ?? null);
    if (m) {
      setTitulo((prev) => (prev ? prev : m.titulo ?? ""));
      setDescricao((prev) => (prev ? prev : m.descricao ?? ""));
      if (m.sugestao_duracao_minutos != null) setDuracaoMinutos(String(m.sugestao_duracao_minutos));
      if (m.periodicidade) setPeriodicidade(normalizarPeriodicidade(m.periodicidade));
      if (m.dia_semana) {
        const diaNorm = normalizarDiaSemana(m.dia_semana);
        if (diaNorm) setDiasSemana([diaNorm]);
      }
      setTemChecklist(!!m.tem_checklist);
      setTemAnexo(!!m.tem_anexo);
    }
  }, [modeloId, modelos]);

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
      } catch (err) {
        console.error("Erro ao verificar slot:", err);
        setSlotCount(0);
      } finally {
        setSlotLoading(false);
      }
    };
    void run();
  }, [responsavelId, dataInicio, horarioInicio]);

  useEffect(() => {
    void carregarModelos();
    void carregarResponsaveis();
    void carregarGrupos();
  }, [
    usuarioLogado.id,
    usuarioLogado.nivel,
    usuarioLogado.departamento_id,
    usuarioLogado.setor_id,
    usuarioLogado.regional_id,
  ]);

  async function carregarModelos() {
    if (!deptId || !setorId) {
      setErroModelos("N2 sem departamento/setor.");
      setModelos([]);
      return;
    }
    setCarregandoModelos(true);
    setErroModelos(null);
    try {
      let q = supabase
        .from("rotinas_padrao")
        .select(
          `
          id, titulo, descricao, sugestao_duracao_minutos, periodicidade,
          urgencia, tipo, dia_semana, tem_checklist, tem_anexo,
          departamento_id, setor_id, grupo_id
        `
        )
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId);
      const { data, error } = await q.order("titulo", { ascending: true });
      if (error) throw error;
      setModelos((data ?? []) as RotinaPadraoRow[]);
    } catch (err) {
      console.error(err);
      setErroModelos("Erro ao carregar modelos.");
      setModelos([]);
    } finally {
      setCarregandoModelos(false);
    }
  }

  async function carregarResponsaveis() {
    setCarregandoResp(true);
    setErroResp(null);
    try {
      let q = supabase
        .from("usuarios")
        .select("id, nome, nivel")
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId)
        .in("nivel", ["N2", "N3"])
        .order("nome", { ascending: true });
      if (regId != null) q = q.eq("regional_id", regId);
      const { data, error } = await q;
      if (error) throw error;
      const lista = (data ?? []).map((r: any) => ({
        id: String(r.id),
        nome: String(r.nome),
        nivel: String(r.nivel),
      }));
      setResponsaveis(lista);
      setResponsavelId((prev) => {
        if (prev && lista.some((u) => u.id === prev)) return prev;
        return lista[0]?.id ?? "";
      });
    } catch (err) {
      console.error(err);
      setErroResp("Erro ao carregar responsaveis.");
      setResponsaveis([]);
      setResponsavelId("");
    } finally {
      setCarregandoResp(false);
    }
  }

  async function carregarGrupos() {
    if (!deptId || !setorId) {
      setErroGrupos("N2 sem departamento/setor.");
      setGrupos([]);
      setGrupoId("");
      return;
    }
    try {
      let q = supabase
        .from("grupos")
        .select("id, nome, departamento_id, setor_id, regional_id, ativo")
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId);
      if (regId != null) q = q.eq("regional_id", regId);
      const { data, error } = await q.order("nome", { ascending: true });
      if (error) throw error;
      const ativos = (data ?? []).filter((g: any) => g.ativo !== false) as GrupoOption[];
      setGrupos(ativos);
      setGrupoId((prev) => {
        if (prev && ativos.some((g) => String(g.id) === String(prev))) return prev;
        return ativos[0] ? String(ativos[0].id) : "";
      });
      setErroGrupos(ativos.length ? null : "Nenhum grupo ativo encontrado.");
    } catch (err) {
      console.error(err);
      setErroGrupos("Erro ao carregar grupos.");
      setGrupos([]);
      setGrupoId("");
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setDetails(null);

    if (!deptId || !setorId) {
      setStatusMsg("Seu usuario N2 nao esta amarrado em Departamento/Setor.");
      return;
    }
    if (!responsavelId) {
      setStatusMsg("Selecione um responsavel.");
      return;
    }
    if (!grupoId) {
      setStatusMsg("Selecione o grupo.");
      return;
    }

    if (isModoModelo && !modeloId) {
      setStatusMsg("Selecione um modelo.");
      return;
    }

    const tituloFinal = (titulo || modeloSelecionado?.titulo || "").trim();
    const descricaoFinal = (descricao || modeloSelecionado?.descricao || "").trim();
    if (!tituloFinal) {
      setStatusMsg("Preencha o titulo da rotina.");
      return;
    }
    if (!descricaoFinal) {
      setStatusMsg("Preencha a descricao.");
      return;
    }

    const minutos = Number(duracaoMinutos);
    if (!Number.isFinite(minutos) || minutos < 1) {
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

    setLoading(true);
    setStatusMsg("Enviando rotina...");
    try {
      const modelo = modeloSelecionado;
      const tipoFinal = aba === "AVULSA" ? "avulsa" : isModoModelo ? (modelo?.tipo ?? "normal") : "normal";
      const periodicidadeFinal = isModoModelo ? normalizarPeriodicidade(modelo?.periodicidade) : periodicidade;
      const baseDias =
        periodicidadeFinal === "semanal" || periodicidadeFinal === "quinzenal"
          ? (modelo?.dia_semana
              ? [normalizarDiaSemana(modelo.dia_semana)].filter(Boolean) as string[]
              : diasSemana)
          : [];

      if ((periodicidadeFinal === "semanal" || periodicidadeFinal === "quinzenal") && baseDias.length === 0) {
        setStatusMsg("Escolha pelo menos um dia da semana.");
        setLoading(false);
        return;
      }

      const periodicidadeParaEdge = periodicidadeFinal === "quinzenal" ? "semanal" : periodicidadeFinal;
      const diasParaCriar = baseDias.length ? baseDias : [null];
      const dataInicioFinal = dataInicio || todayISO();

      const resultados: any[] = [];
      for (const dia of diasParaCriar) {
          const body: any = {
            titulo: tituloFinal,
            descricao: descricaoFinal,
            duracao_minutos: isModoModelo ? modelo?.sugestao_duracao_minutos ?? minutos : minutos,
          tipo: tipoFinal,
          urgencia: isModoModelo ? (modelo?.urgencia ?? "baixa") : "baixa",
          periodicidade: periodicidadeParaEdge,
          dia_semana: dia,
          data_inicio: dataInicioFinal,
          horario_inicio: horarioInicio,
          tem_checklist: lockModelo ? !!modelo?.tem_checklist : temChecklist,
          tem_anexo: lockModelo ? !!modelo?.tem_anexo : temAnexo,
          responsavel_id: responsavelId,
          criador_id: usuarioLogado.id,
          departamento_id: deptId,
          setor_id: setorId,
          regional_id: regId ?? null,
          grupo_id: Number(grupoId),
          rotina_padrao_id: isModoModelo ? modelo?.id ?? null : null,
        };

        if (slotStatus === "bloqueado") {
          setStatusMsg("Ja existem 2 rotinas para esse horario e responsavel.");
          setLoading(false);
          return;
        }

        const result = await callEdgeFunction("eqf-create-rotina-diaria", body);
        if (!result.ok) {
          const rawMsg = result.raw || result.statusText || "Erro ao salvar rotina.";
          setStatusMsg(`Erro: ${result.status} ${result.statusText} - ${rawMsg}`);
          setDetails(result.raw);
          console.error("eqf-create-rotina-diaria (N2) ->", {
            status: result.status,
            statusText: result.statusText,
            raw: result.raw,
          });
          return;
        }
        resultados.push(result.json);
      }

      setStatusMsg(
        resultados.length > 1
          ? `Rotinas criadas com sucesso para ${resultados.length} dia(s) da semana.`
          : "Rotina criada com sucesso."
      );
      setDetails(JSON.stringify(resultados, null, 2));

      setModeloId("");
      setModeloSelecionado(null);
      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("60");
      setPeriodicidade("diaria");
      setDiasSemana(["2"]);
      setDataInicio(todayISO());
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);
      setAba("MODELO");
    } catch (err) {
      setStatusMsg(`Erro inesperado: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const modelosFiltrados = useMemo(() => {
    if (!grupoId) return [];
    return modelos.filter((m) => m.grupo_id != null && String(m.grupo_id) === String(grupoId));
  }, [modelos, grupoId]);

  return (
    <section
      style={{
        borderRadius: 14,
        border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
        background: "radial-gradient(circle at top left, rgba(0,255,136,0.05), #050608)",
        padding: 14,
        width: "100%",
      }}
    >
      <h3 style={{ marginTop: 0, color: theme.colors.neonGreen ?? "#22c55e" }}>Bloco 6B — Criar rotina (N2)</h3>
      <p style={{ fontSize: 13, color: "#ccc" }}>Este bloco chama a funcao eqf-create-rotina-diaria.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAba("MODELO")}
            style={{
              ...btnSecondary,
              background: aba === "MODELO" ? "rgba(34,197,94,0.1)" : "transparent",
              borderColor: aba === "MODELO" ? theme.colors.neonGreen ?? "#22c55e" : btnSecondary.border,
              color: aba === "MODELO" ? theme.colors.neonGreen ?? "#22c55e" : btnSecondary.color,
            }}
          >
            Usar modelo
          </button>
          <button
            type="button"
            onClick={() => setAba("AVULSA")}
            style={{
              ...btnSecondary,
              background: aba === "AVULSA" ? "rgba(34,197,94,0.1)" : "transparent",
              borderColor: aba === "AVULSA" ? theme.colors.neonGreen ?? "#22c55e" : btnSecondary.border,
              color: aba === "AVULSA" ? theme.colors.neonGreen ?? "#22c55e" : btnSecondary.color,
            }}
          >
            Criar avulsa
          </button>
        </div>

        <div>
          <label style={styles.label}>Grupo (obrigatorio)</label>
          <select
            value={grupoId}
            onChange={(e) => {
              setGrupoId(e.target.value);
              const mAtual = modelos.find((m) => m.id === modeloId);
              if (mAtual && mAtual.grupo_id != null && String(mAtual.grupo_id) !== e.target.value) {
                setModeloId("");
              }
            }}
            style={styles.input}
            required
          >
            <option value="">{grupos.length ? "Selecione o grupo" : "Nenhum grupo encontrado"}</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
          {erroGrupos && <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>{erroGrupos}</div>}
        </div>

        <div>
          <label style={styles.label}>Rotina Padrao (modelo)</label>
          <select
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            style={styles.input}
            disabled={carregandoModelos || !grupoId || aba === "AVULSA"}
          >
            <option value="">
              {!grupoId ? "Escolha o grupo primeiro" : carregandoModelos ? "Carregando..." : "Selecione um modelo (opcional)"}
            </option>
            {modelosFiltrados.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo}
              </option>
            ))}
          </select>
          {erroModelos && <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>{erroModelos}</div>}
        </div>

        <div>
          <label style={styles.label}>Titulo da rotina</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required disabled={lockModelo} />
        </div>

        <div>
          <label style={styles.label}>Descricao / Observacoes</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
            required
            disabled={lockModelo}
          />
        </div>

        <div>
          <label style={styles.label}>Responsavel</label>
          <select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            style={styles.input}
            disabled={carregandoResp}
            required
          >
            <option value="">{carregandoResp ? "Carregando..." : "Selecione"}</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} ({r.nivel})
              </option>
            ))}
          </select>
          {erroResp && <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>{erroResp}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Duracao (min)</label>
            <input
              type="number"
              value={duracaoMinutos}
              min={1}
              onChange={(e) => setDuracaoMinutos(e.target.value)}
              style={styles.input}
              disabled={lockModelo}
            />
          </div>
          <div>
            <label style={styles.label}>Periodicidade</label>
            <select
              value={isModoModelo ? normalizarPeriodicidade(modeloSelecionado?.periodicidade) : periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
              style={styles.input}
              disabled={isModoModelo}
            >
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal (2x mes)</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Dia da semana</label>
            <div
              style={{
                border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gap: 6,
                color: "#e5e7eb",
                opacity:
                  isModoModelo
                    ? !["semanal", "quinzenal"].includes(normalizarPeriodicidade(modeloSelecionado?.periodicidade))
                      ? 0.5
                      : 1
                    : !["semanal", "quinzenal"].includes(periodicidade)
                      ? 0.5
                      : 1,
              }}
            >
              {["2", "3", "4", "5", "6", "7"].map((d) => {
                const label =
                  d === "2"
                    ? "Segunda"
                    : d === "3"
                      ? "Terca"
                      : d === "4"
                        ? "Quarta"
                        : d === "5"
                          ? "Quinta"
                          : d === "6"
                            ? "Sexta"
                            : "Sabado";
                const disabled = isModoModelo
                  ? !["semanal", "quinzenal"].includes(normalizarPeriodicidade(modeloSelecionado?.periodicidade))
                  : !["semanal", "quinzenal"].includes(periodicidade);
                return (
                  <label key={d} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={diasSemana.includes(d)}
                      disabled={disabled}
                      onChange={(e) => {
                        if (disabled) return;
                        setDiasSemana((curr) => {
                          if (e.target.checked) return [...new Set([...curr, d])];
                          return curr.filter((x) => x !== d);
                        });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Data de inicio</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Horario</label>
            <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={styles.input} />
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              <span style={{ ...slotBadgeStyle, padding: "2px 8px", borderRadius: 10, display: "inline-block" }}>
                Slot: {slotStatus} {slotLoading ? "(checando...)" : ""}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={styles.label}>Checklist / Anexo</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#e5e7eb" }}>
            <input
              type="checkbox"
              checked={lockModelo ? !!modeloSelecionado?.tem_checklist : temChecklist}
              onChange={(e) => setTemChecklist(e.target.checked)}
              disabled={lockModelo}
            />
            Rotina tem checklist?
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#e5e7eb" }}>
            <input
              type="checkbox"
              checked={lockModelo ? !!modeloSelecionado?.tem_anexo : temAnexo}
              onChange={(e) => setTemAnexo(e.target.checked)}
              disabled={lockModelo}
            />
            Rotina exige anexo na execucao?
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? "Salvando..." : "Salvar rotina"}
          </button>
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              setModeloId("");
              setModeloSelecionado(null);
              setTitulo("");
              setDescricao("");
              setDuracaoMinutos("60");
              setPeriodicidade("diaria");
              setDiasSemana(["2"]);
              setDataInicio(todayISO());
              setHorarioInicio("08:00");
              setTemChecklist(false);
              setTemAnexo(false);
            }}
          >
            Limpar
          </button>
        </div>

        {statusMsg && <div style={{ fontSize: 12, color: "#e5e7eb" }}>{statusMsg}</div>}
        {details && (
          <pre
            style={{
              background: "#0f172a",
              color: "#e5e7eb",
              padding: 10,
              borderRadius: 8,
              fontSize: 11,
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {details}
          </pre>
        )}
      </form>
    </section>
  );
}
