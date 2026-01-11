/******************************************************
 * Análise de jogos Lotofácil na planilha DB_Loto
 *
 * Função principal: atualizarAnaliseLoto()
 *
 * Premissas:
 *  - Aba "DB_Loto":
 *    A1: concurso
 *    B1: data
 *    C1..Q1: d1..d15
 *    Linhas 2..N: concursos reais
 *  - Aba "JOGOS":
 *    A: JogoID
 *    B..P: 15 dezenas
 ******************************************************/

function atualizarAnaliseLoto() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheetName = 'Resultados';
  const jogosSheetName = 'JOGOS';
  const resumoSheetName = 'Resumo_Jogos';
  const conc14SheetName = 'Concursos_14plus';

  /*******************
   * 1) Ler DB_Loto
   *******************/
  const dbSheet = ss.getSheetByName(dbSheetName);
  if (!dbSheet) {
    throw new Error('Aba "DB_Loto" não encontrada. O nome da aba precisa ser exatamente DB_Loto.');
  }

  const lastRow = dbSheet.getLastRow();
  const lastCol = dbSheet.getLastColumn();

  if (lastRow < 2) {
    throw new Error('Aba "DB_Loto" tem cabeçalho, mas nenhuma linha de concurso (linha 2 em diante está vazia).');
  }
  if (lastCol < 17) {
    throw new Error('Aba "DB_Loto" precisa ter pelo menos até a coluna Q (d15).');
  }

  // Lê tudo de A1 até a última linha/coluna com dados
  const allValues = dbSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const header = allValues[0];
  const dataRows = allValues.slice(1); // linhas 2..N
  const numConcursos = dataRows.length;

  /*******************
   * 2) Ler / criar JOGOS
   *******************/
  const defaultJogos = [
    [1,  [1,2,3,5,6,8,11,12,14,16,17,20,21,23,25]],
    [2,  [2,3,5,6,8,11,12,14,16,17,20,21,22,24,25]],
    [3,  [2,3,5,6,7,8,12,14,16,17,19,21,22,23,25]],
    [4,  [1,2,3,5,6,8,11,12,14,16,17,21,22,23,24]],
    [5,  [1,2,3,5,6,7,8,12,16,17,19,21,22,23,25]],
    [6,  [2,3,5,6,7,8,12,14,16,17,19,20,21,22,23]],
    [7,  [1,2,3,5,6,11,12,14,16,17,19,20,21,23,24]],
    [8,  [1,2,3,5,6,7,8,11,16,17,20,22,23,24,25]],
    [9,  [1,2,3,5,6,7,8,12,14,16,19,20,21,23,25]],
    [10, [2,3,5,6,7,11,12,14,16,17,19,21,23,24,25]],
    [11, [2,3,5,6,7,8,11,12,14,16,17,19,23,24,25]],
    [12, [1,2,3,5,6,7,8,11,14,16,17,19,20,23,24]],
    [13, [1,2,3,5,6,7,8,11,14,16,17,19,20,22,25]],
    [14, [1,2,3,5,6,7,8,11,14,16,17,19,21,22,24]],
    [15, [2,5,6,7,8,11,12,14,16,17,20,22,23,24,25]],
    [16, [1,2,5,6,7,8,12,14,16,19,21,22,23,24,25]],
    [17, [1,2,3,5,6,8,12,14,16,19,20,21,22,23,25]],
    [18, [1,2,3,5,6,7,12,14,16,17,19,21,23,24,25]],
    [19, [2,3,5,6,7,8,12,14,16,19,20,21,23,24,25]],
    [20, [1,2,3,5,6,7,12,14,16,19,20,21,23,24,25]]
  ];

  let jogosSheet = ss.getSheetByName(jogosSheetName);
  let jogosDefinidos;

  if (jogosSheet && jogosSheet.getLastRow() >= 2 && jogosSheet.getLastColumn() >= 16) {
    // Reaproveita os jogos existentes
    const numLinhasJogos = jogosSheet.getLastRow() - 1;
    const jogosRange = jogosSheet.getRange(2, 1, numLinhasJogos, 16).getValues();
    jogosDefinidos = jogosRange.map(r => {
      const id = r[0];
      const nums = r.slice(1, 16).map(Number);
      return [id, nums];
    });
  } else {
    // Cria aba JOGOS com os 20 jogos padrão
    if (!jogosSheet) {
      jogosSheet = ss.insertSheet(jogosSheetName);
    } else {
      jogosSheet.clear();
    }

    const headerJogos = ['Jogo'];
    for (let i = 1; i <= 15; i++) headerJogos.push('n' + i);

    const dadosJogos = [headerJogos];
    defaultJogos.forEach(j => {
      const row = [j[0]].concat(j[1]);
      dadosJogos.push(row);
    });

    jogosSheet.getRange(1, 1, dadosJogos.length, dadosJogos[0].length).setValues(dadosJogos);
    jogosDefinidos = defaultJogos;
  }

  const numJogos = jogosDefinidos.length;

  /*******************
   * 3) Calcular acertos
   *******************/
  const startDezCol = 3;                   // C
  const endDezCol = startDezCol + 15 - 1; // Q

  const acertosMatrix = [];
  for (let i = 0; i < numConcursos; i++) {
    acertosMatrix[i] = new Array(numJogos).fill(0);
  }

  const cont11 = new Array(numJogos).fill(0);
  const cont12 = new Array(numJogos).fill(0);
  const cont13 = new Array(numJogos).fill(0);
  const cont14 = new Array(numJogos).fill(0);
  const cont15 = new Array(numJogos).fill(0);

  const concursos14plusRows = [['JogoID', 'Concurso', 'Data', 'Acertos']];

  for (let i = 0; i < numConcursos; i++) {
    const row = dataRows[i];
    const concurso = row[0];
    const data = row[1];

    const dezenasSorteio = [];
    for (let c = startDezCol - 1; c <= endDezCol - 1; c++) {
      dezenasSorteio.push(row[c]);
    }
    const setSorteio = new Set(dezenasSorteio);

    for (let j = 0; j < numJogos; j++) {
      const numsJogo = jogosDefinidos[j][1];
      let hits = 0;
      for (let k = 0; k < numsJogo.length; k++) {
        if (setSorteio.has(numsJogo[k])) hits++;
      }
      acertosMatrix[i][j] = hits;

      if (hits === 11) cont11[j]++;
      else if (hits === 12) cont12[j]++;
      else if (hits === 13) cont13[j]++;
      else if (hits === 14) cont14[j]++;
      else if (hits === 15) cont15[j]++;

      if (hits >= 14) {
        concursos14plusRows.push([
          jogosDefinidos[j][0],
          concurso,
          data,
          hits
        ]);
      }
    }
  }

  /*******************
   * 4) Escrever acertos em DB_Loto (J1..J{n})
   *******************/
  // Procura se já existe J1 no cabeçalho; se não, cria no final
  let startAcertosCol = header.indexOf('J1') + 1; // 1-based
  if (startAcertosCol <= 0) {
    startAcertosCol = lastCol + 1;
  }

  // Escreve cabeçalhos J1..Jn na linha 1
  for (let j = 0; j < numJogos; j++) {
    const colIndex = startAcertosCol + j;
    dbSheet.getRange(1, colIndex).setValue('J' + jogosDefinidos[j][0]);
  }

  // Escreve acertos nas linhas 2..N
  const acertosRange = dbSheet.getRange(2, startAcertosCol, numConcursos, numJogos);
  acertosRange.setValues(acertosMatrix);

  /*******************
   * 5) Resumo_Jogos
   *******************/
  let resumoSheet = ss.getSheetByName(resumoSheetName);
  if (!resumoSheet) {
    resumoSheet = ss.insertSheet(resumoSheetName);
  } else {
    resumoSheet.clear();
  }

  const resumoHeader = [
    'JogoID',
    'n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14','n15',
    'TotalConcursos',
    'Q_11',
    'Q_12',
    'Q_13',
    'Q_14',
    'Q_15',
    'Q_>=14'
  ];

  const resumoData = [resumoHeader];

  for (let j = 0; j < numJogos; j++) {
    const jogoID = jogosDefinidos[j][0];
    const nums = jogosDefinidos[j][1];
    const total = numConcursos;
    const q11 = cont11[j];
    const q12 = cont12[j];
    const q13 = cont13[j];
    const q14 = cont14[j];
    const q15 = cont15[j];
    const q14plus = q14 + q15;

    const line = [jogoID]
      .concat(nums)
      .concat([
        total,
        q11,
        q12,
        q13,
        q14,
        q15,
        q14plus
      ]);
    resumoData.push(line);
  }

  resumoSheet.getRange(1, 1, resumoData.length, resumoData[0].length).setValues(resumoData);

  /*******************
   * 6) Concursos_14plus
   *******************/
  let conc14Sheet = ss.getSheetByName(conc14SheetName);
  if (!conc14Sheet) {
    conc14Sheet = ss.insertSheet(conc14SheetName);
  } else {
    conc14Sheet.clear();
  }

  conc14Sheet.getRange(1, 1, concursos14plusRows.length, concursos14plusRows[0].length)
             .setValues(concursos14plusRows);
}
