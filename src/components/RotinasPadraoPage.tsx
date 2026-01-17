// src/components/RotinasPadraoPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario, RotinaPadrao, ChecklistItemPadrao } from "../types";
import { styles, theme } from "../styles";

type Props = {
  usuarioLogado: Usuario;
};

type Periodicidade = "diaria" | "semanal" | "quinzenal" | "mensal";

type GrupoOption = {
  id: number;
  nome: string;
  departamento_id: number;
  setor_id: number;
  regional_id: number;
  ativo: boolean;
};

// bucket do Supabase Storage (TEM QUE EXISTIR no Storage)
const STORAGE_BUCKET = "rotina-modelos";

const emptyChecklistItem = (ordem: number): ChecklistItemPadrao => ({
  ordem,
  descricao: "",
  tipo: "texto",
  valor_padrao_numerico: null,
  valor_padrao_texto: null,
  exige_anexo: false,
});

export const RotinasPadraoPage: React.FC<Props> = ({ usuarioLogado }) => {
  const [modelos, setModelos] = useState<RotinaPadrao[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<RotinaPadrao | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sugestaoDuracao, setSugestaoDuracao] = useState<number | "">(30);
  const [horarioPadrao, setHorarioPadrao] = useState("08:00");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const [diasSemanaPadrao, setDiasSemanaPadrao] = useState<string[]>([]);

  const [checklist, setChecklist] = useState<ChecklistItemPadrao[]>([
    emptyChecklistItem(1),
  ]);

  const [arquivoModeloNome, setArquivoModeloNome] = useState<string>("");
  const [arquivoModeloUrl, setArquivoModeloUrl] = useState<string>("");
  const [subindoArquivo, setSubindoArquivo] = useState(false);

  // checkbox "exige anexo"
  const [exigeAnexos, setExigeAnexos] = useState<boolean>(false);

  // grupos
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [grupoId, setGrupoId] = useState<string>("");
  const [gruposErro, setGruposErro] = useState<string | null>(null);

  const isN1 = usuarioLogado.nivel === "N1";
  const deptId = usuarioLogado.departamento_id ?? null;
  const setorId = usuarioLogado.setor_id ?? null;

  const podeUsar = useMemo(
    () => isN1 && deptId != null && setorId != null,
    [isN1, deptId, setorId]
  );

  const btnPrimary: React.CSSProperties = {
    ...styles.button,
    background: theme.colors.neonGreen,
    color: "#022c22",
    border: "none",
  };

  const btnSecondary: React.CSSProperties = {
    ...styles.button,
    background: "transparent",
    color: theme.colors.textSoft,
    border: `1px solid ${theme.colors.borderSoft}`,
  };

  async function carregarGrupos() {
    if (!podeUsar) {
      setGrupos([]);
      setGrupoId("");
      setGruposErro("N1 sem departamento/setor definido.");
      return;
    }

    try {
      let q = supabase
        .from("grupos")
        .select("id, nome, departamento_id, setor_id, regional_id, ativo")
        .eq("departamento_id", deptId!)
        .eq("setor_id", setorId!);

      if (usuarioLogado.regional_id != null) q = q.eq("regional_id", usuarioLogado.regional_id);

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
  }

  // Carregar modelos (somente do dept/setor do N1)
  async function carregarModelos() {
    if (!podeUsar) {
      setModelos([]);
      return;
    }

    setLoading(true);
    try {
      let q = supabase
        .from("rotinas_padrao")
        .select(
          `
          id, titulo, descricao, sugestao_duracao_minutos,
          horario_inicio, periodicidade, dia_semana, checklist_padrao,
          arquivo_modelo_nome, arquivo_modelo_url,
          exige_anexos, tem_checklist, tem_anexo,
          criado_por_id, criado_em, atualizado_em,
          departamento_id, setor_id, grupo_id
        `
        )
        .eq("departamento_id", deptId!)
        .eq("setor_id", setorId!);
      const { data, error } = await q.order("titulo", { ascending: true });

      if (error) throw error;

      setModelos((data ?? []) as RotinaPadrao[]);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
      setModelos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarGrupos();
    void carregarModelos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    usuarioLogado.id,
    usuarioLogado.nivel,
    usuarioLogado.departamento_id,
    usuarioLogado.setor_id,
    usuarioLogado.regional_id,
  ]);

  useEffect(() => {
    if (!["semanal", "quinzenal"].includes(periodicidade)) {
      setDiasSemanaPadrao([]);
    }
  }, [periodicidade]);

  function resetForm() {
    setEditando(null);
    setTitulo("");
    setDescricao("");
    setSugestaoDuracao(30);
    setHorarioPadrao("08:00");
    setPeriodicidade("diaria");
    setDiasSemanaPadrao([]);
    setChecklist([emptyChecklistItem(1)]);
    setArquivoModeloNome("");
    setArquivoModeloUrl("");
    setExigeAnexos(false);
    setSubindoArquivo(false);
    setGrupoId((prev) => {
      if (prev && grupos.some((g) => String(g.id) === String(prev))) return prev;
      return grupos[0] ? String(grupos[0].id) : "";
    });
  }

  function atualizarChecklistItem(index: number, field: keyof ChecklistItemPadrao, value: any) {
    setChecklist((atual) => atual.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function adicionarChecklistItem() {
    setChecklist((atual) => [...atual, emptyChecklistItem(atual.length + 1)]);
  }

  function removerChecklistItem(idx: number) {
    setChecklist((atual) =>
      atual
        .filter((_, i) => i !== idx)
        .map((item, index) => ({ ...item, ordem: index + 1 }))
    );
  }

  async function handleUploadModelo(file: File) {
    try {
      setSubindoArquivo(true);

      const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${usuarioLogado.id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Erro ao fazer upload do modelo:", uploadError);
        alert("Erro ao enviar arquivo (Storage). Verifique bucket/policies.");
        return;
      }

      const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      setArquivoModeloNome(file.name);
      setArquivoModeloUrl(publicData.publicUrl);
    } finally {
      setSubindoArquivo(false);
    }
  }

  function abrirEditar(modelo: RotinaPadrao) {
    setEditando(modelo);
    setTitulo(modelo.titulo);
    setDescricao(modelo.descricao ?? "");
    setSugestaoDuracao(modelo.sugestao_duracao_minutos ?? "");
    setHorarioPadrao(modelo.horario_inicio ?? "08:00");

    const p = ((modelo.periodicidade ?? "diaria") as string).toLowerCase() as Periodicidade;
    setPeriodicidade(p);
    const diasRaw = ((modelo as any).dia_semana ?? "") as string;
    const dias = diasRaw
      .split(",")
      .map((d) => d.trim())
      .filter((d) => ["2", "3", "4", "5", "6"].includes(d));
    setDiasSemanaPadrao(dias);

    const itens = (modelo.checklist_padrao ?? []) as ChecklistItemPadrao[];
    setChecklist(itens.length > 0 ? itens : [emptyChecklistItem(1)]);

    setArquivoModeloNome((modelo as any).arquivo_modelo_nome ?? "");
    setArquivoModeloUrl((modelo as any).arquivo_modelo_url ?? "");

    setExigeAnexos(!!(modelo as any).exige_anexos);
    setGrupoId((modelo as any).grupo_id ? String((modelo as any).grupo_id) : "");
  }

  async function excluirModelo() {
    if (!editando) return;

    const ok = window.confirm(`Excluir o modelo "${editando.titulo}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("rotinas_padrao").delete().eq("id", editando.id);
      if (error) throw error;

      await carregarModelos();
      resetForm();
      alert("Modelo excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir modelo:", err);
      alert("Erro ao excluir modelo.");
    } finally {
      setLoading(false);
    }
  }

  async function salvarModelo() {
    if (!grupoId) {
      alert("Selecione o grupo do modelo.");
      return;
    }
    if (!titulo.trim()) {
      alert("Titulo obrigatorio.");
      return;
    }
    if (["semanal", "quinzenal"].includes(periodicidade) && diasSemanaPadrao.length === 0) {
      alert("Selecione pelo menos um dia da semana.");
      return;
    }
    if (!podeUsar) {
      alert("Seu usuário N1 precisa estar vinculado a Departamento e Setor.");
      return;
    }

    const checklistNormalizado: ChecklistItemPadrao[] | null = (() => {
      const itens = (checklist ?? [])
        .map((item, index) => ({
          ...item,
          ordem: index + 1,
          descricao: (item.descricao ?? "").trim(),
        }))
        .filter((item) => item.descricao.length > 0);

      return itens.length > 0 ? itens : null;
    })();

    const temChecklist = !!checklistNormalizado && checklistNormalizado.length > 0;
    const temAnexo = !!arquivoModeloUrl;

    const payload: any = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      periodicidade,
      sugestao_duracao_minutos: sugestaoDuracao === "" ? null : Number(sugestaoDuracao),
      horario_inicio: horarioPadrao || null,
      dia_semana: diasSemanaPadrao.length ? diasSemanaPadrao.join(",") : null,
      checklist_padrao: checklistNormalizado,
      arquivo_modelo_nome: arquivoModeloNome || null,
      arquivo_modelo_url: arquivoModeloUrl || null,
      exige_anexos: !!exigeAnexos,
      tem_checklist: temChecklist,
      tem_anexo: temAnexo,
      departamento_id: deptId,
      setor_id: setorId,
      grupo_id: Number(grupoId),
    };

    setLoading(true);
    try {
      if (editando) {
        const { error } = await supabase.from("rotinas_padrao").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rotinas_padrao")
          .insert({ ...payload, criado_por_id: usuarioLogado.id });
        if (error) throw error;
      }

      await carregarModelos();
      resetForm();
      alert("Modelo salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar modelo:", err);
      const msg =
        (err as any)?.message ??
        (err as any)?.error_description ??
        (typeof err === "string" ? err : "Erro ao salvar modelo.");
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      if (!grupoId) return true;
      return m.grupo_id == null || String(m.grupo_id) === String(grupoId);
    });
  }, [modelos, grupoId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${theme.colors.borderSoft}`,
          background: "rgba(15,23,42,0.95)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.colors.textSoft }}>Modelos de Rotina</div>
        <div style={{ fontSize: 12, color: theme.colors.textMuted }}>
          N1 define o padrão (Departamento/Setor) que o N2/N3 vai usar.
        </div>

        {loading && <div style={{ fontSize: 12, color: theme.colors.textMuted }}>Carregando...</div>}
        {!loading && modelosFiltrados.length === 0 && (
          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>Nenhum modelo encontrado.</div>
        )}

        {modelosFiltrados.map((m) => (
          <button
            key={m.id}
            onClick={() => abrirEditar(m)}
            style={{
              textAlign: "left",
              width: "100%",
              borderRadius: 12,
              border: `1px solid ${theme.colors.borderSoft}`,
              padding: 10,
              background: editando?.id === m.id ? "rgba(34,197,94,0.08)" : "rgba(2,6,23,0.6)",
              color: theme.colors.textSoft,
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 700 }}>{m.titulo}</div>
            {m.descricao && <div style={{ fontSize: 12, color: theme.colors.textMuted }}>{m.descricao}</div>}
            {m.grupo_id && (
              <div style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4 }}>
                Grupo: {String(m.grupo_id)}
              </div>
            )}
          </button>
        ))}

        <button
          style={{ ...btnSecondary, marginTop: 6 }}
          onClick={() => {
            resetForm();
            setEditando(null);
          }}
          type="button"
        >
          Novo modelo
        </button>
      </div>

      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${theme.colors.borderSoft}`,
          background: "rgba(15,23,42,0.95)",
          padding: 14,
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.colors.textSoft }}>Novo modelo de rotina</div>
          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>
            O N2/N3 vai usar este modelo para criar a rotina real.
          </div>
        </div>

        <div>
          <label style={styles.label}>Grupo (obrigatório)</label>
          <select
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            style={styles.input}
            required
            disabled={!podeUsar}
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
          <label style={styles.label}>Título da rotina padrão</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={styles.input}
            required
            disabled={!podeUsar}
          />
        </div>

        <div>
          <label style={styles.label}>Descrição base</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
            disabled={!podeUsar}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Sugestão de duração (minutos)</label>
            <input
              type="number"
              value={sugestaoDuracao}
              onChange={(e) => setSugestaoDuracao(e.target.value === "" ? "" : Number(e.target.value))}
              style={styles.input}
              min={1}
              disabled={!podeUsar}
            />
          </div>
          <div>
            <label style={styles.label}>Horario padrao</label>
            <input
              type="time"
              value={horarioPadrao}
              onChange={(e) => setHorarioPadrao(e.target.value)}
              style={styles.input}
              disabled={!podeUsar}
            />
          </div>
          <div>
            <label style={styles.label}>Periodicidade padrão</label>
            <select
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
              style={styles.input}
              disabled={!podeUsar}
            >
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal (2x mes)</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>

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
              opacity: ["semanal", "quinzenal"].includes(periodicidade) ? 1 : 0.5,
            }}
          >
            {[
              { value: "2", label: "Segunda" },
              { value: "3", label: "Terca" },
              { value: "4", label: "Quarta" },
              { value: "5", label: "Quinta" },
              { value: "6", label: "Sexta" },
            ].map((d) => (
              <label key={d.value} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  disabled={!podeUsar || !["semanal", "quinzenal"].includes(periodicidade)}
                  checked={diasSemanaPadrao.includes(d.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDiasSemanaPadrao((curr) => [...new Set([...curr, d.value])]);
                    } else {
                      setDiasSemanaPadrao((curr) => curr.filter((x) => x !== d.value));
                    }
                  }}
                />
                {d.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4 }}>
            Obs.: so habilitado para Semanal ou Quinzenal.
          </div>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: theme.colors.textSoft }}>
          <input
            type="checkbox"
            checked={exigeAnexos}
            onChange={(e) => setExigeAnexos(e.target.checked)}
            disabled={!podeUsar}
          />
          Rotina exige anexo na execução (N2/N3 só finaliza se anexar)
        </label>

        <div>
          <label style={styles.label}>Arquivo padrão da rotina</label>
          <input
            type="file"
            disabled={!podeUsar || subindoArquivo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUploadModelo(f);
            }}
          />
          {arquivoModeloNome && (
            <div style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4 }}>
              Atual: {arquivoModeloNome}
            </div>
          )}
        </div>

        <div style={{ border: `1px solid ${theme.colors.borderSoft}`, borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.colors.textSoft, marginBottom: 6 }}>
            Checklist padrão
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {checklist.map((item, idx) => (
              <div
                key={idx}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${theme.colors.borderSoft}`,
                  padding: 8,
                  background: "rgba(2,6,23,0.5)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: theme.colors.textMuted }}>#{idx + 1}</span>
                  {checklist.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerChecklistItem(idx)}
                      style={{ ...btnSecondary, padding: "4px 8px", fontSize: 11 }}
                    >
                      Remover
                    </button>
                  )}
                </div>

                <input
                  value={item.descricao}
                  onChange={(e) => atualizarChecklistItem(idx, "descricao", e.target.value)}
                  placeholder="Descrição do item"
                  style={styles.input}
                  disabled={!podeUsar}
                />

                <select
                  value={item.tipo}
                  onChange={(e) => atualizarChecklistItem(idx, "tipo", e.target.value)}
                  style={styles.input}
                  disabled={!podeUsar}
                >
                  <option value="texto">Texto</option>
                  <option value="valor">Valor</option>
                  <option value="moeda">Moeda</option>
                  <option value="booleano">Sim/Não</option>
                </select>

                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: theme.colors.textSoft }}>
                  <input
                    type="checkbox"
                    checked={item.exige_anexo || false}
                    onChange={(e) => atualizarChecklistItem(idx, "exige_anexo", e.target.checked)}
                    disabled={!podeUsar}
                  />
                  Exige anexo neste item
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={adicionarChecklistItem}
            style={{ ...btnSecondary, marginTop: 8, fontSize: 12 }}
            disabled={!podeUsar}
          >
            + Item de checklist
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={salvarModelo} style={btnPrimary} disabled={!podeUsar || loading}>
            Salvar modelo
          </button>
          <button type="button" onClick={resetForm} style={btnSecondary}>
            Limpar
          </button>
          {editando && (
            <button type="button" onClick={excluirModelo} style={{ ...btnSecondary, color: "#fca5a5", borderColor: "#fca5a5" }}>
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RotinasPadraoPage;







