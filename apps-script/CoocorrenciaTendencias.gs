/**
 * Gera automaticamente:
 * 1) Aba "Coocorrencia" (matriz 25×25)
 * 2) Aba "Tendencias" (Freq 20/50/100 + Atraso corrigido + Score + Ranking)
 *
 * Fonte: aba "Resultados"
 * Esperado em "Resultados":
 * - Coluna A: identificador do concurso (opcional para este script)
 * - Colunas C a Q: 15 dezenas do concurso (17 colunas no range total A:Q)
 */
function gerarAnalises() {
  const ss = SpreadsheetApp.getActive();
  const shR = ss.getSheetByName("Resultados");
  if (!shR) throw new Error('Aba "Resultados" não encontrada.');

  const lastRow = shR.getLastRow();
  if (lastRow < 2) throw new Error('Aba "Resultados" sem dados (mínimo a partir da linha 2).');

  // Lê A:Q (17 colunas), a partir da linha 2
  const dados = shR.getRange(2, 1, lastRow - 1, 17).getValues();
  const totalConcursos = dados.length;

  // ======================
  // 1) COOCORRÊNCIA 25×25
  // ======================
  const matriz = Array.from({ length: 25 }, () => Array(25).fill(0));

  dados.forEach(row => {
    // dezenas estão em C:Q -> índices 2..16
    const dezenas = row.slice(2).map(Number).filter(n => n >= 1 && n <= 25);

    // remove duplicatas no mesmo concurso (segurança)
    const unicas = Array.from(new Set(dezenas));

    unicas.forEach(d1 => {
      unicas.forEach(d2 => {
        if (d1 !== d2) matriz[d1 - 1][d2 - 1]++;
      });
    });
  });

  let shC = ss.getSheetByName("Coocorrencia");
  if (!shC) shC = ss.insertSheet("Coocorrencia");
  shC.clear();

  // Header (linha 1, colunas B..Z): 1..25
  shC.getRange(1, 2, 1, 25).setValues([
    Array.from({ length: 25 }, (_, i) => i + 1)
  ]);

  // Corpo (linhas 2..26):
  // Col A = dezena da linha; Col B..Z = matriz
  const corpo = [];
  for (let i = 0; i < 25; i++) {
    corpo.push([i + 1, ...matriz[i]]);
  }
  shC.getRange(2, 1, 25, 26).setValues(corpo);

  // ======================
  // 2) TENDÊNCIAS
  // ======================
  const freq20 = Array(26).fill(0);
  const freq50 = Array(26).fill(0);
  const freq100 = Array(26).fill(0);
  const atraso = Array(26).fill(0);
  const ultimoIndex = Array(26).fill(null);

  for (let i = 0; i < totalConcursos; i++) {
    const dezenas = dados[i].slice(2).map(Number).filter(n => n >= 1 && n <= 25);
    const unicas = Array.from(new Set(dezenas));

    unicas.forEach(d => {
      if (i >= totalConcursos - 20) freq20[d]++;
      if (i >= totalConcursos - 50) freq50[d]++;
      if (i >= totalConcursos - 100) freq100[d]++;

      // guarda o índice da última aparição
      ultimoIndex[d] = i;
    });
  }

  // Atraso CORRETO:
  // - 0 se saiu no último concurso (índice totalConcursos-1)
  // - totalConcursos se nunca apareceu
  for (let d = 1; d <= 25; d++) {
    atraso[d] = (ultimoIndex[d] == null)
      ? totalConcursos
      : (totalConcursos - 1 - ultimoIndex[d]);
  }

  let shT = ss.getSheetByName("Tendencias");
  if (!shT) shT = ss.insertSheet("Tendencias");
  shT.clear();

  shT.getRange(1, 1, 1, 7).setValues([[
    "Dezena", "Freq 20", "Freq 50", "Freq 100", "Atraso", "Score", "Ranking"
  ]]);

  const tabela = [];
  for (let d = 1; d <= 25; d++) {
    // Score (ajuste livre): prioriza curto prazo e penaliza atraso
    const score = (freq20[d] * 3) + (freq50[d] * 2) + (freq100[d] * 1) - (atraso[d] * 0.3);
    tabela.push([d, freq20[d], freq50[d], freq100[d], atraso[d], score]);
  }

  // Ordena por score desc
  tabela.sort((a, b) => b[5] - a[5]);

  // Ranking 1..25
  tabela.forEach((linha, idx) => linha.push(idx + 1));

  shT.getRange(2, 1, 25, 7).setValues(tabela);
}
