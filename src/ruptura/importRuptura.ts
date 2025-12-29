/**
 * IMPORTAÇÃO DE RUPTURA – MVP (MODELO FINAL)
 * Lê TXT (; com cabeçalho) e grava em ruptura.ruptura_raw
 * Compatível com Node 22 + Windows (fetch estável)
 */

import dotenv from "dotenv";
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


import fs from "fs";
import https from "https";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ======================================================
// 🔧 WORKAROUND DEFINITIVO – NODE 22 / WINDOWS
// Força fetch estável + IPv4 (contorna Undici)
// ======================================================
const httpsAgent = new https.Agent({
  keepAlive: true,
  family: 4,
  rejectUnauthorized: false // <<< ESSENCIAL (proxy corporativo)
});

// injeta fetch estável no runtime
(globalThis as any).fetch = (url: any, options: any) =>
  fetch(url, { ...options, agent: httpsAgent });

// ======================================================
// CONFIGURAÇÃO FIXA (por execução)
// ======================================================
const REGIONAL = "MT";
const BANDEIRA = "COMPER";

const CAMINHO_TXT =
  "C:\\projeto raiz\\adm\\src\\ruptura\\ArquivosRuptura\\MT\\Comper\\RupturaComper.txt";

// ======================================================
// SUPABASE (SERVICE ROLE + SCHEMA RUPTURA)
// ======================================================
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    db: { schema: "ruptura" }
  }
);

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================
function toInt(valor: string | undefined): number | null {
  if (!valor) return null;
  const n = Number(valor.trim());
  return Number.isFinite(n) ? n : null;
}

function toText(valor: string | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  return v === "" ? null : v;
}

// ======================================================
// EXECUÇÃO PRINCIPAL
// ======================================================
async function importarRuptura() {
  console.log("🔹 Iniciando importação de Ruptura");
  console.log("Arquivo:", CAMINHO_TXT);

  // --------------------------------------------------
  // 1. Validação do arquivo
  // --------------------------------------------------
  if (!fs.existsSync(CAMINHO_TXT)) {
    throw new Error("Arquivo TXT não encontrado");
  }

  const conteudo = fs.readFileSync(CAMINHO_TXT, "utf-8");
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim() !== "");

  if (linhas.length < 2) {
    throw new Error("Arquivo não possui dados suficientes");
  }

  // --------------------------------------------------
  // 2. Cabeçalho
  // --------------------------------------------------
  const [linhaCabecalho, ...linhasDados] = linhas;

  const colunas = linhaCabecalho
    .split(";")
    .map(c => c.trim().toLowerCase());

  console.log("Colunas detectadas:", colunas.join(", "));

  // --------------------------------------------------
  // 3. Criar JOB de controle
  // --------------------------------------------------
  const dataBase = new Date().toISOString().slice(0, 10);

  const { data: job, error: jobErr } = await supabase
    .from("jobs_ruptura")
    .insert({
      regional: REGIONAL,
      bandeira: BANDEIRA,
      data_base: dataBase,
      status: "processando",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    throw new Error(jobErr?.message ?? "Erro ao criar job_ruptura");
  }

  const jobId = job.id;

  // --------------------------------------------------
  // 4. Converter linhas em registros
  // --------------------------------------------------
  const registros = linhasDados.map((linha, index) => {
    const valores = linha.split(";");
    const obj: Record<string, any> = {};

    colunas.forEach((col, i) => {
      obj[col] = valores[i]?.trim();
    });

    return {
      job_id: jobId,
      regional: REGIONAL,
      bandeira: BANDEIRA,
      data_base: dataBase,

      loja: toInt(obj["loja"]),
      seqproduto: toInt(obj["seqproduto"]),
      desccompleta: toText(obj["desccompleta"]),
      codforn: toInt(obj["codforn"]),
      estoque: toInt(obj["estoque"]),
      parmin: toInt(obj["parmin"]),
      parmax: toInt(obj["parmax"]),

      job_regional: REGIONAL,
      job_bandeira: BANDEIRA,
      linha_origem: index + 2
    };
  });

  console.log(`🔹 ${registros.length} registros processados`);

  // --------------------------------------------------
  // 5. INSERT EM LOTES (ROBUSTO)
  // --------------------------------------------------
  const BATCH_SIZE = 200;

  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const lote = registros.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("ruptura_raw")
      .insert(lote);

    if (error) {
      console.error("❌ Erro no lote", i, error);
      throw error;
    }

    console.log(`✅ Lote ${i / BATCH_SIZE + 1} inserido (${lote.length} linhas)`);
  }

  // --------------------------------------------------
  // 6. Finalizar JOB (SUCESSO)
  // --------------------------------------------------
  await supabase
    .from("jobs_ruptura")
    .update({
      status: "concluido",
      total_linhas: registros.length,
      finished_at: new Date().toISOString()
    })
    .eq("id", jobId);

  console.log("✅ Importação finalizada com sucesso");
}

// ======================================================
// DISPARO
// ======================================================
importarRuptura().catch(async err => {
  console.error("🔥 Falha na importação:", err.message);

  try {
    await supabase
      .from("jobs_ruptura")
      .update({
        status: "erro",
        erro: err.message,
        finished_at: new Date().toISOString()
      });
  } catch {
    // silencioso
  }

  process.exit(1);
});
