/**
 * ============================================================
 * Learning_config.gs (ETAPA 5) - BACKTEST FIEL AO GERADOR REAL
 * ============================================================
 *
 * Correções nesta versão:
 * - Usa SpreadsheetApp.openById(SPREADSHEET_ID) (gatilho estável)
 * - P é mutável (WINDOW_CONCURSOS pode ser reduzida)
 * - Logs de diagnóstico por etapa
 * - Corrige criação de aba de histórico (bug: criava Config_Historico errado)
 * - Erros mais explícitos (timeout / dados insuficientes / restrições impossíveis)
 *
 * Pré-requisito:
 * - Deve existir UM SPREADSHEET_ID global no projeto (não redeclare aqui).
 */

function backtestFielEAutoAjustarConfig_50() {
  // -------- CONFIG / LIMITES --------
  const MAX_RUNTIME_MS = 240000; // 4 min (ajuste conforme sua conta)
  const t0 = Date.now();

  // P precisa ser mutável porque podemos reduzir WINDOW_CONCURSOS
  const P = {
    WINDOW_CONCURSOS: 50,
    MAX_CANDIDATES: 14,
    N_SIM_PER_JOGO: 90
  };

  // -------- ABERTURA DA PLANILHA (gatilho seguro) --------
  if (typeof SPREADSHEET_ID === "undefined" || !SPREADSHEET_ID) {
    throw new Error('CONFIG: SPREADSHEET_ID não definido no escopo global.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  logLC_(ss, "START", `Início backtest fiel. MAX_RUNTIME_MS=${MAX_RUNTIME_MS}`);

  // -------- ENTRADAS --------
  const shRes = mustSheetLC_(ss, "Resultados");
  const cfg0 = loadConfigEnsureFullLC_(ss);

  // 1) Carrega histórico completo
  const fullHist = loadHistoricoResultadosLC_(shRes);
  if (fullHist.length < 20) {
    throw new Error(`DADOS: "Resultados" tem poucos concursos válidos (${fullHist.length}).`);
  }

  // Ajuste da janela conforme dados disponíveis
  if (fullHist.length < P.WINDOW_CONCURSOS + 30) {
    const old = P.WINDOW_CONCURSOS;
    P.WINDOW_CONCURSOS = Math.max(10, Math.min(P.WINDOW_CONCURSOS, fullHist.length - 1));
    logLC_(ss, "DATA", `Janela reduzida: ${old} -> ${P.WINDOW_CONCURSOS} (hist=${fullHist.length})`);
  }

  if (P.WINDOW_CONCURSOS < 10) {
    throw new Error(`DADOS: janela de avaliação muito pequena (${P.WINDOW_CONCURSOS}).`);
  }

  // 2) Define janela de avaliação
  const evalHist = fullHist.slice(-P.WINDOW_CONCURSOS);

  // 3) Pré-computa stats por concurso (independente do candidato)
  logLC_(ss, "STEP1", `Pré-computando stats (window=${P.WINDOW_CONCURSOS})...`);
  const statsByEvalIndex = precomputeStatsForEvalWindowLC_(fullHist, P.WINDOW_CONCURSOS);
  if (!statsByEvalIndex || statsByEvalIndex.length !== evalHist.length) {
    throw new Error(`STATS: statsByEvalIndex inválido. stats=${statsByEvalIndex?.length} eval=${evalHist.length}`);
  }

  // 4) Pré-computa pares fracos (coocorrência global)
  logLC_(ss, "STEP2", `Computando pares fracos globais (BOTTOM_PARES=${cfg0.BOTTOM_PARES})...`);
  const weakPairs = computeWeakPairsGlobalLC_(fullHist, cfg0.BOTTOM_PARES);

  // 5) Candidatos
  logLC_(ss, "STEP3", `Gerando candidatos (max=${P.MAX_CANDIDATES})...`);
  const candidates = generateCandidatesAroundCfgLC_(cfg0, P.MAX_CANDIDATES);
  if (!candidates.length) throw new Error("CAND: nenhum candidato gerado.");

  // 6) Avaliação
  logLC_(ss, "STEP4", `Avaliando candidatos... N_SIM_PER_JOGO=${P.N_SIM_PER_JOGO}`);
  let best = { cfg: pickWeightsLC_(cfg0), score: -Infinity };
  let tested = 0;
  let abortedByTimeout = false;

  for (let i = 0; i < candidates.length; i++) {
    if (Date.now() - t0 > MAX_RUNTIME_MS) {
      abortedByTimeout = true;
      break;
    }

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

  if (!Number.isFinite(best.score) || best.score === -Infinity) {
    const why = abortedByTimeout ? "TIMEOUT" : "DADOS/REGRAS";
    throw new Error(`BACKTEST: falhou. motivo=${why} tested=${tested} window=${P.WINDOW_CONCURSOS}`);
  }

  // 7) Aplica melhor cfg
  const changed = hasWeightChangeLC_(pickWeightsLC_(cfg0), best.cfg);
  if (changed) {
    logLC_(ss, "APPLY", `Aplicando melhor cfg. score=${best.score}`);
    applyConfigUpdateLC_(ss, best.cfg);
  } else {
    logLC_(ss, "APPLY", `Melhor cfg igual à atual. score=${best.score}`);
  }

  // 8) Auditoria
  appendConfigHistoricoBacktestFielLC_(
    ss,
    cfg0,
    best.cfg,
    best.score,
    P.WINDOW_CONCURSOS,
    tested,
    changed,
    "BACKTEST_FIEL_50"
  );

  SpreadsheetApp.flush();
  logLC_(ss, "END", `OK. score=${best.score} tested=${tested} duracao_ms=${Date.now() - t0}`);
}


/* =========================
   BACKTEST FIEL (métrica = média de acertos)
   ========================= */

function evaluateCandidateBacktestFielLC_(
  candWeights,
  evalHist,
  statsByEvalIndex,
  weakPairs,
  cfgFull,
  N_SIM_PER_JOGO,
  t0,
  maxMs
) {
  const QTDE_JOGOS = cfgFull.QTDE_JOGOS;
  const JOGO_DEZENAS = cfgFull.JOGO_DEZENAS;

  let sumMedias = 0;
  let nConc = 0;

  for (let i = 0; i < evalHist.length; i++) {
    if (Date.now() - t0 > maxMs) break;

    const sorteioSet = new Set(evalHist[i].dezenas);
    const stats = statsByEvalIndex[i];
    if (!stats) break;

    const p = buildPFromStatsLC_(stats, candWeights);

    const jogos = generateJogosFieisLC_(
      p,
      QTDE_JOGOS,
      JOGO_DEZENAS,
      cfgFull.MAX_SEQ,
      cfgFull.MIN_DIFF,
      weakPairs,
      cfgFull.PENALTY_WEAK_PAIR,
      N_SIM_PER_JOGO
    );

    // Falhou em gerar jogos para este concurso => sinal de regras restritas demais
    if (jogos.length !== QTDE_JOGOS) {
      // não retorna -Infinity direto; devolve score parcial (mais estável)
      break;
    }

    const hits = jogos.map(j => j.reduce((c, d) => c + (sorteioSet.has(d) ? 1 : 0), 0));
    const mediaConcurso = hits.reduce((a, b) => a + b, 0) / hits.length;

    sumMedias += mediaConcurso;
    nConc++;
  }

  return nConc > 0 ? (sumMedias / nConc) : -Infinity;
}


/* =========================
   GERADOR FIEL (regras)
   ========================= */

function generateJogosFieisLC_(
  pList,
  QTDE_JOGOS,
  K,
  MAX_SEQ,
  MIN_DIFF,
  weakPairsSet,
  PENALTY_WEAK_PAIR,
  N_SIM_PER_JOGO
) {
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

    if (!best) return [];
    jogos.push(best);
  }

  return jogos;
}

function scoreJogoLC_(jogo, pList, weakPairsSet, penaltyWeakPair) {
  let sc = 0;
  for (const d of jogo) sc += pList[d - 1];

  for (let i = 0; i < jogo.length; i++) {
    for (let j = i + 1; j < jogo.length; j++) {
      const a = jogo[i], b = jogo[j];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
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
    } else {
      run = 1;
    }
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
   Estatísticas pré-computadas
   ========================= */

function precomputeStatsForEvalWindowLC_(fullHist, windowConc) {
  const N = fullHist.length;
  const startEval = Math.max(0, N - windowConc);

  const q20 = [], q50 = [], q100 = [];
  const c20 = Array(26).fill(0);
  const c50 = Array(26).fill(0);
  const c100 = Array(26).fill(0);

  const freqTotal = Array(26).fill(0);
  const lastSeenIndex = Array(26).fill(-1);

  const statsByEvalIndex = [];

  for (let idx = 0; idx < N; idx++) {
    const dezenas = fullHist[idx].dezenas;

    // snapshot (somente passado)
    if (idx >= startEval) {
      const snap = Array(26);
      for (let d = 1; d <= 25; d++) {
        const atraso = (lastSeenIndex[d] >= 0) ? (idx - lastSeenIndex[d]) : (idx + 1);
        snap[d] = {
          f20: c20[d],
          f50: c50[d],
          f100: c100[d],
          atraso: atraso,
          freqTotal: freqTotal[d],
          N: idx // quantidade de concursos anteriores
        };
      }
      statsByEvalIndex.push(snap);
    }

    // consome idx
    dezenas.forEach(d => {
      freqTotal[d]++;
      lastSeenIndex[d] = idx;
      c20[d]++; c50[d]++; c100[d]++;
    });

    q20.push(dezenas);
    if (q20.length > 20) q20.shift().forEach(d => c20[d]--);

    q50.push(dezenas);
    if (q50.length > 50) q50.shift().forEach(d => c50[d]--);

    q100.push(dezenas);
    if (q100.length > 100) q100.shift().forEach(d => c100[d]--);
  }

  return statsByEvalIndex;
}

function buildPFromStatsLC_(statsSnap, cand) {
  const raw = Array(25).fill(0);

  for (let d = 1; d <= 25; d++) {
    const st = statsSnap[d];
    const pBayes = (st.freqTotal + 1) / (st.N + 2);

    const core =
      (cand.w20 * st.f20) +
      (cand.w50 * st.f50) +
      (cand.w100 * st.f100) -
      (cand.wAtraso * st.atraso);

    const score = (cand.alphaScore * core) + (cand.wBayes * pBayes);
    raw[d - 1] = Number.isFinite(score) ? Math.max(score, 1e-9) : 1e-9;
  }

  return normalizePositiveLC_(raw);
}


/* =========================
   Pares fracos (global)
   ========================= */

function computeWeakPairsGlobalLC_(hist, bottomPairs) {
  const counts = new Map();

  for (const h of hist) {
    const dz = h.dezenas;
    for (let i = 0; i < dz.length; i++) {
      for (let j = i + 1; j < dz.length; j++) {
        const a = dz[i], b = dz[j];
        const key = `${a}-${b}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  const arr = Array.from(counts.entries()).sort((x, y) => x[1] - y[1]);
  return new Set(arr.slice(0, Math.max(0, bottomPairs)).map(x => x[0]));
}


/* =========================
   Monte Carlo ponderado
   ========================= */

function sampleOneDrawWeightedNoReplacementLC_(pList, K) {
  const items = [];
  for (let i = 0; i < pList.length; i++) {
    const w = (pList[i] > 0) ? pList[i] : 1e-12;
    const u = Math.random();
    const key = -Math.log(u) / w;
    items.push({ dezena: i + 1, key });
  }
  items.sort((a, b) => a.key - b.key);
  const chosen = items.slice(0, K).map(o => o.dezena);
  chosen.sort((a, b) => a - b);
  return chosen;
}

function normalizePositiveLC_(arr) {
  const safe = arr.map(x => (Number.isFinite(x) ? Math.max(x, 1e-12) : 1e-12));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map(x => x / sum);
}


/* =========================
   Leitura do histórico "Resultados"
   ========================= */

function loadHistoricoResultadosLC_(shRes) {
  const lr = shRes.getLastRow();
  if (lr < 2) return [];

  const values = shRes.getRange(2, 1, lr - 1, 17).getValues();
  const out = [];

  values.forEach(r => {
    const concurso = Number(r[0]);
    const dezenas = r.slice(2).map(Number).filter(n => n >= 1 && n <= 25);
    const uniq = Array.from(new Set(dezenas)).sort((a, b) => a - b);

    if (!Number.isFinite(concurso)) return;
    if (uniq.length !== 15) return;

    out.push({ concurso, dezenas: uniq });
  });

  return out;
}


/* =========================
   Candidatos
   ========================= */

function pickWeightsLC_(cfg) {
  return {
    w20: cfg.w20,
    w50: cfg.w50,
    w100: cfg.w100,
    wAtraso: cfg.wAtraso,
    wBayes: cfg.wBayes,
    alphaScore: cfg.alphaScore
  };
}

function generateCandidatesAroundCfgLC_(cfg0, maxCandidates) {
  const base = pickWeightsLC_(cfg0);

  const LIMITS = {
    w20: [0, 10],
    w50: [0, 10],
    w100: [0, 10],
    wAtraso: [0, 2],
    wBayes: [0, 2],
    alphaScore: [0, 3]
  };

  const STEP_INT = 1;
  const STEP_SMALL = 0.1;

  const keysInt = ["w20", "w50", "w100"];
  const keysSmall = ["wAtraso", "wBayes", "alphaScore"];

  const cands = [base];

  while (cands.length < maxCandidates) {
    const cand = { ...base };

    const k1 = (Math.random() < 0.5)
      ? keysInt[Math.floor(Math.random() * keysInt.length)]
      : keysSmall[Math.floor(Math.random() * keysSmall.length)];
    tweakKeyLC_(cand, k1, LIMITS, STEP_INT, STEP_SMALL);

    if (Math.random() < 0.35) {
      const k2 = (Math.random() < 0.5)
        ? keysInt[Math.floor(Math.random() * keysInt.length)]
        : keysSmall[Math.floor(Math.random() * keysSmall.length)];
      tweakKeyLC_(cand, k2, LIMITS, STEP_INT, STEP_SMALL);
    }

    if (!cands.some(x => sameWeightsLC_(x, cand))) cands.push(cand);
  }

  return cands;
}

function tweakKeyLC_(cand, key, limits, stepInt, stepSmall) {
  const [lo, hi] = limits[key];
  const step = (key === "w20" || key === "w50" || key === "w100") ? stepInt : stepSmall;
  const dir = (Math.random() < 0.5) ? -1 : 1;

  let v = cand[key] + dir * step;
  v = Math.max(lo, Math.min(hi, v));
  if (key === "w20" || key === "w50" || key === "w100") v = Math.round(v);
  cand[key] = Number(v);
}

function sameWeightsLC_(a, b) {
  const keys = ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"];
  return keys.every(k => Number(a[k]) === Number(b[k]));
}

function hasWeightChangeLC_(a, b) {
  const keys = ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"];
  return keys.some(k => Number(a[k]) !== Number(b[k]));
}


/* =========================
   Config update + Auditoria
   ========================= */

function applyConfigUpdateLC_(ss, newOpt) {
  const sh = mustSheetLC_(ss, "Config");
  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('CONFIG: Aba "Config" vazia (sem linhas key/value).');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const idx = new Map();
  rows.forEach((r, i) => { if (r[0]) idx.set(String(r[0]).trim(), i + 2); });

  const updates = [
    ["w20", newOpt.w20],
    ["w50", newOpt.w50],
    ["w100", newOpt.w100],
    ["wAtraso", newOpt.wAtraso],
    ["wBayes", newOpt.wBayes],
    ["alphaScore", newOpt.alphaScore]
  ];

  updates.forEach(([k, v]) => {
    const rowNum = idx.get(k);
    if (rowNum) sh.getRange(rowNum, 2).setValue(v);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[k, v]]);
  });
}

/**
 * Histórico correto:
 * - Se você quer usar "Config_Historico" (principal): escreva nela.
 * - Se você quer separar backtests: use "Config_Historico_Backtest".
 *
 * Aqui eu vou manter como "Config_Historico_Backtest" (separado), como seu header sugere.
 */
function appendConfigHistoricoBacktestFielLC_(ss, oldCfg, newCfg, bestScore, windowConc, testedCands, changed, modo) {
  let sh = ss.getSheetByName("Config_Historico_Backtest");
  if (!sh) {
    sh = ss.insertSheet("Config_Historico_Backtest"); // <-- CORRIGIDO
    sh.getRange("A1:R1").setValues([[
      "timestamp",
      "mudou",
      "window_concursos",
      "candidatos_testados",
      "best_score_media_hits",
      "w20_old","w50_old","w100_old","wAtraso_old","wBayes_old","alphaScore_old",
      "w20_new","w50_new","w100_new","wAtraso_new","wBayes_new","alphaScore_new",
      "modo"
    ]]);
  }

  const row = [
    new Date(),
    changed ? "SIM" : "NAO",
    windowConc,
    testedCands,
    bestScore,
    oldCfg.w20, oldCfg.w50, oldCfg.w100, oldCfg.wAtraso, oldCfg.wBayes, oldCfg.alphaScore,
    newCfg.w20, newCfg.w50, newCfg.w100, newCfg.wAtraso, newCfg.wBayes, newCfg.alphaScore,
    modo
  ];

  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}


/* =========================
   Utils / Config load
   ========================= */

function mustSheetLC_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`SHEET: Aba "${name}" não encontrada.`);
  return sh;
}

function loadConfigEnsureFullLC_(ss) {
  const sh = mustSheetLC_(ss, "Config");
  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('CONFIG: Aba "Config" sem linhas key/value.');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const cfgRaw = {};
  rows.forEach(([k, v]) => {
    if (!k) return;
    const key = String(k).trim();
    const s = String(v).trim().replace(",", ".");
    const num = Number(s);
    if (Number.isFinite(num)) cfgRaw[key] = num;
  });

  return {
    // pesos
    w20: cfgRaw.w20 ?? 3,
    w50: cfgRaw.w50 ?? 2,
    w100: cfgRaw.w100 ?? 1,
    wAtraso: cfgRaw.wAtraso ?? 0.3,
    wBayes: cfgRaw.wBayes ?? 0.5,
    alphaScore: cfgRaw.alphaScore ?? 1.0,

    // regras / gerador
    QTDE_JOGOS: cfgRaw.QTDE_JOGOS ?? 5,
    JOGO_DEZENAS: cfgRaw.JOGO_DEZENAS ?? 17,
    MAX_SEQ: cfgRaw.MAX_SEQ ?? 4,
    MIN_DIFF: cfgRaw.MIN_DIFF ?? 12,
    BOTTOM_PARES: cfgRaw.BOTTOM_PARES ?? 60,
    PENALTY_WEAK_PAIR: cfgRaw.PENALTY_WEAK_PAIR ?? 5
  };
}


/* =========================
   Logger simples (pode integrar com sua aba Logs)
   ========================= */

function logLC_(ss, tag, msg) {
  console.log(`[LC][${tag}] ${msg}`);
}
