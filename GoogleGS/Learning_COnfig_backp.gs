/**
 * ============================================================
 * Learning_config.gs (ETAPA 5) - VERSÃO CORRIGIDA E RESILIENTE
 * ============================================================
 */

function backtestFielEAutoAjustarConfig_50() {
  const MAX_RUNTIME_MS = 240000; // 4 min
  const t0 = Date.now();

  const P = {
    WINDOW_CONCURSOS: 50,
    MAX_CANDIDATES: 14,
    N_SIM_PER_JOGO: 90
  };

  if (typeof SPREADSHEET_ID === "undefined" || !SPREADSHEET_ID) {
    throw new Error('CONFIG: SPREADSHEET_ID não definido no escopo global.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  logLC_(ss, "START", `Início backtest fiel. Janela=${P.WINDOW_CONCURSOS}`);

  const shRes = mustSheetLC_(ss, "Resultados");
  const cfg0 = loadConfigEnsureFullLC_(ss);

  const fullHist = loadHistoricoResultadosLC_(shRes);
  if (fullHist.length < 20) {
    throw new Error(`DADOS: Histórico insuficiente (${fullHist.length}).`);
  }

  // Ajuste dinâmico da janela
  if (fullHist.length < P.WINDOW_CONCURSOS + 30) {
    P.WINDOW_CONCURSOS = Math.max(10, fullHist.length - 1);
  }

  const evalHist = fullHist.slice(-P.WINDOW_CONCURSOS);
  const statsByEvalIndex = precomputeStatsForEvalWindowLC_(fullHist, P.WINDOW_CONCURSOS);
  const weakPairs = computeWeakPairsGlobalLC_(fullHist, cfg0.BOTTOM_PARES);

  const candidates = generateCandidatesAroundCfgLC_(cfg0, P.MAX_CANDIDATES);
  
  let best = { cfg: pickWeightsLC_(cfg0), score: -Infinity };
  let tested = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (Date.now() - t0 > MAX_RUNTIME_MS) break;

    const cand = candidates[i];
    const score = evaluateCandidateBacktestFielLC_(
      cand,
      evalHist,
      statsByEvalIndex,
      weakPairs,
      cfg0,
      P.N_SIM_PER_JOGO,
      t0,
      MAX_RUNTIME_MS
    );

    tested++;
    if (Number.isFinite(score) && score > best.score) {
      best = { cfg: cand, score };
    }
  }

  if (best.score === -Infinity) {
    throw new Error(`BACKTEST: Falha crítica. Regras restritas demais para os dados atuais.`);
  }

  const changed = hasWeightChangeLC_(pickWeightsLC_(cfg0), best.cfg);
  if (changed) {
    applyConfigUpdateLC_(ss, best.cfg);
    logLC_(ss, "APPLY", `Configuração otimizada aplicada. Score: ${best.score.toFixed(2)}`);
  }

  appendConfigHistoricoBacktestFielLC_(ss, cfg0, best.cfg, best.score, P.WINDOW_CONCURSOS, tested, changed, "BACKTEST_FIEL_50");
  
  SpreadsheetApp.flush();
  logLC_(ss, "END", `Finalizado. Processados: ${tested}. Duração: ${Math.round((Date.now()-t0)/1000)}s`);
}

/* =========================
   AVALIAÇÃO RESILIENTE
   ========================= */

function evaluateCandidateBacktestFielLC_(candWeights, evalHist, statsByEvalIndex, weakPairs, cfgFull, N_SIM_PER_JOGO, t0, maxMs) {
  const QTDE_JOGOS = cfgFull.QTDE_JOGOS;
  const JOGO_DEZENAS = cfgFull.JOGO_DEZENAS;
  let sumMedias = 0;
  let nConc = 0;

  for (let i = 0; i < evalHist.length; i++) {
    if (Date.now() - t0 > maxMs) break;

    const stats = statsByEvalIndex[i];
    if (!stats) continue;

    const p = buildPFromStatsLC_(stats, candWeights);
    const jogos = generateJogosFieisLC_(
      p, QTDE_JOGOS, JOGO_DEZENAS, 
      cfgFull.MAX_SEQ, cfgFull.MIN_DIFF, 
      weakPairs, cfgFull.PENALTY_WEAK_PAIR, 
      N_SIM_PER_JOGO
    );

    // CORREÇÃO: Se falhar em gerar para este concurso, PULA (continue) em vez de TRAVAR (break)
    if (!jogos || jogos.length !== QTDE_JOGOS) {
      continue; 
    }

    const sorteioSet = new Set(evalHist[i].dezenas);
    const hits = jogos.map(j => j.reduce((c, d) => c + (sorteioSet.has(d) ? 1 : 0), 0));
    sumMedias += (hits.reduce((a, b) => a + b, 0) / hits.length);
    nConc++;
  }

  return nConc > 0 ? (sumMedias / nConc) : -Infinity;
}

/* =========================
   GERADOR FIEL (Lógica de Produção)
   ========================= */

function generateJogosFieisLC_(pList, QTDE_JOGOS, K, MAX_SEQ, MIN_DIFF, weakPairsSet, PENALTY_WEAK_PAIR, N_SIM_PER_JOGO) {
  const jogos = [];
  for (let g = 0; g < QTDE_JOGOS; g++) {
    let best = null;
    let bestScore = -Infinity;

    for (let s = 0; s < N_SIM_PER_JOGO; s++) {
      const cand = sampleOneDrawWeightedNoReplacementLC_(pList, K);
      if (!okMaxSeqLC_(cand, MAX_SEQ)) continue;
      if (!okDiversityLC_(cand, jogos, MIN_DIFF)) continue;

      const sc = scoreJogoLC_(cand, pList, weakPairsSet, PENALTY_WEAK_PAIR);
      if (sc > bestScore) {
        bestScore = sc;
        best = cand;
      }
    }
    if (!best) return []; // Retorna vazio para a função de avaliação decidir o que fazer
    jogos.push(best);
  }
  return jogos;
}

function scoreJogoLC_(jogo, pList, weakPairsSet, penaltyWeakPair) {
  let sc = 0;
  for (const d of jogo) sc += pList[d - 1];
  for (let i = 0; i < jogo.length; i++) {
    for (let j = i + 1; j < jogo.length; j++) {
      const key = jogo[i] < jogo[j] ? `${jogo[i]}-${jogo[j]}` : `${jogo[j]}-${jogo[i]}`;
      if (weakPairsSet.has(key)) sc -= penaltyWeakPair;
    }
  }
  return sc;
}

function okMaxSeqLC_(numsSortedAsc, maxSeq) {
  let run = 1;
  for (let i = 1; i < numsSortedAsc.length; i++) {
    if (numsSortedAsc[i] === numsSortedAsc[i - 1] + 1) {
      run++;
      if (run > maxSeq) return false;
    } else { run = 1; }
  }
  return true;
}

function okDiversityLC_(cand, jogos, minDiff) {
  if (jogos.length === 0) return true;
  const setC = new Set(cand);
  for (const j of jogos) {
    const setJ = new Set(j);
    let inter = 0;
    for (const d of setC) if (setJ.has(d)) inter++;
    const symDiff = (setC.size - inter) + (setJ.size - inter);
    if (symDiff < minDiff) return false;
  }
  return true;
}

/* =========================
   ESTATÍSTICAS E MATEMÁTICA
   ========================= */

function precomputeStatsForEvalWindowLC_(fullHist, windowConc) {
  const N = fullHist.length;
  const startEval = Math.max(0, N - windowConc);
  const c20 = Array(26).fill(0), c50 = Array(26).fill(0), c100 = Array(26).fill(0);
  const freqTotal = Array(26).fill(0), lastSeenIndex = Array(26).fill(-1);
  const q20 = [], q50 = [], q100 = [], statsByEvalIndex = [];

  for (let idx = 0; idx < N; idx++) {
    if (idx >= startEval) {
      const snap = Array(26);
      for (let d = 1; d <= 25; d++) {
        snap[d] = {
          f20: c20[d], f50: c50[d], f100: c100[d],
          atraso: (lastSeenIndex[d] >= 0) ? (idx - lastSeenIndex[d]) : (idx + 1),
          freqTotal: freqTotal[d], N: idx
        };
      }
      statsByEvalIndex.push(snap);
    }
    fullHist[idx].dezenas.forEach(d => {
      freqTotal[d]++; lastSeenIndex[d] = idx;
      c20[d]++; c50[d]++; c100[d]++;
    });
    q20.push(fullHist[idx].dezenas); if (q20.length > 20) q20.shift().forEach(d => c20[d]--);
    q50.push(fullHist[idx].dezenas); if (q50.length > 50) q50.shift().forEach(d => c50[d]--);
    q100.push(fullHist[idx].dezenas); if (q100.length > 100) q100.shift().forEach(d => c100[d]--);
  }
  return statsByEvalIndex;
}

function buildPFromStatsLC_(statsSnap, cand) {
  const raw = Array(25).fill(0);
  for (let d = 1; d <= 25; d++) {
    const st = statsSnap[d];
    const pBayes = (st.freqTotal + 1) / (st.N + 2);
    const score = (cand.alphaScore * ((cand.w20 * st.f20) + (cand.w50 * st.f50) + (cand.w100 * st.f100) - (cand.wAtraso * st.atraso))) + (cand.wBayes * pBayes);
    raw[d - 1] = Math.max(score, 1e-9);
  }
  return normalizePositiveLC_(raw);
}

function computeWeakPairsGlobalLC_(hist, bottomPairs) {
  const counts = new Map();
  hist.forEach(h => {
    const dz = h.dezenas;
    for (let i = 0; i < dz.length; i++) {
      for (let j = i + 1; j < dz.length; j++) {
        const key = `${dz[i]}-${dz[j]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  });
  const arr = Array.from(counts.entries()).sort((x, y) => x[1] - y[1]);
  return new Set(arr.slice(0, Math.max(0, bottomPairs)).map(x => x[0]));
}

function sampleOneDrawWeightedNoReplacementLC_(pList, K) {
  const items = pList.map((w, i) => ({ dezena: i + 1, key: -Math.log(Math.random()) / Math.max(w, 1e-12) }));
  return items.sort((a, b) => a.key - b.key).slice(0, K).map(o => o.dezena).sort((a, b) => a - b);
}

function normalizePositiveLC_(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  return arr.map(x => x / sum);
}

/* =========================
   GERENCIAMENTO DE DADOS E CONFIG
   ========================= */

function loadHistoricoResultadosLC_(shRes) {
  const lr = shRes.getLastRow();
  if (lr < 2) return [];
  const values = shRes.getRange(2, 1, lr - 1, 17).getValues();
  return values.map(r => ({
    concurso: Number(r[0]),
    dezenas: r.slice(2).map(Number).filter(n => n >= 1 && n <= 25).sort((a, b) => a - b)
  })).filter(o => o.dezenas.length === 15);
}

function pickWeightsLC_(cfg) {
  return { w20: cfg.w20, w50: cfg.w50, w100: cfg.w100, wAtraso: cfg.wAtraso, wBayes: cfg.wBayes, alphaScore: cfg.alphaScore };
}

function generateCandidatesAroundCfgLC_(cfg0, maxCandidates) {
  const base = pickWeightsLC_(cfg0);
  const LIMITS = { w20:[0,10], w50:[0,10], w100:[0,10], wAtraso:[0,2], wBayes:[0,2], alphaScore:[0,3] };
  const cands = [base];
  while (cands.length < maxCandidates) {
    const cand = { ...base };
    const key = Object.keys(LIMITS)[Math.floor(Math.random() * 6)];
    const step = (key.startsWith('w') && !['wAtraso','wBayes'].includes(key)) ? 1 : 0.1;
    cand[key] = Math.max(LIMITS[key][0], Math.min(LIMITS[key][1], cand[key] + (Math.random() < 0.5 ? -step : step)));
    if (step === 1) cand[key] = Math.round(cand[key]);
    if (!cands.some(x => sameWeightsLC_(x, cand))) cands.push(cand);
  }
  return cands;
}

function sameWeightsLC_(a, b) {
  return ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"].every(k => Number(a[k]).toFixed(4) === Number(b[k]).toFixed(4));
}

function hasWeightChangeLC_(a, b) { return !sameWeightsLC_(a, b); }

function applyConfigUpdateLC_(ss, newOpt) {
  const sh = mustSheetLC_(ss, "Config");
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  data.forEach((row, i) => {
    if (newOpt.hasOwnProperty(row[0])) sh.getRange(i + 2, 2).setValue(newOpt[row[0]]);
  });
}

function appendConfigHistoricoBacktestFielLC_(ss, oldCfg, newCfg, bestScore, windowConc, testedCands, changed, modo) {
  let sh = ss.getSheetByName("Config_Historico_Backtest") || ss.insertSheet("Config_Historico_Backtest");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["timestamp", "mudou", "window", "testados", "score", "w20_o", "w50_o", "w100_o", "wA_o", "wB_o", "aS_o", "w20_n", "w50_n", "w100_n", "wA_n", "wB_n", "aS_n", "modo"]);
  }
  sh.appendRow([new Date(), changed?"SIM":"NAO", windowConc, testedCands, bestScore, oldCfg.w20, oldCfg.w50, oldCfg.w100, oldCfg.wAtraso, oldCfg.wBayes, oldCfg.alphaScore, newCfg.w20, newCfg.w50, newCfg.w100, newCfg.wAtraso, newCfg.wBayes, newCfg.alphaScore, modo]);
}

function mustSheetLC_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`SHEET: Aba "${name}" não encontrada.`);
  return sh;
}

function loadConfigEnsureFullLC_(ss) {
  const sh = mustSheetLC_(ss, "Config");
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const cfg = {};
  rows.forEach(([k, v]) => cfg[String(k).trim()] = Number(String(v).replace(",", ".")));
  return {
    w20: cfg.w20??0, w50: cfg.w50??1, w100: cfg.w100??4, wAtraso: cfg.wAtraso??0.6, wBayes: cfg.wBayes??0.5, alphaScore: cfg.alphaScore??1.3,
    QTDE_JOGOS: cfg.QTDE_JOGOS??5, JOGO_DEZENAS: cfg.JOGO_DEZENAS??17, MAX_SEQ: cfg.MAX_SEQ??4, MIN_DIFF: cfg.MIN_DIFF??12,
    BOTTOM_PARES: cfg.BOTTOM_PARES??60, PENALTY_WEAK_PAIR: cfg.PENALTY_WEAK_PAIR??5
  };
}

function logLC_(ss, tag, msg) {
  console.log(`[LC][${tag}] ${msg}`);
  const shLogs = ss.getSheetByName("Logs");
  if (shLogs) shLogs.appendRow([new Date(), tag, msg, "LEARNING_BACKTEST"]);
}
