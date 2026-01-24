import { useEffect, useMemo, useState } from "react";
import type { Usuario } from "../types";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../styles";

type Props = {
  perfil: Usuario; // N1
};

type Execucao = {
  id: number;
  rotina_id: string;
  inicio_em: string | null;
  finalizado_em: string | null;
};

type RotinaKPI = {
  id: string;
  titulo: string;
  descricao: string | null;
  periodicidade: "DIARIA" | "SEMANAL" | "MENSAL" | string;
  setor_id: number | null;
  regional_id: number | null;
  responsavel_id: string;
  responsavel_nivel: "N2" | "N3" | string;
  responsavel_nome: string;
  regional_nome: string | null;
  setor_nome: string;
  execucoes: Execucao[];
};

type FiltroPeriodo = "HOJE" | "7D" | "30D";
type FiltroResponsavelNivel = "TODOS" | "N2" | "N3";

export function N1ExecucaoPorRegional({ perfil }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rotinas, setRotinas] = useState<RotinaKPI[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("HOJE");
  const [filtroNivel, setFiltroNivel] =
    useState<FiltroResponsavelNivel>("TODOS");
  const [filtroResponsavelId, setFiltroResponsavelId] =
    useState<string>("TODOS");

  // ⏱ intervalo de datas baseado no filtro
  const intervaloDatas = useMemo(() => {
    const agora = new Date();
    const fim = new Date(agora);
    const inicio = new Date(agora);

    if (filtroPeriodo === "HOJE") {
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);
    } else if (filtroPeriodo === "7D") {
      inicio.setDate(inicio.getDate() - 7);
    } else if (filtroPeriodo === "30D") {
      inicio.setDate(inicio.getDate() - 30);
    }

    return {
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
    };
  }, [filtroPeriodo]);

  // 🔄 carga inicial
  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervaloDatas.inicioISO, intervaloDatas.fimISO]);

  // 🔔 realtime na tabela de execuções
  useEffect(() => {
    const channel = supabase
      .channel("kpi-execucao-por-regional")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rotina_execucoes",
        },
        () => {
          carregarDados(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarDados(showLoading = true) {
    try {
      if (showLoading) setCarregando(true);
      setErro(null);

      // 1) Rotinas – por enquanto SEM filtro de hierarquia
      let rq = supabase
        .from("rotinas")
        .select(
          `
          id,
          titulo,
          descricao,
          periodicidade,
          setor_id,
          regional_id,
          responsavel_id,
          responsavel:usuarios!rotinas_responsavel_id_fkey(
            id,
            nome,
            nivel
          ),
          regional:regionais(
            id,
            nome
          ),
          setor:setores(
            id,
            nome
          )
        `
        );
      if (perfil.departamento_id) rq = rq.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) rq = rq.eq("setor_id", perfil.setor_id);

      const { data: rotinasData, error: rotinasError } = await rq;

      if (rotinasError) throw rotinasError;

      console.log(
        "[KPI N1] Rotinas carregadas (SEM filtro hierarquia):",
        rotinasData ? rotinasData.length : 0,
        rotinasData
      );

      if (!rotinasData || rotinasData.length === 0) {
        setRotinas([]);
        return;
      }

      const rotinaIds = rotinasData.map((r: any) => r.id);

      // 2) Execuções dessas rotinas (sem coluna status)
      const { data: execucoesData, error: execucoesError } = await supabase
        .from("rotina_execucoes")
        .select("id, rotina_id, inicio_em, finalizado_em")
        .in("rotina_id", rotinaIds);

      if (execucoesError) throw execucoesError;

      console.log(
        "[KPI N1] Execuções carregadas:",
        execucoesData ? execucoesData.length : 0,
        execucoesData
      );

      const mapaExecucoes = new Map<string, Execucao[]>();
      (execucoesData ?? []).forEach((e: any) => {
        const arr = mapaExecucoes.get(e.rotina_id) ?? [];
        arr.push({
          id: e.id,
          rotina_id: e.rotina_id,
          inicio_em: e.inicio_em,
          finalizado_em: e.finalizado_em,
        });
        mapaExecucoes.set(e.rotina_id, arr);
      });

      const mapeadas: RotinaKPI[] = (rotinasData ?? []).map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        periodicidade: r.periodicidade,
        setor_id: r.setor_id ?? null,
        regional_id: r.regional_id ?? null,
        responsavel_id: r.responsavel_id,
        responsavel_nivel: r.responsavel?.nivel ?? "N3",
        responsavel_nome: r.responsavel?.nome ?? "Sem responsável",
        regional_nome: r.regional?.nome ?? null,
        setor_nome: r.setor?.nome ?? "Sem setor",
        execucoes: mapaExecucoes.get(r.id) ?? [],
      }));

      const filtradas = mapeadas.filter((r) => ["N2", "N3"].includes(r.responsavel_nivel));
      setRotinas(filtradas);
    } catch (e: any) {
      console.error(e);
      setErro(e.message ?? "Erro ao carregar KPI.");
    } finally {
      if (showLoading) setCarregando(false);
    }
  }

  // 🔎 filtro por período + responsável + cálculo de status
  const rotinasFiltradas = useMemo(() => {
    const { inicioISO, fimISO } = intervaloDatas;

    return rotinas
      .filter((rotina) => {
        // filtro N2 / N3
        if (filtroNivel !== "TODOS" && rotina.responsavel_nivel !== filtroNivel) {
          return false;
        }

        // filtro por responsável específico
        if (
          filtroResponsavelId !== "TODOS" &&
          rotina.responsavel_id !== filtroResponsavelId
        ) {
          return false;
        }

        const todasExecucoes = rotina.execucoes ?? [];

        // Se não tem execução ainda, mostra mesmo assim (planejada / pendente)
        if (todasExecucoes.length === 0) {
          return true;
        }

        // Se tiver execuções:
        const execucoesNoPeriodo = todasExecucoes.filter((exec) => {
          const refDate = exec.finalizado_em ?? exec.inicio_em;
          if (!refDate) return true; // pendente entra em qualquer período

          return refDate >= inicioISO && refDate <= fimISO;
        });

        return execucoesNoPeriodo.length > 0;
      })
      .map((rotina) => {
        const execsOrdenadas = [...(rotina.execucoes ?? [])].sort((a, b) => {
          const da = a.inicio_em ?? a.finalizado_em ?? "";
          const db = b.inicio_em ?? b.finalizado_em ?? "";
          return da.localeCompare(db);
        });

        const ultimaExecucao =
          execsOrdenadas.length > 0
            ? execsOrdenadas[execsOrdenadas.length - 1]
            : undefined;

        // 🔁 Calcula status a partir das datas
        let statusFinal: "FINALIZADA" | "EM ANDAMENTO" | "PENDENTE" =
          "PENDENTE";

        if (ultimaExecucao) {
          if (ultimaExecucao.finalizado_em) {
            statusFinal = "FINALIZADA";
          } else if (ultimaExecucao.inicio_em) {
            statusFinal = "EM ANDAMENTO";
          } else {
            statusFinal = "PENDENTE";
          }
        }

        return {
          ...rotina,
          statusCalculado: statusFinal,
          ultimaExecucao,
        } as RotinaKPI & {
          statusCalculado: "FINALIZADA" | "EM ANDAMENTO" | "PENDENTE";
          ultimaExecucao?: Execucao;
        };
      });
  }, [rotinas, intervaloDatas, filtroNivel, filtroResponsavelId]);

  // lista de responsáveis para o filtro
  const responsaveisUnicos = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string }>();
    rotinas.forEach((r) => {
      if (r.responsavel_id) {
        mapa.set(r.responsavel_id, {
          id: r.responsavel_id,
          nome: r.responsavel_nome,
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [rotinas]);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          borderRadius: 24,
          padding: 24,
          boxSizing: "border-box",
          background: theme.colors.cardBackground ?? "#050505",
          border: `1px solid ${theme.colors.neonGreen ?? "#39ff14"}`,
          boxShadow: `0 0 12px ${
            theme.colors.neonGreen ?? "rgba(57, 255, 20, 0.7)"
          }`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              color: theme.colors.neonOrange ?? "#ff8800",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            KPI – Execução por Regional (Nível 1)
          </h2>

          {/* filtros topo */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* período */}
            <select
              value={filtroPeriodo}
              onChange={(e) =>
                setFiltroPeriodo(e.target.value as FiltroPeriodo)
              }
              style={estiloSelect}
            >
              <option value="HOJE">Hoje</option>
              <option value="7D">Últimos 7 dias</option>
              <option value="30D">Últimos 30 dias</option>
            </select>

            {/* nível responsável */}
            <select
              value={filtroNivel}
              onChange={(e) =>
                setFiltroNivel(e.target.value as FiltroResponsavelNivel)
              }
              style={estiloSelect}
            >
              <option value="TODOS">N2 + N3</option>
              <option value="N2">Somente N2 (gestores)</option>
              <option value="N3">Somente N3 (equipe)</option>
            </select>

            {/* responsável específico */}
            <select
              value={filtroResponsavelId}
              onChange={(e) => setFiltroResponsavelId(e.target.value)}
              style={estiloSelect}
            >
              <option value="TODOS">Todos os responsáveis</option>
              {responsaveisUnicos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {carregando && (
          <p style={{ color: theme.colors.text ?? "#fff" }}>Carregando...</p>
        )}
        {erro && (
          <p style={{ color: theme.colors.danger ?? "#ff4d4f" }}>{erro}</p>
        )}

        {!carregando && !erro && rotinasFiltradas.length === 0 && (
          <p style={{ color: theme.colors.textMuted ?? "#999" }}>
            Nenhuma rotina encontrada para o período e filtros selecionados.
          </p>
        )}

        {!carregando && !erro && rotinasFiltradas.length > 0 && (
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {rotinasFiltradas.map((rotina: any) => (
              <div key={rotina.id} style={estiloCard}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <strong
                    style={{
                      color: theme.colors.text ?? "#fff",
                      fontSize: 14,
                    }}
                  >
                    {rotina.titulo}
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: `1px solid ${
                        theme.colors.neonOrange ?? "#ff8800"
                      }`,
                      textTransform: "uppercase",
                    }}
                  >
                    {rotina.periodicidade}
                  </span>
                </div>

                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 70,
                      color: theme.colors.textMuted ?? "#aaa",
                    }}
                  >
                    Regional:
                  </span>
                  <span>
                    {rotina.regional_nome ?? "Sem regional (⚠ verificar)"}
                  </span>
                </div>

                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 70,
                      color: theme.colors.textMuted ?? "#aaa",
                    }}
                  >
                    Setor:
                  </span>
                  <span>{rotina.setor_nome}</span>
                </div>

                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 70,
                      color: theme.colors.textMuted ?? "#aaa",
                    }}
                  >
                    Resp.:
                  </span>
                  <span>
                    {rotina.responsavel_nome} ({rotina.responsavel_nivel})
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                    gap: 8,
                  }}
                >
                  <StatusPill status={rotina.statusCalculado} />

                  {rotina.ultimaExecucao?.inicio_em && (
                    <span
                      style={{
                        fontSize: 11,
                        color: theme.colors.textMuted ?? "#aaa",
                      }}
                    >
                      Última:{" "}
                      {new Date(
                        rotina.ultimaExecucao.inicio_em
                      ).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const estiloSelect: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  borderRadius: 999,
  border: "1px solid #39ff14",
  padding: "4px 10px",
  fontSize: 12,
  outline: "none",
};

const estiloCard: React.CSSProperties = {
  borderRadius: 18,
  padding: 12,
  border: "1px solid #39ff14",
  boxShadow: "0 0 8px rgba(57,255,20,0.4)",
  background:
    "radial-gradient(circle at top left, rgba(255,136,0,0.2), transparent 55%), #050505",
  fontSize: 12,
};

type StatusPillProps = {
  status: "FINALIZADA" | "EM ANDAMENTO" | "PENDENTE";
};

function StatusPill({ status }: StatusPillProps) {
  let label = status;
  let border = "#999";
  let glow = "rgba(153,153,153,0.5)";

  if (status === "FINALIZADA") {
    label = "Finalizada";
    border = "#39ff14";
    glow = "rgba(57,255,20,0.7)";
  } else if (status === "EM ANDAMENTO") {
    label = "Em andamento";
    border = "#ff8800";
    glow = "rgba(255,136,0,0.7)";
  } else if (status === "PENDENTE") {
    label = "Pendente";
    border = "#ff4d4f";
    glow = "rgba(255,77,79,0.7)";
  }

  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        boxShadow: `0 0 8px ${glow}`,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}
