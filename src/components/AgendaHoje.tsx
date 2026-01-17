// src/components/AgendaHoje.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles, theme } from "../styles";

type FiltroAgenda = "minhas" | "equipe" | "setor";
type ModoAgenda = "dia" | "7dias";

type Props = {
  perfil: Usuario;
  filtroInicial?: FiltroAgenda;
  // Se false, nÇœo auto-scrolla atÇ¸ a hora atual ao carregar (evita pular a pÇágina quando embutido em dashboards).
  autoScrollToHour?: boolean;
  onAbrirExecucao: (rotina: any) => void;
};

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string; // "avulsa" | "normal"
  periodicidade: string; // "diaria" | "semanal" | "mensal" | ...
  data_inicio: string; // YYYY-MM-DD
  data_fim?: string | null;
  dia_semana: string | null; // 1..7 (dom..sab) como string
  horario_inicio: string | null; // "HH:MM"
  duracao_minutos: number | null;
  urgencia: string | null;
  responsavel_id: string;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  grupo_id: number | null;
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

type ItemAgenda = {
  rotina: Rotina;
  execucao: Execucao | null;
};

type RegionalOption = { id: number; nome: string };
type UsuarioOption = { id: string; nome: string };
type GrupoOption = { id: number; nome: string; departamento_id: number; setor_id: number; regional_id: number | null; ativo: boolean };

// Agenda vista: começa 06:00 e termina 00:00 (meia-noite no fim da lista)
const horasDia = [...Array.from({ length: 18 }, (_, i) => i + 6), 0];

