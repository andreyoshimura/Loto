/**
 * setupResultadosJogos()
 *
 * O que faz:
 * - Garante que a aba "Resultados_Jogos" exista
 * - Garante o cabeçalho correto na linha 1
 * - Se já tiver dados, não apaga nada
 *
 * Também garante:
 * - Aba "Entrada_Resultado" com rótulos em A1/A2 (não mexe no que você preenche em B1/B2)
 */
function setupResultadosJogos() {
  const ss = SpreadsheetApp.getActive();

  // --- Resultados_Jogos ---
  let shRJ = ss.getSheetByName("Resultados_Jogos");
  if (!shRJ) shRJ = ss.insertSheet("Resultados_Jogos");

  const headerRJ = [
    "data_resultado",
    "concurso",
    "dezenas_sorteadas",
    "jogo_id",
    "dezenas_jogo",
    "acertos"
  ];

  // Se a linha 1 estiver vazia ou diferente, escreve cabeçalho
  const currentRJ = shRJ.getRange(1, 1, 1, headerRJ.length).getDisplayValues()[0];
  const isEmptyRJ = currentRJ.every(x => String(x).trim() === "");
  const isDifferentRJ = currentRJ.map(x => String(x).trim()).join("|") !== headerRJ.join("|");

  if (isEmptyRJ || isDifferentRJ) {
    shRJ.getRange(1, 1, 1, headerRJ.length).setValues([headerRJ]);
  }

  // --- Entrada_Resultado ---
  let shIn = ss.getSheetByName("Entrada_Resultado");
  if (!shIn) shIn = ss.insertSheet("Entrada_Resultado");

  // Só garante rótulos mínimos (não sobrescreve B1/B2)
  if (String(shIn.getRange("A1").getDisplayValue()).trim() === "") shIn.getRange("A1").setValue("concurso");
  if (String(shIn.getRange("A2").getDisplayValue()).trim() === "") shIn.getRange("A2").setValue("dezenas_sorteadas");

  SpreadsheetApp.flush();
}
