const SHEET_RESULTADOS = 'Resultados';

// URL base da API oficial CAIXA (espelho estável)
const BASE_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/';

/**
 * Função principal.
 * Completa automaticamente TODOS os concursos faltantes.
 */
function updateLotofacil() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_RESULTADOS);

  // Cria a aba Resultados se não existir
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RESULTADOS);
    sheet.getRange(1, 1, 1, 17).setValues([[
      'concurso', 'data',
      'd1', 'd2', 'd3', 'd4', 'd5',
      'd6', 'd7', 'd8', 'd9', 'd10',
      'd11', 'd12', 'd13', 'd14', 'd15'
    ]]);
  }

  const lastRow = sheet.getLastRow();
  const lastConcurso = lastRow > 1 ? Number(sheet.getRange(lastRow, 1).getValue()) : 0;

  Logger.log("Último concurso registrado: " + lastConcurso);

  // Obtém o concurso mais recente da Caixa
  const ultimo = getUltimoConcurso();
  Logger.log("Último concurso disponível na Caixa: " + ultimo);

  if (ultimo <= lastConcurso) {
    Logger.log("Nenhum concurso novo disponível.");
    return;
  }

  let rows = [];

  for (let n = lastConcurso + 1; n <= ultimo; n++) {
    const info = getConcurso(n);

    if (!info) {
      Logger.log("Concurso " + n + " não encontrado.");
      continue;
    }

    const dezenas = info.listaDezenas.map(Number).sort((a, b) => a - b);

    const row = [
      info.numero, 
      info.dataApuracao || "",
      ...dezenas
    ];

    rows.push(row);
    Logger.log("Concurso " + n + " carregado.");
  }

  if (rows.length > 0) {
    sheet.getRange(lastRow + 1, 1, rows.length, 17).setValues(rows);
    Logger.log("Inseridos " + rows.length + " novos concursos.");
  }
}

/**
 * Obtém JSON da Caixa (com headers obrigatórios)
 */
function fetchJSON(url) {
  const params = {
    method: "get",
    muteHttpExceptions: true,
    headers: { "Accept": "application/json" }
  };

  const resp = UrlFetchApp.fetch(url, params);
  if (resp.getResponseCode() !== 200) return null;

  return JSON.parse(resp.getContentText());
}

/**
 * Obtém o último concurso disponível
 */
function getUltimoConcurso() {
  const data = fetchJSON(BASE_URL);
  return Number(data.numero);
}

/**
 * Obtém concurso específico
 */
function getConcurso(n) {
  return fetchJSON(BASE_URL + n);
}
