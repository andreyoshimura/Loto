/**
 * ============================================================
 * Learning_config.gs (ETAPA 5) - BACKTEST FIEL AO GERADOR REAL
 * ============================================================
 *
 * Objetivo
 * --------
 * Encontrar o melhor conjunto de pesos (w20,w50,w100,wAtraso,wBayes,alphaScore)
 * por BACKTEST, gerando jogos com as MESMAS REGRAS do gerador de produção:
 *  - jogos de 17 dezenas (JOGO_DEZENAS)
 *  - QTDE_JOGOS jogos por concurso
 *  - proíbe sequência > MAX_SEQ (ex.: MAX_SEQ=4 => proíbe 5+ consecutivas)
 *  - diversidade entre jogos >= MIN_DIFF (diferença simétrica)
 *  - penaliza pares fracos (BOTTOM_PARES + PENALTY_WEAK_PAIR)
 *
 * Dados de entrada
 * ---------------
 * Aba "Resultados":
 *  - Col A: concurso
 *  - Col C..Q: 15 dezenas sorteadas
 *
 * Aba "Config":
 *  - key/value (A/B) com os parâmetros usados.
 *
 * Saída
 * -----
 * - Atualiza "Config" com os melhores pesos encontrados
 * - Append em "Config_Historico" com modo "BACKTEST_FIEL_50"
 *
 * Performance / Limites
 * ---------------------
 * Backtest é pesado. Este script:
 *  - Pré-computa estatísticas por concurso uma vez (independente do candidato)
 *  - Pré-calcula pares fracos uma vez (coocorrência global do histórico)
 *  - Limita candidatos e simulações por concurso para não estourar tempo
 */


/* =========================
   FUNÇÃO PRINCIPAL
   ========================= */

function backtestFielEAutoAjustarConfig_50() {
  const ss = SpreadsheetApp.getActive();
  const shRes = mustSheet_(ss, "Resultados");
  const cfg0 = loadConfigEnsureFull_(ss);

  // Ajuste fino aqui se quiser
  const P = {
    WINDOW_CONCURSOS: 50,     // <-- escolhido
    MAX_CANDIDATES: 14,       // candidatos por execução
    MAX_RUNTIME_MS: 240000,   // ~4 min
    N_SIM_PER_JOGO: 90        // tentativas por jogo (filtrando regras)
  };

  // 1) Carrega histórico completo (para estatísticas e pares)
  const fullHist = loadHistoricoResultados_(shRes); // [{concurso, dezenas[15]}...]
  if (fullHist.length < P.WINDOW_CONCURSOS + 30) {
    // não bloqueia; só reduz janela se for pouco
    P.WINDOW_CONCURSOS = Math.min(P.WINDOW_CONCURSOS, fullHist.length);
  }

  // 2) Define janela de avaliação (últimos N concursos)
  const evalHist = fullHist.slice(-P.WINDOW_CONCURSOS);

  // 3) Pré-computa estatísticas por concurso (rolling windows + atraso + freq_total + N)
  //    Isso é independente do candidato => ganho enorme de performance.
  const statsByEvalIndex = precomputeStatsForEvalWindow_(fullHist, P.WINDOW_CONCURSOS);

  // 4) Pré-computa pares fracos (coocorrência global do histórico)
  const weakPairs = computeWeakPairsGlobal_(fullHist, cfg0.BOTTOM_PARES);

  // 5) Gera candidatos ao redor do cfg atual
  const candidates = generateCandidatesAroundCfg_(cfg0, P.MAX_CANDIDATES);

  // 6) Avalia cada candidato (backtest fiel)
  const t0 = Date.now();
  let best = { cfg: pickWeights_(cfg0), score: -Infinity };
  let tested = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (Date.now() - t0 > P.MAX_RUNTIME_MS) break;
    const cand = candidates[i];

    const score = evaluateCandidateBacktestFiel_(
      cand,
      evalHist,
      statsByEvalIndex,
      weakPairs,
      cfg0,                // para pegar MAX_SEQ/MIN_DIFF/PENALTY_WEAK_PAIR/QTDE_JOGOS/JOGO_DEZENAS
      P.N_SIM_PER_JOGO,
      t0,
      P.MAX_RUNTIME_MS
    );

    tested++;

    if (score > best.score) best = { cfg: cand, score };
  }

  if (!Number.isFinite(best.score) || best.score < 0) {
    throw new Error("Backtest fiel falhou (timeout ou dados insuficientes).");
  }

  // 7) Aplica melhor cfg
  const changed = hasWeightChange_(pickWeights_(cfg0), best.cfg);
  if (changed) applyConfigUpdate_(ss, best.cfg);

  // 8) Auditoria
  appendConfigHistoricoBacktestFiel_(
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
}


/* =========================
   BACKTEST FIEL (métrica = média de acertos)
   ========================= */

