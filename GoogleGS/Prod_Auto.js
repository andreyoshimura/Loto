/**
 * GATILHO 3
 * ============================================================
 * Prod_Auto.gs — MODO PRODUÇÃO AUTOMÁTICO (GATILHO 3)
 * ============================================================
 *
 * Versão instrumentada + mais robusta para diagnosticar erros.
 *
 * Correção solicitada:
 * - NÃO declara SPREADSHEET_ID (para evitar "already been declared")
 * - Usa a constante global SPREADSHEET_ID já existente no projeto
 *
 * IMPORTANTE:
 * - Garanta que exista APENAS UMA declaração global:
 *     const SPREADSHEET_ID = "....";
 *   (ex.: no Resultado_Jogos.gs)
 * - Aponte o gatilho para executarModoProducao (não para Core).
 */

// Nome do gerador em config.gs
const GENERATOR_FN = "gerarJogosAgressivo";

// ---- TRAVAS ----
const GUARD = {
  HIST_N: 5,       // baseline = média últimos N backtests
  MAX_DROP: 0.6    // queda máxima permitida
};

// Aba de logs
const LOG_SHEET = "Logs";

function executarModoProducao() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    // não marca execução como falha — apenas evita concorrência
    console.log("[PROD][LOCK] Skip: execução concorrente (lock não obtido em 25s).");
    return;
  }

  const startedAt = Date.now();
  let ss = null;

  try {
    // Usa ID global já existente no projeto
    if (typeof SPREADSHEET_ID === "undefined" || !SPREADSHEET_ID) {
      throw new Error('CONFIG: SPREADSHEET_ID não definido no escopo global. Defina em um único arquivo do projeto.');
    }

    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    log_(ss, "START", `Início pipeline. ssId=${ss.getId()}`);

    executarModoProducaoCore_(ss);

    log_(ss, "END", `Fim pipeline OK. duracao_ms=${Date.now() - startedAt}`);
  } catch (e) {
    const msg = buildErrMsg_(e, startedAt);
    // tenta logar na planilha se possível
    try { log_(ss, "ERROR", msg); } catch (_) {}
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   PIPELINE REAL
   ========================================================= */

function executarModoProducaoCore_(ss) {
  // --------------------------------------------------------
  // STEP 1) Ler último sorteio de Resultados (robusto)
  // --------------------------------------------------------
  log_(ss, "STEP1", 'Lendo último sorteio em "Resultados"...');
  const lastDraw = getLastDrawFromResultadosRobusto_(ss);
  log_(ss, "STEP1", `OK. concurso=${lastDraw.concurso} row=${lastDraw.row} dezenas=${lastDraw.dezenas.join("-")}`);

  // --------------------------------------------------------
  // STEP 2) Registrar resultado e calcular acertos
  // --------------------------------------------------------
  log_(ss, "STEP2", "Registrando resultado e calculando acertos (Resultados_Jogos)...");
  assertFn_("registrarResultadoECalcularAcertosAuto");
  registrarResultadoECalcularAcertosAuto();
  log_(ss, "STEP2", "OK. Resultados_Jogos atualizado.");

  // --------------------------------------------------------
  // STEP 3) Baseline antes do aprendizado + snapshot config
  // --------------------------------------------------------
  log_(ss, "STEP3", `Calculando baseline em "Config_Historico" (HIST_N=${GUARD.HIST_N})...`);
  const baseline = getBaselineBestScore_(ss, GUARD.HIST_N);
  log_(ss, "STEP3", `Baseline=${baseline === null ? "null" : baseline}`);

  log_(ss, "STEP3", 'Snapshot de "Config" (rollback)...');
  const cfgBefore = loadConfigSnapshot_(ss);
  log_(ss, "STEP3", `Snapshot OK. keys=${Object.keys(cfgBefore).length}`);

  // --------------------------------------------------------
  // STEP 4) Aprendizado (backtest fiel)
  // --------------------------------------------------------
  log_(ss, "STEP4", "Executando backtestFielEAutoAjustarConfig_50...");
  assertFn_("backtestFielEAutoAjustarConfig_50");
  backtestFielEAutoAjustarConfig_50();
  log_(ss, "STEP4", "OK. Aprendizado concluído.");

  // --------------------------------------------------------
  // STEP 5) Trava de regressão
  // --------------------------------------------------------
  log_(ss, "STEP5", 'Lendo best_score em "Config_Historico"...');
  const last = getLastBestScoreRow_(ss);
  if (!last) throw new Error('STEP5: Não foi possível ler best_score no "Config_Historico" (coluna ausente/valor inválido).');
  log_(ss, "STEP5", `bestScore_atual=${last.bestScore} (row=${last.row})`);

  if (baseline !== null) {
    const drop = baseline - last.bestScore;
    log_(ss, "STEP5", `drop=${drop} (MAX_DROP=${GUARD.MAX_DROP})`);
    if (drop > GUARD.MAX_DROP) {
      log_(ss, "STEP5", "TRAVA ATIVADA: revertendo Config (rollback)...");
      restoreConfigSnapshot_(ss, cfgBefore);
      markLastRowReverted_(ss, `REVERTED | DROP=${drop.toFixed(2)} | BASE=${baseline.toFixed(2)}`);
      throw new Error(
        `STEP5: TRAVA ATIVADA: regressão excessiva. baseline=${baseline.toFixed(2)} atual=${last.bestScore.toFixed(2)} drop=${drop.toFixed(2)}`
      );
    }
  }

  // --------------------------------------------------------
  // STEP 6) Gerar novos jogos (produção)
  // --------------------------------------------------------
  log_(ss, "STEP6", `Validando pré-requisitos do gerador "${GENERATOR_FN}"...`);
  assertFnGlobal_(GENERATOR_FN);

  // Pré-requisitos do gerarJogosAgressivo()
  assertSheetHasSize_(ss, "Resultados", 2, 17);      // mínimo: header + 1 linha, 17 cols (A..Q)
  assertSheetHasSize_(ss, "Tendencias", 26, 7);      // header + 25 linhas, A..G
  assertSheetHasSize_(ss, "Coocorrencia", 26, 26);   // header + 25 linhas, A..Z
  // Config é autocriada pelo gerador, então não precisa validar aqui

  log_(ss, "STEP6", `Executando "${GENERATOR_FN}"...`);
  globalThis[GENERATOR_FN]();
  log_(ss, "STEP6", 'OK. "Jogos_Gerados" e "Historico_Jogos" atualizados.');

  SpreadsheetApp.flush();
}

/* =========================================================
   LEITURA ROBUSTA DO ÚLTIMO SORTEIO (Resultados)
   ========================================================= */

function getLastDrawFromResultadosRobusto_(ss) {
  const sh = ss.getSheetByName("Resultados");
  if (!sh) throw new Error('STEP1: Aba "Resultados" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('STEP1: "Resultados" não tem dados (lr < 2).');

  for (let r = lr; r >= 2; r--) {
    const row = sh.getRange(r, 1, 1, 17).getValues()[0];
    const concurso = String(row[0] ?? "").trim();

    const dezenas = row
      .slice(2)
      .map(Number)
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 25);

    const uniq = Array.from(new Set(dezenas)).sort((a, b) => a - b);
    if (concurso && uniq.length === 15) return { concurso, dezenas: uniq, row: r };
  }

  throw new Error('STEP1: Nenhuma linha válida encontrada em "Resultados" (concurso + 15 dezenas em C..Q).');
}

/* =========================================================
   BASELINE / BEST SCORE (Config_Historico)
   ========================================================= */

function getBaselineBestScore_(ss, n) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return null;

  const lr = sh.getLastRow();
  if (lr < 2) return null;

  const header = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(s => String(s).trim());

  const col = findBestScoreCol_(header);
  if (col < 1) return null;

  const start = Math.max(2, lr - n + 1);
  const vals = sh
    .getRange(start, col, lr - start + 1, 1)
    .getValues()
    .map(r => Number(String(r[0]).replace(",", ".")))
    .filter(v => Number.isFinite(v));

  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getLastBestScoreRow_(ss) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return null;

  const lr = sh.getLastRow();
  if (lr < 2) return null;

  const header = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(s => String(s).trim());

  const col = findBestScoreCol_(header);
  if (col < 1) return null;

  const v = sh.getRange(lr, col).getDisplayValue();
  const bestScore = Number(String(v).replace(",", "."));
  if (!Number.isFinite(bestScore)) return null;

  return { row: lr, bestScore };
}

