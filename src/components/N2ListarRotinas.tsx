// src/components/N2ListarRotinas.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles, theme } from "../styles";
import N2CriarRotina from "./N2CriarRotina";

type Props = {
  perfil: Usuario;
  onAbrirExecucao: (rotina: any) => void; // centralizado no MainShell (abre RotinaExecucaoContainer)
};

type RotinaRow = {
  id: string;
  titulo: string;
  descricao: string | null;

  tipo: "normal" | "avulsa" | null;
  periodicidade: "diaria" | "semanal" | "mensal" | null;
  dia_semana: string | null;

  data_inicio: string | null;
  horario_inicio: string | null;
  duracao_minutos: number | null;

  urgencia: "alta" | "media" | "baixa" | null;

  tem_checklist: boolean | null;
  tem_anexo: boolean | null;

  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;

  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_nivel: string | null;
};

type FiltroStatus =
  | "todas"
  | "nao_iniciada"
  | "em_execucao"
  | "pausada"
  | "finalizada";

export function N2ListarRotinas({ perfil, onAbrirExecucao }: Props) {
  const [rotinas, setRotinas] = useState<RotinaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroMinha, setFiltroMinha] = useState<"todas" | "minhas">("todas");

  // ------------------------------------------------------------------
  // CARREGAR ROTINAS DO N2 (somente da sua regional)
  // ------------------------------------------------------------------
  useEffect(() => {
    void carregarRotinas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.regional_id, perfil.id]);

  const carregarRotinas = async () => {
    if (!perfil.regional_id) {
      setRotinas([]);
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      let q = supabase
        .from("rotinas")
        .select(
          `
          id,
          titulo,
          descricao,
          tipo,
          periodicidade,
          dia_semana,
          data_inicio,
          horario_inicio,
          duracao_minutos,
          urgencia,
          tem_checklist,
          tem_anexo,
          departamento_id,
          setor_id,
          regional_id,
          responsavel_id,
          responsavel:usuarios!rotinas_responsavel_id_fkey(
            id,
            nome,
            nivel
          )
        `
        );

      if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);
      if (perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);

      const { data, error } = await q.order("data_inicio", { ascending: true }).order("horario_inicio", { ascending: true });

      if (error) throw error;

      const lista: RotinaRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        titulo: String(r.titulo ?? ""),
        descricao: (r.descricao ?? null) as string | null,

        tipo: (r.tipo ?? "normal") as RotinaRow["tipo"],
        periodicidade: (r.periodicidade ?? "diaria") as RotinaRow["periodicidade"],
        dia_semana: (r.dia_semana ?? null) as string | null,

        data_inicio: (r.data_inicio ?? null) as string | null,
        horario_inicio: (r.horario_inicio ?? null) as string | null,
        duracao_minutos: (r.duracao_minutos ?? null) as number | null,

        urgencia: (r.urgencia ?? "media") as RotinaRow["urgencia"],

        tem_checklist: !!r.tem_checklist,
        tem_anexo: !!r.tem_anexo,

        departamento_id: r.departamento_id ?? null,
        setor_id: r.setor_id ?? null,
        regional_id: r.regional_id ?? null,

        responsavel_id: r.responsavel_id ? String(r.responsavel_id) : null,
        responsavel_nome: r.responsavel?.nome ?? null,
        responsavel_nivel: r.responsavel?.nivel ?? null,
      }));

      const filtradas = lista.filter((r) => {
        if (r.responsavel_id === perfil.id) return true;
        return r.responsavel_nivel === "N3";
      });
      setRotinas(filtradas);
    } catch (e: any) {
      console.error("Erro ao carregar rotinas N2:", e);
      setErro(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // FILTROS EM MEMÓRIA
  // ------------------------------------------------------------------
  const rotinasFiltradas = useMemo(() => {
    let lista = [...rotinas];

    // ✅ filtro "minhas" correto (responsável = usuário logado)
    if (filtroMinha === "minhas") {
      lista = lista.filter((r) => r.responsavel_id === perfil.id);
    }

    // placeholder: filtroStatus pode ser ligado depois com rotina_execucoes
    if (filtroStatus !== "todas") {
      // manter por enquanto
    }

    return lista;
  }, [rotinas, filtroMinha, filtroStatus, perfil.id]);

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <N2CriarRotina usuarioLogado={perfil} />
      </div>
      <h2 style={{ marginTop: 0, color: theme.colors.neonGreen }}>
        Rotinas & Execução – Nível 2
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: theme.colors.textMuted }}>
        Visualize as rotinas da sua <strong>regional</strong> e da sua equipe (N3).
        O N2 pode <strong>executar</strong> apenas quando for o responsável; caso contrário, abre em <strong>somente leitura</strong>.
      </p>

      {/* filtros simples */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 11,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setFiltroMinha((prev) => (prev === "todas" ? "minhas" : "todas"))
          }
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${theme.colors.borderSoft}`,
            background:
              filtroMinha === "minhas"
                ? "rgba(34,197,94,0.15)"
                : "transparent",
            color:
              filtroMinha === "minhas"
                ? theme.colors.neonGreen
                : theme.colors.textSoft,
            cursor: "pointer",
          }}
        >
          {filtroMinha === "minhas" ? "Mostrar todas" : "Mostrar apenas minhas"}
        </button>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            border: `1px solid ${theme.colors.borderSoft}`,
            background: "rgba(15,23,42,0.9)",
            color: theme.colors.textSoft,
          }}
        >
          <option value="todas">Todas</option>
          <option value="nao_iniciada">Não iniciada</option>
          <option value="em_execucao">Em execução</option>
          <option value="pausada">Pausada</option>
          <option value="finalizada">Finalizada</option>
        </select>
      </div>

      {erro && (
        <p style={{ color: "#fecaca", fontSize: 12, marginTop: 8 }}>
          Erro ao carregar rotinas: {erro}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#e5e7eb", fontSize: 13, marginTop: 8 }}>
          Carregando rotinas da regional…
        </p>
      ) : rotinasFiltradas.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 8 }}>
          Nenhuma rotina encontrada para sua regional.
        </p>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {rotinasFiltradas.map((r) => {
            const periodicidade =
              r.tipo === "avulsa"
                ? "AVULSA"
                : (r.periodicidade ?? "diaria").toUpperCase();

            const dataLabel = r.data_inicio
              ? new Date(r.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
              : "Sem data";

            const horaLabel = r.horario_inicio?.substring(0, 5) ?? "--:--";
            const duracao = r.duracao_minutos ?? 0;

            const isMinha = r.responsavel_id === perfil.id;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onAbrirExecucao(r)}
                style={{
                  ...styles.card,
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: isMinha
                    ? "rgba(34,197,94,0.35)"
                    : "rgba(148,163,184,0.25)",
                  background: isMinha
                    ? "radial-gradient(circle at top left, rgba(34,197,94,0.16), #020617)"
                    : "radial-gradient(circle at top left, rgba(148,163,184,0.10), #020617)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {r.titulo}
                    </div>
                    {r.descricao && (
                      <div
                        style={{
                          fontSize: 11,
                          color: theme.colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {r.descricao}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: `1px solid ${theme.colors.neonGreen}`,
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: theme.colors.neonGreen,
                    }}
                  >
                    {periodicidade}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: theme.colors.textMuted,
                    marginTop: 8,
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    <strong>Data:</strong> {dataLabel} •{" "}
                    <strong>Horário:</strong> {horaLabel} •{" "}
                    <strong>Duração:</strong> {duracao} min
                  </div>

                  <div>
                    <strong>Responsável:</strong>{" "}
                    {r.responsavel_nome
                      ? `${r.responsavel_nome} (${r.responsavel_nivel})`
                      : "—"}
                    {" "}
                    •{" "}
                    <strong>Modo:</strong> {isMinha ? "Executar" : "Somente leitura"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default N2ListarRotinas;
