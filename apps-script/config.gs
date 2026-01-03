/**
 * ============================================================
 * GERADOR AGRESSIVO (SEM IA) + CONFIG AUTO-CORRIGÍVEL
 * ============================================================
 *
 * O que este conjunto faz
 * -----------------------
 * 1) Gera automaticamente QTDE_JOGOS jogos da Lotofácil
 * 2) Cada jogo tem exatamente JOGO_DEZENAS dezenas distintas (default 17)
 * 3) Usa:
 *    - Aba "Tendencias"   (freq 20/50/100 + atraso) para score configurável
 *    - Aba "Coocorrencia" para penalizar pares historicamente fracos
 *    - Monte Carlo (amostragem ponderada sem reposição) para explorar combinações
 *
 * Por que isso economiza créditos/IA
 * ---------------------------------
 * - Aqui o “cérebro” fica no Apps Script + planilha, sem depender do GPT.
 * - No futuro, se quiser, você pode enviar um JSON pequeno para IA só “formatar”
 *   ou aplicar regras adicionais, mas o pesado já estará pronto.
 *
 * Dependências (abas obrigatórias)
 * --------------------------------
 * - "Resultados": dados históricos (linha 1 cabeçalho; col A id concurso; col C..Q 15 dezenas)
 * - "Tendencias": gerada por gerarAnalises() (linhas 2..26; A..G)
 * - "Coocorrencia": gerada por gerarAnalises() (linhas 2..26; A..Z)
 * - "Config": key/value (col A/B). Se faltar, o script cria e preenche defaults.
 *
 * Saídas
 * ------
 * - "Jogos_Gerados": sobrescrito a cada execução (5 jogos do dia)
 * - "Historico_Jogos": append cumulativo (para rastrear e futuramente aprender)
 *
 * Regras aplicadas
 * ----------------
 * - Exatamente QTDE_JOGOS jogos
 * - Cada jogo com exatamente JOGO_DEZENAS dezenas distintas
 * - Proibido sequência de 5+ consecutivas (MAX_SEQ=4)
 * - Diversidade entre jogos (MIN_DIFF: mínimo de dezenas diferentes)
 * - Penaliza pares fracos (BOTTOM_PARES) dentro do jogo
 *
 * Observação importante sobre Config com vírgula
 * ---------------------------------------------
 * - O parser aceita valores como "0,3" e "0.3".
 *   Converte vírgula -> ponto antes do Number().
 */


/* =========================================================
   FUNÇÃO PRINCIPAL (execute esta)
   ========================================================= */

