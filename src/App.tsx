// src/App.tsx
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

import type { Usuario } from "./types";
import { styles } from "./styles";

import { MainShellV14 } from "./components/MainShellV14";

import AdminPage from "./components/AdminPage";
import { LoginScreen } from "./components/LoginScreen";

type PerfilStatus = "idle" | "loading" | "ok" | "error";

function App() {
  // Sessão de auth
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Perfil na tabela public.usuarios
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [perfilStatus, setPerfilStatus] = useState<PerfilStatus>("idle");
  const [perfilErro, setPerfilErro] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // 1) Restaurar sessão + escutar mudanças
  // ------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const restaurarSessao = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          console.error("getSession error:", error);
        }

        setSession(data.session ?? null);
      } catch (err) {
        console.error("getSession exception:", err);
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) setSessionLoaded(true);
      }
    };

    restaurarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log("AUTH EVENT ->", event, sess);
      if (!isMounted) return;

      setSession(sess ?? null);
      setSessionLoaded(true);

      // Sempre que trocar de usuário, resetar perfil
      setPerfil(null);
      setPerfilStatus("idle");
      setPerfilErro(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ------------------------------------------------------------------
  // 2) Função para carregar perfil na tabela usuarios
  // ------------------------------------------------------------------
  const carregarPerfil = useCallback(
    async (sess: Session | null) => {
      if (!sess?.user) {
        setPerfil(null);
        setPerfilStatus("idle");
        setPerfilErro(null);
        return;
      }

      setPerfilStatus("loading");
      setPerfilErro(null);

      try {
        const userId = sess.user.id;

        const { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        console.log("PERFIL -> data:", data, "error:", error);

        if (error) {
          console.error("ERRO ao carregar perfil:", error);
          setPerfil(null);
          setPerfilStatus("error");
          setPerfilErro(error.message);
          return;
        }

        if (!data) {
          setPerfil(null);
          setPerfilStatus("error");
          setPerfilErro(
            "Usuário não encontrado na tabela 'usuarios'. Verifique se ele foi cadastrado."
          );
          return;
        }

        setPerfil(data as Usuario);
        setPerfilStatus("ok");
        setPerfilErro(null);
      } catch (err) {
        console.error("Exception ao carregar perfil:", err);
        setPerfil(null);
        setPerfilStatus("error");
        setPerfilErro("Erro inesperado ao carregar perfil.");
      }
    },
    []
  );

  // Sempre que mudar a sessão (logar / deslogar / trocar usuário) → busca perfil
  useEffect(() => {
    if (!session) {
      setPerfil(null);
      setPerfilStatus("idle");
      setPerfilErro(null);
      return;
    }

    carregarPerfil(session);
  }, [session, carregarPerfil]);

  // ------------------------------------------------------------------
  // 3) Estados de tela
  // ------------------------------------------------------------------

  // 3.1) Ainda não sabemos se tem sessão (primeiro load da app)
  if (!sessionLoaded) {
    return (
      <div style={styles.appShell}>
        <div style={styles.mainContent}>
          <div
            style={{
              ...styles.card,
              minHeight: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Carregando sessão…
            </h2>
            <p style={{ color: "#ccc", marginTop: 16 }}>Por favor, aguarde.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3.2) Não há sessão -> login
  if (!session) {
    return <LoginScreen />;
  }

  // 3.3) Sessão ok, mas perfil ainda carregando
  if (perfilStatus === "loading" && !perfil) {
    return (
      <div style={styles.appShell}>
        <div style={styles.mainContent}>
          <div
            style={{
              ...styles.card,
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Carregando perfil…
            </h2>
            <p style={{ color: "#ccc", marginTop: 16 }}>Por favor, aguarde.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3.4) Deu erro pra carregar o perfil
  if (perfilStatus === "error" && !perfil) {
    return (
      <div style={styles.appShell}>
        <div style={styles.mainContent}>
          <div
            style={{
              ...styles.card,
              minHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Erro ao carregar perfil
            </h2>
            <p
              style={{
                color: "#f97373",
                marginTop: 12,
                textAlign: "center",
                whiteSpace: "pre-line",
                fontSize: 14,
              }}
            >
              {perfilErro ??
                "Não foi possível carregar as informações do usuário."}
            </p>
            <button
              style={{
                marginTop: 18,
                padding: "8px 16px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: "#22c55e",
                color: "#000",
                fontWeight: 600,
                fontSize: 14,
              }}
              onClick={() => carregarPerfil(session)}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3.5) Sessão ok, perfil ok
  if (!perfil) {
    // fallback de segurança (não era pra cair aqui, mas só pra não travar)
    return (
      <div style={styles.appShell}>
        <div style={styles.mainContent}>
          <div
            style={{
              ...styles.card,
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Perfil não encontrado
            </h2>
            <p style={{ color: "#ccc", marginTop: 16 }}>
              Verifique o cadastro desse usuário na tabela{" "}
              <code>public.usuarios</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 4) Roteamento por nível
  // ------------------------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
    setPerfilStatus("idle");
    setPerfilErro(null);
  };

  if (perfil.nivel === "ADM") {
    return <AdminPage usuario={perfil} onLogout={handleLogout} />;
  }

  return (
    <MainShellV14 perfil={perfil} onLogout={handleLogout} />
  );
}

export default App;
