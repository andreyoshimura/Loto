const LOTO_URL = 'https://raw.githubusercontent.com/guilhermeasn/loteria.json/master/data/lotofacil.json';
const SHEET_RESULTADOS = 'Resultados';

/**
 * Atualiza a aba "Resultados" com todos os concursos
 * da Lotofácil presentes no JSON público.
 * Insere apenas concursos novos.
 */
function updateLotofacil() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_RESULTADOS);

  // Cria a aba Resultados, se necessário
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RESULTADOS);
    sheet.getRange(1, 1, 1, 17).setValues([[
      'concurso', 'data',
      'd1','d2','d3','d4','d5','d6','d7','d8',
      'd9','d10','d11','d12','d13','d14','d15'
    ]]);
  }

  const lastRow = sheet.getLastRow();
  const lastConcurso = lastRow > 1 ? Number(sheet.getRange(lastRow, 1).getValue()) : 0;

  const resp = UrlFetchApp.fetch(LOTO_URL, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Falha ao buscar JSON da Lotofácil: ' + resp.getResponseCode());
  }

  const data = JSON.parse(resp.getContentText()); // { "1":[...], "2":[...], ... }

  const concursos = Object.keys(data)
    .map(n => Number(n))
    .sort((a, b) => a - b);

  const rowsToAppend = [];

  concursos.forEach(concurso => {
    if (concurso > lastConcurso) {
      let dezenas = data[concurso];

      dezenas = dezenas.map(Number).sort((a, b) => a - b);

      if (dezenas.length !== 15) {
        Logger.log('Concurso ' + concurso + ' ignorado: não possui 15 dezenas.');
        return;
      }

      const row = [concurso, ''].concat(dezenas);
      rowsToAppend.push(row);
    }
  });

  if (rowsToAppend.length === 0) {
    Logger.log('Nenhum concurso novo para inserir.');
    return;
  }

  sheet.getRange(lastRow + 1, 1, rowsToAppend.length, 17)
       .setValues(rowsToAppend);

  Logger.log('Inseridos ' + rowsToAppend.length + ' concursos novos.');
}