function gerarJogosAgressivo() {
  const ss = SpreadsheetApp.getActive();

  // --- abas obrigatórias ---
  const shR = mustSheet_(ss, "Resultados");
  const shT = mustSheet_(ss, "Tendencias");
  const shC = mustSheet_(ss, "Coocorrencia");

  // --- config: cria/corrige/preenche defaults automaticamente ---
  const cfg = loadConfigEnsure_(ss);

  const qtdJogos = cfg.QTDE_JOGOS;
  const qtdDezenasJogo = cfg.JOGO_DEZENAS;
  const maxSeq = cfg.MAX_SEQ;

  // =========================
  // 1) Carrega Tendencias
  // =========================
  // Estrutura esperada em Tendencias (A..G):
  // [Dezena, Freq20, Freq50, Freq100, Atraso, Score, Ranking]
  const tend = shT.getRange(2, 1, 25, 7).getValues();

  const dezenasInfo = tend.map(r => ({
    d: Number(r[0]),
    f20: Number(r[1]),
    f50: Number(r[2]),
    f100: Number(r[3]),
    atraso: Number(r[4])
  }));

  // Recalcula score por dezena baseado em Config (não depende da coluna Score da planilha)
  const scoreCfg = dezenasInfo.map(o => {
    const sc = (cfg.w20 * o.f20) + (cfg.w50 * o.f50) + (cfg.w100 * o.f100) - (cfg.wAtraso * o.atraso);
    return { d: o.d, score: sc };
  });

  // =========================
  // 2) Bayes (opcional, em memória)
  // =========================
  // p(d) = (k+1)/(N+2) onde k=freq_total e N=nº de concursos
  const { N, freqTotal } = calcFreqTotalFromResultados_(shR);
  const pBayes = calcBayesProb_(N, freqTotal);

  // =========================
  // 3) Probabilidade final por dezena
  // =========================
  // pFinal = alphaScore*pScore + wBayes*pBayes
  // (ambos normalizados)
  const pScore = normalizePositive_(scoreCfg.map(x => x.score));

  const pFinal = [];
  for (let i = 0; i < 25; i++) {
    const p = (cfg.alphaScore * pScore[i]) + (cfg.wBayes * pBayes[i]);
    pFinal.push(Math.max(p, 1e-12));
  }
  const pFinalNorm = normalizePositive_(pFinal);

  // =========================
  // 4) Coocorrência → pares fracos
  // =========================
  const cooc = shC.getRange(2, 1, 25, 26).getValues();
  const coocMap = buildCoocMap_(cooc);
  const paresFracos = bottomPairs_(coocMap, cfg.BOTTOM_PARES);
  const paresFracosSet = new Set(paresFracos.map(p => keyPair_(p[0], p[1])));

  // =========================
  // 5) Monte Carlo: gera candidatos válidos
  // =========================
  const candidatos = [];
  for (let s = 0; s < cfg.N_SIM; s++) {
    // Amostra ponderada sem reposição (Efraimidis–Spirakis)
    const jogo = sampleOneDrawWeightedNoReplacement_(pFinalNorm, qtdDezenasJogo);

    // Regra: proíbe sequência de 5+ (MAX_SEQ=4)
    if (!checkMaxConsecutive_(jogo, maxSeq)) continue;

    // Penaliza pares fracos
    const penalty = countWeakPairsInGame_(jogo, paresFracosSet);

    // Score do jogo
    const scoreJogo = sumGameScore_(jogo, scoreCfg) - (penalty * cfg.PENALTY_WEAK_PAIR);

    candidatos.push({ jogo, scoreJogo, penalty });
  }

  if (candidatos.length < qtdJogos) {
    throw new Error(`Poucos candidatos válidos (${candidatos.length}). Aumente N_SIM ou relaxe regras.`);
  }

  // Ordena por melhor score
  candidatos.sort((a, b) => b.scoreJogo - a.scoreJogo);

  // Seleciona com diversidade mínima
  const escolhidos = selectDiverseGames_(candidatos, qtdJogos, cfg.MIN_DIFF);

  // Segurança final: garante tamanho correto e ordenação
  const jogosFinal = escolhidos.map(x => x.jogo.slice().sort((a, b) => a - b));
  jogosFinal.forEach((j, idx) => {
    if (new Set(j).size !== qtdDezenasJogo) throw new Error(`Jogo ${idx + 1} não tem ${qtdDezenasJogo} dezenas distintas.`);
    if (!checkMaxConsecutive_(j, maxSeq)) throw new Error(`Jogo ${idx + 1} viola regra de sequência.`);
  });

  // =========================
  // 6) Escrita de saída
  // =========================
  writeJogosGerados_(ss, jogosFinal);
  appendHistorico_(ss, jogosFinal);

  SpreadsheetApp.flush();
}


/* =========================================================
   CONFIG (auto-cria/corrige + aceita vírgula decimal)
   ========================================================= */

/**
 * loadConfigEnsure_()
 *
 * O que faz:
 * - Garante que a aba "Config" exista com 2 colunas e cabeçalho key/value.
 * - Se não houver keys, preenche defaults recomendados.
 * - Lê os valores e retorna um objeto cfg numérico.
 *
 * Correção essencial:
 * - Se o usuário colocar "0,3" na planilha, converte para "0.3" antes de Number().
 */
