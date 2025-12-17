// src/components/KpiAgenda.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles, theme } from "../styles";

type FiltroKpi = "minhas" | "equipe" | "setor";
type JanelaKpi = "hoje" | "7dias" | "30dias" | "mes";

type Props = {
  perfil: Usuario;
};

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string; // "avulsa" | "normal"
  periodicidade: string; // "diaria" | "semanal" | "mensal" | ...
  data_inicio: string; // YYYY-MM-DD
  dia_semana: string | null; // 1..7 (dom..sab) como string
  horario_inicio: string | null; // "HH:MM"
  duracao_minutos: number | null;
  urgencia: string | null;
  responsavel_id: string;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  tem_checklist: boolean;
  tem_anexo: boolean;
};

type Execucao = {
  id: number;
  rotina_id: string;
  executor_id: string;
  created_at: string; // timestamptz
  inicio_em: string | null;
  pausado_em: string | null;
  finalizado_em: string | null;
};

type RegionalOption = { id: number; nome: string };
type UsuarioOption = { id: string; nome: string };

// 🔧 Se sua tabela for outra, ajuste aqui:
const USUARIOS_TABLE = "usuarios";

// regra do KPI (fixo pelo que você definiu)
const DEFAULT_DURACAO_MIN = 30;

// =======================
// Helpers de data (LOCAL)
// =======================
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalYMD() {
  return ymdLocal(new Date());
}

function addDaysYMD(dateISO: string, delta: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return ymdLocal(d);
}

function weekday_1_7(dateISO: string): string {
  // JS: 0..6 (dom..sab) -> 1..7
  const d = new Date(`${dateISO}T00:00:00`);
  const js = d.getDay();
  return String(js === 0 ? 1 : js + 1);
}

function dayOfMonth(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDate();
}

function startOfDayLocalToUTC(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toISOString();
}

