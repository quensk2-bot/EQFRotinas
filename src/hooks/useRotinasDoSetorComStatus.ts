// src/hooks/useRotinasDoSetorComStatus.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import type { Database } from "../types_db";

type RotinaRow = Database["public"]["Tables"]["rotinas"]["Row"];
type ExecRow = Database["public"]["Tables"]["rotina_execucoes"]["Row"];

export type StatusExecucao =
  | "Pendente"
  | "Em execução"
  | "Concluída"
  | "Atrasada";

export type RotinaComStatus = {
  rotina: RotinaRow;
  status: StatusExecucao;
  execucoes: ExecRow[];
};

function inicioDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function fimDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function useRotinasDoSetorComStatus(
  perfil: Usuario | null,
  dataRef: Date
) {
  const [dados, setDados] = useState<RotinaComStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!perfil) return;

    const carregar = async () => {
      setLoading(true);
      setErro(null);

      try {
        const inicio = inicioDoDia(dataRef);
        const fim = fimDoDia(dataRef);

        // 1) rotinas do setor/departamento/regional do N1
        const { data: rotData, error: rotErr } = await supabase
          .from("rotinas")
          .select("*")
          .eq("departamento_id", perfil.departamento_id)
          .eq("setor_id", perfil.setor_id)
          .eq("regional_id", perfil.regional_id);

        if (rotErr) throw rotErr;
        const rotinas = (rotData ?? []) as RotinaRow[];

        // 2) execuções do dia
        const { data: execData, error: execErr } = await supabase
          .from("rotina_execucoes")
          .select("*")
          .gte("inicio_em", inicio.toISOString())
          .lte("inicio_em", fim.toISOString());

        if (execErr) throw execErr;
        const execs = (execData ?? []) as ExecRow[];

        // indexar execuções por rotina
        const mapa = new Map<string, ExecRow[]>();
        for (const e of execs) {
          const lista = mapa.get(e.rotina_id) ?? [];
          lista.push(e);
          mapa.set(e.rotina_id, lista);
        }

        // calcular status por rotina
        const resultado: RotinaComStatus[] = rotinas.map((r) => {
          const lista = mapa.get(r.id) ?? [];
          let status: StatusExecucao = "Pendente";

          const emExecucao = lista.some((e) => e.inicio_em && !e.finalizado_em);
          const concluidas = lista.some((e) => e.finalizado_em);

          if (concluidas) status = "Concluída";
          else if (emExecucao) status = "Em execução";
          else status = "Pendente";

          // aqui dá pra colocar regra de "Atrasada" se quiser
          return { rotina: r, status, execucoes: lista };
        });

        setDados(resultado);
      } catch (err: any) {
        console.error("Erro ao carregar rotinas do setor:", err);
        setErro("Erro ao carregar rotinas do setor");
      } finally {
        setLoading(false);
      }
    };

    void carregar();
  }, [perfil?.id, dataRef.toISOString()]);

  return { dados, loading, erro };
}
