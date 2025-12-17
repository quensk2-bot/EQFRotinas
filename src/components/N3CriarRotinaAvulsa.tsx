// src/components/N3CriarRotinaAvulsa.tsx
import type React from "react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles, theme } from "../styles";

type Props = {
  perfil: Usuario | null;
};

type Urgencia = "alta" | "media" | "baixa";

type ChecklistItemForm = {
  id: number;
  descricao: string;
};

type SlotStatus = "livre" | "limite" | "bloqueado";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ✅ gera horários em intervalos FIXOS de 30 minutos
function gerarHorarios30Min(inicio = "06:00", fim = "22:00") {
  const horarios: string[] = [];
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);

  let totalMin = hi * 60 + mi;
  const totalFim = hf * 60 + mf;

  while (totalMin <= totalFim) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    horarios.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    totalMin += 30;
  }
  return horarios;
}

const ui = {
  card: {
    borderRadius: 18,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    background: "rgba(15,23,42,0.92)",
    padding: 14,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  header: {
    borderRadius: 18,
    border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
    background:
      "radial-gradient(circle at top left, rgba(251,146,60,0.16), transparent 55%), rgba(15,23,42,0.94)",
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    color: theme.colors.neonOrange ?? "#fb923c",
    border: `1px solid ${theme.colors.neonOrange ?? "#fb923c"}`,
    background: "rgba(251,146,60,0.10)",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.colors.text ?? "#f9fafb",
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted ?? "#9ca3af",
    marginTop: 2,
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 11,
    color: theme.colors.textMuted ?? "#9ca3af",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 10,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  miniBtn: (active?: boolean) => ({
    border: `1px solid ${
      active ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.borderSoft ?? "#1f2937"
    }`,
    background: active ? "rgba(34,197,94,0.14)" : "transparent",
    color: active ? theme.colors.neonGreen ?? "#22c55e" : theme.colors.textSoft ?? "#e5e7eb",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 600,
  }),
  badge: (kind: SlotStatus) => {
    const map = {
      livre: {
        b: theme.colors.neonGreen ?? "#22c55e",
        bg: "rgba(34,197,94,0.12)",
        c: theme.colors.neonGreen ?? "#22c55e",
      },
      limite: {
        b: theme.colors.neonOrange ?? "#fb923c",
        bg: "rgba(251,146,60,0.12)",
        c: theme.colors.neonOrange ?? "#fb923c",
      },
      bloqueado: { b: "#f87171", bg: "rgba(248,113,113,0.12)", c: "#fca5a5" },
    }[kind];

    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      border: `1px solid ${map.b}`,
      background: map.bg,
      color: map.c,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.2,
    } as React.CSSProperties;
  },
  divider: {
    height: 1,
    background: theme.colors.borderSoft ?? "#1f2937",
    opacity: 0.9,
    margin: "6px 0",
  },
  alert: (kind: "ok" | "warn" | "err") => {
    const map = {
      ok: { b: "#bbf7d0", c: "#bbf7d0" },
      warn: { b: "#fde68a", c: "#fde68a" },
      err: { b: "#fecaca", c: "#fecaca" },
    }[kind];

    return {
      display: "block",
      marginTop: 10,
      fontSize: 12,
      padding: 10,
      borderRadius: 12,
      border: `1px solid ${map.b}`,
      background: "rgba(2,6,23,0.6)",
      color: map.c,
    } as React.CSSProperties;
  },
};

export function N3CriarRotinaAvulsa({ perfil }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  // ✅ AGENDAMENTO (intervalo fixo 30min)
  const [data, setData] = useState<string>(() => hojeISO());
  const horariosDisponiveis = useMemo(() => gerarHorarios30Min("06:00", "22:00"), []);
  const [horario, setHorario] = useState<string>(() => horariosDisponiveis[4] ?? "08:00"); // fallback
  const [duracaoMin, setDuracaoMin] = useState("30");

  const [urgencia, setUrgencia] = useState<Urgencia>("baixa");
  const [temChecklist, setTemChecklist] = useState(false);
  const [temAnexo, setTemAnexo] = useState(false);

  const [checklistDescricao, setChecklistDescricao] = useState("");
  const [checklistItens, setChecklistItens] = useState<ChecklistItemForm[]>([]);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  // disponibilidade do slot (máx 2 rotinas no mesmo dia/hora pro responsável)
  const [slotCount, setSlotCount] = useState<number>(0);
  const [slotLoading, setSlotLoading] = useState(false);

  const slotStatus: SlotStatus = useMemo(() => {
    if (slotCount >= 2) return "bloqueado";
    if (slotCount === 1) return "limite";
    return "livre";
  }, [slotCount]);

  const slotLabel = useMemo(() => {
    if (slotStatus === "bloqueado") return "SLOT BLOQUEADO (2/2)";
    if (slotStatus === "limite") return "SLOT NO LIMITE (1/2)";
    return "SLOT LIVRE (0/2)";
  }, [slotStatus]);

  // se por algum motivo o horário atual não existe na lista (garante 30/30)
  useEffect(() => {
    if (!horariosDisponiveis.includes(horario)) {
      setHorario(horariosDisponiveis[0] ?? "08:00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horariosDisponiveis]);

  useEffect(() => {
    const run = async () => {
      setDetails(null);
      setStatusMsg(null);

      if (!perfil?.id) return;
      if (!data || !horario) return;

      setSlotLoading(true);
      try {
        const { count, error } = await supabase
          .from("rotinas")
          .select("id", { head: true, count: "exact" })
          .eq("responsavel_id", perfil.id)
          .eq("data_inicio", data)
          .eq("horario_inicio", horario);

        if (error) throw error;
        setSlotCount(count ?? 0);
      } catch (err: any) {
        console.error("Erro ao checar slot:", err);
        setSlotCount(0);
      } finally {
        setSlotLoading(false);
      }
    };

    void run();
  }, [perfil?.id, data, horario]);

  const addChecklistItem = () => {
    if (!checklistDescricao.trim()) return;
    setChecklistItens((prev) => [...prev, { id: prev.length + 1, descricao: checklistDescricao.trim() }]);
    setChecklistDescricao("");
  };

  const removeChecklistItem = (id: number) => {
    setChecklistItens((prev) => prev.filter((i) => i.id !== id));
  };

  const setHoje = () => setData(hojeISO());
  const setAmanha = () => setData(addDaysISO(hojeISO(), 1));

  // ✅ navegação de horário em 30/30
  const moverHorario = (delta: number) => {
    const idx = horariosDisponiveis.indexOf(horario);
    if (idx < 0) return setHorario(horariosDisponiveis[0] ?? "08:00");
    const next = Math.max(0, Math.min(horariosDisponiveis.length - 1, idx + delta));
    setHorario(horariosDisponiveis[next] ?? horario);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setDetails(null);

    if (!perfil) {
      setStatusMsg("❌ Perfil não carregado. Faça login novamente.");
      return;
    }

    const t = titulo.trim();
    if (!t) {
      setStatusMsg("⚠️ Informe um título para a rotina.");
      return;
    }

    const duracao = Number.parseInt(duracaoMin || "0", 10);
    if (!Number.isFinite(duracao) || duracao <= 0) {
      setStatusMsg("⚠️ Duração inválida. Use um valor maior que 0.");
      return;
    }

    if (!data || !horario) {
      setStatusMsg("⚠️ Defina data e horário para a rotina.");
      return;
    }

    // validação do slot antes de salvar
    if (slotCount >= 2) {
      setStatusMsg("❌ Limite atingido: você já possui 2 rotinas neste dia e horário. Escolha outro horário.");
      return;
    }

    try {
      // ✅ salva via Edge Function (regra oficial do limite 2/slot)
      const payload = {
        tipo: "avulsa",
        periodicidade: "diaria",
        titulo: t,
        descricao: descricao.trim() || null,
        criador_id: perfil.id,
        responsavel_id: perfil.id,
        departamento_id: perfil.departamento_id ?? null,
        setor_id: perfil.setor_id ?? null,
        regional_id: perfil.regional_id ?? null,
        data_inicio: data,
        horario_inicio: horario,
        duracao_minutos: duracao,
        urgencia,
        tem_checklist: temChecklist,
        tem_anexo: temAnexo,
      };

      const { data: fnData, error: fnError } = await supabase.functions.invoke("eqf-create-rotina-diaria", {
        body: payload,
      });

      if (fnError) {
        console.error("Erro edge function (N3 criar avulsa):", fnError);
        setStatusMsg("❌ Erro ao criar rotina avulsa (função).");
        setDetails(JSON.stringify(fnError, null, 2));
        return;
      }

      if (!fnData?.ok || !fnData?.rotina) {
        setStatusMsg("❌ Não foi possível obter a rotina criada.");
        setDetails(JSON.stringify(fnData, null, 2));
        return;
      }

      const rotina = fnData.rotina;

      // checklist
      if (temChecklist && checklistItens.length > 0) {
        const rows = checklistItens.map((item, idx) => ({
          rotina_id: rotina.id,
          ordem: idx + 1,
          descricao: item.descricao,
          obrigatorio: true,
          exige_anexo: false,
          tipo_valor: null,
          valor_minimo: null,
          valor_maximo: null,
        }));

        const { error: errorChecklist } = await supabase.from("rotina_checklist").insert(rows);

        if (errorChecklist) {
          console.error("Erro ao salvar checklist da rotina N3:", errorChecklist);
          setStatusMsg("⚠️ Rotina criada, mas houve erro ao salvar o checklist.");
          setDetails(JSON.stringify(errorChecklist, null, 2));
          return;
        }
      }

      setStatusMsg("✅ Rotina avulsa criada com sucesso!");
      setDetails(JSON.stringify(rotina, null, 2));

      // reset
      setTitulo("");
      setDescricao("");
      setDuracaoMin("30");
      setUrgencia("baixa");
      setTemChecklist(false);
      setTemAnexo(false);
      setChecklistItens([]);
      setChecklistDescricao("");
    } catch (err: any) {
      console.error("Erro inesperado ao criar rotina N3:", err);
      setStatusMsg("❌ Erro inesperado ao criar rotina.");
      setDetails(String(err?.message ?? err));
    }
  };

  if (!perfil) {
    return <div style={{ fontSize: 13, color: theme.colors.textMuted ?? "#9ca3af" }}>Carregando perfil...</div>;
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={ui.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={ui.pill}>Nível · N3 · Rotina Avulsa</span>
          <div style={ui.title}>Criar rotina avulsa</div>
          <div style={ui.subtitle}>
            Rotina pontual vinculada ao seu usuário • Regional {perfil.regional_id ?? "—"} • Setor {perfil.setor_id ?? "—"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={ui.sectionTitle}>Status do agendamento</div>
          <span style={ui.badge(slotStatus)}>{slotLoading ? "CHECANDO..." : slotLabel}</span>
          <div style={{ fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
            Regra: máximo 2 rotinas no mesmo horário.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={ui.card}>
        {/* AGENDAMENTO (Filtro alinhado) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={ui.sectionTitle}>Agendamento</div>
            <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af", marginTop: 2 }}>
              Data, horário (30 em 30) e duração.
            </div>
          </div>

          <div style={ui.row}>
            <button type="button" style={ui.miniBtn(data === hojeISO())} onClick={setHoje}>
              Hoje
            </button>
            <button type="button" style={ui.miniBtn(data === addDaysISO(hojeISO(), 1))} onClick={setAmanha}>
              Amanhã
            </button>

            <button type="button" style={ui.miniBtn(false)} onClick={() => moverHorario(-1)}>
              -30 min
            </button>
            <button type="button" style={ui.miniBtn(false)} onClick={() => moverHorario(+1)}>
              +30 min
            </button>
          </div>
        </div>

        <div style={ui.grid3}>
          <div>
            <label style={styles.label}>Data</label>
            <input type="date" style={styles.input} value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div>
            <label style={styles.label}>Horário (30 em 30)</label>
            <select style={styles.input} value={horario} onChange={(e) => setHorario(e.target.value)}>
              {horariosDisponiveis.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, marginTop: 4, color: theme.colors.textMuted ?? "#9ca3af" }}>
              {slotStatus === "bloqueado"
                ? "⚠️ Escolha outro horário."
                : slotStatus === "limite"
                ? "Quase lotado (1/2)."
                : "Livre (0/2)."}
            </div>
          </div>

          <div>
            <label style={styles.label}>Duração (min)</label>
            <input type="number" min={1} style={styles.input} value={duracaoMin} onChange={(e) => setDuracaoMin(e.target.value)} />
          </div>
        </div>

        <div style={ui.divider} />

        {/* DADOS DA ROTINA */}
        <div style={ui.grid2}>
          <div>
            <label style={styles.label}>Título</label>
            <input style={styles.input} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Conferir balcão de FLV" />
          </div>

          <div>
            <label style={styles.label}>Urgência</label>
            <select style={styles.input} value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        <div>
          <label style={styles.label}>Descrição</label>
          <textarea
            style={{ ...styles.input, minHeight: 70, resize: "vertical" }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe o que precisa ser verificado na rotina..."
          />
        </div>

        {/* Flags */}
        <div style={ui.row}>
          <label style={{ fontSize: 13, color: theme.colors.textSoft ?? "#e5e7eb" }}>
            <input type="checkbox" checked={temChecklist} onChange={(e) => setTemChecklist(e.target.checked)} style={{ marginRight: 6 }} />
            Tem checklist
          </label>

          <label style={{ fontSize: 13, color: theme.colors.textSoft ?? "#e5e7eb" }}>
            <input type="checkbox" checked={temAnexo} onChange={(e) => setTemAnexo(e.target.checked)} style={{ marginRight: 6 }} />
            Exige anexo na execução
          </label>
        </div>

        {/* CHECKLIST */}
        {temChecklist && (
          <div
            style={{
              marginTop: 6,
              padding: 12,
              borderRadius: 16,
              border: `1px dashed ${theme.colors.borderSoft ?? "#1f2937"}`,
              background: "rgba(2,6,23,0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={ui.sectionTitle}>Checklist</div>
                <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af", marginTop: 2 }}>
                  Monte os passos que deverão ser executados nesta rotina.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  style={{ ...styles.input, fontSize: 12, padding: "8px 10px", minWidth: 240 }}
                  placeholder="Descrição do passo..."
                  value={checklistDescricao}
                  onChange={(e) => setChecklistDescricao(e.target.value)}
                />
                <button type="button" style={{ ...styles.buttonPrimary, fontSize: 12, padding: "10px 12px" }} onClick={addChecklistItem}>
                  + Adicionar
                </button>
              </div>
            </div>

            {checklistItens.length === 0 && (
              <p style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af", marginTop: 10 }}>Nenhum item adicionado ainda.</p>
            )}

            {checklistItens.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {checklistItens.map((item) => (
                  <li key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <span style={{ color: theme.colors.textSoft ?? "#e5e7eb" }}>{item.descricao}</span>

                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      style={{
                        border: `1px solid rgba(248,113,113,0.5)`,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                        background: "rgba(248,113,113,0.10)",
                        color: "#fecaca",
                        fontWeight: 700,
                      }}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* AÇÃO */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <button
            type="submit"
            style={{
              ...styles.buttonPrimary,
              opacity: slotStatus === "bloqueado" ? 0.6 : 1,
              cursor: slotStatus === "bloqueado" ? "not-allowed" : "pointer",
            }}
            disabled={slotStatus === "bloqueado"}
          >
            Salvar rotina avulsa
          </button>

          <div style={{ fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
            Responsável: <strong style={{ color: theme.colors.textSoft ?? "#e5e7eb" }}>{perfil.nome}</strong>
          </div>
        </div>

        {/* STATUS */}
        {statusMsg && <span style={ui.alert(statusMsg.startsWith("❌") ? "err" : statusMsg.startsWith("⚠️") ? "warn" : "ok")}>{statusMsg}</span>}

        {details && (
          <pre
            style={{
              marginTop: 10,
              fontSize: 11,
              background: "rgba(2,6,23,0.65)",
              padding: 10,
              borderRadius: 14,
              maxHeight: 220,
              overflow: "auto",
              border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
              color: theme.colors.textSoft ?? "#e5e7eb",
            }}
          >
            {details}
          </pre>
        )}
      </form>
    </section>
  );
}
