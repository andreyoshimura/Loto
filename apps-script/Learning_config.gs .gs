/**
 * ============================================================
 * Learning_config.gs  (ETAPA 3) - AUTOAJUSTE POR PERFORMANCE
 * ============================================================
 *
 * Objetivo (Opção 1)
 * ------------------
 * Ajustar automaticamente os pesos do gerador para maximizar:
 *   - MÉDIA de acertos dos 5 jogos por execução (bloco de 5 linhas)
 *
 * Como funciona (sem IA)
 * ----------------------
 * 1) Lê "Resultados_Jogos" (append histórico dos acertos)
 * 2) Agrupa em "execuções" (cada execução = 5 jogos)
 * 3) Calcula a métrica: média dos acertos por execução (e média geral)
 * 4) Aplica um ajuste pequeno e controlado nos pesos em "Config"
 *    - Ajuste é conservador para evitar drift e overfitting.
 * 5) Registra auditoria em "Config_Historico"
 *
 * Importante (limitações honestas)
 * -------------------------------
 * - Só com Resultados_Jogos (acertos) você NÃO consegue calcular contrafactual exato
 *   ("com outros pesos eu teria acertado mais no passado"), porque os jogos passados
 *   foram gerados com outros pesos.
 * - Portanto este Learning_config faz:
 *   - controle de drift
 *   - ajuste incremental e auditável
 *
 * Se você quiser "aprendizado real", o próximo upgrade é:
 * - re-simular o histórico (gerar jogos com pesos candidatos) e medir vs sorteios reais.
 *
 * Dependências
 * -----------
 * - Aba "Resultados_Jogos" com cabeçalho:
 *   A data_resultado
 *   B concurso
 *   C dezenas_sorteadas
 *   D jogo_id
 *   E dezenas_jogo
 *   F acertos
 *
 * - Aba "Config" (key/value em A/B). Este script lê e atualiza:
 *   w20, w50, w100, wAtraso, wBayes, alphaScore
 *
 * Saídas
 * ------
 * - Atualiza "Config"
 * - Append em "Config_Historico"
 */


/* =========================================================
   FUNÇÃO PRINCIPAL (execute esta)
   ========================================================= */

/**
 * ajustarConfigPorPerformanceMedia()
 *
 * Quando rodar:
 * - Depois de registrar um resultado em Resultados_Jogos
 * - Antes de gerar novos jogos
 */
function ajustarConfigPorPerformanceMedia() {
  const ss = SpreadsheetApp.getActive();
  const shRJ = mustSheet_(ss, "Resultados_Jogos");

  // garante leitura segura do cfg (aceita vírgula decimal)
  const cfgFull = loadConfigEnsure_(ss);

  // 1) Monta execuções a partir de Resultados_Jogos (robusto)
  const execs = buildExecutionsFromResultadosJogos_(shRJ);

  if (execs.length === 0) {
    throw new Error(
      'Nenhuma execução detectada em "Resultados_Jogos". ' +
      'Confirme que existem acertos numéricos na coluna F e que há blocos completos de 5 linhas.'
    );
  }

  // 2) Janela de treino (últimas execuções)
  const WINDOW_EXECUCOES = Math.min(20, execs.length);
  const recent = execs.slice(-WINDOW_EXECUCOES);

  // 3) Objetivo (Opção 1): média de acertos
  const objBase = objectiveMediaHits_(recent);

  // 4) Ajuste incremental (pequeno, controlado)
  // - regra: se a média recente estiver abaixo de um alvo mínimo, aumenta peso de frequência recente
  // - se estiver acima, reduz levemente para não overfit
  //
  // Obs: você pode mudar TARGET_MEAN se quiser.
  const TARGET_MEAN = 10.0; // alvo "neutro" (não é garantia de nada; serve apenas como referência)

  const oldOpt = pickOptimizableWeights_(cfgFull);
  const newOpt = proposeNextWeights_(oldOpt, objBase, TARGET_MEAN);

  // 5) Aplica limites e update na Config
  const LIMITS = {
    w20: [0, 10],
    w50: [0, 10],
    w100: [0, 10],
    wAtraso: [0, 2],
    wBayes: [0, 2],
    alphaScore: [0, 3]
  };
  clampWeights_(newOpt, LIMITS);

  // 6) Atualiza Config (somente se realmente mudou)
  const changed = hasWeightChange_(oldOpt, newOpt);
  if (changed) applyConfigUpdate_(ss, newOpt);

  // 7) Auditoria
  appendConfigHistorico_(ss, cfgFull, newOpt, objBase, WINDOW_EXECUCOES, changed);

  SpreadsheetApp.flush();
}


