// src/dashboards/index.tsx
import type { Usuario } from "../types";
import { styles } from "../styles";

// componentes de cada nível (estão em /src/components)
import { N1CreateRotina } from "../components/N1CreateRotina";
import { N1ListarRotinas } from "../components/N1ListarRotinas";
import { N2ExecutarRotina } from "../components/N2ExecutarRotina";
import { N3MinhasRotinas } from "../components/N3MinhasRotinas";
import { AgendaHoje } from "../components/AgendaHoje";

// KPIs resumo por nível (já existentes)
import { KpiResumoN1 } from "../components/KpiResumoN1";
import { KpiResumoN2 } from "../components/KpiResumoN2";
import { KpiResumoN3 } from "../components/KpiResumoN3";

// NOVOS: KPIs Planejado x Executado
import { KpiPlanejadoExecutadoN1 } from "../components/KpiPlanejadoExecutadoN1";
import { KpiPlanejadoExecutadoN2 } from "../components/KpiPlanejadoExecutadoN2";
import { KpiPlanejadoExecutadoN3 } from "../components/KpiPlanejadoExecutadoN3";

// ------------------------------------------------------------
// N0 — só visualização de KPI (placeholder simples)
// ------------------------------------------------------------
export function DashboardNivel0({ perfil }: { perfil: Usuario }) {
  return (
    <div style={styles.card}>
      <h2 style={{ marginTop: 0 }}>Painel de Indicadores (N0)</h2>
      <p style={{ color: "#cbd5e1" }}>
        Aqui entram os gráficos/KPIs. Perfil atual: <b>{perfil.nome}</b>
      </p>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        (placeholder — substitua pelo dashboard real quando quiser)
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// N1 — KPI + Planejado x Executado + Agenda + criar/listar rotinas
// ------------------------------------------------------------
export function DashboardNivel1({ perfil }: { perfil: Usuario }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPI de execução do setor (N1) */}
      <KpiResumoN1 perfil={perfil} />

      {/* KPI Planejado x Executado por regional (30 dias) */}
      <KpiPlanejadoExecutadoN1 perfil={perfil} />

      {/* Bloco 12 – Agenda para o N1 (rotinas do próprio usuário) */}
      <AgendaHoje perfil={perfil} filtro="minhas" />

      {/* Bloco 6B – Criar rotina (N1) */}
      <N1CreateRotina perfil={perfil} />

      {/* Bloco 7 – Listar rotinas da equipe (N1) */}
      <N1ListarRotinas perfil={perfil} />
    </div>
  );
}

// ------------------------------------------------------------
// N2 — KPI + Planejado x Executado + Agenda + executar rotinas
// ------------------------------------------------------------
export function DashboardNivel2({ perfil }: { perfil: Usuario }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPI da regional (execuções, horas, etc.) */}
      <KpiResumoN2 perfil={perfil} />

      {/* KPI Planejado x Executado por colaborador (30 dias) */}
      <KpiPlanejadoExecutadoN2 perfil={perfil} />

      {/* Bloco 12 – Agenda / Calendário (rotinas do próprio N2) */}
      <AgendaHoje perfil={perfil} filtro="minhas" />

      {/* Bloco 8 – Minhas rotinas do dia (N2 executando) */}
      <N2ExecutarRotina perfil={perfil} />
    </div>
  );
}

// ------------------------------------------------------------
// N3 — KPI + Planejado x Executado pessoal + Agenda + minhas rotinas
// ------------------------------------------------------------
export function DashboardNivel3({ perfil }: { perfil: Usuario }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Meu resumo de execução (hoje / 30 dias) */}
      <KpiResumoN3 perfil={perfil} />

      {/* Meu Planejado x Executado (30 dias) */}
      <KpiPlanejadoExecutadoN3 perfil={perfil} />

      {/* Bloco 12 – Agenda / Calendário (N3) */}
      <AgendaHoje perfil={perfil} filtro="minhas" />

      {/* Bloco 8 – Minhas rotinas (N3) */}
      <N3MinhasRotinas perfil={perfil} />
    </div>
  );
}

// ------------------------------------------------------------
// N99 — auditor/visualizador master (placeholder)
// ------------------------------------------------------------
export function DashboardNivel99({ perfil }: { perfil: Usuario }) {
  return (
    <div style={styles.card}>
      <h2 style={{ marginTop: 0 }}>Painel N99</h2>
      <p style={{ color: "#cbd5e1" }}>
        Perfil: <b>{perfil.nome}</b> — nível <b>{perfil.nivel}</b>
      </p>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        (placeholder — adicione aqui as telas especiais do N99)
      </p>
    </div>
  );
}
