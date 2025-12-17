import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Ajuda a identificar o problema do .env rápido
  console.error("[ENV] Variáveis do Supabase não carregadas!");
  console.error("[ENV] VITE_SUPABASE_URL:", SUPABASE_URL || "(vazio)");
  console.error("[ENV] VITE_SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "(ok)" : "(vazio)");
  console.error("[ENV] Dica: .env deve ficar na RAIZ (mesmo nível do package.json) e precisa reiniciar o Vite.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
