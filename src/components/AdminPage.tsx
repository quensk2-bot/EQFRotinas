// src/components/AdminPage.tsx
import type React from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../styles";
import type { Usuario } from "../types";

type NivelUsuario = Usuario["nivel"]; // 'ADM' | 'N0' | 'N1' | 'N2' | 'N3' | 'N99'

type Departamento = {
  id: number;
  nome: string;
  codigo: string | null;
  ativo: boolean;
};

type Setor = {
  id: number;
  departamento_id: number;
  nome: string;
  codigo: string | null;
  ativo: boolean;
};

type Regional = {
  id: number;
  setor_id: number;
  nome: string;
  sigla: string | null;
  ativo: boolean;
};

type Grupo = {
  id: number;
  departamento_id: number | null;
  setor_id: number | null;
  regional_id: number | null;
  nome: string;
  ativo: boolean;
};

type AbaAdm = "usuarios" | "estrutura" | "perfis";

const adminStyles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    width: "100vw",
    background:
      "radial-gradient(circle at top, #020617 0, #020617 55%, #000 100%)",
    color: theme.colors.text,
    padding: "24px 0",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "flex-start",
  },
  inner: {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 32px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },

  // header / título / sair
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 700,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  headerRight: {},
  btnLogout: {
    borderRadius: 999,
    border: `1px solid ${theme.colors.borderSoft}`,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    background: theme.colors.bgSoft,
    color: theme.colors.textSoft,
  },

  tabsRow: {
    display: "flex",
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  tab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.borderSoft}`,
    background: theme.colors.bgSoft,
    color: theme.colors.textSoft,
    fontSize: 13,
    cursor: "pointer",
  },
  tabActive: {
    background: theme.colors.neon,
    borderColor: theme.colors.neon,
    color: "#000",
    fontWeight: 600,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    marginTop: 12,
  },
  card: {
    background: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.borderSoft}`,
    boxShadow: "0 18px 40px rgba(0,0,0,0.7)", // ⬅ aqui
    padding: 20,
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
  },
  badge: {
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    background: "#111827",
    color: theme.colors.textMuted,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
  },
  label: {
    color: theme.colors.textSoft,
  },
  input: {
    background: theme.colors.bgSoft,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderSoft}`,
    padding: "8px 10px",
    color: theme.colors.text,
    fontSize: 13,
    outline: "none",
  },
  select: {
    background: theme.colors.bgSoft,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderSoft}`,
    padding: "8px 10px",
    color: theme.colors.text,
    fontSize: 13,
    outline: "none",
  },
  checkboxRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    fontSize: 13,
  },
  formActions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  btnPrimary: {
    borderRadius: 999,
    border: "none",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: theme.colors.neon,
    color: "#000",
  },
  btnSecondary: {
    borderRadius: 999,
    border: `1px solid ${theme.colors.neon}`,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    background: "transparent",
    color: theme.colors.neon,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    marginTop: 6,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.colors.borderSoft}`,
    color: theme.colors.textMuted,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.colors.borderSoft}`,
    whiteSpace: "nowrap",
  },
  tagSuccess: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    background: "rgba(34,197,94,0.16)",
    color: "#4ade80",
  },
  tagMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    background: "#111827",
    color: theme.colors.textMuted,
  },
  tableActions: {
    display: "flex",
    gap: 8,
  },
  btnLink: {
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: 12,
    color: theme.colors.orangeSoft,
    cursor: "pointer",
  },
  btnLinkDanger: {
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: 12,
    color: "#f97373",
    cursor: "pointer",
  },
  emptyRow: {
    textAlign: "center",
    padding: 12,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#f97373",
  },
};