/**
 * Para cada concurso na janela:
 *  - monta distribuição de pesos por dezena usando stats pré-computadas + candidato
 *  - gera QTDE_JOGOS com as regras (seq/diversidade/pares fracos)
 *  - calcula acertos vs sorteio real
 * Score = média das médias de acertos (por concurso)
 */
function evaluateCandidateBacktestFiel_(
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
    const stats = statsByEvalIndex[i]; // stats para este concurso (baseado no passado)

    // monta pesos por dezena (1..25)
    const p = buildPFromStats_(stats, candWeights);

    // gera os jogos (fiel: regras)
    const jogos = generateJogosFieis_(
      p,
      QTDE_JOGOS,
      JOGO_DEZENAS,
      cfgFull.MAX_SEQ,
      cfgFull.MIN_DIFF,
      weakPairs,
      cfgFull.PENALTY_WEAK_PAIR,
      N_SIM_PER_JOGO
    );

    // se por algum motivo não conseguiu gerar (muito restrito), quebra
    if (jogos.length !== QTDE_JOGOS) break;

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

/**
 * Gera QTDE_JOGOS jogos de tamanho K:
 * - Monte Carlo: tenta N_SIM_PER_JOGO candidatos por jogo
 * - filtra: MAX_SEQ (sequência máxima)
 * - filtra: diversidade MIN_DIFF vs jogos já aceitos
 * - escolhe melhor candidato por score (peso das dezenas - penalidade de pares fracos)
 */
function generateJogosFieis_(
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
      const cand = sampleOneDrawWeightedNoReplacement_(pList, K);

      if (!okMaxSeq_(cand, MAX_SEQ)) continue;
      if (!okDiversity_(cand, jogos, MIN_DIFF)) continue;

      const sc = scoreJogo_(cand, pList, weakPairsSet, PENALTY_WEAK_PAIR);
      if (sc > bestScore) {
        bestScore = sc;
        best = cand;
      }
    }

    if (!best) return []; // falhou para este jogo
    jogos.push(best);
  }

  return jogos;
}

function scoreJogo_(jogo, pList, weakPairsSet, penaltyWeakPair) {
  // soma pesos individuais
  let sc = 0;
  for (const d of jogo) sc += pList[d - 1];

  // penaliza pares fracos
  for (let i = 0; i < jogo.length; i++) {
    for (let j = i + 1; j < jogo.length; j++) {
      const a = jogo[i], b = jogo[j];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (weakPairsSet.has(key)) sc -= penaltyWeakPair;
    }
  }

  return sc;
}

function okMaxSeq_(numsSortedAsc, maxSeq) {
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

function okDiversity_(cand, jogos, minDiff) {
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
   Estatísticas pré-computadas (janelas + atraso + Bayes)
   ========================= */

/**
 * Pré-computa stats para cada concurso da janela de avaliação.
 * statsByEvalIndex[i] é um array [26] (1..25) com:
 *  { f20,f50,f100, atraso, freqTotal, N }
 *
 * Importante: stats para o concurso X são calculadas usando somente concursos anteriores a X.
 */
function precomputeStatsForEvalWindow_(fullHist, windowConc) {
  const N = fullHist.length;
  const startEval = Math.max(0, N - windowConc);

  // rolling windows: armazenar últimas listas de dezenas para atualizar contagens
  const q20 = [];
  const q50 = [];
  const q100 = [];
  const c20 = Array(26).fill(0);
  const c50 = Array(26).fill(0);
  const c100 = Array(26).fill(0);

  const freqTotal = Array(26).fill(0);
  const lastSeenIndex = Array(26).fill(-1);

  const statsByEvalIndex = [];

  for (let idx = 0; idx < N; idx++) {
    const dezenas = fullHist[idx].dezenas;

    // Antes de "consumir" o idx, se ele está na janela de avaliação,
    // snapshot das stats acumuladas (baseadas no passado)
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
          N: idx // número de concursos "passados" usados (0..idx-1); aqui idx é quantidade antes de consumir idx
        };
      }
      statsByEvalIndex.push(snap);
    }

    // Agora consome o concurso idx (atualiza contagens para próximos)
    dezenas.forEach(d => {
      freqTotal[d]++;
      lastSeenIndex[d] = idx;
      c20[d]++; c50[d]++; c100[d]++;
    });

    q20.push(dezenas);
    if (q20.length > 20) {
      const old = q20.shift();
      old.forEach(d => c20[d]--);
    }

    q50.push(dezenas);
    if (q50.length > 50) {
      const old = q50.shift();
      old.forEach(d => c50[d]--);
    }

    q100.push(dezenas);
    if (q100.length > 100) {
      const old = q100.shift();
      old.forEach(d => c100[d]--);
    }
  }

  return statsByEvalIndex; // tamanho = windowConc
}

