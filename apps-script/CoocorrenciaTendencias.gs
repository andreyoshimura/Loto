/**
 * Script 2 - Coocorrencia e tendencia
 * Gera automaticamente:
 * 1. Aba COOCORRENCIA (25×25)
 * 2. Aba TENDENCIAS (20, 50, 100 + atraso + ranking)
 *
 * Fonte: aba "Resultados"
 */

function gerarAnalises() {
  const ss = SpreadsheetApp.getActive();

  const dados = ss.getSheetByName("Resultados")
    .getRange(2, 1, ss.getSheetByName("Resultados").getLastRow() - 1, 17)
    .getValues();

  // ----------------------
  // COOCORRÊNCIA 25x25
  // ----------------------

  let matriz = [];
  for (let i = 0; i < 25; i++) {
    matriz[i] = [];
    for (let j = 0; j < 25; j++) matriz[i][j] = 0;
  }

  dados.forEach(row => {
    const dezenas = row.slice(2).map(Number); 

    dezenas.forEach(d1 => {
      dezenas.forEach(d2 => {
        if (d1 !== d2) matriz[d1 - 1][d2 - 1]++;
      });
    });
  });

  let shC = ss.getSheetByName("Coocorrencia");
  if (!shC) shC = ss.insertSheet("Coocorrencia");
  shC.clear();

  // Header
  shC.getRange(1, 2, 1, 25).setValues([Array.from({ length: 25 }, (_, i) => i + 1)]);
  let corpo = [];

  for (let i = 0; i < 25; i++) {
    corpo.push([i + 1, ...matriz[i]]);
  }

  shC.getRange(2, 1, 25, 26).setValues(corpo);


  // ----------------------
  // TENDÊNCIAS
  // ----------------------

  const totalConcursos = dados.length;

  let freq20 = Array(26).fill(0);
  let freq50 = Array(26).fill(0);
  let freq100 = Array(26).fill(0);
  let atraso = Array(26).fill(0);
  let ultimoIndex = {};

  for (let i = 0; i < dados.length; i++) {
    const dezenas = dados[i].slice(2).map(Number);

    dezenas.forEach(d => {
      // Frequência últimas janelas
      if (i >= totalConcursos - 20) freq20[d]++;
      if (i >= totalConcursos - 50) freq50[d]++;
      if (i >= totalConcursos - 100) freq100[d]++;

      // Última aparição (para atraso)
      ultimoIndex[d] = i;
    });
  }

  for (let d = 1; d <= 25; d++) {
    atraso[d] = totalConcursos - (ultimoIndex[d] ?? 0);
  }

  let shT = ss.getSheetByName("Tendencias");
  if (!shT) shT = ss.insertSheet("Tendencias");
  shT.clear();

  shT.getRange(1, 1, 1, 7).setValues([[
    "Dezena", "Freq 20", "Freq 50", "Freq 100", "Atraso", "Score", "Ranking"
  ]]);

  let tabela = [];

  for (let d = 1; d <= 25; d++) {
    const score = freq20[d] * 3 + freq50[d] * 2 + freq100[d] - atraso[d] * 0.3;
    tabela.push([d, freq20[d], freq50[d], freq100[d], atraso[d], score]);
  }

  tabela.sort((a, b) => b[5] - a[5]);

  tabela.forEach((linha, idx) => linha.push(idx + 1));

  shT.getRange(2, 1, 25, 7).setValues(tabela);
}
