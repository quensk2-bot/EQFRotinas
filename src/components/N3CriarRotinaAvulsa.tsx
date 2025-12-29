// src/components/N3CriarRotinaAvulsa.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles, theme } from "../styles";
import type { Usuario } from "../types";

type Props = {
  perfil: Usuario;
};

type GrupoOption = {
  id: number;
  nome: string;
  departamento_id: number;
  setor_id: number;
  regional_id: number;
  ativo: boolean;
};

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const N3CriarRotinaAvulsa: React.FC<Props> = ({ perfil }) => {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMin, setDuracaoMin] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("08:00");

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [grupoId, setGrupoId] = useState<string>("");
  const [erroGrupos, setErroGrupos] = useState<string | null>(null);

  useEffect(() => {
    void carregarGrupos();
  }, [perfil.departamento_id, perfil.setor_id, perfil.regional_id]);

  async function carregarGrupos() {
    if (!perfil.departamento_id || !perfil.setor_id) {
      setErroGrupos("Usuário N3 sem departamento/setor.");
      setGrupos([]);
      setGrupoId("");
      return;
    }
    try {
      let q = supabase
        .from("grupos")
        .select("id, nome, departamento_id, setor_id, regional_id, ativo")
        .eq("departamento_id", perfil.departamento_id)
        .eq("setor_id", perfil.setor_id);
      if (perfil.regional_id != null) q = q.eq("regional_id", perfil.regional_id);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setDetails(null);

    if (!titulo.trim()) {
      setStatusMsg("Título é obrigatório.");
      return;
    }
    if (!grupoId) {
      setStatusMsg("Selecione o grupo.");
      return;
    }

    const dur = Number(duracaoMin);
    if (!Number.isFinite(dur) || dur <= 0) {
      setStatusMsg("Duração inválida.");
      return;
    }

    setLoading(true);
    setStatusMsg("Enviando rotina avulsa...");
    try {
      const { data, error } = await supabase.functions.invoke("eqf-create-rotina-diaria", {
        body: {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          duracao_minutos: dur,
          tipo: "avulsa",
          periodicidade: "diaria",
          data_inicio: dataInicio || null,
          horario_inicio: horarioInicio || null,
          tem_checklist: false,
          tem_anexo: false,
          responsavel_id: perfil.id,
          criador_id: perfil.id,
          departamento_id: perfil.departamento_id ?? null,
          setor_id: perfil.setor_id ?? null,
          regional_id: perfil.regional_id ?? null,
          rotina_padrao_id: null,
          grupo_id: Number(grupoId),
        },
      });

      if (error) {
        setStatusMsg(`Erro: ${error.message}`);
        setDetails(JSON.stringify(error, null, 2));
        return;
      }

      setStatusMsg("Rotina avulsa criada com sucesso.");
      setDetails(JSON.stringify(data, null, 2));
      setTitulo("");
      setDescricao("");
      setDuracaoMin("30");
      setDataInicio("");
      setHorarioInicio("08:00");
    } catch (err) {
      setStatusMsg(`Erro inesperado: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        borderRadius: 14,
        border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
        background: "rgba(15,23,42,0.95)",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <h3 style={{ margin: 0, color: theme.colors.textSoft }}>Criar rotina avulsa (N3)</h3>
      <p style={{ fontSize: 12, color: theme.colors.textMuted }}>
        Você cria uma rotina só sua. Se precisar agendar diariamente, use a periodicidade diária (já padrão).
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={styles.label}>Grupo (obrigatório)</label>
          <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} style={styles.input} required>
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
          <label style={styles.label}>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required />
        </div>

        <div>
          <label style={styles.label}>Descrição</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ ...styles.input, minHeight: 80 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Duração (min)</label>
            <input type="number" value={duracaoMin} min={1} onChange={(e) => setDuracaoMin(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Horário</label>
            <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={styles.input} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Data de início (opcional)</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Periodicidade</label>
            <input value="Diária (fixo para avulsa)" disabled style={{ ...styles.input, color: "#9ca3af" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Salvando..." : "Salvar rotina avulsa"}
          </button>
          <button
            type="button"
            style={{ ...styles.button, background: "#111827", color: "#e5e7eb" }}
            onClick={() => {
              setTitulo("");
              setDescricao("");
              setDuracaoMin("30");
              setDataInicio("");
              setHorarioInicio("08:00");
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
};

export default N3CriarRotinaAvulsa;
