/**************************************************
 * Parâmetros
 **************************************************/

// quantos jogos Monte Carlo gerar por execução
var N_SIM = 100;      // ajuste aqui se quiser mais/menos

// número de dezenas por jogo na Lotofácil
var QTD_DEZENAS_JOGO = 15;

// nome das abas (iguais às que você já usa)
var NOME_SHEET_RESULTADOS = 'Resultados';
var NOME_SHEET_RESUMO     = 'Resumo';
var NOME_SHEET_SIM_MC     = 'Simulador_MC';


/**************************************************
 * Função principal para ser chamada no Apps Script
 **************************************************/

function buildBayesAndMonteCarlo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resultadosSheet = ss.getSheetByName(NOME_SHEET_RESULTADOS);
  var resumoSheet     = ss.getSheetByName(NOME_SHEET_RESUMO);

  if (!resultadosSheet || !resumoSheet) {
    throw new Error('Sheets "Resultados" ou "Resumo" não encontrados.');
  }

  // 1) Atualiza Resumo com p_bayes, z_score, rank_bayes
  var pList = updateResumoBayes_(resumoSheet, resultadosSheet);

  // 2) Gera simulações Monte Carlo em Simulador_MC
  generateMonteCarloSheet_(ss, pList);
}


/**************************************************
 * 1) Atualizar aba Resumo com Bayes + z-score
 **************************************************/

function updateResumoBayes_(resumoSheet, resultadosSheet) {
  // assume: linha 1 = cabeçalho, concursos começam na linha 2
  var lastRowResultados = resultadosSheet.getLastRow();
  if (lastRowResultados <= 1) {
    throw new Error('Nenhum concurso em "' + NOME_SHEET_RESULTADOS + '".');
  }

  // N = quantidade de concursos (1 linha por concurso)
  var N = lastRowResultados - 1;

  // assume 25 dezenas, começando na linha 2, colunas:
  // A = dezena, B = freq_total (como está hoje na sua planilha)
  var startRow   = 2;
  var numDezenas = 25;

  var dadosResumo = resumoSheet
    .getRange(startRow, 1, numDezenas, 2)  // A..B
    .getValues();

  // definir cabeçalhos das novas colunas: J, K, L
  // (colunas 10,11,12)
  resumoSheet.getRange(1, 10, 1, 3).setValues([[
    'p_bayes',
    'z_score',
    'rank_bayes'
  ]]);

  var pList   = [];
  var newCols = [];

  // probabilidade "uniforme" da dezena aparecer num concurso
  var p0 = QTD_DEZENAS_JOGO / 25.0;
  var expectedCount = N * p0;
  var sigma = Math.sqrt(N * p0 * (1 - p0));

  for (var i = 0; i < numDezenas; i++) {
    var dezena    = Number(dadosResumo[i][0]); // col A
    var freqTotal = Number(dadosResumo[i][1]) || 0; // col B

    // probabilidade Bayesiana por concurso: (k+1)/(N+2)
    var p = (freqTotal + 1) / (N + 2);
    pList.push(p);

    // z-score em relação à distribuição uniforme
    var z = (sigma > 0)
      ? (freqTotal - expectedCount) / sigma
      : 0;

    // placeholder para rank; calculo depois
    newCols.push([p, z, 0]);
  }

  // calcular rank_bayes = 1 para maior probabilidade, etc.
  for (var i = 0; i < numDezenas; i++) {
    var pi = pList[i];
    var rank = 1;
    for (var j = 0; j < numDezenas; j++) {
      if (pList[j] > pi) {
        rank++;
      }
    }
    newCols[i][2] = rank;
  }

  // gravar nas colunas J,K,L (10,11,12)
  resumoSheet
    .getRange(startRow, 10, numDezenas, 3)
    .setValues(newCols);

  return pList; // vetor de 25 probabilidades, usado no Monte Carlo
}


/**************************************************
 * 2) Gerar aba Simulador_MC com jogos via Monte Carlo
 **************************************************/

function generateMonteCarloSheet_(ss, pList) {
  var simSheet = ss.getSheetByName(NOME_SHEET_SIM_MC);
  if (!simSheet) {
    simSheet = ss.insertSheet(NOME_SHEET_SIM_MC);
  } else {
    simSheet.clearContents();
  }

  // cabeçalho: sim, d1..d15
  var header = ['sim'];
  for (var i = 1; i <= QTD_DEZENAS_JOGO; i++) {
    header.push('d' + i);
  }
  simSheet.getRange(1, 1, 1, header.length).setValues([header]);

  var allRows = [];

  for (var s = 0; s < N_SIM; s++) {
    var draw = sampleOneDrawBayes_(pList); // array de 15 dezenas
    var row = [s + 1].concat(draw);
    allRows.push(row);
  }

  simSheet.getRange(2, 1, allRows.length, header.length).setValues(allRows);
}


/**************************************************
 *  Amostragem sem reposição ponderada
 *  (Efraimidis–Spirakis)
 *  key_i = -ln(U_i) / w_i
 *  pegar os 15 menores keys.
 **************************************************/

function sampleOneDrawBayes_(pList) {
  var items = [];
  for (var i = 0; i < pList.length; i++) {
    var p = pList[i];
    var w = (p > 0) ? p : 1e-9; // proteção
    var u = Math.random();
    var key = -Math.log(u) / w;
    items.push({
      dezena: i + 1, // números 1..25
      key: key
    });
  }

  // ordena por key crescente
  items.sort(function (a, b) {
    return a.key - b.key;
  });

  // pega as primeiras QTD_DEZENAS_JOGO dezenas
  var chosen = items.slice(0, QTD_DEZENAS_JOGO).map(function (o) {
    return o.dezena;
  });

  // ordenar o resultado final (opcional)
  chosen.sort(function (a, b) {
    return a - b;
  });

  return chosen;
}
