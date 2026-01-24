import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  perfil: Usuario | null;
};

type Urgencia = "alta" | "media" | "baixa";
type Periodicidade = "diaria" | "semanal" | "quinzenal" | "mensal";
type TipoRotina = "normal" | "avulsa";

type UsuarioOption = {
  id: string;
  nome: string;
  email: string;
  nivel: string;
  setor_id: number | null;
  departamento_id: number | null;
  regional_id: number | null;
};

type RotinaPadraoOption = {
  id: string;
  titulo: string;
  descricao: string | null;
  sugestao_duracao_minutos: number | null;
  horario_inicio: string | null;
  urgencia: Urgencia | null;
  tipo: TipoRotina | null;
  periodicidade: Periodicidade | null;
  dia_semana: string | null;
  tem_checklist: boolean | null;
  tem_anexo: boolean | null;
  departamento_id: number | null;
  setor_id: number | null;
  grupo_id: number | null;
};

type GrupoOption = {
  id: number;
  nome: string;
  departamento_id: number;
  setor_id: number;
  regional_id: number | null;
  ativo: boolean;
};

function toYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toYMDLocal(d);
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toYMDLocal(d);
}

function toISODate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return trimmed;
}

function normalizePeriodicidade(p: any): Periodicidade {
  const v = String(p ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (v.includes("quinz")) return "quinzenal";
  if (v === "semanal") return "semanal";
  if (v === "mensal") return "mensal";
  return "diaria";
}

function normalizeDiaSemana(d: any): "" | "2" | "3" | "4" | "5" | "6" | "7" {
  const v = String(d ?? "").trim();
  if (["2", "3", "4", "5", "6", "7"].includes(v)) return v as any;
  return "";
}

function parseDiasSemana(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((d) => d.trim())
    .filter((d) => ["2", "3", "4", "5", "6", "7"].includes(d));
}

function nextDateForWeekday(baseISO: string, dia: "2" | "3" | "4" | "5" | "6" | "7"): string {
  // dia: "2"=segunda, "3"=terça, "4"=quarta, "5"=quinta, "6"=sexta, "7"=sábado
  const base = new Date(baseISO + "T00:00:00");
  // mapeia para JS getDay() (0=dom,1=seg,...,6=sáb)
  const alvoJs = { "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6 }[dia];
  const baseJs = base.getDay(); // 0..6
  const diff = (alvoJs - baseJs + 7) % 7;
  const add = diff; // permite agendar no próprio dia, se coincidir
  const d = new Date(base);
  d.setDate(d.getDate() + add);
  return toYMDLocal(d);
}

export function N1CreateRotina({ perfil }: Props) {
  // campos editáveis
  const [duracaoMinutos, setDuracaoMinutos] = useState("30"); // default 30
  const [dataInicio, setDataInicio] = useState(todayISO());
  const [dataFim, setDataFim] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  // campos do modelo
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia>("alta");
  const [tipoRotina, setTipoRotina] = useState<TipoRotina>("normal");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diasSemana, setDiasSemana] = useState<string[]>(["2"]);
  // compat: seletor legado de dia único
  const setDiaSemana = (v: string) => setDiasSemana(v ? [v] : []);
  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  // grupos
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [grupoId, setGrupoId] = useState<string>("");
  const [gruposErro, setGruposErro] = useState<string | null>(null);

  // UI status
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avisoScope, setAvisoScope] = useState<string | null>(null);

  // modelos
  const [rotinasPadrao, setRotinasPadrao] = useState<RotinaPadraoOption[]>([]);
  const [rotinaPadraoId, setRotinaPadraoId] = useState<string>("");
  const [loadingPadrao, setLoadingPadrao] = useState(false);
  const [erroPadrao, setErroPadrao] = useState<string | null>(null);

  const isSelf = useMemo(() => {
    if (!perfil?.id) return false;
    return String(responsavelId) === String(perfil.id);
  }, [responsavelId, perfil?.id]);

  const responsavelSelecionado = useMemo(() => {
    if (!responsavelId) return null;
    if (isSelf && perfil) {
      return {
        id: perfil.id,
        nome: perfil.nome ?? "EU",
        email: perfil.email ?? "",
        nivel: "N1",
        setor_id: perfil.setor_id ?? null,
        departamento_id: perfil.departamento_id ?? null,
        regional_id: perfil.regional_id ?? null,
      } as UsuarioOption;
    }
    return usuarios.find((u) => String(u.id) === String(responsavelId)) ?? null;
  }, [usuarios, responsavelId, isSelf, perfil]);

  const responsavelLabel = useMemo(() => {
    if (!perfil) return "(não selecionado)";
    if (isSelf) return `${perfil.nome ?? "EU"} (EU - N1)`;
    if (responsavelSelecionado) return `${responsavelSelecionado.nome} (${responsavelSelecionado.nivel})`;
    return "(não selecionado)";
  }, [perfil, isSelf, responsavelSelecionado]);

  const modeloSelecionado = useMemo(() => {
    if (!rotinaPadraoId) return null;
    return rotinasPadrao.find((r) => r.id === rotinaPadraoId) ?? null;
  }, [rotinasPadrao, rotinaPadraoId]);

  const usandoModelo = !!modeloSelecionado;
  const lockModeloFields = usandoModelo;

  const flagsEfetivas = useMemo(() => {
    if (usandoModelo) {
      return {
        temChecklist: !!modeloSelecionado?.tem_checklist,
        temAnexo: !!modeloSelecionado?.tem_anexo,
      };
    }
    return { temChecklist, temAnexo };
  }, [usandoModelo, modeloSelecionado, temChecklist, temAnexo]);

  useEffect(() => {
    if (!perfil?.id) return;
    void carregarUsuarios();
    void carregarRotinasPadrao();
    void carregarGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, perfil?.setor_id, perfil?.departamento_id, perfil?.regional_id]);

  const carregarUsuarios = async () => {
    if (!perfil) return;
    setAvisoScope(null);
    try {
      const { data, error } = await supabase.rpc("eqf_responsaveis_rotina_n1", {
        p_usuario_id: perfil.id,
      });
      if (error) {
        setAvisoScope("Erro ao carregar responsáveis.");
        setUsuarios([]);
        return;
      }
      const lista = (data || []) as UsuarioOption[];
      if (!lista.length) setAvisoScope("Nenhum usuário N2/N3 encontrado para o seu setor/departamento.");
      setUsuarios(lista);
      setResponsavelId((prev) => {
        if (perfil?.id && String(prev) === String(perfil.id)) return prev;
        if (prev && lista.some((u) => String(u.id) === String(prev))) return prev;
        return lista[0]?.id ?? "";
      });
    } catch (e) {
      setAvisoScope("Erro inesperado ao carregar responsáveis.");
      setUsuarios([]);
    }
  };

  const carregarRotinasPadrao = async () => {
    if (!perfil) return;
    setLoadingPadrao(true);
    setErroPadrao(null);
    try {
      let q = supabase.from("rotinas_padrao").select(`
          id,
          titulo,
          descricao,
          sugestao_duracao_minutos,
          horario_inicio,
          urgencia,
          tipo,
          periodicidade,
          dia_semana,
          tem_checklist,
          tem_anexo,
          departamento_id,
          setor_id,
          grupo_id
        `);

      if (perfil.departamento_id != null) q = q.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id != null) q = q.eq("setor_id", perfil.setor_id);

      const { data, error } = await q.order("titulo", { ascending: true });
      if (error) {
        setErroPadrao("Erro ao carregar modelos de rotina.");
        setRotinasPadrao([]);
        return;
      }
      setRotinasPadrao((data || []) as RotinaPadraoOption[]);
    } catch {
      setErroPadrao("Erro inesperado ao carregar modelos.");
      setRotinasPadrao([]);
    } finally {
      setLoadingPadrao(false);
    }
  };

  const carregarGrupos = async () => {
    if (!perfil?.departamento_id || !perfil?.setor_id) {
      setGrupos([]);
      setGrupoId("");
      setGruposErro("Usuário N1 sem departamento/setor definido.");
      return;
    }
    try {
      let q = supabase
        .from("grupos")
        .select("id, nome, departamento_id, setor_id, regional_id, ativo")
        .eq("departamento_id", perfil.departamento_id)
        .eq("setor_id", perfil.setor_id);


      const { data, error } = await q.order("nome", { ascending: true });
      if (error) {
        setGruposErro("Erro ao carregar grupos.");
        setGrupos([]);
        setGrupoId("");
        return;
      }
      const ativos = (data ?? []).filter((g: any) => g.ativo !== false) as GrupoOption[];
      setGrupos(ativos);
      setGrupoId((prev) => {
        if (prev && ativos.some((g) => String(g.id) === String(prev))) return prev;
        return ativos[0] ? String(ativos[0].id) : "";
      });
      setGruposErro(ativos.length ? null : "Nenhum grupo ativo encontrado.");
    } catch {
      setGruposErro("Erro inesperado ao carregar grupos.");
      setGrupos([]);
      setGrupoId("");
    }
  };

  const handleChangeRotinaPadrao = (id: string) => {
    setRotinaPadraoId(id);
    if (!id) return;
    const m = rotinasPadrao.find((r) => r.id === id);
    if (!m) return;
    setTitulo(m.titulo || "");
    setDescricao(m.descricao || "");
    if (m.urgencia) setUrgencia(m.urgencia);
    if (m.tipo) setTipoRotina(m.tipo);
    if (m.periodicidade) setPeriodicidade(m.periodicidade);
    const dsList = parseDiasSemana(m.dia_semana);
    setDiasSemana(dsList);
    if (m.grupo_id != null && String(m.grupo_id) !== grupoId) setGrupoId(String(m.grupo_id));
    if (m.horario_inicio) setHorarioInicio(m.horario_inicio);
    setTemChecklist(!!m.tem_checklist);
    setTemAnexo(!!m.tem_anexo);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!perfil) {
      setStatusMsg("Perfil não carregado. Faça login novamente.");
      return;
    }
    if (!responsavelId) {
      setStatusMsg("Selecione um responsável (N2/N3) ou clique em Criar para mim (N1).");
      return;
    }
    if (!grupoId) {
      setStatusMsg("Selecione o grupo para classificar a rotina.");
      return;
    }

    setLoading(true);
    setStatusMsg("Validando conflito diária...");
    setDetails(null);

    try {
      const minutos = Number(duracaoMinutos);
      const minutosEfetivos = Number.isFinite(minutos) && minutos > 0 ? minutos : 30;

      const tituloEfetivo = usandoModelo ? (modeloSelecionado?.titulo ?? "") : titulo;
      const descricaoEfetiva = usandoModelo ? (modeloSelecionado?.descricao ?? "") : descricao;

      const urgenciaEfetiva: Urgencia = usandoModelo ? ((modeloSelecionado?.urgencia ?? "alta") as Urgencia) : urgencia;
      const tipoEfetivo: TipoRotina = usandoModelo ? ((modeloSelecionado?.tipo ?? "normal") as TipoRotina) : tipoRotina;
      const periodicidadeEfetiva: Periodicidade =
        tipoEfetivo === "avulsa"
          ? "diaria"
          : usandoModelo
            ? normalizePeriodicidade(modeloSelecionado?.periodicidade ?? "diaria")
            : periodicidade;

      const baseDias =
        periodicidadeEfetiva === "semanal" || periodicidadeEfetiva === "quinzenal"
          ? usandoModelo && modeloSelecionado?.dia_semana
            ? parseDiasSemana(modeloSelecionado.dia_semana)
            : diasSemana
          : [];

      if ((periodicidadeEfetiva === "semanal" || periodicidadeEfetiva === "quinzenal") && baseDias.length === 0) {
        setStatusMsg("Escolha pelo menos um dia da semana.");
        setLoading(false);
        return;
      }

      const periodicidadeParaEdge: Periodicidade =
        periodicidadeEfetiva === "quinzenal" ? "semanal" : periodicidadeEfetiva;

      const precisaChecarConflito = tipoEfetivo === "normal" && periodicidadeParaEdge === "diaria";

      if (precisaChecarConflito) {
        const { data: temConflito, error: errRpc } = await supabase.rpc("check_conflito_diaria", {
          p_responsavel: responsavelId,
          p_horario: horarioInicio,
          p_duracao_min: minutosEfetivos,
        });
        if (errRpc) throw errRpc;
        if (temConflito) {
          setStatusMsg("Já existe rotina diária nesse horário para esse usuário.");
          setLoading(false);
          return;
        }
      }

      setStatusMsg("Enviando rotina para o Supabase...");
      const regionalEfetiva = isSelf ? (perfil.regional_id ?? null) : (responsavelSelecionado?.regional_id ?? null);

      const diasCriar = baseDias.length ? baseDias : [null];
      const resultados: any[] = [];
      let baseData = tipoEfetivo === "avulsa" ? (toISODate(dataInicio) ?? todayISO()) : todayISO();

      // diária: se cair em sábado/domingo, empurra para a próxima segunda
      if (tipoEfetivo === "normal" && periodicidadeEfetiva === "diaria") {
        const dow = new Date(baseData + "T00:00:00").getDay(); // 0=dom,6=sab
        if (dow === 0) baseData = addDaysISO(baseData, 1);
        if (dow === 6) baseData = addDaysISO(baseData, 2);
      }

      // mensal: mantém bloqueio para fim de semana
      if (tipoEfetivo === "normal" && periodicidadeEfetiva === "mensal") {
        const dow = new Date(baseData + "T00:00:00").getDay(); // 0=dom,6=sab
        if (dow === 0 || dow === 6) {
          setStatusMsg("Rotinas mensais não podem iniciar em sábado ou domingo. Escolha um dia útil.");
          setLoading(false);
          return;
        }
      }

      for (const dia of diasCriar) {
        // para semanal/quinzenal, usa a data base informada (ou hoje) como primeira ocorrência
        const dataParaInserir =
          periodicidadeParaEdge === "semanal" && dia
            ? nextDateForWeekday(baseData, dia as any)
            : baseData;

        const { data, error } = await supabase.functions.invoke("eqf-create-rotina-diaria", {
          body: {
            duracao_minutos: minutosEfetivos,
            urgencia: urgenciaEfetiva,
            tipo: tipoEfetivo,
            periodicidade: periodicidadeParaEdge,
            titulo: tituloEfetivo,
            descricao: descricaoEfetiva,
            dia_semana: dia,
            data_inicio: dataParaInserir,
            data_fim: toISODate(dataFim),
            horario_inicio: horarioInicio || null,
            tem_checklist: flagsEfetivas.temChecklist,
            tem_anexo: flagsEfetivas.temAnexo,
            responsavel_id: responsavelId,
            criador_id: perfil.id,
            departamento_id: perfil.departamento_id ?? null,
            setor_id: perfil.setor_id ?? null,
            regional_id: regionalEfetiva,
            rotina_padrao_id: usandoModelo ? modeloSelecionado!.id : null,
            grupo_id: Number(grupoId),
          },
        });

        if (error) {
          const msgData = (data as any)?.message ?? (data as any)?.error ?? null;
          const diaLabel = dia ? ` (dia ${dia})` : "";
          setStatusMsg(`Erro ao criar rotina${diaLabel}: ${msgData ?? error.message}`);
          setDetails(
            JSON.stringify(
              {
                dia_semana: dia,
                status: (error as any)?.status ?? null,
                message: error.message,
                context: (error as any)?.context ?? null,
                data,
                raw: error,
              },
              null,
              2
            )
          );
          return;
        }
        resultados.push(data);
      }

      setStatusMsg(
        resultados.length > 1
          ? `Rotinas criadas com sucesso para ${resultados.length} dia(s) da semana.`
          : "Rotina criada com sucesso."
      );
      setDetails(JSON.stringify(resultados, null, 2));

      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("30");
      setUrgencia("alta");
      setTipoRotina("normal");
      setPeriodicidade("diaria");
      setDiasSemana(["2"]);
      setDataInicio(todayISO());
      setDataFim("");
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);
      setRotinaPadraoId("");
      setGrupoId((prev) => {
        if (prev && grupos.some((g) => String(g.id) === String(prev))) return prev;
        return grupos[0] ? String(grupos[0].id) : "";
      });

      setResponsavelId((prev) => {
        if (perfil?.id && String(prev) === String(perfil.id)) return prev;
        if (prev && usuarios.some((u) => String(u.id) === String(prev))) return prev;
        return usuarios[0]?.id ?? "";
      });
    } catch (err) {
      setStatusMsg(`Erro inesperado: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const duracao = Number(duracaoMinutos) || 0;
  const [hora, minuto] = horarioInicio.split(":").map((x) => Number(x) || 0);

  const regionalPreview = useMemo(() => {
    if (!perfil) return "null";
    if (isSelf) return String(perfil.regional_id ?? "null");
    return String(responsavelSelecionado?.regional_id ?? "null");
  }, [perfil, isSelf, responsavelSelecionado]);

  const periodicidadeRender: Periodicidade = usandoModelo
    ? normalizePeriodicidade(modeloSelecionado?.periodicidade ?? "diaria")
    : periodicidade;
  const diasHabilitados = ["semanal", "quinzenal"].includes(periodicidadeRender);

  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid #222",
        padding: 16,
        background: "radial-gradient(circle at top left, rgba(0,255,136,0.08), #050608)",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#00ff88" }}>Bloco 6B — Criar rotina (N1)</h3>
      <p style={{ fontSize: 13, color: "#ccc" }}>
        Este bloco chama a função <strong>eqf-create-rotina-diaria</strong>.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setTipoRotina("normal")}
          style={{
            ...styles.button,
            padding: "8px 12px",
            background: tipoRotina === "normal" ? theme.colors.neonGreen : "transparent",
            color: tipoRotina === "normal" ? "#022c22" : theme.colors.neonGreen,
            border: `1px solid ${theme.colors.neonGreen}`,
          }}
        >
          Usar modelo
        </button>
        <button
          type="button"
          onClick={() => {
            setTipoRotina("avulsa");
            setRotinaPadraoId("");
          }}
          style={{
            ...styles.button,
            padding: "8px 12px",
            background: tipoRotina === "avulsa" ? theme.colors.neonGreen : "transparent",
            color: tipoRotina === "avulsa" ? "#022c22" : theme.colors.neonGreen,
            border: `1px solid ${theme.colors.neonGreen}`,
          }}
        >
          Criar avulsa
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={styles.label}>Tipo de rotina</label>
          <select
            value={tipoRotina}
            onChange={(e) => {
              const val = e.target.value as TipoRotina;
              setTipoRotina(val);
              if (val === "avulsa") {
                setRotinaPadraoId("");
              }
            }}
            style={styles.input}
            disabled={lockModeloFields}
          >
            <option value="normal">Normal</option>
            <option value="avulsa">Avulsa</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <label style={styles.label}>Grupo (obrigatório)</label>
            <select
              value={grupoId}
              onChange={(e) => {
                const val = e.target.value;
                setGrupoId(val);
                const modeloAtual = rotinasPadrao.find((r) => r.id === rotinaPadraoId);
                if (modeloAtual && modeloAtual.grupo_id != null && String(modeloAtual.grupo_id) !== val) {
                  setRotinaPadraoId("");
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
            {gruposErro && <div style={{ fontSize: 11, color: "#f97316", marginTop: 4 }}>{gruposErro}</div>}
          </div>

          <div>
            <label style={styles.label}>Rotina Padrão (opcional)</label>
            <select
              value={rotinaPadraoId}
              onChange={(e) => handleChangeRotinaPadrao(e.target.value)}
              style={styles.input}
              disabled={tipoRotina === "avulsa"}
            >
              <option value="">{loadingPadrao ? "Carregando modelos..." : "Selecione um modelo (opcional)"}</option>
              {rotinasPadrao
                .filter((r) => r.grupo_id != null && String(r.grupo_id) === String(grupoId))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.titulo}
                  </option>
                ))}
            </select>
            {usandoModelo && (
              <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>
                Modo modelo ativo: campos do modelo travados. Ajuste apenas responsável / data / horário / duração e dia da semana.
              </div>
            )}
            {erroPadrao && <div style={{ fontSize: 11, color: "#f97316", marginTop: 4 }}>{erroPadrao}</div>}
          </div>
        </div>

        <div>
          <label style={styles.label}>Título da rotina</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required disabled={lockModeloFields} />
          {lockModeloFields && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Travado pelo modelo.</div>}
        </div>

        <div>
          <label style={styles.label}>Descrição / Observações</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
            disabled={lockModeloFields}
          />
        </div>

        <div>
          <label style={styles.label}>Responsável pela rotina</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              style={{ ...styles.input, flex: 1, minWidth: 240 }}
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.nivel})
                </option>
              ))}
            </select>
            <button type="button" onClick={() => perfil && setResponsavelId(perfil.id)} style={{ ...styles.button, padding: "8px 12px" }}>
              Criar para mim (N1)
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {avisoScope ? avisoScope : `N1 escolhe o responsável do seu setor/departamento — atual: ${responsavelLabel}`}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Duração (minutos)</label>
            <input
              type="number"
              value={duracaoMinutos}
              min={1}
              onChange={(e) => setDuracaoMinutos(e.target.value)}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Urgência</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)} style={styles.input}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Dia da semana</label>
            <div
              style={{
                border: `1px solid ${theme.colors.borderSoft}`,
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gap: 6,
                color: "#e5e7eb",
                opacity: diasHabilitados ? 1 : 0.5,
              }}
            >
              {["2", "3", "4", "5", "6", "7"].map((d) => {
                const label =
                  d === "2"
                    ? "Segunda"
                    : d === "3"
                      ? "Terça"
                      : d === "4"
                        ? "Quarta"
                        : d === "5"
                          ? "Quinta"
                          : d === "6"
                            ? "Sexta"
                            : "Sábado";
                return (
                  <label key={d} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      disabled={!diasHabilitados}
                      checked={diasSemana.includes(d)}
                      onChange={(e) => {
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
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Obs.: só habilitado para Semanal ou Quinzenal.
            </div>
          </div>
          <div>
            <label style={styles.label}>Periodicidade</label>
            <select
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
              style={styles.input}
              disabled={lockModeloFields}
            >
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal (2x mês)</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Data de início (opcional)</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={styles.input}
              min={todayISO()}
              disabled={tipoRotina !== "avulsa"}
            />
          </div>
          <div>
            <label style={styles.label}>Data de fim (opcional)</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={styles.input}
              min={dataInicio || todayISO()}
            />
          </div>
          <div>
            <label style={styles.label}>Horário (agenda)</label>
            <input
              type="time"
              value={horarioInicio}
              onChange={(e) => setHorarioInicio(e.target.value)}
              style={styles.input}
              disabled={lockModeloFields && !!modeloSelecionado?.horario_inicio}
            />
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Duração estimada: {duracao} min • Horário atual: {String(hora).padStart(2, "0")}:{String(minuto).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={styles.label}>Checklist e anexo</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#e5e7eb" }}>
            <input
              type="checkbox"
              checked={temChecklist}
              onChange={(e) => setTemChecklist(e.target.checked)}
              disabled={lockModeloFields}
            />
            Rotina tem checklist?
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#e5e7eb" }}>
            <input type="checkbox" checked={temAnexo} onChange={(e) => setTemAnexo(e.target.checked)} disabled={lockModeloFields} />
            Rotina exige anexo na execução?
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              ...styles.button,
              padding: "10px 16px",
              background: theme.colors.neonGreen,
              color: "#022c22",
              border: "none",
            }}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar rotina"}
          </button>
          <button
            type="button"
            style={{ ...styles.button, padding: "10px 16px", background: "#111827", color: "#e5e7eb" }}
            onClick={() => {
              setTitulo("");
              setDescricao("");
              setDuracaoMinutos("30");
              setUrgencia("alta");
              setTipoRotina("normal");
              setPeriodicidade("diaria");
              setDiaSemana("2");
              setDataInicio(todayISO());
              setHorarioInicio("08:00");
              setTemChecklist(false);
              setTemAnexo(false);
              setRotinaPadraoId("");
              setGrupoId((prev) => {
                if (prev && grupos.some((g) => String(g.id) === String(prev))) return prev;
                return grupos[0] ? String(grupos[0].id) : "";
              });
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
              maxHeight: 260,
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

export default N1CreateRotina;