/* =========================================================
   OBJETIVO (Opção 1)
   ========================================================= */

/**
 * objectiveMediaHits_(execs)
 *
 * execs = [{concurso, hits:[h1..h5]}...]
 * Retorna: média das médias
 */
function objectiveMediaHits_(execs) {
  const medias = execs.map(e => (e.hits.reduce((a, b) => a + b, 0) / e.hits.length));
  return medias.reduce((a, b) => a + b, 0) / medias.length;
}


/* =========================================================
   AGRUPAMENTO ROBUSTO: Resultados_Jogos -> execuções
   ========================================================= */

/**
 * buildExecutionsFromResultadosJogos_()
 *
 * O que faz:
 * - Agrupa por concurso (col B)
 * - Para cada concurso, quebra em blocos de 5 acertos (col F)
 * - Cada bloco de 5 é 1 "execução"
 *
 * Por que é robusto:
 * - independe do tipo de data
 * - não quebra se você rodar várias vezes no mesmo concurso
 */
function buildExecutionsFromResultadosJogos_(shRJ) {
  const lr = shRJ.getLastRow();
  if (lr < 2) return [];

  const rows = shRJ.getRange(2, 1, lr - 1, 6).getValues(); // A..F
  const byConcurso = new Map();

  rows.forEach(r => {
    const concurso = String(r[1] ?? "").trim();
    const hit = Number(r[5]);

    if (!concurso) return;
    if (!Number.isFinite(hit)) return;

    if (!byConcurso.has(concurso)) byConcurso.set(concurso, []);
    byConcurso.get(concurso).push(hit);
  });

  const execs = [];

  // ordena concursos numericamente quando possível
  const concursos = Array.from(byConcurso.keys()).sort((a, b) => Number(a) - Number(b));

  concursos.forEach(concurso => {
    const hits = byConcurso.get(concurso);

    // quebra em blocos de 5
    for (let i = 0; i + 4 < hits.length; i += 5) {
      execs.push({
        concurso: concurso,
        hits: hits.slice(i, i + 5)
      });
    }
  });

  return execs;
}


/* =========================================================
   PROPOSTA DE AJUSTE (incremental, controlado)
   ========================================================= */

/**
 * proposeNextWeights_(oldOpt, objBase, targetMean)
 *
 * Estratégia simples e controlada:
 * - Se média < target: aumenta levemente w20 e alphaScore, reduz wAtraso um pouco
 * - Se média >= target: reduz levemente w20/alphaScore para evitar drift
 *
 * Observação:
 * - Ajustes pequenos para não “bagunçar” o gerador.
 */
function proposeNextWeights_(oldOpt, objBase, targetMean) {
  const n = { ...oldOpt };

  // passos pequenos
  const STEP_INT = 1;
  const STEP_SMALL = 0.05;

  if (objBase < targetMean) {
    n.w20 = n.w20 + STEP_INT;
    n.alphaScore = n.alphaScore + STEP_SMALL;
    n.wAtraso = n.wAtraso - STEP_SMALL; // menos penalização de atraso
  } else {
    // se está "ok", reduz um pouco para não overfit
    n.w20 = n.w20 - STEP_INT;
    n.alphaScore = n.alphaScore - STEP_SMALL;
    // mantém wAtraso estável
  }

  // ajuste suave no Bayes: aumenta um pouco se média estiver ruim
  if (objBase < targetMean - 1) n.wBayes = n.wBayes + STEP_SMALL;
  if (objBase > targetMean + 1) n.wBayes = n.wBayes - STEP_SMALL;

  return n;
}


