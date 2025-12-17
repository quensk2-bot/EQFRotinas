// src/components/ExecucaoModal.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles";
import { HistoricoExecucoesRotina } from "./HistoricoExecucoesRotina";
import { KpiPorRotina } from "./KpiPorRotina";

type Props = {
  open: boolean;
  rotinaId: string;
  perfil: any;
  onClose: () => void;
};

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  periodicidade: string;
  data_inicio: string;
  dia_semana: string | null;
  horario_inicio: string | null;
  duracao_minutos: number | null;
  urgencia: string | null;
  tem_checklist: boolean;
  tem_anexo: boolean;
};

type Execucao = {
  id: number;
  rotina_id: string;
  executor_id: string;
  inicio_em: string | null;
  pausado_em: string | null;
  finalizado_em: string | null;
  duracao_total_segundos: number | null;
  observacao: string | null;
  status: string;
};

type ChecklistItem = {
  id: number;
  rotina_id: string;
  ordem: number;
  descricao: string;
  concluido: boolean;
};

type Anexo = {
  id: number;
  rotina_execucao_id: number;
  url: string;
  nome_arquivo: string;
  criado_em: string;
};

export function ExecucaoModal({ open, rotinaId, perfil, onClose }: Props) {
  const [rotina, setRotina] = useState<Rotina | null>(null);
  const [execucao, setExecucao] = useState<Execucao | null>(null);
  const [cronometro, setCronometro] = useState("00:00:00");
  const [intervalId, setIntervalId] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [checklistValores, setChecklistValores] = useState<Record<number, string>>({});
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  // ----------------------------------
  // CARREGAR ROTINA
  // ----------------------------------
  const carregarRotina = async () => {
    const { data, error } = await supabase
      .from("rotinas")
      .select(
        `
        id, titulo, descricao, tipo, periodicidade,
        data_inicio, dia_semana, horario_inicio, duracao_minutos,
        urgencia, tem_checklist, tem_anexo
      `
      )
      .eq("id", rotinaId)
      .single();

    if (error) {
      console.error(error);
      setErro("Erro ao carregar rotina.");
      return;
    }

    setRotina(data as Rotina);
  };

  // ----------------------------------
  // CARREGAR EXECUÇÃO (SE EXISTIR)
  // ----------------------------------
  const carregarExecucao = async () => {
    const { data, error } = await supabase
      .from("rotina_execucoes")
      .select("*")
      .eq("rotina_id", rotinaId)
      .eq("executor_id", perfil.id)
      .order("inicio_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setErro("Erro ao carregar execução da rotina.");
      return;
    }

    if (data) {
      setExecucao(data as Execucao);
      setObservacao(data.observacao ?? "");

      if (data.inicio_em && !data.finalizado_em) {
        iniciarCronometro(data as Execucao);
      } else if (data.duracao_total_segundos) {
        setCronometro(segundosParaHHMMSS(data.duracao_total_segundos));
      }
    } else {
      setExecucao(null);
      setCronometro("00:00:00");
    }
  };

  // ----------------------------------
  // CRIAR EXECUÇÃO SE NÃO EXISTIR
  // ----------------------------------
  const iniciarExecucao = async () => {
    if (execucao && execucao.id) return; // já existe

    const { data, error } = await supabase
      .from("rotina_execucoes")
      .insert({
        rotina_id: rotinaId,
        executor_id: perfil.id,
        inicio_em: new Date().toISOString(),
        status: "em_execucao",
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setErro("Erro ao iniciar execução.");
      return;
    }

    const nova = data as Execucao;
    setExecucao(nova);
    iniciarCronometro(nova);
  };

  // ----------------------------------
  // CHECKLIST
  // ----------------------------------
  const carregarChecklist = async () => {
    const { data, error } = await supabase
      .from("rotina_checklist_execucao_view")
      .select("*")
      .eq("rotina_id", rotinaId)
      .eq("executor_id", perfil.id)
      .order("ordem", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const itens = (data as any[]) as ChecklistItem[];
    setChecklist(itens);
    setChecklistValores(() => {
      const mapa: Record<number, string> = {};
      for (const it of itens) {
        mapa[it.id] = "";
      }
      return mapa;
    });
  };

  const toggleChecklistItem = async (itemId: number) => {
    const item = checklist.find((c) => c.id === itemId);
    if (!item || !execucao) return;

    const novoValor = !item.concluido;

    const { error } = await supabase
      .from("rotina_checklist_execucao")
      .update({ concluido: novoValor })
      .eq("id", itemId);

    if (error) {
      console.error(error);
      return;
    }

    setChecklist((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, concluido: novoValor } : c))
    );
  };

  const handleChangeChecklistValor = (itemId: number, valor: string) => {
    // Valor / observação controlado por item, para não repetir em todos
    setChecklistValores((prev) => ({ ...prev, [itemId]: valor }));
  };

  // ----------------------------------
  // ANEXOS
  // ----------------------------------
  const carregarAnexos = async () => {
    if (!execucao) return;
    const { data, error } = await supabase
      .from("rotina_execucao_anexos")
      .select("*")
      .eq("rotina_execucao_id", execucao.id)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAnexos((data as any[]) as Anexo[]);
  };

  const uploadAnexo = async (file: File) => {
    if (!execucao) return;

    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${rotinaId}/${execucao.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = (await supabase.storage
        .from("rotina-anexos")
        .upload(path, file)) as any;

      if (uploadError) {
        console.error(uploadError);
        setErro("Erro ao enviar anexo.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("rotina-anexos")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("rotina_execucao_anexos")
        .insert({
          rotina_execucao_id: execucao.id,
          url: publicUrlData.publicUrl,
          nome_arquivo: file.name,
        });

      if (insertError) {
        console.error(insertError);
        setErro("Erro ao salvar anexo.");
        return;
      }

      await carregarAnexos();
    } catch (e) {
      console.error(e);
      setErro("Erro inesperado ao enviar anexo.");
    }
  };

  // ----------------------------------
  // CRONÔMETRO
  // ----------------------------------
  const iniciarCronometro = (ex: Execucao) => {
    if (!ex.inicio_em || ex.finalizado_em) return;

    if (intervalId) {
      clearInterval(intervalId);
    }

    const inicio = new Date(ex.inicio_em).getTime();

    const t = window.setInterval(() => {
      const agora = Date.now();
      const diffSeg = Math.floor((agora - inicio) / 1000);

      setCronometro(segundosParaHHMMSS(diffSeg));
    }, 1000);

    setIntervalId(t);
  };

  useEffect(() => {
    if (!execucao?.inicio_em || execucao.finalizado_em) {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [execucao, intervalId]);

  // ----------------------------------
  // PAUSAR / CONTINUAR
  // ----------------------------------
  const pausarOuContinuar = async () => {
    if (!execucao) return;

    const agoraIso = new Date().toISOString();

    if (!execucao.pausado_em) {
      const { data, error } = await supabase
        .from("rotina_execucoes")
        .update({
          pausado_em: agoraIso,
          status: "pausado",
        })
        .eq("id", execucao.id)
        .select("*")
        .single();

      if (error) {
        console.error(error);
        setErro("Erro ao pausar execução.");
        return;
      }

      setExecucao(data as Execucao);

      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    } else {
      const { data, error } = await supabase
        .from("rotina_execucoes")
        .update({
          pausado_em: null,
          status: "em_execucao",
        })
        .eq("id", execucao.id)
        .select("*")
        .single();

      if (error) {
        console.error(error);
        setErro("Erro ao retomar execução.");
        return;
      }

      const nova = data as Execucao;
      setExecucao(nova);
      iniciarCronometro(nova);
    }
  };

  // ----------------------------------
  // FINALIZAR
  // ----------------------------------
  const finalizar = async () => {
    if (!execucao) return;
    setLoading(true);
    setErro(null);

    try {
      const agora = new Date();
      let duracaoSegundos = execucao.duracao_total_segundos ?? 0;

      if (execucao.inicio_em) {
        const inicio = new Date(execucao.inicio_em).getTime();
        const agoraMs = agora.getTime();
        const diff = Math.floor((agoraMs - inicio) / 1000);
        duracaoSegundos = diff;
      }

      const { data, error } = await supabase
        .from("rotina_execucoes")
        .update({
          finalizado_em: agora.toISOString(),
          duracao_total_segundos: duracaoSegundos,
          observacao: observacao || null,
          status: "finalizado",
        })
        .eq("id", execucao.id)
        .select("*")
        .single();

      if (error) {
        console.error(error);
        setErro("Erro ao finalizar execução.");
        setLoading(false);
        return;
      }

      setExecucao(data as Execucao);

      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    } catch (e) {
      console.error(e);
      setErro("Erro inesperado ao finalizar execução.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // EFEITO QUANDO ABRE O MODAL
  // ----------------------------------
  useEffect(() => {
    if (!open) return;

    setErro(null);
    setExecucao(null);
    setCronometro("00:00:00");
    setChecklist([]);
    setChecklistValores({});
    setAnexos([]);

    void carregarRotina();
    void carregarExecucao();
  }, [open, rotinaId]);

  useEffect(() => {
    if (!execucao) return;

    void carregarChecklist();
    void carregarAnexos();
  }, [execucao?.id]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#020617",
          borderRadius: 18,
          padding: 18,
          minWidth: 420,
          maxWidth: 720,
          width: "100%",
          border: "1px solid #1e293b",
          color: "#e5e7eb",
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {rotina?.titulo ?? "Execução da rotina"}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              ID: {rotina?.id} • Duração planejada:{" "}
              {rotina?.duracao_minutos ?? 0} min
            </div>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#022c22",
              border: "1px solid #22c55e",
              color: "#bbf7d0",
            }}
          >
            {cronometro}
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          {/* CHECKLIST */}
          {rotina?.tem_checklist && checklist.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "rgba(15,23,42,0.9)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Checklist
              </div>
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.concluido}
                      onChange={() => toggleChecklistItem(item.id)}
                      style={{ marginRight: 4 }}
                    />
                    <span style={{ flex: 1 }}>{item.descricao}</span>
                    <input
                      type="text"
                      style={{
                        ...styles.input,
                        maxWidth: 140,
                        fontSize: 12,
                        padding: "4px 6px",
                      }}
                      placeholder="Valor / observação"
                      value={checklistValores[item.id] ?? ""}
                      onChange={(e) =>
                        handleChangeChecklistValor(item.id, e.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ANEXOS */}
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #1f2937",
              background: "rgba(15,23,42,0.9)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Anexos
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAnexo(file);
                }}
              />
            </div>
            <div
              style={{
                maxHeight: 140,
                overflowY: "auto",
                fontSize: 12,
                color: "#cbd5f5",
              }}
            >
              {anexos.length === 0 && <div>Nenhum anexo enviado.</div>}
              {anexos.map((ax) => (
                <div
                  key={ax.id}
                  style={{
                    padding: "4px 0",
                    borderBottom: "1px solid #020617",
                  }}
                >
                  <a
                    href={ax.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#60a5fa" }}
                  >
                    {ax.nome_arquivo}
                  </a>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {new Date(ax.criado_em).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* OBSERVAÇÃO */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            Observações
          </div>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Registre divergências, ocorrências, observações importantes..."
            style={{
              ...styles.input,
              minHeight: 80,
              resize: "vertical",
            }}
          />
        </div>

        {/* RODAPÉ: BOTÕES */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setVerHistorico((v) => !v)}
              style={{
                ...styles.buttonSecondary,
                padding: "6px 12px",
                fontSize: 12,
              }}
            >
              {verHistorico ? "Ocultar histórico" : "Ver histórico"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...styles.buttonSecondary,
                padding: "6px 12px",
                fontSize: 12,
              }}
            >
              Fechar
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={iniciarExecucao}
              disabled={!!execucao}
              style={{
                ...styles.buttonSecondary,
                padding: "6px 12px",
                opacity: execucao ? 0.5 : 1,
                cursor: execucao ? "not-allowed" : "pointer",
              }}
            >
              Iniciar
            </button>
            {execucao && (
              <button
                type="button"
                onClick={pausarOuContinuar}
                style={{
                  ...styles.buttonSecondary,
                  padding: "6px 12px",
                }}
              >
                {execucao.pausado_em ? "Retomar" : "Pausar"}
              </button>
            )}
            <button
              type="button"
              onClick={finalizar}
              disabled={!execucao || loading}
              style={{
                ...styles.buttonPrimary,
                padding: "6px 12px",
                backgroundColor: "#ef4444",
                borderColor: "#b91c1c",
                opacity: !execucao || loading ? 0.5 : 1,
                cursor: !execucao || loading ? "not-allowed" : "pointer",
              }}
            >
              Finalizar rotina
            </button>
          </div>
        </div>

        {/* ERRO */}
        {erro && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#450a0a",
              color: "#fecaca",
            }}
          >
            {erro}
          </div>
        )}

        {/* KPI / HISTÓRICO */}
        {verHistorico && rotina && (
          <div style={{ marginTop: 16 }}>
            <KpiPorRotina rotinaId={rotina.id} />
            <HistoricoExecucoesRotina rotinaId={rotina.id} executorId={perfil.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function segundosParaHHMMSS(totalSegundos: number): string {
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}
