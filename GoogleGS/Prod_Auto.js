/**
 * ============================================================
 * Prod_Auto.gs — MODO PRODUÇÃO AUTOMÁTICO (CORRIGIDO)
 * ============================================================
 *
 * Correções aplicadas:
 * 1) Remove duplicidade de executarModoProducao (era a causa do erro "function not found")
 * 2) LockService (evita execuções concorrentes por gatilho/manual)
 * 3) Chamada do gerador via globalThis (mais estável em gatilhos)
 * 4) Fecha chaves/escopo e garante flush no final
 *
 * Observação operacional:
 * - Depois de colar, APAGUE e RECRIE o gatilho apontando para executarModoProducao.
 */

function executarModoProducao() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error("Execução concorrente detectada (lock).");
  }

  try {
    executarModoProducaoCore_();
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   PIPELINE REAL (NÃO ATELE O GATILHO A ESTA)
   ========================================================= */

function executarModoProducaoCore_() {
  const ss = SpreadsheetApp.getActive();

  const GENERATOR_FN = "gerarJogosAgressivo";

  // ---- TRAVAS ----
  const GUARD = {
    HIST_N: 5,       // baseline = média últimos N backtests
    MAX_DROP: 0.6    // queda máxima permitida
  };

  // --------------------------------------------------------
  // 1) Ler último sorteio diretamente de Resultados
  // --------------------------------------------------------
  const lastDraw = getLastDrawFromResultados_(ss);
  if (!lastDraw) {
    throw new Error('Falha ao ler último sorteio da aba "Resultados".');
  }

  // --------------------------------------------------------
  // 2) Registrar resultado e calcular acertos
  // --------------------------------------------------------
  if (typeof registrarResultadoECalcularAcertosAuto !== "function") {
    throw new Error("Função registrarResultadoECalcularAcertosAuto() não encontrada.");
  }
  registrarResultadoECalcularAcertosAuto();

  // --------------------------------------------------------
  // 3) Baseline antes do aprendizado
  // --------------------------------------------------------
  const baseline = getBaselineBestScore_(ss, GUARD.HIST_N);

  // Snapshot para rollback
  const cfgBefore = loadConfigSnapshot_(ss);

  // --------------------------------------------------------
  // 4) Aprendizado (backtest fiel)
  // --------------------------------------------------------
  if (typeof backtestFielEAutoAjustarConfig_50 !== "function") {
    throw new Error("Função backtestFielEAutoAjustarConfig_50() não encontrada.");
  }
  backtestFielEAutoAjustarConfig_50();

  // --------------------------------------------------------
  // 5) Trava de regressão
  // --------------------------------------------------------
  const last = getLastBestScoreRow_(ss);
  if (!last) {
    throw new Error("Não foi possível ler best_score no Config_Historico.");
  }

  if (baseline !== null) {
    const drop = baseline - last.bestScore;
    if (drop > GUARD.MAX_DROP) {
      restoreConfigSnapshot_(ss, cfgBefore);
      markLastRowReverted_(
        ss,
        `REVERTED | DROP=${drop.toFixed(2)} | BASE=${baseline.toFixed(2)}`
      );
      throw new Error(
        `TRAVA ATIVADA: regressão excessiva. baseline=${baseline.toFixed(2)} atual=${last.bestScore.toFixed(2)}`
      );
    }
  }

  // --------------------------------------------------------
  // 6) Gerar novos jogos (produção)
  // --------------------------------------------------------
  if (typeof globalThis[GENERATOR_FN] !== "function") {
    throw new Error(`Gerador "${GENERATOR_FN}" não encontrado.`);
  }
  globalThis[GENERATOR_FN]();

  SpreadsheetApp.flush();
}

/* =========================================================
   LEITURA DO ÚLTIMO SORTEIO (Resultados)
   ========================================================= */

/**
 * Esperado em "Resultados":
 * - Col A = concurso
 * - Col C..Q = 15 dezenas
 */
function getLastDrawFromResultados_(ss) {
  const sh = ss.getSheetByName("Resultados");
  if (!sh) throw new Error('Aba "Resultados" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) return null;

  const row = sh.getRange(lr, 1, 1, 17).getValues()[0];
  const concurso = String(row[0] ?? "").trim();

  const dezenas = row
    .slice(2)
    .map(Number)
    .filter(n => n >= 1 && n <= 25);

  const uniq = Array.from(new Set(dezenas)).sort((a, b) => a - b);
  if (!concurso || uniq.length !== 15) return null;

  return { concurso, dezenas: uniq };
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
  const names = [
    "best_score_media_hits",
    "media_hits_rece",
    "media_hits_recente"
  ];
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
  if (!sh) throw new Error('Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" vazia.');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const snap = {};
  rows.forEach(([k, v]) => {
    if (k) snap[String(k).trim()] = v;
  });
  return snap;
}

function restoreConfigSnapshot_(ss, snap) {
  const sh = ss.getSheetByName("Config");
  if (!sh) throw new Error('Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" vazia.');

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
