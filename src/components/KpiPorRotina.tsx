// src/components/KpiPorRotina.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Execucao = {
  id: number;
  rotina_id: string;
  duracao_total_segundos: number | null;
  finalizado_em: string | null;
};

type Props = {
  rotinaId: string;
};

function formatarDuracao(seg: number | null) {
  if (!seg || seg <= 0) return "-";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function KpiPorRotina({ rotinaId }: Props) {
  const [total, setTotal] = useState(0);
  const [concluidas, setConcluidas] = useState(0);
  const [mediaSegundos, setMediaSegundos] = useState<number | null>(null);

  const carregar = async () => {
    const { data, error } = await supabase
      .from("rotina_execucoes")
      .select("id, rotina_id, duracao_total_segundos, finalizado_em")
      .eq("rotina_id", rotinaId);

    if (error) {
      console.error("Erro ao carregar KPI por rotina:", error.message);
      return;
    }

    const lista = (data ?? []) as Execucao[];
    setTotal(lista.length);

    const concl = lista.filter((e) => !!e.finalizado_em);
    setConcluidas(concl.length);

    if (concl.length > 0) {
      const soma = concl.reduce(
        (acc, e) => acc + (e.duracao_total_segundos ?? 0),
        0
      );
      setMediaSegundos(Math.floor(soma / concl.length));
    } else {
      setMediaSegundos(null);
    }
  };

  useEffect(() => {
    if (!rotinaId) return;
    carregar();
  }, [rotinaId]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        fontSize: 11,
        color: "#cbd5e1",
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        Execuções: <strong>{total}</strong>
      </div>
      <div
        style={{
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        Concluídas: <strong>{concluidas}</strong>
      </div>
      <div
        style={{
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        Média duração:{" "}
        <strong>{formatarDuracao(mediaSegundos)}</strong>
      </div>
    </div>
  );
}
