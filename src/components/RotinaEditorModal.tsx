import type React from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Usuario } from "../types";
import { theme } from "../styles";

type NivelUsuario = Usuario["nivel"];

export type RotinaBasica = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  horario_inicio: string | null;
  duracao_minutos: number | null;
  responsavel_id: string;
};

type Props = {
  rotina: RotinaBasica;
  usuarioLogado: Usuario;
  onClose: () => void;
  onSaved?: (rotinaAtualizada: RotinaBasica) => void;
};

type ResponsavelOption = {
  id: string;
  nome: string;
};

const MAX_DESC = 100;

export const RotinaEditorModal: React.FC<Props> = ({
  rotina,
  usuarioLogado,
  onClose,
  onSaved,
}) => {
  const [responsavelId, setResponsavelId] = useState(rotina.responsavel_id);
  const [dataInicio, setDataInicio] = useState(rotina.data_inicio ?? "");
  const [horarioInicio, setHorarioInicio] = useState(
    rotina.horario_inicio ?? ""
  );
  const [duracaoMinutos, setDuracaoMinutos] = useState<number | "">(
    rotina.duracao_minutos ?? ""
  );

  // ✅ Descrição EDITÁVEL (máx. 100 caracteres)
  const [descricao, setDescricao] = useState<string>(
    rotina.descricao ?? ""
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<ResponsavelOption[]>([]);

  const nivel: NivelUsuario = usuarioLogado.nivel;
  const podeEditarBasico = nivel === "N1" || nivel === "N2";

  useEffect(() => {
    if (!podeEditarBasico) return;

    async function carregarResponsaveis() {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("setor_id", usuarioLogado.setor_id); // pode ajustar se quiser filtrar por regional

      if (!error && data) {
        setResponsaveis(
          data.map((u: any) => ({ id: u.id as string, nome: u.nome as string }))
        );
      } else if (error) {
        console.error("Erro ao carregar responsáveis:", error);
      }
    }

    void carregarResponsaveis();
  }, [podeEditarBasico, usuarioLogado.setor_id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEditarBasico) {
      setErro("Você não tem permissão para editar esta rotina.");
      return;
    }

    if (descricao.length > MAX_DESC) {
      setErro(`A descrição pode ter no máximo ${MAX_DESC} caracteres.`);
      return;
    }

    setErro(null);
    setSalvando(true);
    const payload = {
      responsavel_id: responsavelId,
      data_inicio: dataInicio,
      horario_inicio: horarioInicio,
      duracao_minutos:
        duracaoMinutos === "" ? null : Number(duracaoMinutos),
      descricao: descricao.trim() === "" ? null : descricao.trim(),
    };

    const { data, error } = await supabase
      .from("rotinas")
      .update(payload)
      .eq("id", rotina.id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar rotina:", error);
      setErro("Não foi possível salvar as alterações.");
      setSalvando(false);
      return;
    }

    if (data && onSaved) {
      onSaved(data as RotinaBasica);
    }

    setSalvando(false);
    onClose();
  }

  const contadorDescricao = `${descricao.length}/${MAX_DESC}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "95%",
          background: theme.colors.backgroundCard,
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Editar rotina</h2>
        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
          Após criada, só é permitido alterar:
          <strong> responsável</strong>,{" "}
          <strong>data de início</strong>, <strong>horário</strong>,{" "}
          <strong>duração</strong> e{" "}
          <strong>descrição (resumo até {MAX_DESC} caracteres)</strong>.
          <br />
          Os demais atributos (título, tipo, periodicidade, checklist,
          anexos, etc.) ficam travados para manter consistência nos KPIs.
        </p>

        {/* Título travado (somente leitura) */}
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${theme.colors.borderSoft}`,
            background: theme.colors.backgroundSoft,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>{rotina.titulo}</div>
        </div>

        {erro && (
          <div
            style={{
              marginBottom: 12,
              color: theme.colors.danger,
              fontSize: 13,
            }}
          >
            {erro}
          </div>
        )}

        <form onSubmit={salvar}>
          {/* Responsável */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Responsável</span>
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              disabled={!podeEditarBasico}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="">Selecione um responsável</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>

          {/* Data de início */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Data de início</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              disabled={!podeEditarBasico}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          {/* Horário */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Horário de início</span>
            <input
              type="time"
              value={horarioInicio ?? ""}
              onChange={(e) => setHorarioInicio(e.target.value)}
              disabled={!podeEditarBasico}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          {/* Duração */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Duração (minutos)</span>
            <input
              type="number"
              min={0}
              value={duracaoMinutos}
              onChange={(e) =>
                setDuracaoMinutos(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              disabled={!podeEditarBasico}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          {/* Descrição (EDITÁVEL, 100 chars) */}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Descrição (até {MAX_DESC} caracteres)</span>
            <textarea
              value={descricao}
              onChange={(e) =>
                setDescricao(e.target.value.slice(0, MAX_DESC))
              }
              disabled={!podeEditarBasico}
              rows={3}
              style={{
                width: "100%",
                marginTop: 4,
                resize: "vertical",
              }}
            />
            <div
              style={{
                fontSize: 11,
                textAlign: "right",
                marginTop: 2,
                color:
                  descricao.length >= MAX_DESC
                    ? "#f97373"
                    : "#9ca3af",
              }}
            >
              {contadorDescricao}
            </div>
          </label>

          <div
            style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: `1px dashed ${theme.colors.borderSoft}`,
              fontSize: 11,
              opacity: 0.7,
            }}
          >
            Demais campos da rotina (tipo, periodicidade, checklist,
            anexos, etc.) permanecem travados para garantir padronização
            nos relatórios e KPIs.
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${theme.colors.borderSoft}`,
                background: "transparent",
                color: theme.colors.text,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !podeEditarBasico}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                background: theme.colors.primary,
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


