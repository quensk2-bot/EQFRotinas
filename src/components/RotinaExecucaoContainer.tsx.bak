// Cronômetro estável + execução de rotina
// Reescrito com reancoragem do tempo a cada salvamento
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../styles";
import type { Rotina, Usuario } from "../types";

type Props = {
  open: boolean;
  rotina: Rotina | null;
  perfil: Usuario;
  onClose: () => void;
  onFinalizada?: () => void;
};

type ChecklistItemExec = {
  ordem: number;
  descricao: string;
  valor: string;
  concluido: boolean;
};

type Anexo = {
  id: number;
  storage_path: string;
  descricao: string | null;
  created_at: string;
};

const neon = theme.colors.neonGreen ?? "#22c55e";
const borderSoft = theme.colors.borderSoft ?? "rgba(148,163,184,0.25)";
const textMuted = theme.colors.textMuted ?? "#9ca3af";
const text = theme.colors.text ?? "#f9fafb";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.96)",
  zIndex: 50,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle: React.CSSProperties = {
  width: "96%",
  maxWidth: 1200,
  maxHeight: "92vh",
  background: "rgba(15,23,42,1)",
  borderRadius: 24,
  border: `1px solid ${neon}`,
  boxShadow: "0 0 40px rgba(34,197,94,0.3)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const bodyGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
  gap: 16,
  flex: 1,
  minHeight: 0,
};

const colunaStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.9)",
  borderRadius: 16,
  border: `1px solid ${borderSoft}`,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const footerRowStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const badgeBase: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  border: `1px solid ${borderSoft}`,
};

const tituloStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700 };
const rotinaIdStyle: React.CSSProperties = { fontSize: 11, color: textMuted };
const headerRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const cronometroStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 20,
  fontWeight: 700,
};

