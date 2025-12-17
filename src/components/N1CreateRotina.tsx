// src/components/N1CreateRotina.tsx

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles";
import type { Usuario } from "../types";

type Props = {
  perfil: Usuario | null;
};

type Urgencia = "alta" | "media" | "baixa";
type Periodicidade = "diaria" | "semanal" | "mensal";
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
  urgencia: Urgencia | null;
  tipo: TipoRotina | null;
  periodicidade: Periodicidade | null;
  dia_semana: string | null;
  tem_checklist: boolean | null;
  tem_anexo: boolean | null;
  departamento_id: number | null;
  setor_id: number | null;
};

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

function normalizePeriodicidade(p: any): Periodicidade {
  const v = String(p ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (v === "semanal") return "semanal";
  if (v === "mensal") return "mensal";
  return "diaria";
}

export function N1CreateRotina({ perfil }: Props) {
  // ====== campos “editáveis” (mesmo com modelo) ======
  const [duracaoMinutos, setDuracaoMinutos] = useState("30"); // default 30
  const [dataInicio, setDataInicio] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [responsavelId, setResponsavelId] = useState<string>("");

  // ====== campos “do modelo” (ou manual quando sem modelo) ======
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia>("alta");
  const [tipoRotina, setTipoRotina] = useState<TipoRotina>("normal");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");

  // ✅ Dia da semana SEMPRE destravado (sempre editável)
  const [diaSemana, setDiaSemana] = useState<"2" | "3" | "4" | "5" | "6" | "7" | "">("2");

  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  // ====== UI status ======
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avisoScope, setAvisoScope] = useState<string | null>(null);

  // ====== modelos ======
  const [rotinasPadrao, setRotinasPadrao] = useState<RotinaPadraoOption[]>([]);
  const [rotinaPadraoId, setRotinaPadraoId] = useState<string>("");
  const [loadingPadrao, setLoadingPadrao] = useState(false);
  const [erroPadrao, setErroPadrao] = useState<string | null>(null);

  // --------- derived: responsável ----------
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
    if (isSelf) return `${perfil.nome ?? "EU"} (EU — N1)`;
    if (responsavelSelecionado) return `${responsavelSelecionado.nome} (${responsavelSelecionado.nivel})`;
    return "(não selecionado)";
  }, [perfil, isSelf, responsavelSelecionado]);

  // --------- derived: modelo ----------
  const modeloSelecionado = useMemo(() => {
    if (!rotinaPadraoId) return null;
    return rotinasPadrao.find((r) => r.id === rotinaPadraoId) ?? null;
  }, [rotinasPadrao, rotinaPadraoId]);

  const usandoModelo = !!modeloSelecionado;

  // ✅ trava qualquer edição de “campo do modelo”
  const lockModeloFields = usandoModelo;

  // flags efetivas (sempre do modelo quando usandoModelo)
  const flagsEfetivas = useMemo(() => {
    if (usandoModelo) {
      return {
        temChecklist: !!modeloSelecionado?.tem_checklist,
        temAnexo: !!modeloSelecionado?.tem_anexo,
      };
    }
    return { temChecklist, temAnexo };
  }, [usandoModelo, modeloSelecionado, temChecklist, temAnexo]);

  // --------- effects ----------
  useEffect(() => {
    if (!perfil?.id) return;
    void carregarUsuarios();
    void carregarRotinasPadrao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id, perfil?.setor_id, perfil?.departamento_id]);

  const carregarUsuarios = async () => {
    if (!perfil) return;
    setAvisoScope(null);

    try {
      const { data, error } = await supabase.rpc("eqf_responsaveis_rotina_n1", {
        p_usuario_id: perfil.id,
      });

      if (error) {
        console.error("Erro ao buscar responsáveis (RPC):", error);
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
      console.error("Erro inesperado ao carregar responsáveis:", e);
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
          urgencia,
          tipo,
          periodicidade,
          dia_semana,
          tem_checklist,
          tem_anexo,
          departamento_id,
          setor_id
        `);

      if (perfil.departamento_id != null) q = q.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id != null) q = q.eq("setor_id", perfil.setor_id);

      const { data, error } = await q.order("titulo", { ascending: true });

      if (error) {
        console.error("Erro ao carregar rotinas padrão:", error);
        setErroPadrao("Erro ao carregar modelos de rotina.");
        setRotinasPadrao([]);
        return;
      }

      setRotinasPadrao((data || []) as RotinaPadraoOption[]);
    } catch (e) {
      console.error("Erro inesperado rotinas padrão:", e);
      setErroPadrao("Erro inesperado ao carregar modelos.");
      setRotinasPadrao([]);
    } finally {
      setLoadingPadrao(false);
    }
  };

  // --------- handlers ----------
  const handleChangeRotinaPadrao = (id: string) => {
    setRotinaPadraoId(id);

    const modelo = rotinasPadrao.find((r) => r.id === id);
    if (!modelo) {
      // voltou para “sem modelo”
      setStatusMsg(null);
      setDetails(null);
      return;
    }

    // Carrega os dados do modelo para exibir (travado na UI)
    setTitulo(modelo.titulo ?? "");
    setDescricao(modelo.descricao ?? "");

    setDuracaoMinutos(modelo.sugestao_duracao_minutos != null ? String(modelo.sugestao_duracao_minutos) : "30");

    if (modelo.urgencia) setUrgencia(modelo.urgencia);

    const tipo = (modelo.tipo ?? "normal") as TipoRotina;
    setTipoRotina(tipo);

    const periodicidadeModelo: Periodicidade =
      tipo === "avulsa" ? "diaria" : normalizePeriodicidade(modelo.periodicidade ?? "diaria");
    setPeriodicidade(periodicidadeModelo);

    // ✅ carrega dia_semana do modelo, mas continua editável (destravado)
    if (modelo.dia_semana) setDiaSemana(modelo.dia_semana as any);

    setTemChecklist(!!modelo.tem_checklist);
    setTemAnexo(!!modelo.tem_anexo);

    setStatusMsg("✅ Modelo aplicado: campos do modelo travados. Você ajusta responsável/data/horário/duração e dia da semana.");
    setDetails(null);
  };

  const handleCriarParaMim = () => {
    if (!perfil?.id) return;
    setResponsavelId(perfil.id);
    setStatusMsg("✅ Responsável definido como: EU (N1)");
    setDetails(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!perfil) {
      setStatusMsg("❌ Perfil não carregado. Faça login novamente.");
      return;
    }
    if (!responsavelId) {
      setStatusMsg("❌ Selecione um responsável (N2/N3) ou clique em Criar para mim (N1).");
      return;
    }

    setLoading(true);
    setStatusMsg("⏳ Validando conflito diária...");
    setDetails(null);

    try {
      const minutos = Number(duracaoMinutos);
      const minutosEfetivos = Number.isFinite(minutos) && minutos > 0 ? minutos : 30;

      // se tiver modelo, força tudo do modelo (exceto os editáveis)
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

      // ✅ dia_semana sempre vem do select (destravado), mas só envia se semanal
      const diaSemanaEfetivo = periodicidadeEfetiva === "semanal" ? diaSemana : null;

      // conflito só para rotina normal + diária
      const precisaChecarConflito = tipoEfetivo === "normal" && periodicidadeEfetiva === "diaria";

      if (precisaChecarConflito) {
        const { data: temConflito, error: errRpc } = await supabase.rpc("check_conflito_diaria", {
          p_responsavel: responsavelId,
          p_horario: horarioInicio,
          p_duracao_min: minutosEfetivos,
        });

        if (errRpc) throw errRpc;
        if (temConflito) {
          setStatusMsg("❌ Já existe rotina diária nesse horário para esse usuário.");
          setLoading(false);
          return;
        }
      }

      setStatusMsg("⏳ Enviando rotina para o Supabase...");

      const regionalEfetiva = isSelf ? (perfil.regional_id ?? null) : (responsavelSelecionado?.regional_id ?? null);

      const { data, error } = await supabase.functions.invoke("eqf-create-rotina-diaria", {
        body: {
          duracao_minutos: minutosEfetivos,
          urgencia: urgenciaEfetiva,
          tipo: tipoEfetivo,
          periodicidade: periodicidadeEfetiva,

          titulo: tituloEfetivo,
          descricao: descricaoEfetiva,

          dia_semana: diaSemanaEfetivo,

          data_inicio: dataInicio || null,
          horario_inicio: horarioInicio || null,

          tem_checklist: flagsEfetivas.temChecklist,
          tem_anexo: flagsEfetivas.temAnexo,

          responsavel_id: responsavelId,
          criador_id: perfil.id,

          departamento_id: perfil.departamento_id ?? null,
          setor_id: perfil.setor_id ?? null,
          regional_id: regionalEfetiva,

          rotina_padrao_id: usandoModelo ? modeloSelecionado!.id : null,
        },
      });

      if (error) {
        setStatusMsg(`❌ Erro ao criar rotina: ${error.message}`);
        setDetails(JSON.stringify(error, null, 2));
        return;
      }

      setStatusMsg("✅ Rotina criada com sucesso.");
      setDetails(JSON.stringify(data, null, 2));

      // reset (mantém responsável escolhido)
      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("30");
      setUrgencia("alta");
      setTipoRotina("normal");
      setPeriodicidade("diaria");
      setDiaSemana("2");
      setDataInicio("");
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);
      setRotinaPadraoId("");

      setResponsavelId((prev) => {
        if (perfil?.id && String(prev) === String(perfil.id)) return prev;
        if (prev && usuarios.some((u) => String(u.id) === String(prev))) return prev;
        return usuarios[0]?.id ?? "";
      });
    } catch (err) {
      setStatusMsg(`❌ Erro inesperado: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // --------- UI helpers ----------
  const duracao = Number(duracaoMinutos) || 0;
  const [hora, minuto] = horarioInicio.split(":").map((x) => Number(x) || 0);

  const regionalPreview = useMemo(() => {
    if (!perfil) return "null";
    if (isSelf) return String(perfil.regional_id ?? "null");
    return String(responsavelSelecionado?.regional_id ?? "null");
  }, [perfil, isSelf, responsavelSelecionado]);

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

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={styles.label}>Rotina Padrão (opcional)</label>
          <select value={rotinaPadraoId} onChange={(e) => handleChangeRotinaPadrao(e.target.value)} style={styles.input}>
            <option value="">{loadingPadrao ? "Carregando modelos..." : "Selecione um modelo (opcional)"}</option>
            {rotinasPadrao.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titulo}
              </option>
            ))}
          </select>

          {usandoModelo && (
            <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>
              ✅ Modo modelo ativo: campos do modelo travados. Ajuste apenas responsável / data / horário / duração e dia da semana.
            </div>
          )}

          {erroPadrao && <div style={{ fontSize: 11, color: "#f97316", marginTop: 4 }}>{erroPadrao}</div>}
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
              required
            >
              <option value="">— selecione —</option>

              {perfil?.id && isSelf && <option value={perfil.id}>{perfil.nome ?? "EU"} (EU — N1)</option>}

              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.nivel})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCriarParaMim}
              style={{
                ...styles.button,
                padding: "10px 12px",
                background: "#111827",
                color: "#e5e7eb",
                border: "1px solid #334155",
                borderRadius: 10,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
              disabled={!perfil?.id}
              title="Define o responsável como você (N1)"
            >
              Criar para mim (N1)
            </button>
          </div>

          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            N1 escolhe o responsável N2/N3 do setor/departamento — ou cria para si.
          </div>

          {avisoScope && <div style={{ fontSize: 11, color: "#f97316", marginTop: 4 }}>{avisoScope}</div>}
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4,1fr)" }}>
          <div>
            <label style={styles.label}>Duração (minutos)</label>
            <input type="number" min={0} value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} style={styles.input} />
          </div>

          <div>
            <label style={styles.label}>Urgência</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)} style={styles.input} disabled={lockModeloFields}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div>
            <label style={styles.label}>Tipo de rotina</label>
            <select value={tipoRotina} onChange={(e) => setTipoRotina(e.target.value as TipoRotina)} style={styles.input} disabled={lockModeloFields}>
              <option value="normal">Normal</option>
              <option value="avulsa">Avulsa (1 dia)</option>
            </select>
          </div>

          <div>
            <label style={styles.label}>Periodicidade</label>
            <select
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
              style={styles.input}
              disabled={lockModeloFields || tipoRotina === "avulsa"}
            >
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>

        {/* ✅ BLOCO CORRIGIDO: dia da semana SEMPRE destravado e sem duplicação */}
        <div>
          <label style={styles.label}>Dia da semana</label>
          <select value={diaSemana} onChange={(e) => setDiaSemana(e.target.value as any)} style={styles.input}>
            <option value="2">Segunda-feira</option>
            <option value="3">Terça-feira</option>
            <option value="4">Quarta-feira</option>
            <option value="5">Quinta-feira</option>
            <option value="6">Sexta-feira</option>
            <option value="7">Sábado</option>
          </select>

          <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
            Obs.: o dia da semana só é aplicado quando a periodicidade for <b>Semanal</b>.
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={styles.label}>Data de início (opcional)</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} min={todayISO()} />

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setDataInicio(todayISO())}
                style={{ ...styles.button, padding: "4px 10px", fontSize: 12, background: "#111827", color: "#e5e7eb" }}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setDataInicio(addDaysISO(todayISO(), 1))}
                style={{ ...styles.button, padding: "4px 10px", fontSize: 12, background: "#111827", color: "#e5e7eb" }}
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => setDataInicio(addDaysISO(todayISO(), 7))}
                style={{ ...styles.button, padding: "4px 10px", fontSize: 12, background: "#111827", color: "#e5e7eb" }}
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => setDataInicio("")}
                style={{ ...styles.button, padding: "4px 10px", fontSize: 12, background: "#111827", color: "#e5e7eb", opacity: 0.85 }}
              >
                Limpar
              </button>
            </div>
          </div>

          <div>
            <label style={styles.label}>Horário (agenda)</label>
            <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={styles.input} />
          </div>
        </div>

        {usandoModelo ? (
          <div style={{ border: "1px dashed #334155", borderRadius: 12, padding: 10, fontSize: 12, color: "#9ca3af" }}>
            <strong>Definições do modelo:</strong>{" "}
            Checklist: <b>{flagsEfetivas.temChecklist ? "Sim" : "Não"}</b> • Anexo: <b>{flagsEfetivas.temAnexo ? "Sim" : "Não"}</b>
            <div style={{ marginTop: 4 }}>Obs.: checklist/anexo são definidos no modelo e não são alterados aqui.</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#e5e7eb" }}>
              <input type="checkbox" checked={temChecklist} onChange={(e) => setTemChecklist(e.target.checked)} />
              Terá checklist?
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#e5e7eb" }}>
              <input type="checkbox" checked={temAnexo} onChange={(e) => setTemAnexo(e.target.checked)} />
              Terá anexo obrigatório?
            </label>
          </div>
        )}

        <div
          style={{
            marginTop: 4,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #1f2933",
            background: "#020617",
            fontSize: 12,
            color: "#e5e7eb",
          }}
        >
          <strong>Resumo:</strong>
          <div>Título: {titulo || "(sem título)"}</div>
          <div>Responsável: {responsavelLabel}</div>
          <div>
            Urgência: {urgencia} • Tipo: {tipoRotina} • Periodicidade: {tipoRotina === "avulsa" ? "diaria" : periodicidade}
          </div>
          <div>
            Horário: {String(hora).padStart(2, "0")}:{String(minuto).padStart(2, "0")} • Duração: {duracao} min
          </div>
          <div>
            Checklist: {flagsEfetivas.temChecklist ? "Sim" : "Não"} • Anexo: {flagsEfetivas.temAnexo ? "Sim" : "Não"}
          </div>
          <div style={{ marginTop: 6, color: "#9ca3af" }}>
            regional_id aplicado: <b style={{ color: "#e5e7eb" }}>{regionalPreview}</b>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            marginTop: 8,
            background: loading ? "#14532d" : "linear-gradient(90deg, #22c55e, #eab308)",
            color: "#000",
            fontSize: 15,
          }}
        >
          {loading ? "Criando rotina..." : "Criar rotina"}
        </button>
      </form>

      {statusMsg && <p style={{ fontSize: 13, color: "#bbf7d0", marginTop: 10 }}>{statusMsg}</p>}

      {details && (
        <>
          <h4 style={{ marginTop: 8, color: "#facc15", fontSize: 13 }}>
            Retorno da função
          </h4>
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
        </>
      )}
    </section>
  );
}