function findBestScoreCol_(header) {
  const names = ["best_score_media_hits", "media_hits_rece", "media_hits_recente"];
  for (const n of names) {
    const i = header.findIndex(h => h === n);
    if (i >= 0) return i + 1;
  }
  return -1;
}

/* =========================================================
   SNAPSHOT / ROLLBACK CONFIG
   ========================================================= */

function loadConfigSnapshot_(ss) {
  const sh = ss.getSheetByName("Config");
  if (!sh) throw new Error('STEP3: Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('STEP3: Aba "Config" vazia (lr < 2).');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const snap = {};
  rows.forEach(([k, v]) => {
    if (k) snap[String(k).trim()] = v;
  });
  return snap;
}

function restoreConfigSnapshot_(ss, snap) {
  const sh = ss.getSheetByName("Config");
  if (!sh) throw new Error('STEP5: Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('STEP5: Aba "Config" vazia (lr < 2).');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const idx = new Map();
  rows.forEach((r, i) => {
    if (r[0]) idx.set(String(r[0]).trim(), i + 2);
  });

  Object.keys(snap).forEach(k => {
    const r = idx.get(k);
    if (r) {
      sh.getRange(r, 2).setValue(snap[k]);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[k, snap[k]]]);
    }
  });
}

/* =========================================================
   HISTÓRICO — MARCAR ROLLBACK
   ========================================================= */