/* =========================================================
   LIMITES / DETECÇÃO DE MUDANÇA
   ========================================================= */

function clampWeights_(opt, limits) {
  Object.keys(limits).forEach(k => {
    const [lo, hi] = limits[k];
    let v = Number(opt[k]);
    if (!Number.isFinite(v)) v = lo;
    v = Math.max(lo, Math.min(hi, v));

    if (k === "w20" || k === "w50" || k === "w100") v = Math.round(v);
    opt[k] = v;
  });
}

function hasWeightChange_(a, b) {
  const keys = ["w20", "w50", "w100", "wAtraso", "wBayes", "alphaScore"];
  return keys.some(k => Number(a[k]) !== Number(b[k]));
}


/* =========================================================
   UPDATE NA CONFIG (key/value)
   ========================================================= */

function pickOptimizableWeights_(cfg) {
  return {
    w20: cfg.w20,
    w50: cfg.w50,
    w100: cfg.w100,
    wAtraso: cfg.wAtraso,
    wBayes: cfg.wBayes,
    alphaScore: cfg.alphaScore
  };
}

/**
 * applyConfigUpdate_()
 * Atualiza valores na aba Config, sem depender da ordem.
 */
function applyConfigUpdate_(ss, newOpt) {
  const sh = mustSheet_(ss, "Config");
  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" vazia (sem linhas key/value).');

  const rows = sh.getRange(2, 1, lr - 1, 2).getValues();
  const idx = new Map();
  rows.forEach((r, i) => {
    if (r[0]) idx.set(String(r[0]).trim(), i + 2);
  });

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
    if (rowNum) {
      sh.getRange(rowNum, 2).setValue(v);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[k, v]]);
    }
  });

  return true;
}


/* =========================================================
   AUDITORIA
   ========================================================= */

function appendConfigHistorico_(ss, oldCfgFull, newOpt, objBase, windowExec, changed) {
  let sh = ss.getSheetByName("Config_Historico");
  if (!sh) {
    sh = ss.insertSheet("Config_Historico");
    sh.getRange("A1:M1").setValues([[
      "timestamp",
      "mudou",
      "window_execucoes",
      "media_hits_recente",
      "w20_old", "w50_old", "w100_old", "wAtraso_old", "wBayes_old", "alphaScore_old",
      "w20_new", "w50_new", "w100_new", "wAtraso_new", "wBayes_new", "alphaScore_new"
    ]]);
  }

  const row = [
    new Date(),
    changed ? "SIM" : "NAO",
    windowExec,
    objBase,
    oldCfgFull.w20, oldCfgFull.w50, oldCfgFull.w100, oldCfgFull.wAtraso, oldCfgFull.wBayes, oldCfgFull.alphaScore,
    newOpt.w20, newOpt.w50, newOpt.w100, newOpt.wAtraso, newOpt.wBayes, newOpt.alphaScore
  ];

  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function mustSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Aba "${name}" não encontrada.`);
  return sh;
}

/**
 * loadConfigEnsure_()
 * - lê Config key/value
 * - aceita "0,3" (converte vírgula pra ponto)
 * - retorna defaults se faltar
 *
 * OBS: Se você já tem uma versão mais completa no Core, pode manter a sua.
 */
function loadConfigEnsure_(ss) {
  let sh = ss.getSheetByName("Config");
  if (!sh) sh = ss.insertSheet("Config");

  const lr = sh.getLastRow();
  if (lr < 2) throw new Error('Aba "Config" sem linhas (precisa ter key/value).');

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
    w20: cfgRaw.w20 ?? 3,
    w50: cfgRaw.w50 ?? 2,
    w100: cfgRaw.w100 ?? 1,
    wAtraso: cfgRaw.wAtraso ?? 0.3,
    wBayes: cfgRaw.wBayes ?? 0.5,
    alphaScore: cfgRaw.alphaScore ?? 1.0
  };
}
