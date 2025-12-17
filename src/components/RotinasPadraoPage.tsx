// src/components/RotinasPadraoPage.tsx
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario, RotinaPadrao, ChecklistItemPadrao } from "../types";
import { styles, theme } from "../styles";

type Props = {
  usuarioLogado: Usuario;
};

type Periodicidade = "diaria" | "semanal" | "mensal";

// 🔥 bucket do Supabase Storage (TEM QUE EXISTIR no Storage)
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
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");

  const [checklist, setChecklist] = useState<ChecklistItemPadrao[]>([
    emptyChecklistItem(1),
  ]);

  const [arquivoModeloNome, setArquivoModeloNome] = useState<string>("");
  const [arquivoModeloUrl, setArquivoModeloUrl] = useState<string>("");
  const [subindoArquivo, setSubindoArquivo] = useState(false);

  // ✅ checkbox "exige anexo"
  const [exigeAnexos, setExigeAnexos] = useState<boolean>(false);

  const isN1 = usuarioLogado.nivel === "N1";
  const deptId = usuarioLogado.departamento_id ?? null;
  const setorId = usuarioLogado.setor_id ?? null;

  const podeUsar = useMemo(
    () => isN1 && deptId != null && setorId != null,
    [isN1, deptId, setorId]
  );

  // ------------------------
  // Botões
  // ------------------------
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

  // ------------------------
  // Carregar modelos (somente do dept/setor do N1)
  // ------------------------
  async function carregarModelos() {
    if (!isN1 || deptId == null || setorId == null) {
      setModelos([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rotinas_padrao")
        .select(
          `
          id, titulo, descricao, sugestao_duracao_minutos,
          periodicidade, checklist_padrao,
          arquivo_modelo_nome, arquivo_modelo_url,
          exige_anexos, tem_checklist, tem_anexo,
          criado_por_id, criado_em, atualizado_em,
          departamento_id, setor_id
        `
        )
        .eq("departamento_id", deptId)
        .eq("setor_id", setorId)
        .order("titulo", { ascending: true });

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
    void carregarModelos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    usuarioLogado.id,
    usuarioLogado.nivel,
    usuarioLogado.departamento_id,
    usuarioLogado.setor_id,
  ]);

  function resetForm() {
    setEditando(null);
    setTitulo("");
    setDescricao("");
    setSugestaoDuracao(30);
    setPeriodicidade("diaria");
    setChecklist([emptyChecklistItem(1)]);
    setArquivoModeloNome("");
    setArquivoModeloUrl("");
    setExigeAnexos(false);
    setSubindoArquivo(false);
  }

  // ------------------------
  // Checklist helpers
  // ------------------------
  function atualizarChecklistItem(
    index: number,
    field: keyof ChecklistItemPadrao,
    value: any
  ) {
    setChecklist((atual) =>
      atual.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
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

  // ------------------------
  // Upload do arquivo modelo (robusto)
  // ------------------------
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
        alert(
          "Erro ao enviar arquivo (Storage). Verifique se o BUCKET existe e se as policies permitem upload."
        );
        return;
      }

      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      setArquivoModeloNome(file.name);
      setArquivoModeloUrl(publicData.publicUrl);
    } finally {
      setSubindoArquivo(false);
    }
  }

  // ------------------------
  // Abrir modelo para edição
  // ------------------------
  function abrirEditar(modelo: RotinaPadrao) {
    setEditando(modelo);
    setTitulo(modelo.titulo ?? "");
    setDescricao(modelo.descricao ?? "");
    setSugestaoDuracao(
      modelo.sugestao_duracao_minutos != null
        ? modelo.sugestao_duracao_minutos
        : ""
    );

    const p = ((modelo.periodicidade ?? "diaria") as string)
      .toLowerCase() as Periodicidade;
    setPeriodicidade(p);

    const itens = (modelo.checklist_padrao ?? []) as ChecklistItemPadrao[];
    setChecklist(itens.length > 0 ? itens : [emptyChecklistItem(1)]);

    setArquivoModeloNome((modelo as any).arquivo_modelo_nome ?? "");
    setArquivoModeloUrl((modelo as any).arquivo_modelo_url ?? "");

    setExigeAnexos(!!(modelo as any).exige_anexos);
  }

  // ------------------------
  // ✅ Excluir modelo (FORA do salvarModelo!)
  // ------------------------
  async function excluirModelo() {
    if (!editando) return;

    const ok = window.confirm(
      `Excluir o modelo "${editando.titulo}"?\nEssa ação não pode ser desfeita.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("rotinas_padrao")
        .delete()
        .eq("id", editando.id);

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

  // ------------------------
  // Salvar modelo (insert/update)
  // ------------------------
  async function salvarModelo() {
    if (!titulo.trim()) {
      alert("Título é obrigatório.");
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
      sugestao_duracao_minutos:
        sugestaoDuracao === "" ? null : Number(sugestaoDuracao),

      checklist_padrao: checklistNormalizado,

      arquivo_modelo_nome: arquivoModeloNome || null,
      arquivo_modelo_url: arquivoModeloUrl || null,

      // ✅ checkbox
      exige_anexos: !!exigeAnexos,

      // ✅ flags coerentes
      tem_checklist: temChecklist,
      tem_anexo: temAnexo,

      // vínculo
      departamento_id: deptId,
      setor_id: setorId,
    };

    setLoading(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from("rotinas_padrao")
          .update(payload)
          .eq("id", editando.id);

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
      alert("Erro ao salvar modelo.");
    } finally {
      setLoading(false);
    }
  }

  // ------------------------
  // Permissão
  // ------------------------
  if (!isN1) {
    return (
      <div style={{ padding: 24, color: theme.colors.text }}>
        Você não tem permissão para cadastrar modelos de rotina.
      </div>
    );
  }

  if (deptId == null || setorId == null) {
    return (
      <div style={styles.card}>
        <h2 style={{ margin: 0, color: theme.colors.neonGreen }}>
          Modelos de Rotina (N1)
        </h2>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: theme.colors.textMuted,
          }}
        >
          Para cadastrar/visualizar modelos, o N1 precisa estar vinculado a{" "}
          <strong>Departamento</strong> e <strong>Setor</strong> na tabela{" "}
          <code>public.usuarios</code>.
        </p>
      </div>
    );
  }

  // ------------------------
  // UI
  // ------------------------
  return (
    <div
      style={{
        padding: 8,
        color: theme.colors.text,
        display: "grid",
        gridTemplateColumns: "1.3fr 2fr",
        gap: 18,
        alignItems: "flex-start",
      }}
    >
      {/* COLUNA ESQUERDA: LISTA */}
      <div
        style={{
          borderRadius: 18,
          border: `1px solid ${theme.colors.borderSoft}`,
          background: theme.colors.bgElevated,
          padding: 14,
        }}
      >
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Modelos de Rotina
            </div>
            <div style={{ fontSize: 11, color: theme.colors.textMuted }}>
              N1 define o padrão (Departamento/Setor) que o N2/N3 vão usar.
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12 }}
          >
            Novo modelo
          </button>
        </div>

        {loading && modelos.length === 0 && (
          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>
            Carregando modelos...
          </div>
        )}

        {!loading && modelos.length === 0 && (
          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>
            Nenhum modelo cadastrado ainda.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 6,
          }}
        >
          {modelos.map((m) => {
            const p = (m.periodicidade ?? "diaria").toString().toLowerCase();
            const periodicidadeLabel =
              p === "semanal" ? "Semanal" : p === "mensal" ? "Mensal" : "Diária";
            const ativo = editando?.id === m.id;

            return (
              <div
                key={m.id}
                onClick={() => abrirEditar(m)}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: ativo
                    ? `1px solid ${theme.colors.neonGreen}`
                    : `1px solid ${theme.colors.borderSoft}`,
                  background: ativo ? "rgba(34,197,94,0.08)" : "#020617",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.titulo}</div>

                {m.descricao && (
                  <div
                    style={{
                      fontSize: 11,
                      color: theme.colors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {m.descricao.slice(0, 120)}
                    {m.descricao.length > 120 ? "..." : ""}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: theme.colors.textMuted,
                  }}
                >
                  {periodicidadeLabel}
                  {m.sugestao_duracao_minutos != null
                    ? ` • ${m.sugestao_duracao_minutos} min`
                    : ""}
                  {(m as any).exige_anexos ? " • Exige anexo" : ""}
                </div>

                {(m as any).arquivo_modelo_nome && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#60a5fa" }}>
                    Arquivo: {(m as any).arquivo_modelo_nome}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* COLUNA DIREITA: FORM */}
      <div
        style={{
          borderRadius: 18,
          border: `1px solid ${theme.colors.borderSoft}`,
          background: theme.colors.bgElevated,
          padding: 14,
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {editando ? "Editar modelo de rotina" : "Novo modelo de rotina"}
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textMuted }}>
            O N2/N3 vão usar este modelo para criar a rotina real.
          </div>
        </div>

        {/* TÍTULO */}
        <div>
          <div style={styles.label}>Título da rotina padrão</div>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={styles.input}
            placeholder="Ex.: Conferência de estoque semanal"
          />
        </div>

        {/* DESCRIÇÃO */}
        <div style={{ marginTop: 10 }}>
          <div style={styles.label}>Descrição base</div>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
          />
        </div>

        {/* DURAÇÃO + PERIODICIDADE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div>
            <div style={styles.label}>Sugestão de duração (minutos)</div>
            <input
              type="number"
              min={0}
              value={sugestaoDuracao}
              onChange={(e) =>
                setSugestaoDuracao(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              style={styles.input}
            />
          </div>

          <div>
            <div style={styles.label}>Periodicidade padrão</div>
            <select
              value={periodicidade}
              onChange={(e) =>
                setPeriodicidade(e.target.value as Periodicidade)
              }
              style={styles.input}
            >
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>

        {/* ✅ EXIGE ANEXO */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <input
            id="exigeAnexos"
            type="checkbox"
            checked={exigeAnexos}
            onChange={(e) => setExigeAnexos(e.target.checked)}
          />
          <label
            htmlFor="exigeAnexos"
            style={{
              fontSize: 12,
              color: theme.colors.textSoft,
              fontWeight: 700,
            }}
          >
            Rotina exige anexo na execução
          </label>
          <span style={{ fontSize: 11, color: theme.colors.textMuted }}>
            (N2/N3 só finaliza se anexar)
          </span>
        </div>

        {/* ARQUIVO MODELO */}
        <div style={{ marginTop: 12 }}>
          <div style={styles.label}>Arquivo padrão da rotina</div>
          <div
            style={{
              fontSize: 11,
              color: theme.colors.textMuted,
              marginBottom: 6,
            }}
          >
            Anexe PDF/planilha/guia. Fica salvo no Supabase.
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadModelo(file);
              }}
              disabled={subindoArquivo}
            />
            {subindoArquivo && (
              <span style={{ fontSize: 11, color: "#a5b4fc" }}>
                Enviando...
              </span>
            )}
          </div>

          {arquivoModeloNome && arquivoModeloUrl && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              Arquivo atual:{" "}
              <a
                href={arquivoModeloUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#60a5fa" }}
              >
                {arquivoModeloNome}
              </a>
            </div>
          )}
        </div>

        {/* CHECKLIST */}
        <div style={{ marginTop: 14 }}>
          <div style={styles.label}>Checklist padrão</div>
          <div
            style={{
              fontSize: 11,
              color: theme.colors.textMuted,
              marginBottom: 8,
            }}
          >
            Itens que o N2/N3 marcarão na execução. Numeração automática.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checklist.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: `1px dashed ${theme.colors.borderSoft}`,
                  background: "#020617",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      textAlign: "right",
                      fontSize: 12,
                      color: theme.colors.textMuted,
                    }}
                  >
                    {idx + 1}.
                  </span>

                  <input
                    type="text"
                    value={item.descricao ?? ""}
                    onChange={(e) =>
                      atualizarChecklistItem(idx, "descricao", e.target.value)
                    }
                    placeholder="Descrição do item"
                    style={{ ...styles.input, flex: 1 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={item.tipo}
                    onChange={(e) =>
                      atualizarChecklistItem(
                        idx,
                        "tipo",
                        e.target.value as ChecklistItemPadrao["tipo"]
                      )
                    }
                    style={{ ...styles.input, maxWidth: 220 }}
                  >
                    <option value="texto">Texto</option>
                    <option value="valor">Valor numérico</option>
                    <option value="moeda">Moeda (R$)</option>
                    <option value="booleano">Sim/Não</option>
                  </select>

                  {checklist.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerChecklistItem(idx)}
                      style={{
                        ...btnSecondary,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 11,
                        marginLeft: "auto",
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarChecklistItem}
              style={{
                ...btnSecondary,
                fontSize: 12,
                alignSelf: "flex-start",
              }}
            >
              + Item de checklist
            </button>
          </div>
        </div>

        {/* AÇÕES */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={salvarModelo}
            disabled={loading}
            style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}
          >
            {editando ? "Atualizar modelo" : "Salvar modelo"}
          </button>

          {editando && (
            <button
              type="button"
              onClick={excluirModelo}
              disabled={loading}
              style={{
                ...btnSecondary,
                border: `1px solid ${theme.colors.neonOrange}`,
                color: theme.colors.neonOrange,
                opacity: loading ? 0.7 : 1,
              }}
            >
              Excluir modelo
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.7 : 1 }}
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
};