function markLastRowReverted_(ss, text) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return;

  const header = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(s => String(s).trim());

  const idx = header.findIndex(h => h === "modo");
  if (idx < 0) return;

  sh.getRange(sh.getLastRow(), idx + 1).setValue(text);
}

/* =========================================================
   HELPERS: validação e logging
   ========================================================= */

function assertFn_(fnName) {
  if (typeof globalThis[fnName] !== "function") {
    throw new Error(`MISSING_FN: Função "${fnName}" não encontrada no projeto.`);
  }
}

function assertFnGlobal_(fnName) {
  if (typeof globalThis[fnName] !== "function") {
    throw new Error(`MISSING_FN: Função global "${fnName}" não encontrada (arquivo não carregado?).`);
  }
}

function assertSheetHasSize_(ss, sheetName, minRows, minCols) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`MISSING_SHEET: Aba "${sheetName}" não encontrada (pré-requisito).`);

  const lr = sh.getLastRow();
  const lc = sh.getLastColumn();
  if (lr < minRows || lc < minCols) {
    throw new Error(
      `BAD_SHEET: Aba "${sheetName}" com tamanho inválido. lastRow=${lr} lastCol=${lc} esperado>=${minRows}x${minCols}`
    );
  }
}

function buildErrMsg_(e, startedAt) {
  const name = e && e.name ? e.name : "Error";
  const message = e && e.message ? e.message : String(e);
  const stack = e && e.stack ? e.stack : "";
  return [
    `${name}: ${message}`,
    `duracao_ms=${Date.now() - startedAt}`,
    stack ? `stack=${stack}` : ""
  ].filter(Boolean).join(" | ");
}

function log_(ss, tag, msg) {
  console.log(`[PROD][${tag}] ${msg}`);

  if (!ss) return;

  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.getRange("A1:D1").setValues([["timestamp", "tag", "mensagem", "exec"]]);
  }

  const execId = Utilities.getUuid();
  sh.appendRow([new Date(), tag, msg, execId]);
}
