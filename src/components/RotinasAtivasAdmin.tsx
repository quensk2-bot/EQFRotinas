// Lista e administração de rotinas ativas (N1/N2): editar data fim, pausar, excluir
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { styles as baseStyles, theme } from "../styles";

type Props = { perfil: Usuario };

type Rotina = {
  id: string;
  titulo: string;
  responsavel_id: string;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  data_inicio: string;
  data_fim: string | null;
  periodicidade: string;
  horario_inicio: string | null;
  status: string;
  rotina_padrao_id: string | null;
};

type UsuarioInfo = { id: string; nome: string; nivel: string; regional_id: number | null };
type Regional = { id: number; nome: string };

const formatDate = (v: string | null) =>
  v ? new Date((v.includes("T") ? v : `${v}T00:00:00`)).toLocaleDateString("pt-BR") : "";
const formatTime = (v: string | null) => (v ? v.slice(0, 5) : "");
const toDateInput = (v: string | null) => (v ? (v.includes("T") ? v.split("T")[0] ?? v : v) : "");
const todayLocalYMD = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (iso: string, delta: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function RotinasAtivasAdmin({ perfil }: Props) {
  const isN1 = perfil.nivel === "N1";
  const isN2 = perfil.nivel === "N2";

  const [regioes, setRegioes] = useState<Regional[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);

  const [escopo, setEscopo] = useState<"minhas" | "regional">(() => (isN1 || isN2 ? "regional" : "minhas"));
  const [regionalFiltro, setRegionalFiltro] = useState<number | "todas">("todas");
  const [usuarioFiltro, setUsuarioFiltro] = useState<string | "todos">("todos");

  const [lista, setLista] = useState<Rotina[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // regionais (N1)
  useEffect(() => {
    if (!isN1) return;
    supabase
      .from("regionais")
      .select("id,nome")
      .order("nome", { ascending: true })
      .then(({ data }) => {
        if (data) setRegioes(data.map((r: any) => ({ id: Number(r.id), nome: String(r.nome ?? `Regional ${r.id}`) })));
      })
      .catch(() => {});
  }, [isN1]);

  // usuários (N1/N2)
  useEffect(() => {
    if (!isN1 && !isN2) return;
    let q = supabase.from("usuarios").select("id,nome,nivel,regional_id,departamento_id,setor_id,ativo").eq("ativo", true);
    if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
    if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);
    if (isN2 && perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);
    if (isN1 && regionalFiltro !== "todas") q = q.eq("regional_id", regionalFiltro);
    q = q.in("nivel", ["N1", "N2", "N3"] as any);
    q.then(({ data }) => {
      if (data) {
        const list = data.map((u: any) => ({
          id: String(u.id),
          nome: String(u.nome ?? "Usuário"),
          nivel: String(u.nivel ?? ""),
          regional_id: u.regional_id ?? null,
        }));
        setUsuarios(list);
        if (usuarioFiltro !== "todos" && !list.some((u) => u.id === usuarioFiltro)) setUsuarioFiltro("todos");
      }
    }).catch(() => {});
  }, [isN1, isN2, perfil.departamento_id, perfil.setor_id, perfil.regional_id, regionalFiltro, usuarioFiltro]);

  const carregar = async () => {
    try {
      setLoading(true);
      setErro(null);

      let q = supabase
        .from("rotinas")
        .select("id,titulo,responsavel_id,departamento_id,setor_id,regional_id,data_inicio,data_fim,periodicidade,horario_inicio,status,rotina_padrao_id");

      if (perfil.departamento_id) q = q.eq("departamento_id", perfil.departamento_id);
      if (perfil.setor_id) q = q.eq("setor_id", perfil.setor_id);

      if (isN1) {
        if (escopo === "minhas") q = q.eq("responsavel_id", perfil.id);
        if (regionalFiltro !== "todas") q = q.eq("regional_id", regionalFiltro);
      } else if (isN2) {
        if (perfil.regional_id) q = q.eq("regional_id", perfil.regional_id);
        if (escopo === "minhas") q = q.eq("responsavel_id", perfil.id);
      } else {
        q = q.eq("responsavel_id", perfil.id);
      }

      if (usuarioFiltro !== "todos") q = q.eq("responsavel_id", usuarioFiltro);

      const { data, error } = await q.order("data_inicio", { ascending: false });
      if (error) throw error;

      let rotinas = (data as Rotina[]) ?? [];

      // mostra somente rotinas criadas a partir de modelo (tem rotina_padrao_id)
      rotinas = rotinas.filter((r) => r.rotina_padrao_id != null);

      // N2 não vê N1
      if (isN2) {
        const allow = new Set(
          usuarios.filter((u) => u.nivel === "N2" || u.nivel === "N3").map((u) => u.id)
        );
        rotinas = rotinas.filter((r) => allow.has(r.responsavel_id));
      }

      setLista(rotinas);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar rotinas.");
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopo, regionalFiltro, usuarioFiltro, usuarios.length, perfil.id, perfil.nivel, perfil.departamento_id, perfil.setor_id, perfil.regional_id]);

  const updateDataFim = async (id: string, data_fim: string | null) => {
    // otimista na UI
    setLista((curr) => curr.map((r) => (r.id === id ? { ...r, data_fim } : r)));
    try {
      const { error } = await supabase.from("rotinas").update({ data_fim }).eq("id", id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar data fim.");
      alert(e?.message ?? "Erro ao salvar data fim.");
      await carregar();
    }
  };

  const pausar = async (id: string) => {
    // fallback: como o enum recusa pausado/pausada, usamos data_fim = ontem para parar imediatamente
    const ontem = addDays(todayLocalYMD(), -1);
    setLista((curr) => curr.map((r) => (r.id === id ? { ...r, data_fim: ontem } : r)));
    try {
      const { error } = await supabase.from("rotinas").update({ data_fim: ontem }).eq("id", id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao pausar rotina.");
      alert(e?.message ?? "Erro ao pausar rotina.");
      await carregar();
    }
  };

  const reiniciar = async (id: string) => {
    // retira a data_fim para voltar a agendar
    setLista((curr) => curr.map((r) => (r.id === id ? { ...r, data_fim: null } : r)));
    try {
      const { error } = await supabase.from("rotinas").update({ data_fim: null }).eq("id", id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao reiniciar rotina.");
      alert(e?.message ?? "Erro ao reiniciar rotina.");
      await carregar();
    }
  };

  const excluir = async (id: string) => {
    const ok = window.confirm("Excluir esta rotina? Esta ação não pode ser desfeita.");
    if (!ok) return;
    await supabase.from("rotinas").delete().eq("id", id);
    await carregar();
  };

  const labelResp = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id;
  const labelRegional = (id: number | null) => {
    if (id == null) return "-";
    return regioes.find((r) => r.id === id)?.nome ?? `Regional ${id}`;
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <style>
        {`
          input[type="date"]::-webkit-calendar-picker-indicator {
            filter: hue-rotate(90deg) brightness(1.4) saturate(1.6);
            opacity: 0.9;
          }
          input[type="date"]:focus::-webkit-calendar-picker-indicator {
            filter: hue-rotate(110deg) brightness(1.6) saturate(1.8);
          }
        `}
      </style>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.colors.textSoft ?? "#e5e7eb" }}>Rotinas ativas</div>
        <div style={{ fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>
          N1 filtra por regional; N2 vê somente sua regional.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(isN1 || isN2) && (
          <>
            <button
              type="button"
              onClick={() => setEscopo("minhas")}
              style={{
                ...baseStyles.button,
                padding: "6px 10px",
                background: escopo === "minhas" ? theme.colors.neonGreen : "transparent",
                color: escopo === "minhas" ? "#022c22" : theme.colors.textSoft ?? "#e5e7eb",
                border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
              }}
            >
              Minhas
            </button>
            <button
              type="button"
              onClick={() => setEscopo("regional")}
              style={{
                ...baseStyles.button,
                padding: "6px 10px",
                background: escopo === "regional" ? theme.colors.neonGreen : "transparent",
                color: escopo === "regional" ? "#022c22" : theme.colors.textSoft ?? "#e5e7eb",
                border: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
              }}
            >
              Regional
            </button>
          </>
        )}

        {isN1 && (
          <select
            value={String(regionalFiltro)}
            onChange={(e) => setRegionalFiltro(e.target.value === "todas" ? "todas" : Number(e.target.value))}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px" }}
          >
            <option value="todas">Todas regionais</option>
            {regioes.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.nome}
              </option>
            ))}
          </select>
        )}

        {(isN1 || isN2) && (
          <select
            value={usuarioFiltro}
            onChange={(e) => setUsuarioFiltro(e.target.value as any)}
            style={{ ...baseStyles.input, fontSize: 12, padding: "4px 8px", minWidth: 180 }}
          >
            <option value="todos">Todos usuários</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        )}

        <button type="button" onClick={carregar} style={{ ...baseStyles.buttonSecondary, padding: "6px 10px", fontSize: 12 }}>
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
            background: "linear-gradient(135deg, rgba(9,14,26,0.95), rgba(14,22,38,0.95))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 170px 120px 120px 100px 90px 200px",
              gap: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: theme.colors.textMuted ?? "#9ca3af",
              borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
              background: "linear-gradient(90deg, rgba(27,43,71,0.55), rgba(24,38,62,0.45))",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            <div>Rotina</div>
            <div>Responsável</div>
            <div>Regional</div>
            <div>Data início</div>
            <div>Data fim</div>
            <div>Status</div>
            <div>Ações</div>
          </div>

          {lista.length === 0 && <div style={{ padding: 10, fontSize: 12, color: theme.colors.textMuted ?? "#9ca3af" }}>Nenhuma rotina.</div>}

          {lista.map((r, idx) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 170px 120px 120px 100px 90px 200px",
                gap: 8,
                padding: "8px 10px",
                fontSize: 12,
                borderBottom: `1px solid ${theme.colors.borderSoft ?? "#1f2937"}`,
                background: idx % 2 === 0 ? "rgba(17,27,46,0.35)" : "rgba(12,20,35,0.30)",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{r.titulo}</div>
                <div style={{ fontSize: 11, color: theme.colors.textMuted ?? "#9ca3af" }}>
                  {r.periodicidade} • {formatTime(r.horario_inicio)}
                </div>
              </div>
              <div>{labelResp(r.responsavel_id)}</div>
              <div>{labelRegional(r.regional_id)}</div>
              <div>{formatDate(r.data_inicio)}</div>
              <div>
                <input
                  type="date"
                  value={toDateInput(r.data_fim)}
                  onChange={(e) => updateDataFim(r.id, e.target.value || null)}
                  style={{
                    ...baseStyles.input,
                    fontSize: 11,
                    padding: "4px 6px",
                    background: "rgba(0,255,136,0.12)",
                    borderColor: theme.colors.neonGreen ?? "#22c55e",
                    color: "#d1fae5",
                    boxShadow: "0 0 0 1px rgba(34,197,94,0.35)",
                  }}
                />
              </div>
              <div style={{ textTransform: "capitalize" }}>
                {r.data_fim && r.data_fim < todayLocalYMD() ? "Pausada" : r.status ?? "-"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...baseStyles.buttonSecondary, padding: "4px 8px", fontSize: 11 }}
                  onClick={() => pausar(r.id)}
                  title="Pausar"
                >
                  Pausar
                </button>
                <button
                  type="button"
                  style={{ ...baseStyles.buttonSecondary, padding: "4px 8px", fontSize: 11 }}
                  onClick={() => reiniciar(r.id)}
                  title="Reiniciar (voltar a pendente)"
                >
                  Reiniciar
                </button>
                <button
                  type="button"
                  style={{ ...baseStyles.buttonSecondary, padding: "4px 8px", fontSize: 11, color: "#fecaca", borderColor: "#ef4444" }}
                  onClick={() => excluir(r.id)}
                  title="Excluir"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
