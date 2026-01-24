// src/components/N2CriarRotina.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  usuarioLogado: Usuario;
};

type Periodicidade = "diaria" | "semanal" | "quinzenal" | "mensal";

type Responsavel = {
  id: string;
  nome: string;
  nivel: string;
  grupo_id?: number | null;
};

type GrupoOption = {
  id: number;
  nome: string;
  departamento_id: number;
  setor_id: number;
  regional_id: number | null;
  ativo: boolean;
};

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
  const [aba] = useState<"AVULSA">("AVULSA");

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
  const [urgencia, setUrgencia] = useState("baixa");
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
    void carregarResponsaveis();
    void carregarGrupos();
  }, [
    usuarioLogado.id,
    usuarioLogado.nivel,
    usuarioLogado.departamento_id,
    usuarioLogado.setor_id,
    usuarioLogado.regional_id,
  ]);

  useEffect(() => {
    if (aba === "AVULSA") {
      setResponsavelId(usuarioLogado.id);
    }
  }, [aba, usuarioLogado.id]);

  useEffect(() => {
    const resp = responsaveis.find((r) => r.id === responsavelId);
    if (resp?.grupo_id != null) {
      setGrupoId(String(resp.grupo_id));
    }
  }, [responsavelId, responsaveis]);

  async function carregarResponsaveis() {
    setCarregandoResp(true);
    setErroResp(null);
    try {
      let q = supabase
        .from("usuarios")
        .select("id, nome, nivel, grupo_id")
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId)
        .in("nivel", ["N2", "N3"])
        .order("nome", { ascending: true });
      if (regId) q = q.eq("regional_id", regId);
      const { data, error } = await q;
      if (error) throw error;
      const lista = (data ?? []).map((r: any) => ({
        id: String(r.id),
        nome: String(r.nome),
        nivel: String(r.nivel),
        grupo_id: r.grupo_id != null ? Number(r.grupo_id) : null,
      }));
      const selfId = String(usuarioLogado.id);
      if (!lista.some((u) => u.id === selfId)) {
        lista.unshift({
          id: selfId,
          nome: usuarioLogado.nome ?? "Eu",
          nivel: usuarioLogado.nivel,
          grupo_id: (usuarioLogado as any)?.grupo_id ?? null,
        });
      }
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
      setStatusMsg("Grupo nao identificado para o responsavel.");
      return;
    }

    const tituloFinal = (titulo || "").trim();
    const descricaoFinal = (descricao || "").trim();
    if (!tituloFinal) {
      setStatusMsg("Preencha o titulo da rotina.");
      return;
    }
    if (!descricaoFinal) {
      setStatusMsg("Preencha a descricao.");
      return;
    }

    if (aba === "AVULSA") {
      const resp = responsaveis.find((r) => r.id === responsavelId);
      if (responsavelId !== usuarioLogado.id && resp?.nivel !== "N3") {
        setStatusMsg("Avulsa: so pode ser para voce ou para N3.");
        return;
      }
      if (!resp?.grupo_id) {
        setStatusMsg("Responsavel precisa estar vinculado a um grupo.");
        return;
      }
      if (String(resp.grupo_id) !== String(grupoId)) {
        setStatusMsg("Responsavel precisa estar no mesmo grupo selecionado.");
        return;
      }
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
      const { data: grupoData, error: grupoError } = await supabase
        .from("grupos")
        .select("id, departamento_id, setor_id, regional_id, ativo")
        .eq("id", grupoId)
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

      const tipoFinal = "avulsa";
      const periodicidadeFinal: Periodicidade = "diaria";
      const dataInicioFinal = dataInicio || todayISO();
      const regionalIdEfetivo = grupoData.regional_id ?? null;

      const body: any = {
        titulo: tituloFinal,
        descricao: descricaoFinal,
        duracao_minutos: minutos,
        tipo: tipoFinal,
        urgencia: urgencia,
        periodicidade: periodicidadeFinal,
        dia_semana: null,
        data_inicio: dataInicioFinal,
        data_fim: null,
        horario_inicio: horarioInicio,
        tem_checklist: temChecklist,
        tem_anexo: temAnexo,
        responsavel_id: responsavelId,
        criador_id: usuarioLogado.id,
        departamento_id: deptId,
        setor_id: setorId,
        regional_id: regionalIdEfetivo,
        grupo_id: Number(grupoId),
        rotina_padrao_id: null,
      };

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

      setStatusMsg("Rotina criada com sucesso.");
      setDetails(JSON.stringify(result.json ?? {}, null, 2));

      setTitulo("");
      setDescricao("");
      setDuracaoMinutos("60");
      setUrgencia("baixa");
      setDataInicio(todayISO());
      setHorarioInicio("08:00");
      setTemChecklist(false);
      setTemAnexo(false);
    } catch (err) {
      setStatusMsg(`Erro inesperado: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const responsaveisAvulsa = useMemo(() => {
    return responsaveis.filter((r) => r.id === usuarioLogado.id || r.nivel === "N3");
  }, [responsaveis, usuarioLogado.id]);

  return (
    <section style={{ ...styles.card, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: theme.colors.neonOrange ?? "#fb923c" }}>
            Bloco 6B - Criar rotina (N2)
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
              required
            >
              <option value="">{carregandoResp ? "Carregando..." : "Selecione"}</option>
              {responsaveisAvulsa.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} ({r.nivel})
                </option>
              ))}
            </select>
            {erroResp && <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>{erroResp}</div>}
            {erroGrupos && <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>{erroGrupos}</div>}
          </div>

          <div>
            <label style={styles.label}>Data de inicio</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} />
          </div>

          <div>
            <label style={styles.label}>Horario</label>
            <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={styles.input} />
          </div>
        </div>

        <div>
          <label style={styles.label}>Titulo</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required />
        </div>

        <div>
          <label style={styles.label}>Descricao</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={styles.textarea} required />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={styles.label}>Duracao (min)</label>
            <input type="number" value={duracaoMinutos} min={1} onChange={(e) => setDuracaoMinutos(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Urgencia</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} style={styles.input}>
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
            <input type="checkbox" checked={temChecklist} onChange={(e) => setTemChecklist(e.target.checked)} />
            Tem checklist
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: theme.colors.textSoft }}>
            <input type="checkbox" checked={temAnexo} onChange={(e) => setTemAnexo(e.target.checked)} />
            Exige anexo
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
              setTitulo("");
              setDescricao("");
              setDuracaoMinutos("60");
              setUrgencia("baixa");
              setDataInicio(todayISO());
              setHorarioInicio("08:00");
              setTemChecklist(false);
              setTemAnexo(false);
            }}
          >
            Limpar
          </button>
          {statusMsg && <div style={{ fontSize: 12, color: theme.colors.textSoft }}>{statusMsg}</div>}
        </div>

        {details && (
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              color: theme.colors.textMuted,
              whiteSpace: "pre-wrap",
            }}
          >
            {details}
          </pre>
        )}
      </form>
    </section>
  );
}