export default function AdminPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAdm>("usuarios");

  // ---------- USUÁRIOS ----------
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] =
    useState<Usuario | null>(null);

  const [formUsuario, setFormUsuario] = useState<{
    nivel: NivelUsuario;
    departamento_id: string | number | "";
    setor_id: string | number | "";
    regional_id: string | number | "";
    ativo: boolean;
  }>({
    nivel: "N1",
    departamento_id: "",
    setor_id: "",
    regional_id: "",
    ativo: true,
  });

  // NOVO USUÁRIO
  const [novoUsuario, setNovoUsuario] = useState<{
    nome: string;
    email: string;
    nivel: NivelUsuario;
    departamento_id: string | number | "";
    setor_id: string | number | "";
    regional_id: string | number | "";
    senha: string;
  }>({
    nome: "",
    email: "",
    nivel: "N1",
    departamento_id: "",
    setor_id: "",
    regional_id: "",
    senha: "",
  });
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [erroNovoUsuario, setErroNovoUsuario] = useState<string | null>(null);

  // ---------- ESTRUTURA ----------
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregandoEstrutura, setCarregandoEstrutura] = useState(false);

  const [editDepId, setEditDepId] = useState<number | null>(null);
  const [formDep, setFormDep] = useState({
    nome: "",
    codigo: "",
    ativo: true,
  });

  const [editSetorId, setEditSetorId] = useState<number | null>(null);
  const [formSetor, setFormSetor] = useState({
    departamento_id: "" as number | "" | string,
    nome: "",
    codigo: "",
    ativo: true,
  });

  const [editRegId, setEditRegId] = useState<number | null>(null);
  const [formReg, setFormReg] = useState({
    setor_id: "" as number | "" | string,
    nome: "",
    sigla: "",
    ativo: true,
  });

  const [editGrupoId, setEditGrupoId] = useState<number | null>(null);
  const [formGrupo, setFormGrupo] = useState<{
    departamento_id: string | number | "";
    setor_id: string | number | "";
    regional_id: string | number | "";
    nome: string;
    ativo: boolean;
  }>({
    departamento_id: "",
    setor_id: "",
    regional_id: "",
    nome: "",
    ativo: true,
  });

  // ---------- LOGOUT ----------
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  // ---------- CARREGAR DADOS INICIAIS ----------
  useEffect(() => {
    carregarUsuarios();
    carregarEstrutura();
  }, []);

  async function carregarUsuarios() {
    setCarregandoUsuarios(true);
    const { data, error } = await supabase
      .from("usuarios")
      .select(
        `
        id,
        nome,
        email,
        nivel,
        departamento_id,
        setor_id,
        regional_id,
        ativo
      `,
      )
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar usuários:", error.message);
      setCarregandoUsuarios(false);
      return;
    }

    setUsuarios((data ?? []) as Usuario[]);
    setCarregandoUsuarios(false);
  }

  async function carregarEstrutura() {
    setCarregandoEstrutura(true);

    const [depRes, setRes, regRes, grpRes] = await Promise.all([
      supabase
        .from("departamentos")
        .select("id, nome, codigo, ativo")
        .order("nome"),
      supabase
        .from("setores")
        .select("id, departamento_id, nome, codigo, ativo")
        .order("nome"),
      supabase
        .from("regionais")
        .select("id, setor_id, nome, sigla, ativo")
        .order("nome"),
      supabase
        .from("grupos")
        .select("id, departamento_id, setor_id, regional_id, nome, ativo")
        .order("nome"),
    ]);

    if (depRes.error) {
      console.error("Erro ao carregar departamentos:", depRes.error.message);
    } else {
      setDepartamentos(
        (depRes.data ?? []).map((d: any) => ({
          id: d.id,
          nome: d.nome,
          codigo: d.codigo,
          ativo: d.ativo,
        })),
      );
    }

    if (setRes.error) {
      console.error("Erro ao carregar setores:", setRes.error.message);
    } else {
      setSetores(
        (setRes.data ?? []).map((s: any) => ({
          id: s.id,
          departamento_id: s.departamento_id,
          nome: s.nome,
          codigo: s.codigo,
          ativo: s.ativo,
        })),
      );
    }

    if (regRes.error) {
      console.error("Erro ao carregar regionais:", regRes.error.message);
    } else {
      setRegionais(
        (regRes.data ?? []).map((r: any) => ({
          id: r.id,
          setor_id: r.setor_id,
          nome: r.nome,
          sigla: r.sigla,
          ativo: r.ativo,
        })),
      );
    }

    if (grpRes.error) {
      console.error("Erro ao carregar grupos:", grpRes.error.message);
    } else {
      setGrupos(
        (grpRes.data ?? []).map((g: any) => ({
          id: g.id,
          departamento_id: g.departamento_id,
          setor_id: g.setor_id,
          regional_id: g.regional_id,
          nome: g.nome,
          ativo: g.ativo,
        })),
      );
    }

    setCarregandoEstrutura(false);
  }

  // ---------- NOVO USUÁRIO ----------
  async function criarNovoUsuario(e: React.FormEvent) {
    e.preventDefault();
    setErroNovoUsuario(null);

    if (
      !novoUsuario.nome.trim() ||
      !novoUsuario.email.trim() ||
      !novoUsuario.senha.trim()
    ) {
      setErroNovoUsuario("Nome, e-mail e senha são obrigatórios.");
      return;
    }

    if (novoUsuario.senha.trim().length < 6) {
      setErroNovoUsuario("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setCriandoUsuario(true);
    try {
      const payload = {
        nome: novoUsuario.nome.trim(),
        email: novoUsuario.email.trim(),
        nivel: novoUsuario.nivel,
        departamento_id:
          novoUsuario.departamento_id === ""
            ? null
            : Number(novoUsuario.departamento_id),
        setor_id:
          novoUsuario.setor_id === "" ? null : Number(novoUsuario.setor_id),
        regional_id:
          novoUsuario.regional_id === ""
            ? null
            : Number(novoUsuario.regional_id),
        senha: novoUsuario.senha.trim(),
      };

      const { data, error } = await supabase.functions.invoke(
        "eqf-provision-user",
        {
          body: payload,
          headers: {
            "x-eqf-admin-key":
              (import.meta as any).env.VITE_EQF_ADMIN_KEY || "dev-admin-key-123",
          },
        },
      );

      console.log("DEBUG eqf-provision-user ->", { data, error });

      if (error) {
        console.error("Erro ao criar usuário (function):", error);
        setErroNovoUsuario("Erro ao criar usuário.");
      } else if (data && (data as any).ok === false) {
        console.error("Erro de negócio ao criar usuário:", data);
        const msg =
          typeof (data as any).message === "string"
            ? (data as any).message
            : "Erro ao criar usuário.";
        setErroNovoUsuario(msg);
      } else {
        setNovoUsuario({
          nome: "",
          email: "",
          nivel: "N1",
          departamento_id: "",
          setor_id: "",
          regional_id: "",
          senha: "",
        });
        await carregarUsuarios();
      }
    } catch (err) {
      console.error("Erro inesperado ao criar usuário:", err);
      setErroNovoUsuario("Erro inesperado ao criar usuário.");
    } finally {
      setCriandoUsuario(false);
    }
  }

  // ---------- USUÁRIOS: SELECIONAR / EDITAR ----------
  function selecionarUsuario(u: Usuario) {
    setUsuarioSelecionado(u);
    setFormUsuario({
      nivel: u.nivel,
      departamento_id: u.departamento_id ?? "",
      setor_id: u.setor_id ?? "",
      regional_id: u.regional_id ?? "",
      ativo: (u as any).ativo ?? true,
    });
  }

  function limparUsuarioSelecionado() {
    setUsuarioSelecionado(null);
    setFormUsuario({
      nivel: "N1",
      departamento_id: "",
      setor_id: "",
      regional_id: "",
      ativo: true,
    });
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSelecionado) {
      alert("Selecione um usuário na tabela para editar.");
      return;
    }

    const payload = {
      nivel: formUsuario.nivel,
      departamento_id:
        formUsuario.departamento_id === ""
          ? null
          : Number(formUsuario.departamento_id),
      setor_id:
        formUsuario.setor_id === "" ? null : Number(formUsuario.setor_id),
      regional_id:
        formUsuario.regional_id === ""
          ? null
          : Number(formUsuario.regional_id),
      ativo: formUsuario.ativo,
    };

    const { error } = await supabase
      .from("usuarios")
      .update(payload)
      .eq("id", usuarioSelecionado.id);

    if (error) {
      console.error("Erro ao atualizar usuário:", error.message);
      alert("Erro ao atualizar usuário.");
      return;
    }

    await carregarUsuarios();
    const atualizado =
      usuarios.find((u) => u.id === usuarioSelecionado.id) ?? null;
    if (atualizado) {
      selecionarUsuario(atualizado);
    } else {
      limparUsuarioSelecionado();
    }
  }

  async function excluirUsuario(id: string) {
    if (
      !window.confirm(
        "Excluir o registro de perfil deste usuário? (O usuário auth continua existindo, apenas o perfil é removido.)",
      )
    )
      return;

    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir usuário:", error.message);
      alert("Erro ao excluir usuário.");
      return;
    }
    await carregarUsuarios();
    if (usuarioSelecionado?.id === id) limparUsuarioSelecionado();
  }

  // ---------- DEPARTAMENTO ----------
  function iniciarNovoDep() {
    setEditDepId(null);
    setFormDep({
      nome: "",
      codigo: "",
      ativo: true,
    });
  }

  function editarDep(dep: Departamento) {
    setEditDepId(dep.id);
    setFormDep({
      nome: dep.nome,
      codigo: dep.codigo ?? "",
      ativo: dep.ativo,
    });
  }

  async function salvarDep(e: React.FormEvent) {
    e.preventDefault();
    if (!formDep.nome.trim()) {
      alert("Nome do departamento é obrigatório.");
      return;
    }

    const payload = {
      nome: formDep.nome.trim(),
      codigo: formDep.codigo.trim() || null,
      ativo: formDep.ativo,
    };

    if (editDepId) {
      const { error } = await supabase
        .from("departamentos")
        .update(payload)
        .eq("id", editDepId);
      if (error) {
        console.error("Erro ao atualizar departamento:", error.message);
        alert("Erro ao atualizar departamento.");
        return;
      }
    } else {
      const { error } = await supabase.from("departamentos").insert(payload);
      if (error) {
        console.error("Erro ao criar departamento:", error.message);
        alert("Erro ao criar departamento.");
        return;
      }
    }

    await carregarEstrutura();
    iniciarNovoDep();
  }

  async function excluirDep(id: number) {
    if (
      !window.confirm(
        "Excluir este departamento? (verifique se não há setores vinculados)",
      )
    )
      return;
    const { error } = await supabase.from("departamentos").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir departamento:", error.message);
      alert("Erro ao excluir departamento.");
      return;
    }
    await carregarEstrutura();
    if (editDepId === id) iniciarNovoDep();
  }

  // ---------- SETOR ----------
  function iniciarNovoSetor() {
    setEditSetorId(null);
    setFormSetor({
      departamento_id: "",
      nome: "",
      codigo: "",
      ativo: true,
    });
  }

  function editarSetor(setor: Setor) {
    setEditSetorId(setor.id);
    setFormSetor({
      departamento_id: setor.departamento_id,
      nome: setor.nome,
      codigo: setor.codigo ?? "",
      ativo: setor.ativo,
    });
  }

  async function salvarSetor(e: React.FormEvent) {
    e.preventDefault();
    if (!formSetor.nome.trim()) {
      alert("Nome do setor é obrigatório.");
      return;
    }
    if (!formSetor.departamento_id) {
      alert("Selecione o departamento do setor.");
      return;
    }

    const payload = {
      departamento_id: Number(formSetor.departamento_id),
      nome: formSetor.nome.trim(),
      codigo: formSetor.codigo.trim() || null,
      ativo: formSetor.ativo,
    };

    if (editSetorId) {
      const { error } = await supabase
        .from("setores")
        .update(payload)
        .eq("id", editSetorId);
      if (error) {
        console.error("Erro ao atualizar setor:", error.message);
        alert("Erro ao atualizar setor.");
        return;
      }
    } else {
      const { error } = await supabase.from("setores").insert(payload);
      if (error) {
        console.error("Erro ao criar setor:", error.message);
        alert("Erro ao criar setor.");
        return;
      }
    }

    await carregarEstrutura();
    iniciarNovoSetor();
  }

  async function excluirSetor(id: number) {
    if (
      !window.confirm(
        "Excluir este setor? (verifique se não há regionais vinculadas)",
      )
    )
      return;
    const { error } = await supabase.from("setores").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir setor:", error.message);
      alert("Erro ao excluir setor.");
      return;
    }
    await carregarEstrutura();
    if (editSetorId === id) iniciarNovoSetor();
  }

  // ---------- REGIONAL ----------
  function iniciarNovoReg() {
    setEditRegId(null);
    setFormReg({
      setor_id: "",
      nome: "",
      sigla: "",
      ativo: true,
    });
  }

  function editarReg(reg: Regional) {
    setEditRegId(reg.id);
    setFormReg({
      setor_id: reg.setor_id,
      nome: reg.nome,
      sigla: reg.sigla ?? "",
      ativo: reg.ativo,
    });
  }

  async function salvarReg(e: React.FormEvent) {
    e.preventDefault();
    if (!formReg.nome.trim()) {
      alert("Nome da regional é obrigatório.");
      return;
    }
    if (!formReg.setor_id) {
      alert("Selecione o setor da regional.");
      return;
    }

    const payload = {
      setor_id: Number(formReg.setor_id),
      nome: formReg.nome.trim(),
      sigla: formReg.sigla.trim() || null,
      ativo: formReg.ativo,
    };

    if (editRegId) {
      const { error } = await supabase
        .from("regionais")
        .update(payload)
        .eq("id", editRegId);
      if (error) {
        console.error("Erro ao atualizar regional:", error.message);
        alert("Erro ao atualizar regional.");
        return;
      }
    } else {
      const { error } = await supabase.from("regionais").insert(payload);
      if (error) {
        console.error("Erro ao criar regional:", error.message);
        alert("Erro ao criar regional.");
        return;
      }
    }

    await carregarEstrutura();
    iniciarNovoReg();
  }

  async function excluirReg(id: number) {
    if (!window.confirm("Excluir esta regional?")) return;
    const { error } = await supabase.from("regionais").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir regional:", error.message);
      alert("Erro ao excluir regional.");
      return;
    }
    await carregarEstrutura();
    if (editRegId === id) iniciarNovoReg();
  }

  // ---------- GRUPOS ----------
  function iniciarNovoGrupo() {
    setEditGrupoId(null);
    setFormGrupo({
      departamento_id: "",
      setor_id: "",
      regional_id: "",
      nome: "",
      ativo: true,
    });
  }

  function editarGrupo(g: Grupo) {
    setEditGrupoId(g.id);
    setFormGrupo({
      departamento_id: g.departamento_id ?? "",
      setor_id: g.setor_id ?? "",
      regional_id: g.regional_id ?? "",
      nome: g.nome,
      ativo: g.ativo,
    });
  }

  async function salvarGrupo(e: React.FormEvent) {
    e.preventDefault();
    if (!formGrupo.nome.trim()) {
      alert("Nome do grupo é obrigatório.");
      return;
    }
    if (!formGrupo.departamento_id) {
      alert("Selecione o departamento do grupo.");
      return;
    }
    if (!formGrupo.setor_id) {
      alert("Selecione o setor do grupo.");
      return;
    }
    if (!formGrupo.regional_id) {
      alert("Selecione a regional do grupo.");
      return;
    }

    const payload = {
      departamento_id: Number(formGrupo.departamento_id),
      setor_id: Number(formGrupo.setor_id),
      regional_id: Number(formGrupo.regional_id),
      nome: formGrupo.nome.trim(),
      ativo: formGrupo.ativo,
    };

    if (editGrupoId) {
      const { error } = await supabase
        .from("grupos")
        .update(payload)
        .eq("id", editGrupoId);
      if (error) {
        console.error("Erro ao atualizar grupo:", error.message);
        alert("Erro ao atualizar grupo.");
        return;
      }
    } else {
      const { error } = await supabase.from("grupos").insert(payload);
      if (error) {
        console.error("Erro ao criar grupo:", error.message);
        alert("Erro ao criar grupo.");
        return;
      }
    }

    await carregarEstrutura();
    iniciarNovoGrupo();
  }

  async function excluirGrupo(id: number) {
    if (
      !window.confirm(
        "Excluir este grupo? (verifique se não há rotinas vinculadas)",
      )
    )
      return;

    const { error } = await supabase.from("grupos").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir grupo:", error.message);
      alert("Erro ao excluir grupo.");
      return;
    }
    await carregarEstrutura();
    if (editGrupoId === id) iniciarNovoGrupo();
  }

  // ---------- RENDER ----------
  return (
    <div style={adminStyles.container}>
      <div style={adminStyles.inner}>
        {/* HEADER COM BOTÃO SAIR */}
        <header style={adminStyles.headerRow}>
          <div style={adminStyles.headerText}>
            <h1 style={adminStyles.headerTitle}>Administração</h1>
            <p style={adminStyles.headerSubtitle}>
              Cadastro e gestão de usuários e estrutura (departamentos, setores,
              regionais e grupos)
            </p>
          </div>
          <div style={adminStyles.headerRight}>
            <button
              type="button"
              style={adminStyles.btnLogout}
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </header>

        {/* TABS */}
        <nav style={adminStyles.tabsRow}>
          <button
            type="button"
            style={{
              ...adminStyles.tab,
              ...(abaAtiva === "usuarios" ? adminStyles.tabActive : {}),
            }}
            onClick={() => setAbaAtiva("usuarios")}
          >
            Usuários
          </button>

          <button
            type="button"
            style={{
              ...adminStyles.tab,
              ...(abaAtiva === "estrutura" ? adminStyles.tabActive : {}),
            }}
            onClick={() => setAbaAtiva("estrutura")}
          >
            Estrutura (Dept / Setor / Regional / Grupo)
          </button>

          <button
            type="button"
            style={{
              ...adminStyles.tab,
              ...(abaAtiva === "perfis" ? adminStyles.tabActive : {}),
            }}
            onClick={() => setAbaAtiva("perfis")}
          >
            Perfis / Níveis
          </button>
        </nav>

        {/* CONTEÚDO */}
        {abaAtiva === "usuarios" && (
          <section style={adminStyles.section}>
            {/* NOVO USUÁRIO */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>Novo usuário</h2>
                <span style={adminStyles.badge}>Criação de usuário</span>
              </div>

              <form onSubmit={criarNovoUsuario}>
                <div style={adminStyles.formGrid}>
                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nome</label>
                    <input
                      type="text"
                      value={novoUsuario.nome}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                      placeholder="Nome completo"
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>E-mail</label>
                    <input
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                      placeholder="email@empresa.com"
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Senha inicial</label>
                    <input
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          senha: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                      placeholder="Defina a senha de acesso"
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nível</label>
                    <select
                      value={novoUsuario.nivel}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          nivel: e.target.value as NivelUsuario,
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="N1">Nível 1</option>
                      <option value="N2">Nível 2</option>
                      <option value="N3">Nível 3</option>
                      <option value="N0">Nível 0 (visualização)</option>
                      <option value="N99">Nível 99 (técnico)</option>
                      <option value="ADM">ADM</option>
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Departamento</label>
                    <select
                      value={novoUsuario.departamento_id}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          departamento_id: e.target.value,
                          setor_id: "",
                          regional_id: "",
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Nenhum –</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Setor</label>
                    <select
                      value={novoUsuario.setor_id}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          setor_id: e.target.value,
                          regional_id: "",
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Nenhum –</option>
                      {setores
                        .filter(
                          (s) =>
                            !novoUsuario.departamento_id ||
                            s.departamento_id ===
                              Number(novoUsuario.departamento_id),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Regional</label>
                    <select
                      value={novoUsuario.regional_id}
                      onChange={(e) =>
                        setNovoUsuario((prev) => ({
                          ...prev,
                          regional_id: e.target.value,
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Nenhuma –</option>
                      {regionais
                        .filter(
                          (r) =>
                            !novoUsuario.setor_id ||
                            r.setor_id === Number(novoUsuario.setor_id),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {erroNovoUsuario && (
                  <p style={adminStyles.errorText}>{erroNovoUsuario}</p>
                )}

                <div style={adminStyles.formActions}>
                  <button
                    type="submit"
                    style={adminStyles.btnPrimary}
                    disabled={criandoUsuario}
                  >
                    {criandoUsuario ? "Criando usuário..." : "Criar usuário"}
                  </button>
                </div>
              </form>
            </div>

            {/* EDITAR USUÁRIO / AJUSTAR PERFIL */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>
                  {usuarioSelecionado
                    ? "Editar usuário"
                    : "Selecione um usuário"}
                </h2>
              </div>

              {usuarioSelecionado ? (
                <form onSubmit={salvarUsuario}>
                  <div style={adminStyles.formGrid}>
                    <div style={adminStyles.formGroup}>
                      <span style={adminStyles.label}>Nome</span>
                      <div
                        style={{ ...adminStyles.input, borderStyle: "dashed" }}
                      >
                        {usuarioSelecionado.nome}
                      </div>
                    </div>
                    <div style={adminStyles.formGroup}>
                      <span style={adminStyles.label}>E-mail</span>
                      <div
                        style={{ ...adminStyles.input, borderStyle: "dashed" }}
                      >
                        {usuarioSelecionado.email}
                      </div>
                    </div>

                    <div style={adminStyles.formGroup}>
                      <label style={adminStyles.label}>Nível</label>
                      <select
                        value={formUsuario.nivel}
                        onChange={(e) =>
                          setFormUsuario((prev) => ({
                            ...prev,
                            nivel: e.target.value as NivelUsuario,
                          }))
                        }
                        style={adminStyles.select}
                      >
                        <option value="ADM">ADM</option>
                        <option value="N1">Nível 1</option>
                        <option value="N2">Nível 2</option>
                        <option value="N3">Nível 3</option>
                        <option value="N0">Nível 0 (visualização)</option>
                        <option value="N99">Nível 99 (técnico)</option>
                      </select>
                    </div>

                    <div style={adminStyles.formGroup}>
                      <label style={adminStyles.label}>Departamento</label>
                      <select
                        value={formUsuario.departamento_id}
                        onChange={(e) =>
                          setFormUsuario((prev) => ({
                            ...prev,
                            departamento_id: e.target.value,
                            setor_id: "",
                            regional_id: "",
                          }))
                        }
                        style={adminStyles.select}
                      >
                        <option value="">– Nenhum –</option>
                        {departamentos.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={adminStyles.formGroup}>
                      <label style={adminStyles.label}>Setor</label>
                      <select
                        value={formUsuario.setor_id}
                        onChange={(e) =>
                          setFormUsuario((prev) => ({
                            ...prev,
                            setor_id: e.target.value,
                            regional_id: "",
                          }))
                        }
                        style={adminStyles.select}
                      >
                        <option value="">– Nenhum –</option>
                        {setores
                          .filter(
                            (s) =>
                              !formUsuario.departamento_id ||
                              s.departamento_id ===
                                Number(formUsuario.departamento_id),
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={adminStyles.formGroup}>
                      <label style={adminStyles.label}>Regional</label>
                      <select
                        value={formUsuario.regional_id}
                        onChange={(e) =>
                          setFormUsuario((prev) => ({
                            ...prev,
                            regional_id: e.target.value,
                          }))
                        }
                        style={adminStyles.select}
                      >
                        <option value="">– Nenhuma –</option>
                        {regionais
                          .filter(
                            (r) =>
                              !formUsuario.setor_id ||
                              r.setor_id === Number(formUsuario.setor_id),
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nome}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={adminStyles.formGroup}>
                      <label style={adminStyles.label}>Status</label>
                      <label style={adminStyles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={formUsuario.ativo}
                          onChange={(e) =>
                            setFormUsuario((prev) => ({
                              ...prev,
                              ativo: e.target.checked,
                            }))
                          }
                        />
                        Ativo
                      </label>
                    </div>
                  </div>

                  <div style={adminStyles.formActions}>
                    <button type="submit" style={adminStyles.btnPrimary}>
                      Salvar alterações
                    </button>
                    <button
                      type="button"
                      style={adminStyles.btnSecondary}
                      onClick={limparUsuarioSelecionado}
                    >
                      Limpar seleção
                    </button>
                  </div>
                </form>
              ) : (
                <p style={{ fontSize: 13, color: theme.colors.textMuted }}>
                  Clique em um usuário na tabela abaixo para editar nível,
                  departamento, setor, regional e status.
                </p>
              )}
            </div>

            {/* TABELA DE USUÁRIOS */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>Usuários cadastrados</h2>
                {carregandoUsuarios && (
                  <span style={adminStyles.badge}>Carregando…</span>
                )}
              </div>

              <div style={adminStyles.tableWrap}>
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Nome</th>
                      <th style={adminStyles.th}>E-mail</th>
                      <th style={adminStyles.th}>Nível</th>
                      <th style={adminStyles.th}>Departamento</th>
                      <th style={adminStyles.th}>Setor</th>
                      <th style={adminStyles.th}>Regional</th>
                      <th style={adminStyles.th}>Status</th>
                      <th style={adminStyles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan={8} style={adminStyles.emptyRow}>
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    )}

                    {usuarios.map((u) => {
                      const dep = departamentos.find(
                        (d) => d.id === (u as any).departamento_id,
                      );
                      const set = setores.find(
                        (s) => s.id === (u as any).setor_id,
                      );
                      const reg = regionais.find(
                        (r) => r.id === (u as any).regional_id,
                      );
                      const ativo = (u as any).ativo ?? true;

                      return (
                        <tr key={u.id}>
                          <td style={adminStyles.td}>{u.nome}</td>
                          <td style={adminStyles.td}>{u.email}</td>
                          <td style={adminStyles.td}>{u.nivel}</td>
                          <td style={adminStyles.td}>{dep?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{set?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{reg?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>
                            <span
                              style={
                                ativo
                                  ? adminStyles.tagSuccess
                                  : adminStyles.tagMuted
                              }
                            >
                              {ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td style={adminStyles.td}>
                            <div style={adminStyles.tableActions}>
                              <button
                                type="button"
                                style={adminStyles.btnLink}
                                onClick={() => selecionarUsuario(u)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                style={adminStyles.btnLinkDanger}
                                onClick={() => excluirUsuario(u.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {abaAtiva === "estrutura" && (
          <section style={adminStyles.section}>
            {/* DEPARTAMENTOS */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>
                  Departamentos ({departamentos.length})
                </h2>
                {carregandoEstrutura && (
                  <span style={adminStyles.badge}>Atualizando…</span>
                )}
              </div>

              <form onSubmit={salvarDep}>
                <div style={adminStyles.formGrid}>
                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nome</label>
                    <input
                      type="text"
                      value={formDep.nome}
                      onChange={(e) =>
                        setFormDep((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Código</label>
                    <input
                      type="text"
                      value={formDep.codigo}
                      onChange={(e) =>
                        setFormDep((prev) => ({
                          ...prev,
                          codigo: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Status</label>
                    <label style={adminStyles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={formDep.ativo}
                        onChange={(e) =>
                          setFormDep((prev) => ({
                            ...prev,
                            ativo: e.target.checked,
                          }))
                        }
                      />
                      Ativo
                    </label>
                  </div>
                </div>

                <div style={adminStyles.formActions}>
                  <button type="submit" style={adminStyles.btnPrimary}>
                    {editDepId
                      ? "Salvar departamento"
                      : "Cadastrar departamento"}
                  </button>
                  {editDepId && (
                    <button
                      type="button"
                      style={adminStyles.btnSecondary}
                      onClick={iniciarNovoDep}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div style={adminStyles.tableWrap}>
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Nome</th>
                      <th style={adminStyles.th}>Código</th>
                      <th style={adminStyles.th}>Status</th>
                      <th style={adminStyles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departamentos.length === 0 && (
                      <tr>
                        <td colSpan={4} style={adminStyles.emptyRow}>
                          Nenhum departamento cadastrado.
                        </td>
                      </tr>
                    )}

                    {departamentos.map((d) => (
                      <tr key={d.id}>
                        <td style={adminStyles.td}>{d.nome}</td>
                        <td style={adminStyles.td}>{d.codigo ?? "–"}</td>
                        <td style={adminStyles.td}>
                          <span
                            style={
                              d.ativo
                                ? adminStyles.tagSuccess
                                : adminStyles.tagMuted
                            }
                          >
                            {d.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td style={adminStyles.td}>
                          <div style={adminStyles.tableActions}>
                            <button
                              type="button"
                              style={adminStyles.btnLink}
                              onClick={() => editarDep(d)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              style={adminStyles.btnLinkDanger}
                              onClick={() => excluirDep(d.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SETORES */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>
                  Setores ({setores.length})
                </h2>
              </div>

              <form onSubmit={salvarSetor}>
                <div style={adminStyles.formGrid}>
                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Departamento</label>
                    <select
                      value={formSetor.departamento_id}
                      onChange={(e) =>
                        setFormSetor((prev) => ({
                          ...prev,
                          departamento_id: e.target.value,
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Selecione –</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nome do setor</label>
                    <input
                      type="text"
                      value={formSetor.nome}
                      onChange={(e) =>
                        setFormSetor((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Código</label>
                    <input
                      type="text"
                      value={formSetor.codigo}
                      onChange={(e) =>
                        setFormSetor((prev) => ({
                          ...prev,
                          codigo: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Status</label>
                    <label style={adminStyles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={formSetor.ativo}
                        onChange={(e) =>
                          setFormSetor((prev) => ({
                            ...prev,
                            ativo: e.target.checked,
                          }))
                        }
                      />
                      Ativo
                    </label>
                  </div>
                </div>

                <div style={adminStyles.formActions}>
                  <button type="submit" style={adminStyles.btnPrimary}>
                    {editSetorId ? "Salvar setor" : "Cadastrar setor"}
                  </button>
                  {editSetorId && (
                    <button
                      type="button"
                      style={adminStyles.btnSecondary}
                      onClick={iniciarNovoSetor}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div style={adminStyles.tableWrap}>
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Departamento</th>
                      <th style={adminStyles.th}>Setor</th>
                      <th style={adminStyles.th}>Código</th>
                      <th style={adminStyles.th}>Status</th>
                      <th style={adminStyles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setores.length === 0 && (
                      <tr>
                        <td colSpan={5} style={adminStyles.emptyRow}>
                          Nenhum setor cadastrado.
                        </td>
                      </tr>
                    )}

                    {setores.map((s) => {
                      const dep = departamentos.find(
                        (d) => d.id === s.departamento_id,
                      );
                      return (
                        <tr key={s.id}>
                          <td style={adminStyles.td}>{dep?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{s.nome}</td>
                          <td style={adminStyles.td}>{s.codigo ?? "–"}</td>
                          <td style={adminStyles.td}>
                            <span
                              style={
                                s.ativo
                                  ? adminStyles.tagSuccess
                                  : adminStyles.tagMuted
                              }
                            >
                              {s.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td style={adminStyles.td}>
                            <div style={adminStyles.tableActions}>
                              <button
                                type="button"
                                style={adminStyles.btnLink}
                                onClick={() => editarSetor(s)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                style={adminStyles.btnLinkDanger}
                                onClick={() => excluirSetor(s.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* REGIONAIS */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>
                  Regionais ({regionais.length})
                </h2>
              </div>

              <form onSubmit={salvarReg}>
                <div style={adminStyles.formGrid}>
                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Setor</label>
                    <select
                      value={formReg.setor_id}
                      onChange={(e) =>
                        setFormReg((prev) => ({
                          ...prev,
                          setor_id: e.target.value,
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Selecione –</option>
                      {setores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nome da regional</label>
                    <input
                      type="text"
                      value={formReg.nome}
                      onChange={(e) =>
                        setFormReg((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Sigla</label>
                    <input
                      type="text"
                      value={formReg.sigla}
                      onChange={(e) =>
                        setFormReg((prev) => ({
                          ...prev,
                          sigla: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Status</label>
                    <label style={adminStyles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={formReg.ativo}
                        onChange={(e) =>
                          setFormReg((prev) => ({
                            ...prev,
                            ativo: e.target.checked,
                          }))
                        }
                      />
                      Ativo
                    </label>
                  </div>
                </div>

                <div style={adminStyles.formActions}>
                  <button type="submit" style={adminStyles.btnPrimary}>
                    {editRegId ? "Salvar regional" : "Cadastrar regional"}
                  </button>
                  {editRegId && (
                    <button
                      type="button"
                      style={adminStyles.btnSecondary}
                      onClick={iniciarNovoReg}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div style={adminStyles.tableWrap}>
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Setor</th>
                      <th style={adminStyles.th}>Regional</th>
                      <th style={adminStyles.th}>Sigla</th>
                      <th style={adminStyles.th}>Status</th>
                      <th style={adminStyles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionais.length === 0 && (
                      <tr>
                        <td colSpan={5} style={adminStyles.emptyRow}>
                          Nenhuma regional cadastra­da.
                        </td>
                      </tr>
                    )}

                    {regionais.map((r) => {
                      const setor = setores.find((s) => s.id === r.setor_id);
                      return (
                        <tr key={r.id}>
                          <td style={adminStyles.td}>{setor?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{r.nome}</td>
                          <td style={adminStyles.td}>{r.sigla ?? "–"}</td>
                          <td style={adminStyles.td}>
                            <span
                              style={
                                r.ativo
                                  ? adminStyles.tagSuccess
                                  : adminStyles.tagMuted
                              }
                            >
                              {r.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td style={adminStyles.td}>
                            <div style={adminStyles.tableActions}>
                              <button
                                type="button"
                                style={adminStyles.btnLink}
                                onClick={() => editarReg(r)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                style={adminStyles.btnLinkDanger}
                                onClick={() => excluirReg(r.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GRUPOS */}
            <div style={adminStyles.card}>
              <div style={adminStyles.cardHeaderRow}>
                <h2 style={adminStyles.cardTitle}>Grupos ({grupos.length})</h2>
              </div>

              <form onSubmit={salvarGrupo}>
                <div style={adminStyles.formGrid}>
                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Departamento</label>
                    <select
                      value={formGrupo.departamento_id}
                      onChange={(e) =>
                        setFormGrupo((prev) => ({
                          ...prev,
                          departamento_id: e.target.value,
                          setor_id: "",
                          regional_id: "",
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Selecione –</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Setor</label>
                    <select
                      value={formGrupo.setor_id}
                      onChange={(e) =>
                        setFormGrupo((prev) => ({
                          ...prev,
                          setor_id: e.target.value,
                          regional_id: "",
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Selecione –</option>
                      {setores
                        .filter(
                          (s) =>
                            !formGrupo.departamento_id ||
                            s.departamento_id ===
                              Number(formGrupo.departamento_id),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Regional</label>
                    <select
                      value={formGrupo.regional_id}
                      onChange={(e) =>
                        setFormGrupo((prev) => ({
                          ...prev,
                          regional_id: e.target.value,
                        }))
                      }
                      style={adminStyles.select}
                    >
                      <option value="">– Selecione –</option>
                      {regionais
                        .filter(
                          (r) =>
                            !formGrupo.setor_id ||
                            r.setor_id === Number(formGrupo.setor_id),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Nome do grupo</label>
                    <input
                      type="text"
                      value={formGrupo.nome}
                      onChange={(e) =>
                        setFormGrupo((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      style={adminStyles.input}
                    />
                  </div>

                  <div style={adminStyles.formGroup}>
                    <label style={adminStyles.label}>Status</label>
                    <label style={adminStyles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={formGrupo.ativo}
                        onChange={(e) =>
                          setFormGrupo((prev) => ({
                            ...prev,
                            ativo: e.target.checked,
                          }))
                        }
                      />
                      Ativo
                    </label>
                  </div>
                </div>

                <div style={adminStyles.formActions}>
                  <button type="submit" style={adminStyles.btnPrimary}>
                    {editGrupoId ? "Salvar grupo" : "Cadastrar grupo"}
                  </button>
                  {editGrupoId && (
                    <button
                      type="button"
                      style={adminStyles.btnSecondary}
                      onClick={iniciarNovoGrupo}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div style={adminStyles.tableWrap}>
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Departamento</th>
                      <th style={adminStyles.th}>Setor</th>
                      <th style={adminStyles.th}>Regional</th>
                      <th style={adminStyles.th}>Grupo</th>
                      <th style={adminStyles.th}>Status</th>
                      <th style={adminStyles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.length === 0 && (
                      <tr>
                        <td colSpan={6} style={adminStyles.emptyRow}>
                          Nenhum grupo cadastrado.
                        </td>
                      </tr>
                    )}

                    {grupos.map((g) => {
                      const dep = g.departamento_id
                        ? departamentos.find((d) => d.id === g.departamento_id)
                        : undefined;
                      const set = g.setor_id
                        ? setores.find((s) => s.id === g.setor_id)
                        : undefined;
                      const reg = g.regional_id
                        ? regionais.find((r) => r.id === g.regional_id)
                        : undefined;

                      return (
                        <tr key={g.id}>
                          <td style={adminStyles.td}>{dep?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{set?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{reg?.nome ?? "–"}</td>
                          <td style={adminStyles.td}>{g.nome}</td>
                          <td style={adminStyles.td}>
                            <span
                              style={
                                g.ativo
                                  ? adminStyles.tagSuccess
                                  : adminStyles.tagMuted
                              }
                            >
                              {g.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td style={adminStyles.td}>
                            <div style={adminStyles.tableActions}>
                              <button
                                type="button"
                                style={adminStyles.btnLink}
                                onClick={() => editarGrupo(g)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                style={adminStyles.btnLinkDanger}
                                onClick={() => excluirGrupo(g.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {abaAtiva === "perfis" && (
          <section style={adminStyles.section}>
            <div style={adminStyles.card}>
              <h2 style={adminStyles.cardTitle}>Perfis / Níveis</h2>
              <p style={{ fontSize: 13, color: theme.colors.textMuted }}>
                Nesta versão, os perfis são controlados pelo campo{" "}
                <code>nivel</code> da tabela <code>usuarios</code> (ADM, N1,
                N2, N3, N0, N99). Futuramente podemos criar aqui uma tela para
                documentação e gestão avançada de permissões.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
