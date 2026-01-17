// Tela de auditoria de rotinas para N1/N2 com filtros de data e regional
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles as baseStyles, theme } from "../styles";

type Props = { perfil: Usuario };

type ExecucaoRow = {
  id: number;
  rotina_id: string;
  executor_id: string;
  inicio_em: string | null;
  finalizado_em: string | null;
  pausado_total_segundos: number;
  created_at: string;
  regional_id: number | null;
};

type RotinaInfo = {
  id: string;
  titulo: string;
  responsavel_id: string;
  regional_id: number | null;
  grupo_id: number | null;
};

type UsuarioInfo = { id: string; nome: string; nivel: string };

type AnexoInfo = { execucao_id: number; storage_path: string };

type GrupoOption = { id: number; nome: string };

function startOfDayISO(d: string) {
  return new Date(`${d}T00:00:00`).toISOString();
}
function endOfDayISO(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
}

const formatDateTime = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const formatSeconds = (s: number | null | undefined) => {
  if (!s || s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export function KpiAuditoria({ perfil }: Props) {
  const hoje = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }, []);

  const [dataIni, setDataIni] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [regionalFiltro, setRegionalFiltro] = useState<number | "todas">("todas");
  const [grupoFiltro, setGrupoFiltro] = useState<number | "todos">("todos");

  const [regionais, setRegionais] = useState<{ id: number; nome: string }[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<
    (ExecucaoRow & {
      rotinaTitulo: string;
      responsavel: string;
      executor: string;
      executorNivel: string;
      anexos: string[];
      duracaoSeg: number | null;
    })[]
  >([]);

  // Regionais (apenas N1)
  useEffect(() => {
    if (perfil.nivel !== "N1") return;
    supabase
      .from("regionais")
      .select("id,nome")
      .order("nome", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setRegionais(data.map((r: any) => ({ id: Number(r.id), nome: String(r.nome ?? `Regional ${r.id}`) })));
      })
      .catch(() => {});
  }, [perfil.nivel]);

  useEffect(() => {
    if (!(perfil.nivel === "N1" || perfil.nivel === "N2")) return;

    const loadGrupos = async () => {
      try {
        let q = supabase.from("grupos").select("id,nome,departamento_id,setor_id,regional_id,ativo").eq("ativo", true);
        if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
        if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);

        if (perfil.nivel === "N2" && perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);
        if (perfil.nivel === "N1" && regionalFiltro !== "todas") q = q.eq("regional_id", regionalFiltro);

        const { data, error } = await q.order("nome", { ascending: true });
        if (!error && data) {
          const list = data.map((g: any) => ({ id: Number(g.id), nome: String(g.nome ?? `Grupo ${g.id}`) }));
          setGrupos(list);
          if (grupoFiltro !== "todos" && !list.some((x) => x.id === grupoFiltro)) setGrupoFiltro("todos");
        }
      } catch {
        // silencioso
      }
    };

    void loadGrupos();
  }, [perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id, regionalFiltro, grupoFiltro]);

  const carregar = async () => {
    try {
      setLoading(true);
      setErro(null);

      // Execuções no intervalo
      let q = supabase
        .from("rotina_execucoes")
        .select("id,rotina_id,executor_id,inicio_em,finalizado_em,pausado_total_segundos,created_at,regional_id,departamento_id,setor_id");

      q = q.gte("created_at", startOfDayISO(dataIni)).lt("created_at", endOfDayISO(dataFim));

      // Escopo por nível
      if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);

      if (perfil.nivel === "N1") {
        if (regionalFiltro !== "todas") q = q.eq("regional_id", regionalFiltro);
      } else if (perfil.nivel === "N2") {
        if (perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);
      } else if (perfil.nivel === "N3") {
        q = q.eq("executor_id", perfil.id);
      }

      const { data: exData, error: exErr } = await q;
      if (exErr) throw exErr;
      let execs = (exData as ExecucaoRow[]) ?? [];

      // Carregar usuários para map de nível/nome
      const userIds = Array.from(new Set(execs.map((e) => e.executor_id)));
      const { data: userData } = await supabase.from("usuarios").select("id,nome,nivel").in("id", userIds);
      const userMap: Record<string, UsuarioInfo> = {};
      (userData ?? []).forEach((u: any) => {
        userMap[String(u.id)] = { id: String(u.id), nome: String(u.nome ?? "Usuário"), nivel: String(u.nivel ?? "") };
      });

      // N2 só pode ver N3 e ele mesmo
      if (perfil.nivel === "N2") {
        execs = execs.filter((e) => {
          const n = userMap[e.executor_id]?.nivel;
          return e.executor_id === perfil.id || n === "N3";
        });
      }

      // Rotinas
      const rotinaIds = Array.from(new Set(execs.map((e) => e.rotina_id)));
      const { data: rotData } = await supabase
        .from("rotinas")
        .select("id,titulo,responsavel_id,regional_id,grupo_id")
        .in("id", rotinaIds);
      const rotMap: Record<string, RotinaInfo> = {};
      (rotData ?? []).forEach((r: any) => {
        rotMap[String(r.id)] = {
          id: String(r.id),
          titulo: String(r.titulo ?? "Rotina"),
          responsavel_id: String(r.responsavel_id ?? ""),
          regional_id: r.regional_id ?? null,
          grupo_id: r.grupo_id ?? null,
        };
      });

      if (grupoFiltro !== "todos") {
        execs = execs.filter((e) => rotMap[e.rotina_id]?.grupo_id === grupoFiltro);
      }

      // Anexos
      const exIds = execs.map((e) => e.id);
      const { data: anData } = await supabase
        .from("rotina_anexos")
        .select("execucao_id,storage_path")
        .in("execucao_id", exIds);
      const anexosMap: Record<number, string[]> = {};
      (anData ?? []).forEach((a: any) => {
        const arr = anexosMap[a.execucao_id] ?? [];
        arr.push(String(a.storage_path ?? ""));
        anexosMap[a.execucao_id] = arr;
      });

      const rowsBuild = execs
        .map((e) => {
          const rot = rotMap[e.rotina_id];
          const execUser = userMap[e.executor_id];
          const duracaoSeg =
            e.inicio_em && e.finalizado_em ? Math.max(0, Math.floor((new Date(e.finalizado_em).getTime() - new Date(e.inicio_em).getTime()) / 1000)) : null;
          return {
            ...e,
            rotinaTitulo: rot?.titulo ?? "Rotina",
            responsavel: rot ? rot.responsavel_id : "-",
            executor: execUser?.nome ?? e.executor_id,
            executorNivel: execUser?.nivel ?? "",
            anexos: anexosMap[e.id] ?? [],
            duracaoSeg,
          };
        })
        // ordena por data desc (created_at)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      setRows(rowsBuild);
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao carregar auditoria.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataIni, dataFim, regionalFiltro, grupoFiltro, perfil.id, perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.colors.textSoft ?? "#e5e7eb" }}>Auditoria de rotinas</div>
        <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
          N1 filtra por regional; N2 vê apenas sua regional e N3.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: theme.colors.textSoft ?? "#e5e7eb" }}>
          Data início
          <input
            type="date"
            value={dataIni}
            onChange={(e) => setDataIni(e.target.value)}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px", marginLeft: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, color: theme.colors.textSoft ?? "#e5e7eb" }}>
          Data fim
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px", marginLeft: 4 }}
          />
        </label>

        {perfil.nivel === "N1" && (
          <select
            value={String(regionalFiltro)}
            onChange={(e) => setRegionalFiltro(e.target.value === "todas" ? "todas" : Number(e.target.value))}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px", minWidth: 180 }}
          >
            <option value="todas">Todas regionais</option>
            {regionais.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.nome}
              </option>
            ))}
          </select>
        )}

        {(perfil.nivel === "N1" || perfil.nivel === "N2") && (
          <select
            value={String(grupoFiltro)}
            onChange={(e) => setGrupoFiltro(e.target.value === "todos" ? "todos" : Number(e.target.value))}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px", minWidth: 180 }}
          >
            <option value="todos">Todos grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.nome}
              </option>
            ))}
          </select>
        )}

        <button type="button" onClick={carregar} style={{ ...baseStyles.button, padding: "6px 12px" }}>
          Recarregar
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>Carregando...</div>}
      {erro && <div style={{ fontSize: 12, color: "#fecaca" }}>{erro}</div>}

      {!loading && !erro && (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
            background: "rgba(15,23,42,0.96)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 180px 140px 140px 120px 140px",
              gap: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: theme.colors.textMuted ?? "#9ca3af",
              borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
              background: "rgba(2,6,23,0.35)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            <div>Data (criada)</div>
            <div>Rotina</div>
            <div>Executor</div>
            <div>Início</div>
            <div>Fim</div>
            <div>Pausado</div>
            <div>Anexos</div>
          </div>

          {rows.length === 0 && <div style={{ padding: 10, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>Nenhum registro.</div>}

          {rows.map((r, idx) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 180px 140px 140px 120px 140px",
                gap: 8,
                padding: "8px 10px",
                fontSize: 12,
                borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
                background: idx % 2 === 0 ? "rgba(2,6,23,0.18)" : "rgba(2,6,23,0.10)",
              }}
            >
              <div>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{r.rotinaTitulo}</div>
                <div style={{ fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
                  Exec.: {r.executor} ({r.executorNivel || "?"})
                </div>
              </div>
              <div>{r.executor}</div>
              <div>{formatDateTime(r.inicio_em)}</div>
              <div>{formatDateTime(r.finalizado_em)}</div>
              <div>{formatSeconds(r.pausado_total_segundos)}</div>
              <div style={{ fontSize: 11 }}>
                {r.anexos.length === 0
                  ? "—"
                  : r.anexos.map((a, i) => (
                      <div key={i}>
                        <a href={a} target="_blank" rel="noreferrer" style={{ color: theme.colors.neonGreen ?? "#22c55e" }}>
                          Anexo {i + 1}
                        </a>
                      </div>
                    ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KpiAuditoria;