function loadConfigEnsure_(ss) {
  let sh = ss.getSheetByName("Config");
  if (!sh) sh = ss.insertSheet("Config");

  // garante 2 colunas
  const lastCol = sh.getLastColumn();
  if (lastCol < 2) sh.insertColumnsAfter(1, 2 - lastCol);

  // garante cabeçalho
  const lastRow = sh.getLastRow();
  if (lastRow < 1) {
    sh.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
  } else {
    const h = sh.getRange(1, 1, 1, 2).getValues()[0];
    const h0 = String(h[0]).toLowerCase().trim();
    const h1 = String(h[1]).toLowerCase().trim();
    if (h0 !== "key" || h1 !== "value") sh.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
  }

  // Defaults recomendados (modo agressivo)
  const defaults = [
    ["w20", 3],
    ["w50", 2],
    ["w100", 1],
    ["wAtraso", 0.3],
    ["wBayes", 0.5],
    ["alphaScore", 1.0],
    ["N_SIM", 300],
    ["BOTTOM_PARES", 60],
    ["JOGO_DEZENAS", 17],
    ["QTDE_JOGOS", 5],
    ["MAX_SEQ", 4],
    ["MIN_DIFF", 12],
    ["PENALTY_WEAK_PAIR", 5]
  ];

  // lê existentes (linhas 2..)
  const lr = sh.getLastRow();
  const existing = (lr >= 2) ? sh.getRange(2, 1, lr - 1, 2).getValues() : [];
  const hasAnyKey = existing.some(r => r[0]);

  if (!hasAnyKey) {
    // preenche defaults se não tem nenhuma key
    sh.getRange(2, 1, defaults.length, 2).setValues(defaults);
    SpreadsheetApp.flush();
  } else {
    // completa faltantes sem sobrescrever
    const mapKeys = new Set(existing.filter(r => r[0]).map(r => String(r[0]).trim()));
    const toAppend = defaults.filter(([k]) => !mapKeys.has(k));
    if (toAppend.length) {
      sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, 2).setValues(toAppend);
      SpreadsheetApp.flush();
    }
  }

  // releitura consolidada
  const lr2 = sh.getLastRow();
  const rows = (lr2 >= 2) ? sh.getRange(2, 1, lr2 - 1, 2).getValues() : [];
  const cfgRaw = {};

  rows.forEach(([k, v]) => {
    if (!k) return;
    const key = String(k).trim();

    // aceita 0,3 e 0.3
    const s = String(v).trim().replace(",", ".");
    const num = Number(s);

    if (Number.isFinite(num)) cfgRaw[key] = num;
  });

  // retorna cfg final com fallback
  return {
    w20: cfgRaw.w20 ?? 3,
    w50: cfgRaw.w50 ?? 2,
    w100: cfgRaw.w100 ?? 1,
    wAtraso: cfgRaw.wAtraso ?? 0.3,
    wBayes: cfgRaw.wBayes ?? 0.5,
    alphaScore: cfgRaw.alphaScore ?? 1.0,
    N_SIM: cfgRaw.N_SIM ?? 300,
    BOTTOM_PARES: cfgRaw.BOTTOM_PARES ?? 60,
    JOGO_DEZENAS: cfgRaw.JOGO_DEZENAS ?? 17,
    QTDE_JOGOS: cfgRaw.QTDE_JOGOS ?? 5,
    MAX_SEQ: cfgRaw.MAX_SEQ ?? 4,
    MIN_DIFF: cfgRaw.MIN_DIFF ?? 12,
    PENALTY_WEAK_PAIR: cfgRaw.PENALTY_WEAK_PAIR ?? 5
  };
}


/* =========================================================
   SHEETS: utilitário
   ========================================================= */

function mustSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Aba "${name}" não encontrada.`);
  return sh;
}


/* =========================================================
   RESULTADOS → freq_total e Bayes
   ========================================================= */

/**
 * calcFreqTotalFromResultados_()
 *
 * O que faz:
 * - Lê Resultados (linhas 2..fim, A..Q)
 * - Conta N concursos = nº de linhas
 * - freqTotal[d] = quantas vezes a dezena d apareceu (por concurso, sem duplicata)
 */
function calcFreqTotalFromResultados_(shR) {
  const lastRow = shR.getLastRow();
  if (lastRow < 2) throw new Error('Resultados sem dados.');

  const dados = shR.getRange(2, 1, lastRow - 1, 17).getValues();
  const freqTotal = Array(26).fill(0);

  dados.forEach(row => {
    const dezenas = Array.from(new Set(row.slice(2).map(Number).filter(n => n >= 1 && n <= 25)));
    dezenas.forEach(d => freqTotal[d]++);
  });

  return { N: dados.length, freqTotal };
}

/**
 * calcBayesProb_()
 *
 * Bayes simples com suavização:
 * p(d) = (k + 1) / (N + 2)
 * - k = freq_total da dezena
 * - N = nº de concursos
 *
 * Retorna um vetor normalizado (25 posições, soma 1).
 */
function calcBayesProb_(N, freqTotal) {
  const p = [];
  for (let d = 1; d <= 25; d++) {
    p.push((Number(freqTotal[d]) + 1) / (N + 2));
  }
  return normalizePositive_(p);
}


/* =========================================================
   Normalização
   ========================================================= */

function normalizePositive_(arr) {
  const safe = arr.map(x => (Number.isFinite(x) ? Math.max(x, 1e-12) : 1e-12));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map(x => x / sum);
}


/* =========================================================
   Coocorrência → pares fracos
   ========================================================= */

function keyPair_(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
}

/**
 * buildCoocMap_()
 * Converte a matriz da aba Coocorrencia em Map("a-b" => valor) com a<b.
 */
function buildCoocMap_(cooc) {
  const map = new Map();
  for (let i = 0; i < 25; i++) {
    const a = Number(cooc[i][0]);
    for (let j = i + 1; j < 25; j++) {
      const b = j + 1;
      const v = Number(cooc[i][j + 1]) || 0;
      map.set(keyPair_(a, b), v);
    }
  }
  return map;
}

/**
 * bottomPairs_()
 * Seleciona os N pares com menor coocorrência (>0) para usar como "pares fracos".
 */
function bottomPairs_(coocMap, n) {
  const arr = [];
  for (const [k, v] of coocMap.entries()) {
    if (v > 0) {
      const [a, b] = k.split("-").map(Number);
      arr.push([a, b, v]);
    }
  }
  arr.sort((x, y) => x[2] - y[2]);
  return arr.slice(0, n);
}

function countWeakPairsInGame_(jogo, weakSet) {
  let c = 0;
  for (let i = 0; i < jogo.length; i++) {
    for (let j = i + 1; j < jogo.length; j++) {
      if (weakSet.has(keyPair_(jogo[i], jogo[j]))) c++;
    }
  }
  return c;
}


/* =========================================================
   Regras do jogo e diversidade
   ========================================================= */

/**
 * checkMaxConsecutive_()
 * Proíbe sequência de (maxSeq+1)+ consecutivos.
 * Ex.: maxSeq=4 => 5 consecutivos é proibido.
 */
function checkMaxConsecutive_(nums, maxSeq) {
  const a = nums.slice().sort((x, y) => x - y);
  let run = 1;
  for (let i = 1; i < a.length; i++) {
    if (a[i] === a[i - 1] + 1) {
      run++;
      if (run > maxSeq) return false;
    } else {
      run = 1;
    }
  }
  return true;
}

function sumGameScore_(jogo, scoreCfg) {
  const m = new Map(scoreCfg.map(o => [o.d, o.score]));
  return jogo.reduce((s, d) => s + (m.get(d) || 0), 0);
}

/**
 * selectDiverseGames_()
 * Escolhe jogos garantindo diversidade mínima:
 * - diffCount >= minDiff para todos os pares de jogos escolhidos.
 */
function selectDiverseGames_(candidatos, qtd, minDiff) {
  const chosen = [];
  for (const c of candidatos) {
    if (chosen.length >= qtd) break;
    const ok = chosen.every(x => diffCount_(x.jogo, c.jogo) >= minDiff);
    if (ok) chosen.push(c);
  }

  // fallback se não conseguir diversidade suficiente
  if (chosen.length < qtd) {
    for (const c of candidatos) {
      if (chosen.length >= qtd) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }
  return chosen.slice(0, qtd);
}

function diffCount_(a, b) {
  const sa = new Set(a);
  let inter = 0;
  b.forEach(x => { if (sa.has(x)) inter++; });
  return a.length - inter;
}


/* =========================================================
   Monte Carlo (Efraimidis–Spirakis) - REAPROVEITADO
   ========================================================= */

/**
 * sampleOneDrawWeightedNoReplacement_()
 *
 * Amostragem ponderada sem reposição:
 * key_i = -ln(U_i) / w_i
 * Seleciona os K menores keys.
 *
 * Entrada:
 * - pList: array[25] de probabilidades (soma ~1)
 * - K: dezenas por jogo (ex.: 17)
 *
 * Saída:
 * - array com K dezenas (1..25) ordenadas crescente
 */
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


/* =========================================================
   Escrita de saída (planilha)
   ========================================================= */

function writeJogosGerados_(ss, jogos) {
  let sh = ss.getSheetByName("Jogos_Gerados");
  if (!sh) sh = ss.insertSheet("Jogos_Gerados");
  sh.clear();

  sh.getRange("A1:C1").setValues([["data", "jogo_id", "dezenas"]]);

  const hoje = new Date();
  const rows = jogos.map((j, idx) => [
    hoje,
    `J${String(idx + 1).padStart(2, "0")}`,
    j.map(n => String(n).padStart(2, "0")).join("-")
  ]);

  sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function appendHistorico_(ss, jogos) {
  let sh = ss.getSheetByName("Historico_Jogos");
  if (!sh) {
    sh = ss.insertSheet("Historico_Jogos");
    sh.getRange("A1:C1").setValues([["data", "jogo_id", "dezenas"]]);
  }

  const hoje = new Date();
  const start = sh.getLastRow() + 1;

  const rows = jogos.map((j, idx) => [
    hoje,
    `J${String(idx + 1).padStart(2, "0")}`,
    j.map(n => String(n).padStart(2, "0")).join("-")
  ]);

  sh.getRange(start, 1, rows.length, 3).setValues(rows);
}