/**
 * Constrói pList (25) a partir de stats (por dezena) e pesos do candidato.
 * p = alpha*(w20*f20 + w50*f50 + w100*f100 - wAtraso*atraso) + wBayes*pBayes
 * pBayes = (freqTotal+1)/(N+2)
 */
function buildPFromStats_(statsSnap, cand) {
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

    // garante positivo mínimo
    raw[d - 1] = Number.isFinite(score) ? Math.max(score, 1e-9) : 1e-9;
  }

  return normalizePositive_(raw);
}


/* =========================
   Pares fracos (coocorrência global)
   ========================= */

/**
 * Computa coocorrência global no histórico e retorna Set dos BOTTOM_PARES mais fracos.
 * “Mais fraco” = menor contagem de coocorrências.
 */
function computeWeakPairsGlobal_(hist, bottomPairs) {
  // matriz triangular em map "a-b" -> count
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

  // ordena por contagem crescente e pega bottomPairs
  const arr = Array.from(counts.entries()).sort((x, y) => x[1] - y[1]);
  const weak = new Set(arr.slice(0, Math.max(0, bottomPairs)).map(x => x[0]));
  return weak;
}


/* =========================
   Monte Carlo ponderado (sem reposição)
   ========================= */

function sampleOneDrawWeightedNoReplacement_(pList, K) {
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

function normalizePositive_(arr) {
  const safe = arr.map(x => (Number.isFinite(x) ? Math.max(x, 1e-12) : 1e-12));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map(x => x / sum);
}


/* =========================
   Leitura do histórico "Resultados"
   ========================= */

function loadHistoricoResultados_(shRes) {
  const lr = shRes.getLastRow();
  if (lr < 2) return [];

  const values = shRes.getRange(2, 1, lr - 1, 17).getValues(); // A..Q
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
   Candidatos (vizinhança do cfg atual)
   ========================= */

function pickWeights_(cfg) {
  return {
    w20: cfg.w20,
    w50: cfg.w50,
    w100: cfg.w100,
    wAtraso: cfg.wAtraso,
    wBayes: cfg.wBayes,
    alphaScore: cfg.alphaScore
  };
}

function generateCandidatesAroundCfg_(cfg0, maxCandidates) {
  const base = pickWeights_(cfg0);

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
    tweakKey_(cand, k1, LIMITS, STEP_INT, STEP_SMALL);

    if (Math.random() < 0.35) {
      const k2 = (Math.random() < 0.5)
        ? keysInt[Math.floor(Math.random() * keysInt.length)]
        : keysSmall[Math.floor(Math.random() * keysSmall.length)];
      tweakKey_(cand, k2, LIMITS, STEP_INT, STEP_SMALL);
    }

    if (!cands.some(x => sameWeights_(x, cand))) cands.push(cand);
  }

  return cands;
}

function tweakKey_(cand, key, limits, stepInt, stepSmall) {
  const [lo, hi] = limits[key];
  const step = (key === "w20" || key === "w50" || key === "w100") ? stepInt : stepSmall;
  const dir = (Math.random() < 0.5) ? -1 : 1;

  let v = cand[key] + dir * step;
  v = Math.max(lo, Math.min(hi, v));
  if (key === "w20" || key === "w50" || key === "w100") v = Math.round(v);
  cand[key] = Number(v);
}

function sameWeights_(a, b) {
  const keys = ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"];
  return keys.every(k => Number(a[k]) === Number(b[k]));
}

function hasWeightChange_(a, b) {
  const keys = ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"];
  return keys.some(k => Number(a[k]) !== Number(b[k]));
}


/* =========================
   Config update + Auditoria
   ========================= */

function applyConfigUpdate_(ss, newOpt) {
  const sh = mustSheet_(ss, "Config");
  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" vazia (sem linhas key/value).');

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

function appendConfigHistoricoBacktestFiel_(ss, oldCfg, newCfg, bestScore, windowConc, testedCands, changed, modo) {
  let sh = ss.getSheetByName("Config_Historico_Backtest");
  if (!sh) {
    sh = ss.insertSheet("Config_Historico");
    sh.getRange("A1:Q1").setValues([[
      "timestamp",
      "mudou",
      "window_concursos",
      "candidatos_testados",
      "best_score_media_hits",
      "w20_old","w50_old","w100_old","wAtraso_old","wBayes_old","alphaScore_old",
      "w20_new","w50_new","w100_new","wAtraso_new","wBayes_new","alphaScore_new",
      "modo"
    ]]);
  } else {
    // garante pelo menos 17 colunas
    if (sh.getLastColumn() < 17) sh.insertColumnsAfter(sh.getLastColumn(), 17 - sh.getLastColumn());
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

function mustSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Aba "${name}" não encontrada.`);
  return sh;
}

/**
 * Lê Config completo (inclui regras), aceitando vírgula decimal.
 */
function loadConfigEnsureFull_(ss) {
  const sh = mustSheet_(ss, "Config");
  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" sem linhas key/value.');

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