function endOfDayLocalToUTCExclusive(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function startOfMonthYMD(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(1);
  return ymdLocal(d);
}

function endOfMonthYMD(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return ymdLocal(d);
}

function minutesDiff(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

// ===========================================
// Expansão de recorrência em memória (por dia)
// ===========================================
function buildAgendaDoDia(rotinasBase: Rotina[], dateISO: string) {
  const domAlvo = dayOfMonth(dateISO);
  const dow = weekday_1_7(dateISO);

  return rotinasBase.filter((r) => {
    if (r.tipo === "avulsa") return r.data_inicio === dateISO;

    const p = (r.periodicidade ?? "").toLowerCase();
    if (!r.data_inicio) return false;

    if (p === "diaria") return r.data_inicio <= dateISO;

    if (p === "semanal") {
      return r.data_inicio <= dateISO && String(r.dia_semana ?? "") === dow;
    }

    if (p === "mensal") {
      if (r.data_inicio > dateISO) return false;
      return dayOfMonth(r.data_inicio) === domAlvo;
    }

    // fallback: somente no dia exato
    return r.data_inicio === dateISO;
  });
}
export function KpiAgenda({ perfil }: Props) {
  const [janela, setJanela] = useState<JanelaKpi>("7dias");
  const [dataRef, setDataRef] = useState(() => todayLocalYMD());

  // filtro padrão por nível (como você pediu)
  const filtroPadrao = useMemo((): FiltroKpi => {
    if (perfil.nivel === "N3") return "minhas";
    if (perfil.nivel === "N2") return "equipe";
    // N1 enxerga “nacional” por padrão
    return "setor";
  }, [perfil.nivel]);

  const [filtro, setFiltro] = useState<FiltroKpi>(filtroPadrao);

  // extras:
  // N1: regional + usuário
  // N2: usuário (somente usuários da regional)
  // N3: nenhum
  const podeFiltrarRegional = perfil.nivel === "N1";
  const podeFiltrarUsuario = perfil.nivel === "N1" || perfil.nivel === "N2";

  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [filtroRegional, setFiltroRegional] = useState<number | "todas">("todas");
  const [filtroUsuario, setFiltroUsuario] = useState<string | "todos">("todos");

  const [usuarioNomeMap, setUsuarioNomeMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // resultado do KPI (cards + séries)
  const [kpi, setKpi] = useState<{
    periodo: { ini: string; fim: string };
    totalProgramadas: number;
    totalExecutadas: number;
    taxaExecucao: number;
    tempoProgMin: number;
    tempoExecMin: number;
    aderenciaTempo: number;
    pendentes: number;
    finalizadas: number;
    porDia: { dia: string; programadas: number; executadas: number; tempoProgMin: number; tempoExecMin: number }[];
    porUsuario: { id: string; nome: string; programadas: number; executadas: number; taxa: number; tempoExecMin: number }[];
  } | null>(null);

  // mantém filtro padrão atualizado quando troca perfil
  useEffect(() => {
    setFiltro(filtroPadrao);
    if (perfil.nivel !== "N1") setFiltroRegional("todas");
    if (perfil.nivel === "N3") setFiltroUsuario("todos");
  }, [filtroPadrao, perfil.nivel]);

  // carregar regionais (somente N1)
  useEffect(() => {
    if (!podeFiltrarRegional) return;

    const loadRegionais = async () => {
      try {
        const { data, error } = await supabase.from("regionais").select("id,nome").order("nome", { ascending: true });
        if (!error && data) {
          setRegionais(data.map((r: any) => ({ id: Number(r.id), nome: String(r.nome ?? `Regional ${r.id}`) })));
        }
      } catch {
        // silencioso
      }
    };

    void loadRegionais();
  }, [podeFiltrarRegional]);

  // carregar usuários (N1/N2)
  // Regras:
  // - sempre filtra por departamento/setor do perfil
  // - N2: sempre trava na regional do N2
  // - N1: se filtroRegional != todas, filtra usuários daquela regional
  useEffect(() => {
    if (!podeFiltrarUsuario) return;

    const loadUsuarios = async () => {
      try {
        let uq = supabase
          .from(USUARIOS_TABLE)
          .select("id,nome,nivel,departamento_id,setor_id,regional_id,ativo")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (perfil.departamento_id) uq = uq.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) uq = uq.eq("setor_id", perfil.setor_id);

        if (perfil.nivel === "N2" && perfil.regional_id) {
          uq = uq.eq("regional_id", perfil.regional_id);
        }

        if (perfil.nivel === "N1" && filtroRegional !== "todas") {
          uq = uq.eq("regional_id", filtroRegional);
        }

        uq = uq.in("nivel", ["N1", "N2", "N3"] as any);

        const { data, error } = await uq;

        if (!error && data) {
          const list = data.map((u: any) => ({ id: String(u.id), nome: String(u.nome) }));
          setUsuarios(list);

          const map: Record<string, string> = {};
          for (const u of data as any[]) map[String(u.id)] = String(u.nome);
          setUsuarioNomeMap((prev) => ({ ...prev, ...map }));

          if (filtroUsuario !== "todos" && !list.some((x) => x.id === filtroUsuario)) {
            setFiltroUsuario("todos");
          }
        }
      } catch {
        // silencioso
      }
    };

    void loadUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeFiltrarUsuario, perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id, filtroRegional]);

  const getPeriodo = useMemo(() => {
    const hoje = dataRef;
    if (janela === "hoje") return { ini: hoje, fim: hoje };
    if (janela === "7dias") return { ini: addDaysYMD(hoje, -6), fim: hoje };
    if (janela === "30dias") return { ini: addDaysYMD(hoje, -29), fim: hoje };
    // mês
    return { ini: startOfMonthYMD(hoje), fim: endOfMonthYMD(hoje) };
  }, [janela, dataRef]);

  const carregarKpi = async () => {
    try {
      setLoading(true);
      setErro(null);

      const { ini, fim } = getPeriodo;

      // 1) buscar rotinas base (com regras por nível/filtro)
      let q = supabase
        .from("rotinas")
        .select(
          `
          id, titulo, descricao, tipo, periodicidade,
          data_inicio, dia_semana, horario_inicio, duracao_minutos,
          urgencia, responsavel_id, departamento_id, setor_id, regional_id,
          tem_checklist, tem_anexo
        `
        )
        // pega as recorrentes que possam impactar o período e as avulsas do período
        .or(
          [
            `and(tipo.eq.avulsa,data_inicio.gte.${ini},data_inicio.lte.${fim})`,
            `and(tipo.eq.normal,data_inicio.lte.${fim})`,
          ].join(",")
        );

      // ✅ hierarquia (mesma ideia da Agenda)
      if (filtro === "minhas") {
        q = q.eq("responsavel_id", perfil.id);
      } else if (filtro === "equipe") {
        if (perfil.nivel === "N2") {
          if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
          if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);
          if (perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);
        } else if (perfil.nivel === "N1") {
          if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
          if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);
        }
      } else if (filtro === "setor") {
        if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);
      }

      // ✅ filtros extras por nível
      if (perfil.nivel === "N1" && filtroRegional !== "todas") {
        q = q.eq("regional_id", filtroRegional);
      }

      if ((perfil.nivel === "N1" || perfil.nivel === "N2") && filtroUsuario !== "todos") {
        q = q.eq("responsavel_id", filtroUsuario);
      }

      // 🔒 N3 sempre “só dele”, independente de chip
      if (perfil.nivel === "N3") {
        q = q.eq("responsavel_id", perfil.id);
      }

      const { data: rotData, error: rotErr } = await q;
      if (rotErr) {
        console.error(rotErr);
        setErro("Erro ao carregar rotinas para o KPI.");
        return;
      }

      let rotinas = (rotData as Rotina[]) ?? [];

      // 2) expandir ocorrências dia a dia no período
      const dias: string[] = [];
      const totalDias = Math.max(1, Math.round((new Date(fim + "T00:00:00").getTime() - new Date(ini + "T00:00:00").getTime()) / 86400000) + 1);
      for (let i = 0; i < totalDias; i++) dias.push(addDaysYMD(ini, i));

      // porDia programadas
      const programadasPorDia = new Map<string, Rotina[]>();
      for (const d of dias) {
        const rotDia = buildAgendaDoDia(rotinas, d);
        programadasPorDia.set(d, rotDia);
      }

      // 3) buscar execuções finalizadas no período
      const rotinasIdsPeriodo = Array.from(
        new Set(
          dias.flatMap((d) => (programadasPorDia.get(d) ?? []).map((r) => r.id)).filter(Boolean)
        )
      );

      let execucoesFinalizadas: Execucao[] = [];

      if (rotinasIdsPeriodo.length) {
        const { data: exData, error: exErr } = await supabase
          .from("rotina_execucoes")
          .select("id,rotina_id,executor_id,created_at,inicio_em,pausado_em,finalizado_em")
          .in("rotina_id", rotinasIdsPeriodo)
          .gte("created_at", startOfDayLocalToUTC(ini))
          .lt("created_at", endOfDayLocalToUTCExclusive(fim))
          .not("finalizado_em", "is", null)
          .order("id", { ascending: false });

        if (exErr) {
          console.error(exErr);
          setErro("Erro ao carregar execuções finalizadas (KPI).");
        } else {
          execucoesFinalizadas = (exData as Execucao[]) ?? [];
        }
      }

      // 4) map rotina_id::diaLocal -> execução (pega a mais recente do dia)
      const execMap = new Map<string, Execucao>();
      for (const ex of execucoesFinalizadas) {
        const diaLocal = ymdLocal(new Date(ex.created_at));
        const key = `${ex.rotina_id}::${diaLocal}`;
        if (!execMap.has(key)) execMap.set(key, ex);
      }

      // 5) garantir nome do responsável no card/ranking
      try {
        const respIds = Array.from(new Set(rotinas.map((r) => r.responsavel_id).filter(Boolean)));
        const falt = respIds.filter((id) => !usuarioNomeMap[id]);
        if (falt.length) {
          const { data: uData } = await supabase.from(USUARIOS_TABLE).select("id,nome").in("id", falt as any);
          if (uData) {
            const add: Record<string, string> = {};
            for (const u of uData as any[]) add[String(u.id)] = String(u.nome);
            setUsuarioNomeMap((prev) => ({ ...prev, ...add }));
          }
        }
      } catch {
        // silencioso
      }

      // 6) agregações
      let totalProgramadas = 0;
      let totalExecutadas = 0;
      let tempoProgMin = 0;
      let tempoExecMin = 0;

      const porDia = dias.map((d) => {
        const rotDia = programadasPorDia.get(d) ?? [];
        let prog = rotDia.length;
        let exec = 0;
        let tProg = 0;
        let tExec = 0;

        for (const r of rotDia) {
          const dur = r.duracao_minutos ?? DEFAULT_DURACAO_MIN;
          tProg += dur;

          const ex = execMap.get(`${r.id}::${d}`);
          if (ex?.finalizado_em && ex.inicio_em) {
            exec += 1;
            tExec += minutesDiff(ex.inicio_em, ex.finalizado_em);
          }
        }

        totalProgramadas += prog;
        totalExecutadas += exec;
        tempoProgMin += tProg;
        tempoExecMin += tExec;

        return { dia: d, programadas: prog, executadas: exec, tempoProgMin: tProg, tempoExecMin: tExec };
      });

      const pendentes = Math.max(0, totalProgramadas - totalExecutadas);
      const finalizadas = totalExecutadas;

      const taxaExecucao = totalProgramadas > 0 ? totalExecutadas / totalProgramadas : 0;
      const aderenciaTempo = tempoProgMin > 0 ? tempoExecMin / tempoProgMin : 0;

      // ranking por usuário
      const aggUser = new Map<string, { id: string; nome: string; programadas: number; executadas: number; tempoExecMin: number }>();

      for (const d of dias) {
        const rotDia = programadasPorDia.get(d) ?? [];
        for (const r of rotDia) {
          const uid = r.responsavel_id;
          const nome = usuarioNomeMap[uid] ?? "Usuário";

          if (!aggUser.has(uid)) aggUser.set(uid, { id: uid, nome, programadas: 0, executadas: 0, tempoExecMin: 0 });
          const reg = aggUser.get(uid)!;

          reg.programadas += 1;

          const ex = execMap.get(`${r.id}::${d}`);
          if (ex?.finalizado_em && ex.inicio_em) {
            reg.executadas += 1;
            reg.tempoExecMin += minutesDiff(ex.inicio_em, ex.finalizado_em);
          }
        }
      }

      const porUsuario = Array.from(aggUser.values())
        .map((u) => ({
          ...u,
          taxa: u.programadas > 0 ? u.executadas / u.programadas : 0,
        }))
        .sort((a, b) => b.executadas - a.executadas);

      setKpi({
        periodo: { ini, fim },
        totalProgramadas,
        totalExecutadas,
        taxaExecucao,
        tempoProgMin,
        tempoExecMin,
        aderenciaTempo,
        pendentes,
        finalizadas,
        porDia,
        porUsuario,
      });
    } catch (e) {
      console.error(e);
      setErro("Erro inesperado ao calcular KPI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janela, dataRef, filtro, filtroRegional, filtroUsuario, perfil.id, perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id]);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const renderChip = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: active ? `1px solid ${theme.colors.neonGreen ?? "rgba(34,197,94,0.9)"}` : "1px solid rgba(148,163,184,0.4)",
        background: active ? "rgba(34,197,94,0.15)" : "rgba(15,23,42,0.9)",
        color: active ? "#bbf7d0" : "#e5e7eb",
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const tituloPeriodo = useMemo(() => {
    const ini = kpi?.periodo.ini ?? getPeriodo.ini;
    const fim = kpi?.periodo.fim ?? getPeriodo.fim;
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
    return `${fmt(ini)} → ${fmt(fim)}`;
  }, [kpi, getPeriodo.ini, getPeriodo.fim]);

  // mini gráfico simples (barras)
  const maxDia = useMemo(() => {
    if (!kpi?.porDia?.length) return 1;
    return Math.max(...kpi.porDia.map((x) => x.programadas), 1);
  }, [kpi]);
  return (
    <div>
      {/* Topo: filtros */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e5e7eb" }}>KPI</div>

          <input
            type="date"
            value={dataRef}
            onChange={(e) => setDataRef(e.target.value)}
            style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 150 }}
            title="Data referência"
          />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {renderChip(janela === "hoje", "Hoje", () => setJanela("hoje"))}
            {renderChip(janela === "7dias", "7 dias", () => setJanela("7dias"))}
            {renderChip(janela === "30dias", "30 dias", () => setJanela("30dias"))}
            {renderChip(janela === "mes", "Mês", () => setJanela("mes"))}
          </div>

          <div style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>{tituloPeriodo}</div>

          {/* filtros extras por nível */}
          {(perfil.nivel === "N1" || perfil.nivel === "N2") && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 6, alignItems: "center" }}>
              {/* Regional: só N1 */}
              {perfil.nivel === "N1" && (
                <select
                  value={String(filtroRegional)}
                  onChange={(e) => setFiltroRegional(e.target.value === "todas" ? "todas" : Number(e.target.value))}
                  style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 220 }}
                  title="Filtrar por regional"
                >
                  <option value="todas">Todas regionais</option>
                  {regionais.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              )}

              {/* Usuário: N1 e N2 */}
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value as any)}
                style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 260 }}
                title="Filtrar por usuário"
              >
                <option value="todos">Todos usuários</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>

              {(filtroUsuario !== "todos" || (perfil.nivel === "N1" && filtroRegional !== "todas")) && (
                <button
                  type="button"
                  onClick={() => {
                    if (perfil.nivel === "N1") setFiltroRegional("todas");
                    setFiltroUsuario("todos");
                  }}
                  style={{ ...styles.buttonSecondary, padding: "4px 10px", fontSize: 12 }}
                  title="Limpar filtros"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* chips de escopo */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* N3 é sempre minhas */}
          {perfil.nivel === "N3" && renderChip(true, "Minhas", () => setFiltro("minhas"))}

          {perfil.nivel !== "N3" && (
            <>
              {renderChip(filtro === "minhas", "Minhas", () => setFiltro("minhas"))}
              {renderChip(filtro === "equipe", perfil.nivel === "N2" ? "Equipe (regional)" : "Equipe (setor)", () => setFiltro("equipe"))}
              {perfil.nivel === "N1" && renderChip(filtro === "setor", "Nacional", () => setFiltro("setor"))}
            </>
          )}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>Calculando KPI…</p>}
      {erro && <p style={{ fontSize: 13, color: "#fecaca", marginBottom: 8 }}>{erro}</p>}

      {/* Cards KPI */}
      {kpi && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Taxa de execução</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#bbf7d0" }}>{pct(kpi.taxaExecucao)}</div>
              <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                {kpi.totalExecutadas} / {kpi.totalProgramadas}
              </div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Tempo programado</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#e5e7eb" }}>{kpi.tempoProgMin} min</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Padrão: 30 min quando vazio</div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Tempo executado</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#e5e7eb" }}>{kpi.tempoExecMin} min</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Conta só finalizadas</div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Aderência de tempo</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#93c5fd" }}>{pct(kpi.aderenciaTempo)}</div>
              <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                {kpi.tempoExecMin} / {kpi.tempoProgMin} min
              </div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Pendentes</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#7dd3fc" }}>{kpi.pendentes}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Sem finalização no período</div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Finalizadas</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{kpi.finalizadas}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Somente `finalizado_em`</div>
            </div>
          </div>

          {/* Gráfico por dia: programadas vs executadas */}
          <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#e5e7eb" }}>Programadas x Executadas (por dia)</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Barras: Programadas (base) | Executadas (topo)</div>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingTop: 10 }}>
              {kpi.porDia.map((d) => {
                const progH = Math.round((d.programadas / maxDia) * 70);
                const execH = d.programadas > 0 ? Math.round((d.executadas / d.programadas) * progH) : 0;

                const label = new Date(d.dia + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

                return (
                  <div key={d.dia} style={{ minWidth: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ height: 76, width: 18, position: "relative", borderRadius: 8, background: "rgba(148,163,184,0.10)", overflow: "hidden" }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: progH, background: "rgba(125,211,252,0.35)" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: execH, background: "rgba(34,197,94,0.55)" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#cbd5e1" }}>
                      {d.executadas}/{d.programadas}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranking por usuário */}
          <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(31,41,55,1)", background: "rgba(15,23,42,0.95)", padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#e5e7eb", marginBottom: 8 }}>Ranking (por usuário)</div>

            {kpi.porUsuario.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Sem dados no período.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {kpi.porUsuario.slice(0, 20).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      borderRadius: 10,
                      border: "1px solid rgba(31,41,55,1)",
                      padding: "8px 10px",
                      background: "rgba(2,6,23,0.25)",
                    }}
                  >
                    <div style={{ minWidth: 220 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#e5e7eb" }}>{u.nome}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>
                        {u.executadas}/{u.programadas} • {pct(u.taxa)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 11, color: "#4ade80" }}>✅ {u.executadas}</div>
                      <div style={{ fontSize: 11, color: "#7dd3fc" }}>📌 {u.programadas}</div>
                      <div style={{ fontSize: 11, color: "#93c5fd" }}>⏱ {u.tempoExecMin} min</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