const btnNeonStyle: React.CSSProperties = {
  borderRadius: 999,
  border: "none",
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const formatSeconds = (total: number) => {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function RotinaExecucaoContainer({ open, rotina, perfil, onClose, onFinalizada }: Props) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinalizada, setIsFinalizada] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItemExec[]>([]);
  const [execucaoId, setExecucaoId] = useState<number | null>(null);
  const [executorId, setExecutorId] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [loadingInicial, setLoadingInicial] = useState(false);
  const [erroInicial, setErroInicial] = useState<string | null>(null);

  // cronômetro: base acumulada (s) + início do trecho corrido (ISO)
  const baseAcumuladaRef = useRef(0);
  const inicioRodandoRef = useRef<string | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canView = useMemo(() => {
    if (!rotina) return false;
    if (perfil.nivel === "N3") return rotina.responsavel_id === perfil.id;
    if (perfil.nivel === "N2") {
      const okDep = perfil.departamento_id == null || rotina.departamento_id === perfil.departamento_id;
      const okSet = perfil.setor_id == null || rotina.setor_id === perfil.setor_id;
      const okReg = perfil.regional_id == null || rotina.regional_id === perfil.regional_id;
      return okDep && okSet && okReg;
    }
    // N1
    const okDep = perfil.departamento_id == null || rotina.departamento_id === perfil.departamento_id;
    const okSet = perfil.setor_id == null || rotina.setor_id === perfil.setor_id;
    return okDep && okSet;
  }, [perfil, rotina]);

  const canEdit = useMemo(() => {
    if (!rotina) return false;
    return rotina.responsavel_id === perfil.id;
  }, [rotina, perfil.id]);

  const isReadOnly = useMemo(() => !canEdit, [canEdit]);

  const computeTotalSeconds = () => {
    const base = baseAcumuladaRef.current || 0;
    const startISO = inicioRodandoRef.current;
    if (!startISO) return base;
    const startMs = new Date(startISO).getTime();
    if (Number.isNaN(startMs)) return base;
    const diff = Math.floor((Date.now() - startMs) / 1000);
    return base + Math.max(0, diff);
  };

  const recalcElapsed = () => {
    const total = computeTotalSeconds();
    setElapsedSeconds(total);
    return total;
  };

  const startTicker = () => {
    if (tickTimerRef.current != null) window.clearInterval(tickTimerRef.current);
    tickTimerRef.current = window.setInterval(() => {
      if (!open || isFinalizada || isPaused) return;
      setElapsedSeconds(computeTotalSeconds());
    }, 1000);
  };

  const stopTicker = () => {
    if (tickTimerRef.current != null) window.clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
  };

  // liga/desliga ticker conforme estado
  useEffect(() => {
    if (!open) {
      stopTicker();
      return;
    }
    if (isPaused || isFinalizada) {
      stopTicker();
      return;
    }
    startTicker();
    return () => stopTicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPaused, isFinalizada]);

  // init
  useEffect(() => {
    if (!open || !rotina) return;

    const init = async () => {
      setIsMinimized(false);
      setErroInicial(null);
      setLoadingInicial(true);
      setExecucaoId(null);
      setExecutorId(null);
      setIsPaused(false);
      setIsFinalizada(false);
      setElapsedSeconds(0);
      setObservacoes("");
      setChecklist([]);
      setAnexos([]);
      baseAcumuladaRef.current = 0;
      inicioRodandoRef.current = null;

      if (!canView) {
        setErroInicial("Sem permissão para visualizar esta execução.");
        setLoadingInicial(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setErroInicial("Não foi possível carregar o usuário atual.");
          return;
        }
        const uid = userData.user.id;
        setExecutorId(uid);

        // checklist base
        const { data: itensChecklist, error: checklistErr } = await supabase
          .from("rotina_checklist")
          .select("ordem, descricao")
          .eq("rotina_id", rotina.id)
          .order("ordem", { ascending: true });

        if (checklistErr) {
          setErroInicial("Erro ao carregar checklist da rotina.");
          return;
        }

        let baseChecklist: ChecklistItemExec[] = [];
        if (itensChecklist && itensChecklist.length > 0) {
          baseChecklist = itensChecklist.map((item: any) => ({
            ordem: item.ordem,
            descricao: item.descricao ?? "",
            valor: "",
            concluido: false,
          }));
        } else {
          baseChecklist = [{ ordem: 1, descricao: rotina.titulo ?? "Etapa principal", valor: "", concluido: false }];
        }

        // execução do dia
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const di = today.toISOString();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const df = tomorrow.toISOString();

        let execRow: any | null = null;

        if (isReadOnly) {
          const { data: execsRO } = await supabase
            .from("rotina_execucoes")
            .select("id, inicio_em, pausado_em, finalizado_em, duracao_total_segundos, observacoes, checklist_execucao")
            .eq("rotina_id", rotina.id)
            .gte("created_at", di)
            .lt("created_at", df)
            .order("id", { ascending: false })
            .limit(1);
          execRow = execsRO?.[0] ?? null;
        } else {
          const { data: execs } = await supabase
            .from("rotina_execucoes")
            .select("id, inicio_em, pausado_em, finalizado_em, duracao_total_segundos, observacoes, checklist_execucao")
            .eq("rotina_id", rotina.id)
            .eq("executor_id", uid)
            .gte("created_at", di)
            .lt("created_at", df)
            .order("id", { ascending: false })
            .limit(1);
          execRow = execs?.[0] ?? null;

          if (!execRow) {
            const nowISO = new Date().toISOString();
            const { data: created } = await supabase
              .from("rotina_execucoes")
              .insert({
                rotina_id: rotina.id,
                executor_id: uid,
                inicio_em: nowISO,
                pausado_em: null,
                finalizado_em: null,
                duracao_total_segundos: 0,
                observacoes: null,
                checklist_execucao: null,
              })
              .select("id, inicio_em, pausado_em, finalizado_em, duracao_total_segundos, observacoes, checklist_execucao")
              .single();
            execRow = created;
          }
        }

        if (execRow?.id) setExecucaoId(execRow.id);

        const finalizada = !!execRow?.finalizado_em;
        const pausada = !!execRow?.pausado_em;
        setIsFinalizada(finalizada);
        setIsPaused(finalizada ? true : pausada);

        const baseAcum = typeof execRow?.duracao_total_segundos === "number" ? execRow.duracao_total_segundos : 0;
        baseAcumuladaRef.current = baseAcum;

        if (!finalizada && !pausada && execRow?.inicio_em) {
          inicioRodandoRef.current = execRow.inicio_em;
        } else {
          inicioRodandoRef.current = null;
        }

        recalcElapsed();

        setObservacoes(execRow?.observacoes ?? "");
        let checklistExec: ChecklistItemExec[] = baseChecklist;
        if (execRow?.checklist_execucao && Array.isArray(execRow.checklist_execucao)) {
          checklistExec = execRow.checklist_execucao.map((i: any) => ({
            ordem: i.ordem,
            descricao: i.descricao ?? "",
            valor: i.valor ?? "",
            concluido: !!i.concluido,
          }));
        }
        setChecklist(checklistExec);

        if (execRow?.id) {
          const { data: anexoRows } = await supabase
            .from("rotina_anexos")
            .select("id, storage_path, descricao, created_at")
            .eq("rotina_id", rotina.id)
            .eq("execucao_id", execRow.id)
            .order("created_at", { ascending: false });
          if (anexoRows) setAnexos(anexoRows as Anexo[]);
        }
      } catch (e: any) {
        console.error("Erro inesperado na inicialização da execução:", e);
        setErroInicial("Erro inesperado ao iniciar execução.");
      } finally {
        setLoadingInicial(false);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rotina?.id, perfil.id, isReadOnly, canView]);

  // salva tempo contínuo (a cada 5s) reancorando quando está rodando
  useEffect(() => {
    if (!execucaoId || isReadOnly) return;

    const interval = setInterval(async () => {
      const nowISO = new Date().toISOString();

      if (!isPaused && !isFinalizada) {
        const total = computeTotalSeconds();
        baseAcumuladaRef.current = total;
        inicioRodandoRef.current = nowISO;
        setElapsedSeconds(total);

        const { error } = await supabase
          .from("rotina_execucoes")
          .update({ duracao_total_segundos: total, inicio_em: nowISO })
          .eq("id", execucaoId);

        if (error) console.error("Erro ao salvar tempo contínuo:", error);
        return;
      }

      const { error: errSave } = await supabase
        .from("rotina_execucoes")
        .update({ duracao_total_segundos: elapsedSeconds })
        .eq("id", execucaoId);

      if (errSave) console.error("Erro ao salvar tempo contínuo (pausada/finalizada):", errSave);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucaoId, isReadOnly, isPaused, isFinalizada, elapsedSeconds]);

  // persistência ao desmontar
  useEffect(() => {
    return () => {
      if (execucaoId && !isFinalizada && !isReadOnly) {
        const total = !isPaused && !isFinalizada ? computeTotalSeconds() : elapsedSeconds;
        void supabase
          .from("rotina_execucoes")
          .update({
            duracao_total_segundos: total,
            observacoes,
            checklist_execucao: checklist,
          })
          .eq("id", execucaoId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucaoId, isFinalizada, isReadOnly, isPaused, elapsedSeconds, observacoes, checklist]);

  useEffect(() => {
    if (!execucaoId || isReadOnly || isFinalizada) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void persistEstadoParcial();
    }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist, observacoes]);

  const persistEstadoParcial = async (extra: Record<string, any> = {}) => {
    if (!execucaoId || isReadOnly) return;

    if (!isPaused && !isFinalizada) {
      const total = computeTotalSeconds();
      const nowISO = new Date().toISOString();
      baseAcumuladaRef.current = total;
      inicioRodandoRef.current = nowISO;
      setElapsedSeconds(total);

      const { error } = await supabase
        .from("rotina_execucoes")
        .update({
          duracao_total_segundos: total,
          inicio_em: nowISO,
          observacoes,
          checklist_execucao: checklist,
          ...extra,
        })
        .eq("id", execucaoId);

      if (error) console.error("Erro ao salvar estado parcial:", error);
      return;
    }

    const { error } = await supabase
      .from("rotina_execucoes")
      .update({
        duracao_total_segundos: elapsedSeconds,
        observacoes,
        checklist_execucao: checklist,
        ...extra,
      })
      .eq("id", execucaoId);

    if (error) console.error("Erro ao salvar estado parcial:", error);
  };

  const handlePausar = async () => {
    if (!execucaoId || isReadOnly) return;

    const total = computeTotalSeconds();
    setElapsedSeconds(total);

    const novoPausado = !isPaused;
    setIsPaused(novoPausado);

    if (novoPausado) {
      baseAcumuladaRef.current = total;
      inicioRodandoRef.current = null;

      await persistEstadoParcial({
        duracao_total_segundos: total,
        pausado_em: new Date().toISOString(),
      });
    } else {
      const nowISO = new Date().toISOString();
      inicioRodandoRef.current = nowISO;

      await persistEstadoParcial({
        inicio_em: nowISO,
        pausado_em: null,
        duracao_total_segundos: baseAcumuladaRef.current,
      });
    }
  };

  const handleMinimizar = async () => {
    await persistEstadoParcial();
    setIsMinimized(true);
  };

  const handleFechar = async () => {
    await persistEstadoParcial();
    onClose();
  };

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!execucaoId || isReadOnly || isFinalizada) return;
      void persistEstadoParcial();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucaoId, isReadOnly, isFinalizada, observacoes, checklist, elapsedSeconds]);

  const handleFinalizar = async () => {
    if (!execucaoId || isReadOnly) return;

    const total = computeTotalSeconds();
    setElapsedSeconds(total);

    if ((rotina as any)?.tem_anexo) {
      if (!anexos || anexos.length < 1) {
        alert("Esta rotina exige anexo de comprovação. Envie pelo menos 1 arquivo antes de finalizar.");
        return;
      }
    }

    const { error } = await supabase
      .from("rotina_execucoes")
      .update({
        finalizado_em: new Date().toISOString(),
        duracao_total_segundos: total,
        observacoes,
        checklist_execucao: checklist,
        pausado_em: null,
      })
      .eq("id", execucaoId);

    if (error) {
      console.error("Erro ao finalizar rotina:", error);
      alert("Erro ao finalizar rotina. Tente novamente.");
      return;
    }

    if ((rotina as any)?.tipo === "avulsa") {
      const { error: rotinaError } = await supabase
        .from("rotinas")
        .update({ status: "finalizada" })
        .eq("id", rotina.id);

      if (rotinaError) {
        console.error("Erro ao finalizar rotina (rotinas):", rotinaError);
        alert("Erro ao finalizar rotina. Tente novamente.");
        return;
      }
    }

    setIsFinalizada(true);
    setIsPaused(true);
    baseAcumuladaRef.current = total;
    inicioRodandoRef.current = null;

    if (onFinalizada) onFinalizada();
  };

  if (!open || !rotina) return null;

  const statusBadge = () => {
    if (!execucaoId && isReadOnly) {
      return <span style={{ ...badgeBase, background: "rgba(56,189,248,0.10)", color: "#7dd3fc" }}>Sem execução</span>;
    }
    if (isFinalizada) {
      return <span style={{ ...badgeBase, background: "rgba(34,197,94,0.18)", color: "#4ade80" }}>Finalizada</span>;
    }
    if (isPaused) {
      return <span style={{ ...badgeBase, background: "rgba(234,179,8,0.15)", color: "#facc15" }}>Pausada</span>;
    }
    return <span style={{ ...badgeBase, background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>Em execução</span>;
  };

  const handleToggleChecklistItem = (ordem: number) => {
    if (isFinalizada || isReadOnly) return;
    setChecklist((prev) => prev.map((i) => (i.ordem === ordem ? { ...i, concluido: !i.concluido } : i)));
  };

  const handleUpdateValor = (ordem: number, valor: string) => {
    if (isFinalizada || isReadOnly) return;
    setChecklist((prev) => prev.map((i) => (i.ordem === ordem ? { ...i, valor } : i)));
  };

  const handleUploadAnexos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!execucaoId || !rotina || !executorId || isReadOnly) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErroUpload(null);

    const bucket = "rotina-anexos";
    const novos: Anexo[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `rotinas/${rotina.id}/execucoes/${execucaoId}/${Date.now()}-${i}.${ext}`;

        const { error: upError } = await supabase.storage.from(bucket).upload(path, file);
        if (upError) {
          setErroUpload("Erro ao enviar um dos anexos.");
          continue;
        }

        const { data: inserted, error: insErr } = await supabase
          .from("rotina_anexos")
          .insert({
            rotina_id: rotina.id,
            execucao_id: execucaoId,
            executor_id: executorId,
            storage_path: path,
            descricao: file.name,
          })
          .select("id, storage_path, descricao, created_at")
          .single();

        if (!insErr && inserted) novos.push(inserted as Anexo);
      }

      if (novos.length > 0) setAnexos((prev) => [...novos, ...prev]);
    } catch (err: any) {
      setErroUpload("Erro inesperado ao enviar anexos.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const modal = !isMinimized && (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <header style={headerRowStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{rotina.titulo}</div>
            <div style={{ fontSize: 11, color: textMuted }}>
              ID: {rotina.id} • Duração planejada: {rotina.duracao_minutos ?? 0} min
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {isReadOnly && <span style={{ ...badgeBase, background: "rgba(148,163,184,0.15)", color: "#e5e7eb" }}>Somente leitura</span>}
            {statusBadge()}
            <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>{formatSeconds(elapsedSeconds)}</span>

            <button type="button" style={{ ...btnNeonStyle, background: "transparent", border: `1px solid ${neon}`, color: neon }} onClick={handleMinimizar}>
              Minimizar
            </button>

            <button type="button" style={{ ...btnNeonStyle, background: "#991b1b", color: "#fee2e2" }} onClick={handleFechar}>
              Fechar
            </button>
          </div>
        </header>

        {erroInicial ? (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(220,38,38,0.18)", color: "#fecaca", fontSize: 13 }}>{erroInicial}</div>
        ) : loadingInicial ? (
          <div style={{ color: "#e5e7eb", fontSize: 13 }}>Carregando dados da execução...</div>
        ) : (
          <>
            <div style={bodyGridStyle}>
              <div style={colunaStyle}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Checklist da execução</div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>
                  {isReadOnly ? "Visualização do checklist (somente leitura)." : "Marque o item concluído e registre o valor da conferência."}
                </div>

                {rotina?.arquivo_modelo_url && (
                  <a href={rotina.arquivo_modelo_url} target="_blank" rel="noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: neon, textDecoration: "none",
                    border: `1px solid ${borderSoft}`, padding: "6px 10px", borderRadius: 10,
                  }}>
                    📄 Baixar anexo da rotina {rotina.arquivo_modelo_nome ? `(${rotina.arquivo_modelo_nome})` : ""}
                  </a>
                )}

                <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                  {checklist.map((item) => (
                    <div
                      key={item.ordem}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px minmax(0, 1.6fr) minmax(0, 0.8fr)",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        disabled={isFinalizada || isReadOnly}
                        onChange={() => handleToggleChecklistItem(item.ordem)}
                      />
                      <div
                        style={{
                          background: "rgba(15,23,42,1)",
                          borderRadius: 10,
                          border: `1px solid ${borderSoft}`,
                          padding: "6px 8px",
                          color: text,
                          fontSize: 13,
                        }}
                      >
                        {item.descricao || <span style={{ color: "#64748b" }}>(sem descrição)</span>}
                      </div>
                      <input
                        type="text"
                        style={{
                          background: "rgba(15,23,42,1)",
                          borderRadius: 10,
                          border: `1px solid ${borderSoft}`,
                          padding: "6px 8px",
                          color: text,
                          fontSize: 13,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                        placeholder="Valor / Qtd"
                        value={item.valor}
                        disabled={isFinalizada || isReadOnly}
                        onChange={(e) => handleUpdateValor(item.ordem, e.target.value)}
                      />
                    </div>
                  ))}

                  {checklist.length === 0 && <div style={{ fontSize: 12, color: textMuted }}>Esta rotina não possui checklist cadastrado.</div>}
                </div>
              </div>

              <div style={colunaStyle}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Observações</div>
                <textarea
                  style={{
                    flex: 1,
                    background: "rgba(15,23,42,1)",
                    borderRadius: 12,
                    border: `1px solid ${borderSoft}`,
                    padding: 10,
                    color: text,
                    fontSize: 13,
                    resize: "none",
                    minHeight: 120,
                  }}
                  placeholder="Registre divergências, ocorrências, observações importantes..."
                  value={observacoes}
                  disabled={isFinalizada || isReadOnly}
                  onChange={(e) => setObservacoes(e.target.value)}
                />

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Anexos da execução</div>
                  <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>
                    {isReadOnly
                      ? "Visualização de anexos (somente leitura)."
                      : (rotina as any)?.tem_anexo
                        ? "⚠️ Anexo obrigatório: envie pelo menos 1 arquivo para conseguir finalizar. (Múltiplos permitidos)"
                        : "Envie fotos, prints ou documentos. Múltiplos arquivos são permitidos."}
                  </div>

                  <input
                    type="file"
                    multiple
                    disabled={isFinalizada || uploading || isReadOnly}
                    onChange={handleUploadAnexos}
                    style={{ fontSize: 12, marginBottom: 4 }}
                  />

                  {erroUpload && <div style={{ fontSize: 11, color: "#fecaca", marginBottom: 4 }}>{erroUpload}</div>}
                  {uploading && <div style={{ fontSize: 11, color: "#e5e7eb", marginBottom: 4 }}>Enviando anexos...</div>}

                  <div style={{ marginTop: 8, maxHeight: 130, overflowY: "auto", fontSize: 12 }}>
                    {anexos.length === 0 && <div style={{ fontSize: 12, color: textMuted }}>Nenhum anexo enviado ainda.</div>}

                    {anexos.map((a) => {
                      const publicUrl = supabase.storage.from("rotina-anexos").getPublicUrl(a.storage_path).data.publicUrl ?? "#";
                      return (
                        <div
                          key={a.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 0",
                            borderBottom: `1px solid ${borderSoft}`,
                          }}
                        >
                          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: neon, textDecoration: "none" }}>
                            ⬇ {a.descricao ?? "arquivo"}
                          </a>
                          <span style={{ fontSize: 10, color: textMuted }}>{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <footer style={footerRowStyle}>
              <div style={{ fontSize: 12, color: textMuted }}>
                {isReadOnly
                  ? "Modo somente leitura: você pode visualizar checklist, tempo e anexos dentro da sua hierarquia."
                  : "O cronômetro registra o tempo total. Você pode pausar/minimizar sem perder o tempo. Ao finalizar, tudo fica salvo para auditoria."}
              </div>

              {!isReadOnly && (
                <div style={{ display: "flex", gap: 8 }}>
                  {!isFinalizada && (
                    <button type="button" style={{ ...btnNeonStyle, background: "#f97316", color: "#111827" }} onClick={handlePausar}>
                      {isPaused ? "Retomar" : "Pausar"}
                    </button>
                  )}
                  {!isFinalizada && (
                    <button type="button" style={{ ...btnNeonStyle, background: "#dc2626", color: "#fee2e2" }} onClick={handleFinalizar}>
                      Finalizar rotina
                    </button>
                  )}
                </div>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );

  const floating = isMinimized && (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        width: 320,
        background: "rgba(15,23,42,0.98)",
        borderRadius: 16,
        border: `1px solid ${neon}`,
        boxShadow: "0 0 25px rgba(34,197,94,0.35)",
        padding: 12,
        zIndex: 40,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {isReadOnly ? "Visualizando: " : "Em execução: "}
        <span style={{ color: neon }}>{rotina.titulo}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "monospace", fontSize: 14 }}>{formatSeconds(elapsedSeconds)}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={{ ...btnNeonStyle, padding: "4px 10px", background: neon, color: "#000" }} onClick={() => setIsMinimized(false)}>
            Maximizar
          </button>
          {!isReadOnly && !isFinalizada && (
            <button type="button" style={{ ...btnNeonStyle, padding: "4px 10px", background: "#dc2626", color: "#fee2e2" }} onClick={handleFinalizar}>
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {modal}
      {floating}
    </>
  );
}
