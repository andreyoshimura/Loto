// --- CONFIGURAÇÕES v1---
const SHEET_NAME = 'Performance_IA';
const COL_RESULTADO = 3; // Coluna C
const COL_JOGOS_GERADOS = 4; // Coluna D
const COL_MELHOR_ACERTO = 5; // Coluna E
const COL_DEZENAS_NEGLIGENCIADAS = 6; // Coluna F
const TOTAL_DEZENAS = 25; // O total de dezenas da Lotofácil (1 a 25)

/**
 * Função principal que configura o cabeçalho e analisa a performance.
 */
function analisarERegistrarPerformance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // 1. GARANTE A EXISTÊNCIA DA ABA E CRIA SE NECESSÁRIO
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    Logger.log(`Aba "${SHEET_NAME}" criada.`);
  }

  // 2. DEFINE E GARANTE O CABEÇALHO
  const HEADER = ['Data_Analise', 'Concurso', 'Resultado_Sorteado', 'Jogos_Gerados', 'Melhor_Acerto', 'Dezenas_Negligenciadas'];
  const headerRange = sheet.getRange(1, 1, 1, HEADER.length);
  
  // Verifica se a célula A1 já contém o cabeçalho esperado
  if (sheet.getRange('A1').getValue() !== HEADER[0]) {
    headerRange.setValues([HEADER]);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold'); // Formata em negrito
    Logger.log('Cabeçalho da Performance_IA criado.');
  }
  
  // --- INÍCIO DA LÓGICA DE ANÁLISE ---
  const range = sheet.getDataRange();
  const values = range.getValues();
  const lastRow = values.length;
  
  // Verifica a partir da segunda linha (índice 1) para ignorar o cabeçalho
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
                                    .filter(n => !isNaN(n)); 

      // 2. Processar Jogos Gerados (JSON)
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
      sheet.getRange(i + 1, COL_MELHOR_ACERTO).setValue('ERRO: ' + e.message.substring(0, 50));
    }
  }
  // Se o script rodar com sucesso sem interrupção de autorização
  if (lastRow > 1) {
    Browser.msgBox('Análise de performance concluída! Verifique a aba Performance_IA.');
  }
}

// (Mantenha as funções auxiliares calcularAcertos e identificarNegligenciadas inalteradas)

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
  const dezenasAI = new Set();
  
  // Cria um conjunto com TODAS as dezenas escolhidas pela IA
  for (const jogo of jogosGerados) {
    for (const dezena of jogo) {
      dezenasAI.add(dezena);
    }
  }

  // Compara com o resultado sorteado
  const negligenciadas = [];
  for (const dezenaSorteada of resultado) {
    if (!dezenasAI.has(dezenaSorteada)) {
      negligenciadas.push(dezenaSorteada);
    }
  }
  
  return negligenciadas;
}