// 🔧 Nome da sua tabela de usuários (no seu SQL: public.usuarios)
const USUARIOS_TABLE = "usuarios";

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
  const d = new Date(`${dateISO}T00:00:00`);
  const js = d.getDay(); // 0..6
  return String(js === 0 ? 1 : js + 1); // 1..7
}
function dayOfMonth(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDate();
}
function matchDiaSemana(raw: string | null, dateISO: string): boolean {
  if (!raw) return false;
  const dow = weekday_1_7(dateISO);
  const parts = String(raw)
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (/^[1-7]$/.test(p)) return p;
      if (["domingo", "dom"].includes(p)) return "1";
      if (["segunda", "seg"].includes(p)) return "2";
      if (["terca", "ter"].includes(p)) return "3";
      if (["quarta", "qua"].includes(p)) return "4";
      if (["quinta", "qui"].includes(p)) return "5";
      if (["sexta", "sex"].includes(p)) return "6";
      if (["sabado", "sab"].includes(p)) return "7";
      return "";
    })
    .filter((p) => p.length > 0);
  return parts.includes(dow);
}
// 00:00 LOCAL -> UTC ISO (para filtrar created_at)
function startOfDayLocalToUTC(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toISOString();
}
// Próximo dia 00:00 LOCAL -> UTC ISO (exclusive)
function endOfDayLocalToUTCExclusive(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// =======================
// Hora atual (local)
// =======================
function nowHM() {
  const d = new Date();
  return { hour: d.getHours(), min: d.getMinutes() };
}

// ===========================================
// Expansão de recorrência em memória (por dia)
// ===========================================
function buildAgendaDoDia(rotinasBase: Rotina[], dateISO: string) {
  const domAlvo = dayOfMonth(dateISO);
  const dow = weekday_1_7(dateISO);
  const dowNum = Number(dow); // 1=domingo, 7=sábado
  return rotinasBase.filter((r) => {
    if (r.data_fim && dateISO > r.data_fim) return false;

    if (r.tipo === "avulsa") return r.data_inicio === dateISO;

    const p = (r.periodicidade ?? "").toLowerCase();
    if (!r.data_inicio) return false;

    if (p === "diaria") {
      // não exibe diária em sábado/domingo
      if (dowNum === 1 || dowNum === 7) return false;
      return r.data_inicio <= dateISO;
    }

    if (p === "semanal") {
      return r.data_inicio <= dateISO && matchDiaSemana(r.dia_semana, dateISO);
    }

    if (p === "mensal") {
      if (r.data_inicio > dateISO) return false;
      return dayOfMonth(r.data_inicio) === domAlvo;
    }

    return r.data_inicio === dateISO;
  });
}
export function AgendaHoje({ perfil, filtroInicial, autoScrollToHour = true, onAbrirExecucao }: Props) {
  const [dataRef, setDataRef] = useState(() => todayLocalYMD());
  const [modo, setModo] = useState<ModoAgenda>("dia");

  const getFiltroPadrao = (): FiltroAgenda => {
    if (filtroInicial) return filtroInicial;
    if (perfil.nivel === "N1") return "setor";
    if (perfil.nivel === "N2") return "equipe";
    return "minhas";
  };

  const [filtro, setFiltro] = useState<FiltroAgenda>(() => getFiltroPadrao());
  const [itens, setItens] = useState<ItemAgenda[]>([]);
  const [semHorario, setSemHorario] = useState<ItemAgenda[]>([]);
  const [agenda7, setAgenda7] = useState<{ data: string; itens: ItemAgenda[]; semHorario: ItemAgenda[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ✅ filtros extras
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [filtroRegional, setFiltroRegional] = useState<number | "todas">("todas"); // só N1
  const [filtroUsuario, setFiltroUsuario] = useState<string | "todos">("todos"); // N1 e N2
  const [filtroGrupo, setFiltroGrupo] = useState<string | "todos">("todos"); // N1 e N2

  // ✅ mapa id->nome p/ exibir no card
  const [usuarioNomeMap, setUsuarioNomeMap] = useState<Record<string, string>>({});
  const [usuarioNivelMap, setUsuarioNivelMap] = useState<Record<string, string>>({});

  const podeFiltrarRegional = perfil.nivel === "N1"; // ✅ N2 escondido
  const podeFiltrarUsuario = perfil.nivel === "N1" || perfil.nivel === "N2";

  // ✅ refs para auto-scroll na hora atual
  const hourRowRefs = useMemo(() => {
    const m = new Map<number, React.RefObject<HTMLDivElement>>();
    for (const h of horasDia) m.set(h, React.createRef<HTMLDivElement>());
    return m;
  }, []);

  const scrollToCurrentHour = (behavior: ScrollBehavior = "auto") => {
    if (modo !== "dia") return;
    if (dataRef !== todayLocalYMD()) return;
    const h = nowHM().hour;
    const ref = hourRowRefs.get(h);
    if (ref?.current) ref.current.scrollIntoView({ behavior, block: "center" });
  };

  useEffect(() => {
    setFiltro(getFiltroPadrao());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.nivel, filtroInicial]);

  // ✅ Carregar regionais (só N1)
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

  // ✅ Carregar usuários para o select (N1/N2)
  // Regras:
  // - exige grupo selecionado (filtroGrupo)
  // - N1: depto/setor + (se filtroRegional != todas) filtra por regional
  // - N2: depto/setor + regional FIXA do N2 (não vaza)
  useEffect(() => {
    if (!podeFiltrarUsuario) return;

    const loadUsuarios = async () => {
      try {
        if (filtroGrupo === "todos") {
          setUsuarios([]);
          if (filtroUsuario !== "todos") setFiltroUsuario("todos");
          return;
        }

        let uq = supabase
          .from(USUARIOS_TABLE)
          .select("id,nome,nivel,departamento_id,setor_id,regional_id,grupo_id,ativo")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (perfil.departamento_id) uq = uq.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) uq = uq.eq("setor_id", perfil.setor_id);
        uq = uq.eq("grupo_id", Number(filtroGrupo));

        // ✅ N2: trava na própria regional
        if (perfil.nivel === "N2" && perfil.regional_id) uq = uq.eq("regional_id", perfil.regional_id);

        // ✅ N1: se escolheu uma regional, filtra usuários por ela
        if (perfil.nivel === "N1" && filtroRegional !== "todas") uq = uq.eq("regional_id", filtroRegional);

        uq = uq.in("nivel", ["N1", "N2", "N3"] as any);

        const { data, error } = await uq;
        if (!error && data) {
          const list = data.map((u: any) => ({ id: String(u.id), nome: String(u.nome) }));
          setUsuarios(list);

          const map: Record<string, string> = {};
          const mapNivel: Record<string, string> = {};
          for (const u of data as any[]) {
            map[String(u.id)] = String(u.nome);
            mapNivel[String(u.id)] = String(u.nivel ?? "");
          }
          setUsuarioNomeMap((prev) => ({ ...prev, ...map }));
          setUsuarioNivelMap((prev) => ({ ...prev, ...mapNivel }));

          // se usuário filtrado não está na lista (troca regional), reseta
          if (filtroUsuario !== "todos" && !list.some((x) => x.id === filtroUsuario)) setFiltroUsuario("todos");
        }
      } catch {
        // silencioso
      }
    };

    void loadUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    podeFiltrarUsuario,
    perfil.nivel,
    perfil.departamento_id,
    perfil.setor_id,
    perfil.regional_id,
    filtroRegional,
    filtroGrupo,
  ]);

  // ✅ Carregar grupos para o select (N1/N2)
  useEffect(() => {
    if (!(perfil.nivel === "N1" || perfil.nivel === "N2")) return;

    const loadGrupos = async () => {
      try {
        let gq = supabase
          .from("grupos")
          .select("id,nome,departamento_id,setor_id,regional_id,ativo")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (perfil.departamento_id) gq = gq.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) gq = gq.eq("setor_id", perfil.setor_id);

        // ✅ N2: trava na própria regional
        if (perfil.nivel === "N2" && perfil.regional_id) gq = gq.eq("regional_id", perfil.regional_id);

        // ✅ N1: se escolheu uma regional, filtra grupos por ela
        if (perfil.nivel === "N1" && filtroRegional !== "todas") gq = gq.eq("regional_id", filtroRegional);

        const { data, error } = await gq;
        if (!error && data) {
          const list = data.map((g: any) => ({
            id: Number(g.id),
            nome: String(g.nome ?? `Grupo ${g.id}`),
            departamento_id: Number(g.departamento_id),
            setor_id: Number(g.setor_id),
            regional_id: g.regional_id != null ? Number(g.regional_id) : null,
            ativo: g.ativo !== false,
          }));
          setGrupos(list);

          if (filtroGrupo !== "todos" && !list.some((x) => String(x.id) === String(filtroGrupo))) {
            setFiltroGrupo("todos");
          }
        }
      } catch {
        // silencioso
      }
    };

    void loadGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id, filtroRegional]);

  const carregarAgenda = async () => {
    try {
      setLoading(true);
      setErro(null);

      const dataIni = dataRef;
      const dataFim = modo === "7dias" ? addDaysYMD(dataRef, 6) : dataRef;

      let q = supabase
        .from("rotinas")
        .select(
          `
          id, titulo, descricao, tipo, periodicidade,
          data_inicio, data_fim, dia_semana, horario_inicio, duracao_minutos,
          urgencia, responsavel_id, departamento_id, setor_id, regional_id, grupo_id,
          tem_checklist, tem_anexo
        `
        )
        .or(
          modo === "dia"
            ? [
                `and(tipo.eq.avulsa,data_inicio.eq.${dataRef})`,
                `and(tipo.eq.normal,periodicidade.eq.diaria,data_inicio.lte.${dataRef})`,
                `and(tipo.eq.normal,periodicidade.eq.semanal,data_inicio.lte.${dataRef})`,
                `and(tipo.eq.normal,periodicidade.eq.mensal,data_inicio.lte.${dataRef})`,
              ].join(",")
            : [
                `and(tipo.eq.avulsa,data_inicio.gte.${dataIni},data_inicio.lte.${dataFim})`,
                `and(tipo.eq.normal,data_inicio.lte.${dataFim},periodicidade.in.(diaria,semanal,mensal))`,
              ].join(",")
        );

      // ✅ filtro hierárquico base (não mexer)
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

      // ✅ regional extra: SOMENTE N1
      if (perfil.nivel === "N1" && filtroRegional !== "todas") {
        q = q.eq("regional_id", filtroRegional);
      }

      // ✅ usuário extra: N1 e N2
      if ((perfil.nivel === "N1" || perfil.nivel === "N2") && filtroUsuario !== "todos") {
        q = q.eq("responsavel_id", filtroUsuario);
      }

      // ✅ grupo extra: N1 e N2
      if ((perfil.nivel === "N1" || perfil.nivel === "N2") && filtroGrupo !== "todos") {
        q = q.eq("grupo_id", Number(filtroGrupo));
      }

      const { data, error } = await q;
      if (error) {
        console.error(error);
        setErro("Erro ao carregar agenda.");
        return;
      }

      let rotinas = (data as Rotina[]) ?? [];

      // visibilidade por hierarquia:
      // N3: só vê ele mesmo
      // N2: vê ele mesmo + N3
      // N1: vê N1/N2/N3 (filtragem adicional já ocorre pelos selects/filtros)
      if (perfil.nivel === "N3") {
        rotinas = rotinas.filter((r) => r.responsavel_id === perfil.id);
      } else if (perfil.nivel === "N2") {
        rotinas = rotinas.filter(
          (r) => r.responsavel_id === perfil.id || usuarioNivelMap[r.responsavel_id] === "N3"
        );
      }

      // N2 não enxerga rotinas cujo responsável é N1
      if (perfil.nivel === "N2") {
        rotinas = rotinas.filter((r) => usuarioNivelMap[r.responsavel_id] !== "N1");
      }

      // respeita data_fim
      if (modo === "dia") {
        rotinas = rotinas.filter((r) => !r.data_fim || r.data_fim >= dataRef);
      } else {
        const dataIni = dataRef;
        const dataFim = addDaysYMD(dataRef, 6);
        rotinas = rotinas.filter((r) => !r.data_fim || r.data_fim >= dataIni);
      }

      // filtro: nao exibir diarias em sabado/domingo apenas no modo "dia"
      if (modo === "dia") {
        const dowNum = Number(weekday_1_7(dataRef)); // 1=domingo, 7=sabado
        if (dowNum === 1 || dowNum === 7) {
          rotinas = rotinas.filter((r) => (r.periodicidade ?? "").toLowerCase() !== "diaria");
        }
      }

      // ✅ garantir nomes dos responsáveis (para o card)
      try {
        const ids = Array.from(new Set(rotinas.map((r) => r.responsavel_id).filter(Boolean)));
        const faltantes = ids.filter((id) => !usuarioNomeMap[id]);
        if (faltantes.length) {
          const { data: uData } = await supabase.from(USUARIOS_TABLE).select("id,nome,nivel").in("id", faltantes as any);
          if (uData) {
            const add: Record<string, string> = {};
            const addNivel: Record<string, string> = {};
            for (const u of uData as any[]) {
              add[String(u.id)] = String(u.nome);
              addNivel[String(u.id)] = String(u.nivel ?? "");
            }
            setUsuarioNomeMap((prev) => ({ ...prev, ...add }));
            setUsuarioNivelMap((prev) => ({ ...prev, ...addNivel }));
          }
        }
      } catch {
        // silencioso
      }

      // ========================
      // MODO 7 DIAS
      // ========================
      if (modo === "7dias") {
        const dias: string[] = [];
        for (let i = 0; i < 7; i++) dias.push(addDaysYMD(dataRef, i));

        const agendaPorDiaRotinas = dias.map((d) => ({ data: d, rotinas: buildAgendaDoDia(rotinas, d) }));

        const rotinaIds = Array.from(
          new Set(
            agendaPorDiaRotinas
              .flatMap((x) => x.rotinas.map((r) => r.id))
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          )
        );

        const { data: execsData, error: execErr } = await supabase
          .from("rotina_execucoes")
          .select("id,rotina_id,executor_id,created_at,inicio_em,pausado_em,finalizado_em")
          .in("rotina_id", rotinaIds.length ? rotinaIds : ["__none__"])
          .gte("created_at", startOfDayLocalToUTC(dataIni))
          .lt("created_at", endOfDayLocalToUTCExclusive(dataFim))
          .order("id", { ascending: false });

        if (execErr) {
          console.error(execErr);
          setErro("Erro ao carregar execuções (7 dias).");
        }

        const execucoes = ((execsData as Execucao[]) ?? []);
        const execMap = new Map<string, Execucao>();

        for (const ex of execucoes) {
          const diaLocal = ymdLocal(new Date(ex.created_at));
          const key = `${ex.rotina_id}::${diaLocal}`;
          if (!execMap.has(key)) execMap.set(key, ex);
        }

        const agendaFinal = agendaPorDiaRotinas.map(({ data: dia, rotinas: rotDia }) => {
          const itensMontados: ItemAgenda[] = rotDia.map((r) => ({ rotina: r, execucao: execMap.get(`${r.id}::${dia}`) ?? null }));
          const comHorario = itensMontados.filter((it) => it.rotina.horario_inicio);
          const semHorarioLista = itensMontados.filter((it) => !it.rotina.horario_inicio);

          comHorario.sort((a, b) => (a.rotina.horario_inicio ?? "23:59").localeCompare(b.rotina.horario_inicio ?? "23:59"));
          return { data: dia, itens: comHorario, semHorario: semHorarioLista };
        });

        setAgenda7(agendaFinal);
        setItens([]);
        setSemHorario([]);
        return;
      }

      // ========================
      // MODO DIA (padrão)
      // ========================
      const domAlvo = dayOfMonth(dataRef);
      rotinas = rotinas.filter((r) => {
        if ((r.periodicidade ?? "") !== "mensal") return true;
        if (!r.data_inicio) return false;
        return dayOfMonth(r.data_inicio) === domAlvo;
      });
      rotinas = rotinas.filter((r) => {
        const p = (r.periodicidade ?? "").toLowerCase();
        if (p !== "semanal") return true;
        return matchDiaSemana(r.dia_semana, dataRef);
      });

      const rotinaIds = Array.from(new Set(rotinas.map((r) => r?.id).filter((id): id is string => typeof id === "string" && id.length > 0)));

      if (rotinaIds.length === 0) {
        setItens([]);
        setSemHorario([]);
        setAgenda7([]);
        return;
      }

      const { data: execucoesData, error: execError } = await supabase
        .from("rotina_execucoes")
        .select("id,rotina_id,executor_id,created_at,inicio_em,pausado_em,finalizado_em")
        .in("rotina_id", rotinaIds)
        .gte("created_at", startOfDayLocalToUTC(dataRef))
        .lt("created_at", endOfDayLocalToUTCExclusive(dataRef))
        .order("id", { ascending: false });

      if (execError) {
        console.error(execError);
        setErro("Erro ao carregar execuções.");

        const fallback: ItemAgenda[] = rotinas.map((r) => ({ rotina: r, execucao: null }));
        const comHorarioFallback = fallback.filter((it) => it.rotina.horario_inicio);
        const semHorarioFallback = fallback.filter((it) => !it.rotina.horario_inicio);
        comHorarioFallback.sort((a, b) => (a.rotina.horario_inicio ?? "23:59").localeCompare(b.rotina.horario_inicio ?? "23:59"));

        setItens(comHorarioFallback);
        setSemHorario(semHorarioFallback);
        setAgenda7([]);
        return;
      }

      const execucoes = (execucoesData as Execucao[]) ?? [];
      const execPorRotina = new Map<string, Execucao>();
      for (const ex of execucoes) if (!execPorRotina.has(ex.rotina_id)) execPorRotina.set(ex.rotina_id, ex);

      const itensMontados: ItemAgenda[] = rotinas.map((r) => ({ rotina: r, execucao: execPorRotina.get(r.id) ?? null }));

      const comHorario = itensMontados.filter((it) => it.rotina.horario_inicio);
      const semHorarioLista = itensMontados.filter((it) => !it.rotina.horario_inicio);

      comHorario.sort((a, b) => (a.rotina.horario_inicio ?? "23:59").localeCompare(b.rotina.horario_inicio ?? "23:59"));

      setItens(comHorario);
      setSemHorario(semHorarioLista);
      setAgenda7([]);
    } catch (e) {
      console.error(e);
      setErro("Erro inesperado ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataRef,
    modo,
    filtro,
    filtroRegional,
    filtroUsuario,
    filtroGrupo,
    perfil.id,
    perfil.nivel,
    perfil.setor_id,
    perfil.departamento_id,
    perfil.regional_id,
  ]);

  // ✅ auto-scroll depois do carregamento (abrir já na hora atual)
  useEffect(() => {
    if (!autoScrollToHour) return;
    if (modo !== "dia") return;
    if (dataRef !== todayLocalYMD()) return;
    if (loading) return;

    const t = setTimeout(() => scrollToCurrentHour("auto"), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, dataRef, loading, autoScrollToHour]);

  const itensPorHora = useMemo(() => {
    const mapa = new Map<number, ItemAgenda[]>();
    for (const h of horasDia) mapa.set(h, []);

    for (const item of itens) {
      const hStr = item.rotina.horario_inicio ?? "00:00";
      const h = parseInt(hStr.slice(0, 2), 10);
      mapa.get(h)?.push(item);
    }

    for (const [h, arr] of mapa) {
      arr.sort((a, b) => (a.rotina.horario_inicio ?? "23:59").localeCompare(b.rotina.horario_inicio ?? "23:59"));
      mapa.set(h, arr);
    }
    return mapa;
  }, [itens]);

  const mudarDia = (delta: number) => setDataRef(addDaysYMD(dataRef, delta));

  const tituloDia = useMemo(() => {
    const d = new Date(dataRef + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  }, [dataRef]);

  const corStatus = (item: ItemAgenda) => {
    const ex = item.execucao;
    if (!ex) return { label: "Pendente", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.8)", color: "#7dd3fc" };
    if (ex.finalizado_em) return { label: "Finalizada", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.8)", color: "#4ade80" };
    if (ex.pausado_em && !ex.finalizado_em) return { label: "Pausada", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.9)", color: "#fbbf24" };
    if (ex.inicio_em && !ex.finalizado_em) return { label: "Em execução", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.9)", color: "#facc15" };
    return { label: "Pendente", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.8)", color: "#7dd3fc" };
  };

  const corUrgencia = (urg: string | null) => {
    if (urg === "alta") return { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.8)", color: "#fecaca" };
    if (urg === "media") return { bg: "rgba(251,191,36,0.18)", border: "rgba(251,191,36,0.8)", color: "#fef3c7" };
    return { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.9)", color: "#bbf7d0" };
  };

  const renderFiltroChip = (valor: FiltroAgenda, label: string) => {
    const ativo = filtro === valor;
    return (
      <button
        type="button"
        onClick={() => setFiltro(valor)}
        style={{
          padding: "3px 8px",
          borderRadius: 999,
          border: ativo ? `1px solid ${theme.colors.neonGreen ?? "rgba(34,197,94,0.9)"}` : "1px solid rgba(148,163,184,0.4)",
          background: ativo ? "rgba(34,197,94,0.15)" : "rgba(15,23,42,0.9)",
          color: ativo ? "#bbf7d0" : "#e5e7eb",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  const renderModoChip = (valor: ModoAgenda, label: string) => {
    const ativo = modo === valor;
    return (
      <button
        type="button"
        onClick={() => setModo(valor)}
        style={{
          padding: "3px 8px",
          borderRadius: 999,
          border: ativo ? `1px solid ${theme.colors.neonGreen ?? "rgba(34,197,94,0.9)"}` : "1px solid rgba(148,163,184,0.4)",
          background: ativo ? "rgba(34,197,94,0.15)" : "rgba(15,23,42,0.9)",
          color: ativo ? "#bbf7d0" : "#e5e7eb",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  // ✅ Executa só se for responsável, senão visualiza
  const acaoLabel = (item: ItemAgenda) => (item.rotina.responsavel_id === perfil.id ? "Executar" : "Visualizar");
  const nomeResponsavel = (id: string) => usuarioNomeMap[id] ?? "Usuário";
  return (
    <div>
      {/* Barra superior */}
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
          <button
            type="button"
            style={{ ...styles.button, padding: "4px 10px", fontSize: 13 }}
            onClick={() => mudarDia(-1)}
            disabled={modo === "7dias"}
            title={modo === "7dias" ? "No modo 7 dias, use a data como início do intervalo." : ""}
          >
            ◀ Ontem
          </button>

          <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{tituloDia}</div>

          <input
            type="date"
            value={dataRef}
            onChange={(e) => setDataRef(e.target.value)}
            style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 150 }}
            title="Escolher data"
          />

          <button type="button" style={{ ...styles.button, padding: "4px 10px", fontSize: 13 }} onClick={() => setDataRef(todayLocalYMD())}>
            Hoje
          </button>

          <div style={{ display: "flex", gap: 6, marginLeft: 6, flexWrap: "wrap" }}>
            {renderModoChip("dia", "Dia")}
            {renderModoChip("7dias", "Próximos 7 dias")}
          </div>

          {/* Filtros extras */}
          {(perfil.nivel === "N1" || perfil.nivel === "N2") && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 6, alignItems: "center" }}>
              {/* ✅ Regional: somente N1 */}
              {perfil.nivel === "N1" && (
                <select
                  value={String(filtroRegional)}
                  onChange={(e) => setFiltroRegional(e.target.value === "todas" ? "todas" : Number(e.target.value))}
                  style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 200 }}
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

              {/* ✅ Usuário: N1 e N2 */}
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value as any)}
                style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 240 }}
                title="Filtrar por usuário"
                disabled={filtroGrupo === "todos"}
              >
                <option value="todos">
                  {filtroGrupo === "todos" ? "Escolha um grupo primeiro" : "Todos usuários"}
                </option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>

              {/* ✅ Grupo: N1 e N2 */}
              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value as any)}
                style={{ ...styles.input, fontSize: 12, padding: "4px 8px", maxWidth: 220 }}
                title="Filtrar por grupo"
              >
                <option value="todos">Todos grupos</option>
                {grupos.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.nome}
                  </option>
                ))}
              </select>

              {(filtroUsuario !== "todos" || filtroGrupo !== "todos" || (perfil.nivel === "N1" && filtroRegional !== "todas")) && (
                <button
                  type="button"
                  onClick={() => {
                    if (perfil.nivel === "N1") setFiltroRegional("todas");
                    setFiltroUsuario("todos");
                    setFiltroGrupo("todos");
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

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {perfil.nivel === "N3" && renderFiltroChip("minhas", "Minhas rotinas")}

          {perfil.nivel !== "N3" && (
            <>
              {renderFiltroChip("minhas", "Minhas rotinas")}
              {renderFiltroChip("equipe", perfil.nivel === "N2" ? "Equipe (regional/setor)" : "Equipe (setor)")}
              {perfil.nivel === "N1" && renderFiltroChip("setor", "Setor (nacional)")}
            </>
          )}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>Carregando agenda…</p>}
      {erro && <p style={{ fontSize: 13, color: "#fecaca", marginBottom: 8 }}>{erro}</p>}

      {/* =======================
          MODO 7 DIAS
         ======================= */}
      {modo === "7dias" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agenda7.map((dia) => {
            const titulo = new Date(dia.data + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

            return (
              <div
                key={dia.data}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(31,41,55,1)",
                  padding: 10,
                  background: "rgba(15,23,42,0.95)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", marginBottom: 8, color: "#e5e7eb" }}>{titulo}</div>

                {dia.itens.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {dia.itens.map((item) => {
                      const status = corStatus(item);
                      const urg = corUrgencia(item.rotina.urgencia);
                      const act = acaoLabel(item);

                      return (
                        <div
                          key={`${dia.data}::${item.rotina.id}::${item.rotina.horario_inicio ?? "sem"}`}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${urg.border}`,
                            background: urg.bg,
                            padding: "6px 10px",
                            minWidth: 220,
                            cursor: "pointer",
                          }}
                          onClick={() => onAbrirExecucao(item.rotina)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{item.rotina.titulo}</div>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: status.bg,
                                border: `1px solid ${status.border}`,
                                color: status.color,
                              }}
                            >
                              {status.label}
                            </span>
                          </div>

                          <div style={{ marginTop: 2, fontSize: 11, color: "#93c5fd" }}>👤 {nomeResponsavel(item.rotina.responsavel_id)}</div>

                          {item.rotina.descricao && <div style={{ marginTop: 2, fontSize: 11, color: "#cbd5f5" }}>{item.rotina.descricao}</div>}

                          <div style={{ marginTop: 4, fontSize: 10, color: "#9ca3af", display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {item.rotina.horario_inicio && <span>⏰ Hora: {item.rotina.horario_inicio}</span>}
                            {item.rotina.duracao_minutos && <span>{item.rotina.duracao_minutos} min</span>}
                            <span style={{ color: act === "Executar" ? "#bbf7d0" : "#cbd5e1" }}>▶ {act}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>Sem rotinas com horário.</div>
                )}

                {dia.semHorario.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Sem horário definido</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {dia.semHorario.map((item) => {
                        const status = corStatus(item);
                        const urg = corUrgencia(item.rotina.urgencia);
                        const act = acaoLabel(item);

                        return (
                          <div
                            key={`${dia.data}::${item.rotina.id}::semHorario`}
                            style={{
                              borderRadius: 10,
                              border: `1px solid ${urg.border}`,
                              background: urg.bg,
                              padding: "6px 10px",
                              minWidth: 220,
                              cursor: "pointer",
                            }}
                            onClick={() => onAbrirExecucao(item.rotina)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{item.rotina.titulo}</div>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 999,
                                  background: status.bg,
                                  border: `1px solid ${status.border}`,
                                  color: status.color,
                                }}
                              >
                                {status.label}
                              </span>
                            </div>

                            <div style={{ marginTop: 2, fontSize: 11, color: "#93c5fd" }}>👤 {nomeResponsavel(item.rotina.responsavel_id)}</div>

                            {item.rotina.descricao && <div style={{ marginTop: 2, fontSize: 11, color: "#cbd5f5" }}>{item.rotina.descricao}</div>}

                            <div style={{ marginTop: 4, fontSize: 10, color: "#9ca3af" }}>
                              ▶ <span style={{ color: act === "Executar" ? "#bbf7d0" : "#cbd5e1" }}>{act}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* =======================
          MODO DIA (linha por hora)
         ======================= */}
      {modo === "dia" && (
        <>
          {/* legenda minutos */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 6 }}>
            <div />
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: 11, padding: "0 10px" }}>
              <span>00</span>
              <span>15</span>
              <span>30</span>
              <span>45</span>
              <span>60</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              gap: 8,
              maxHeight: "70vh",
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {/* coluna horas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11, color: "#9ca3af" }}>
              {horasDia.map((h, idx) => {
                const isHoje = dataRef === todayLocalYMD();
                const isHoraAtual = isHoje && nowHM().hour === h;

                return (
                  <div
                    key={`${h}-${idx}`}
                    style={{
                      height: 64,
                      display: "flex",
                      alignItems: "center",
                      fontWeight: isHoraAtual ? 800 : 500,
                      color: isHoraAtual ? "#fca5a5" : "#9ca3af",
                    }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                );
              })}
            </div>

            {/* coluna agenda por hora */}
            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(31,41,55,1)",
                padding: 6,
                background: "rgba(15,23,42,0.95)",
              }}
            >
              {horasDia.map((h, idx) => {
                const isHoje = dataRef === todayLocalYMD();
                const isHoraAtual = isHoje && nowHM().hour === h;
                const isLastRow = idx === horasDia.length - 1;

                const lista = (itensPorHora.get(h) ?? []).slice();
                lista.sort((a, b) => (a.rotina.horario_inicio ?? "23:59").localeCompare(b.rotina.horario_inicio ?? "23:59"));

                return (
                  <div
                    key={`${h}-${idx}`}
                    ref={hourRowRefs.get(h)}
                    style={{
                      position: "relative",
                      height: 64,
                      borderBottom: !isLastRow ? "1px dashed rgba(31,41,55,0.8)" : "none",
                      marginBottom: !isLastRow ? 10 : 0,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: isHoraAtual ? "rgba(248,113,113,0.06)" : "transparent",
                    }}
                  >
                    {/* linhas verticais 15/30/45 */}
                    {[15, 30, 45].map((m) => (
                      <div
                        key={m}
                        style={{
                          position: "absolute",
                          left: `${(m / 60) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: "rgba(148,163,184,0.12)",
                          pointerEvents: "none",
                        }}
                      />
                    ))}

                    {/* linha horizontal acompanhando hora atual */}
                    {isHoraAtual && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "50%",
                          height: 2,
                          background: "rgba(248,113,113,0.55)",
                          boxShadow: "0 0 12px rgba(248,113,113,0.35)",
                          pointerEvents: "none",
                        }}
                      />
                    )}

                    {/* cards: TODOS da hora na MESMA LINHA (scroll horizontal) */}
                    <div
                      style={{
                        position: "relative",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        overflowX: "auto",
                        overflowY: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lista.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#64748b" }}>—</div>
                      ) : (
                        lista.map((item) => {
                          const status = corStatus(item);
                          const urg = corUrgencia(item.rotina.urgencia);
                          const act = acaoLabel(item);

                          return (
                            <div
                              key={item.rotina.id}
                              style={{
                                flex: "0 0 auto",
                                width: 320,
                                borderRadius: 12,
                                border: `1px solid ${urg.border}`,
                                background: urg.bg,
                                padding: "8px 10px",
                                cursor: "pointer",
                              }}
                              onClick={() => onAbrirExecucao(item.rotina)}
                              title={`${item.rotina.horario_inicio ?? ""} • ${item.rotina.duracao_minutos ?? ""} min`}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: "#e5e7eb",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.rotina.titulo}
                                </div>

                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "1px 6px",
                                    borderRadius: 999,
                                    background: status.bg,
                                    border: `1px solid ${status.border}`,
                                    color: status.color,
                                    flexShrink: 0,
                                  }}
                                >
                                  {status.label}
                                </span>
                              </div>

                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 11,
                                  color: "#93c5fd",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                👤 {nomeResponsavel(item.rotina.responsavel_id)}
                              </div>

                              {item.rotina.descricao && (
                                <div
                                  style={{
                                    marginTop: 3,
                                    fontSize: 11,
                                    color: "#cbd5f5",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.rotina.descricao}
                                </div>
                              )}

                              <div style={{ marginTop: 5, fontSize: 10, color: "#9ca3af", display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {item.rotina.horario_inicio && <span>⏰ Hora: {item.rotina.horario_inicio}</span>}
                                {item.rotina.duracao_minutos && <span>{item.rotina.duracao_minutos} min</span>}
                                <span style={{ color: act === "Executar" ? "#bbf7d0" : "#cbd5e1" }}>▶ {act}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* sem horário */}
          {semHorario.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 700 }}>Sem horário definido</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {semHorario.map((item) => {
                  const status = corStatus(item);
                  const urg = corUrgencia(item.rotina.urgencia);
                  const act = acaoLabel(item);

                  return (
                    <div
                      key={item.rotina.id}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${urg.border}`,
                        background: urg.bg,
                        padding: "8px 10px",
                        minWidth: 260,
                        cursor: "pointer",
                      }}
                      onClick={() => onAbrirExecucao(item.rotina)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#e5e7eb" }}>{item.rotina.titulo}</div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 999,
                            background: status.bg,
                            border: `1px solid ${status.border}`,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div style={{ marginTop: 3, fontSize: 11, color: "#93c5fd" }}>👤 {nomeResponsavel(item.rotina.responsavel_id)}</div>

                      {item.rotina.descricao && <div style={{ marginTop: 3, fontSize: 11, color: "#cbd5f5" }}>{item.rotina.descricao}</div>}

                      <div style={{ marginTop: 5, fontSize: 10, color: "#9ca3af" }}>
                        ▶ <span style={{ color: act === "Executar" ? "#bbf7d0" : "#cbd5e1" }}>{act}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



