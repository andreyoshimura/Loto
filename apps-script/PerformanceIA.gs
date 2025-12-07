// --- CONFIGURAÇÕES ---
const SHEET_NAME = 'Performance_IA';
const COL_RESULTADO = 3; // Coluna C
const COL_JOGOS_GERADOS = 4; // Coluna D
const COL_MELHOR_ACERTO = 5; // Coluna E
const COL_DEZENAS_NEGLIGENCIADAS = 6; // Coluna F
const TOTAL_DEZENAS = 25; // O total de dezenas da Lotofácil (1 a 25)

/**
 * Função principal que busca a última linha com dados de entrada (C e D)
 * e calcula o Melhor Acerto e as Dezenas Negligenciadas, registrando o resultado
 * nas colunas E e F.
 */
function analisarERegistrarPerformance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log(`A planilha "${SHEET_NAME}" não foi encontrada.`);
    Browser.msgBox(`Erro: A aba "${SHEET_NAME}" não foi encontrada. Verifique o nome.`);
    return;
  }
  
  // Define o range de dados, ignorando o cabeçalho
  const range = sheet.getDataRange();
  const values = range.getValues();
  const lastRow = values.length;
  
  // Verifica a partir da segunda linha (índice 1)
  for (let i = 1; i < lastRow; i++) {
    const row = values[i];
    const resultadoStr = row[COL_RESULTADO - 1]; // Resultado Sorteado (C)
    const jogosGeradosStr = row[COL_JOGOS_GERADOS - 1]; // Jogos Gerados (D)
    const melhorAcerto = row[COL_MELHOR_ACERTO - 1]; // Melhor Acerto (E)
    
    // Se a coluna E (Melhor Acerto) já estiver preenchida, pula para a próxima linha
    if (melhorAcerto && melhorAcerto !== '') {
      continue; 
    }
    
    // Verifica se os dados de entrada necessários estão disponíveis
    if (!resultadoStr || !jogosGeradosStr) {
      Logger.log(`Linha ${i + 1}: Dados de entrada incompletos. Pulando.`);
      continue;
    }
    
    try {
      // 1. Processar Resultados Sorteados
      const resultado = resultadoStr.split(',')
                                    .map(s => parseInt(s.trim()))
                                    .filter(n => !isNaN(n)); // Garante que é um array de números

      // 2. Processar Jogos Gerados (JSON)
      // O JSON deve ser um array de arrays: [[j1],[j2],[j3],[j4],[j5]]
      const jogosGerados = JSON.parse(jogosGeradosStr);
      
      // 3. Executar o Backtesting
      const acertos = calcularAcertos(jogosGerados, resultado);
      const melhorAcertoEncontrado = Math.max(...acertos);
      
      // 4. Identificar Dezenas Negligenciadas
      const dezenasNegligenciadas = identificarNegligenciadas(jogosGerados, resultado);
      const negligenciadasStr = dezenasNegligenciadas.join(',');
      
      // 5. Registrar os Resultados (Atualiza as colunas E e F na planilha)
      sheet.getRange(i + 1, COL_MELHOR_ACERTO).setValue(melhorAcertoEncontrado);
      sheet.getRange(i + 1, COL_DEZENAS_NEGLIGENCIADAS).setValue(negligenciadasStr);
      
      Logger.log(`Linha ${i + 1} processada. Melhor Acerto: ${melhorAcertoEncontrado}`);

    } catch (e) {
      Logger.log(`Erro ao processar a Linha ${i + 1}: ${e.toString()}`);
      // Opcional: Registrar o erro na planilha
      sheet.getRange(i + 1, COL_MELHOR_ACERTO).setValue('ERRO: ' + e.message.substring(0, 50));
    }
  }
  Browser.msgBox('Análise de performance concluída! Verifique a aba Performance_IA.');
}


/**
 * Calcula o número de acertos para cada jogo gerado.
 * @param {Array<Array<number>>} jogosGerados - Array de jogos (5x17).
 * @param {Array<number>} resultado - Array das 15 dezenas sorteadas.
 * @returns {Array<number>} Array com o número de acertos para cada jogo.
 */
function calcularAcertos(jogosGerados, resultado) {
  const acertosPorJogo = [];
  const resultadoSet = new Set(resultado);
  
  for (const jogo of jogosGerados) {
    let acertos = 0;
    for (const dezena of jogo) {
      if (resultadoSet.has(dezena)) {
        acertos++;
      }
    }
    acertosPorJogo.push(acertos);
  }
  return acertosPorJogo;
}

/**
 * Identifica as dezenas que foram sorteadas, mas não estavam no conjunto de 17 dezenas escolhido pela IA.
 * @param {Array<Array<number>>} jogosGerados - Array de jogos (5x17).
 * @param {Array<number>} resultado - Array das 15 dezenas sorteadas.
 * @returns {Array<number>} Dezenas sorteadas que não estavam no conjunto de 17.
 */
function identificarNegligenciadas(jogosGerados, resultado) {
  // A IA escolhe 17 dezenas no total, que compõem o 'universo' de onde os 5 jogos são criados.
  // Vamos assumir que o 'universo' de 17 dezenas é a união de todas as dezenas em JOGOS GERADOS.
  
  const dezenasAI = new Set();
  
  // 1. Cria um conjunto com TODAS as dezenas escolhidas pela IA (de 1 a 25)
  // Nota: Se os 5 jogos de 17 dezenas usam o mesmo universo, o primeiro jogo já é o suficiente.
  // Caso contrário, usamos a união de todos os 5 jogos. Vamos usar a união para ser mais robusto.
  for (const jogo of jogosGerados) {
    for (const dezena of jogo) {
      dezenasAI.add(dezena);
    }
  }

  // 2. Compara com o resultado sorteado
  const negligenciadas = [];
  for (const dezenaSorteada of resultado) {
    if (!dezenasAI.has(dezenaSorteada)) {
      negligenciadas.push(dezenaSorteada);
    }
  }
  
  return negligenciadas;
}
