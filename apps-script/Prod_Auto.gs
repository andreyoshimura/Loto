/**
 * ============================================================
 * Prod_Auto.gs — MODO PRODUÇÃO AUTOMÁTICO (FECHADO)
 * ============================================================
 *
 * Pipeline executado em ORDEM SEGURA:
 *
 * 1) registrarResultadoECalcularAcertosAuto()
 *    - Lê Entrada_Resultado
 *    - Calcula acertos dos jogos anteriores
 *    - Escreve em Resultados_Jogos
 *
 * 2) backtestFielEAutoAjustarConfig_50()
 *    - Aprende com histórico (50 concursos)
 *    - Ajusta pesos do Config
 *    - Registra performance em Config_Historico
 *
 * 3) TRAVA DE PRODUÇÃO
 *    - Se o best_score cair além do permitido, REVERTE Config
 *
 * 4) gerarJogosAgressivo()
 *    - Gera os próximos 5 jogos (17 dezenas)
 *
 * Objetivo:
 * ---------
 * Operar como sistema produtivo contínuo, sem IA, com
 * aprendizado controlado e reversível.
 */


/* =========================================================
   FUNÇÃO ÚNICA DE PRODUÇÃO (EXECUTE ESTA)
   ========================================================= */

function executarModoProducao() {
  const ss = SpreadsheetApp.getActive();

  // ===== CONFIG FIXA DO GERADOR =====
  const GENERATOR_FN_NAME = "gerarJogosAgressivo";

  // ===== TRAVAS DE SEGURANÇA =====
  const GUARD = {
    HIST_N: 5,        // baseline = média dos últimos 5 backtests
    MAX_DROP: 0.6    // queda máxima aceitável no best_score
  };

  // --------------------------------------------------------
  // 0) Validação mínima de entrada
  // --------------------------------------------------------
  const shEntrada = ss.getSheetByName("Entrada_Resultado");
  if (!shEntrada) throw new Error('Aba "Entrada_Resultado" não encontrada.');

  const concurso = String(shEntrada.getRange("B1").getDisplayValue()).trim();
  const dezenas = String(shEntrada.getRange("B2").getDisplayValue()).trim();

  if (!concurso || !dezenas) {
    throw new Error('Entrada_Resultado incompleta: preencha B1 (concurso) e B2 (15 dezenas).');
  }

  // --------------------------------------------------------
  // 1) Baseline (antes do learning)
  // --------------------------------------------------------
  const baseline = getBaselineBestScore_(ss, GUARD.HIST_N);

  // --------------------------------------------------------
  // 2) Snapshot do Config (para possível rollback)
  // --------------------------------------------------------
  const cfgBefore = loadConfigSnapshot_(ss);

  // --------------------------------------------------------
  // 3) Registrar resultado e calcular acertos
  // --------------------------------------------------------
  if (typeof registrarResultadoECalcularAcertosAuto !== "function") {
    throw new Error("Função registrarResultadoECalcularAcertosAuto() não encontrada.");
  }
  registrarResultadoECalcularAcertosAuto();

  // --------------------------------------------------------
  // 4) Rodar backtest fiel (aprendizado)
  // --------------------------------------------------------
  if (typeof backtestFielEAutoAjustarConfig_50 !== "function") {
    throw new Error("Função backtestFielEAutoAjustarConfig_50() não encontrada.");
  }
  backtestFielEAutoAjustarConfig_50();

  // --------------------------------------------------------
  // 5) Avaliar resultado do learning
  // --------------------------------------------------------
  const last = getLastBestScoreRow_(ss);
  if (!last) throw new Error("Não foi possível ler best_score no Config_Historico.");

  if (baseline !== null) {
    const drop = baseline - last.bestScore;

    if (drop > GUARD.MAX_DROP) {
      // rollback total
      restoreConfigSnapshot_(ss, cfgBefore);

      markLastRowReverted_(ss,
        `REVERTED | DROP=${drop.toFixed(2)} | BASE=${baseline.toFixed(2)}`
      );

      throw new Error(
        `TRAVA ATIVADA: queda excessiva no aprendizado. ` +
        `baseline=${baseline.toFixed(2)} atual=${last.bestScore.toFixed(2)}`
      );
    }
  }

  // --------------------------------------------------------
  // 6) Gerar novos jogos (produção)
  // --------------------------------------------------------
  if (typeof this[GENERATOR_FN_NAME] !== "function") {
    throw new Error(`Gerador "${GENERATOR_FN_NAME}" não encontrado.`);
  }
  this[GENERATOR_FN_NAME]();

  SpreadsheetApp.flush();
}


/* =========================================================
   BASELINE / BEST SCORE
   ========================================================= */

function getBaselineBestScore_(ss, n) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return null;

  const lr = sh.getLastRow();
  if (lr < 2) return null;

  const header = sh.getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0].map(s => String(s).trim());

  const col = findBestScoreCol_(header);
  if (col < 1) return null;

  const start = Math.max(2, lr - n + 1);
  const vals = sh.getRange(start, col, lr - start + 1, 1)
    .getValues()
    .map(r => Number(String(r[0]).replace(",", ".")))
    .filter(v => Number.isFinite(v));

  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getLastBestScoreRow_(ss) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return null;

  const lr = sh.getLastRow();
  if (lr < 2) return null;

  const header = sh.getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0].map(s => String(s).trim());

  const col = findBestScoreCol_(header);
  if (col < 1) return null;

  const v = sh.getRange(lr, col).getDisplayValue();
  const bestScore = Number(String(v).replace(",", "."));
  if (!Number.isFinite(bestScore)) return null;

  return { row: lr, bestScore };
}

function findBestScoreCol_(header) {
  const candidates = [
    "best_score_media_hits",
    "media_hits_rece",
    "media_hits_recente"
  ];
  for (const name of candidates) {
    const idx = header.findIndex(h => h === name);
    if (idx >= 0) return idx + 1;
  }
  return -1;
}


/* =========================================================
   SNAPSHOT / RESTORE CONFIG
   ========================================================= */

function loadConfigSnapshot_(ss) {
  const sh = ss.getSheetByName("Config");
  if (!sh) throw new Error('Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" vazia.');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const snap = {};
  rows.forEach(([k, v]) => { if (k) snap[String(k).trim()] = v; });
  return snap;
}

function restoreConfigSnapshot_(ss, snap) {
  const sh = ss.getSheetByName("Config");
  if (!sh) throw new Error('Aba "Config" não encontrada.');

  const lr = sh.getLastRow();
  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const idx = new Map();
  rows.forEach((r, i) => { if (r[0]) idx.set(String(r[0]).trim(), i + 2); });

  Object.keys(snap).forEach(k => {
    const r = idx.get(k);
    if (r) sh.getRange(r, 2).setValue(snap[k]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[k, snap[k]]]);
  });
}


/* =========================================================
   HISTÓRICO — marcar rollback
   ========================================================= */

function markLastRowReverted_(ss, text) {
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) return;

  const header = sh.getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0].map(s => String(s).trim());

  const idx = header.findIndex(h => h === "modo");
  if (idx < 0) return;

  sh.getRange(sh.getLastRow(), idx + 1).setValue(text);
}
