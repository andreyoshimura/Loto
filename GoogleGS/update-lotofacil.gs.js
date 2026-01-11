/**
 * Lista os resultados da lotofacil:
 * 1) Automação diária em "updateLotofacil"
 * 2) Lista todos os concursos existentes
 *
 * Destino: aba "Resultados"
 * Fonte "Sistema oficial da caixa"
 */
const SHEET_RESULTADOS = 'Resultados';
const BASE_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/';

function updateLotofacil() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_RESULTADOS);

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

  const ultimo = getUltimoConcurso();
  if (!ultimo) {
    Logger.log("Não foi possível obter o último concurso da Caixa.");
    return;
  }

  Logger.log("Último concurso disponível na Caixa: " + ultimo);

  if (ultimo <= lastConcurso) {
    Logger.log("Nenhum concurso novo disponível.");
    return;
  }

  let rows = [];

  for (let n = lastConcurso + 1; n <= ultimo; n++) {
    const info = getConcurso(n);

    if (!info) {
      Logger.log("Concurso " + n + " não pôde ser carregado (erro na API). Pulando.");
      continue;
    }

    if (!info.listaDezenas || !info.numero) {
      Logger.log("Concurso " + n + " com estrutura inesperada. Pulando.");
      continue;
    }

    const dezenas = info.listaDezenas.map(Number).sort((a, b) => a - b);

    if (dezenas.length !== 15) {
      Logger.log("Concurso " + n + " ignorado: não possui 15 dezenas.");
      continue;
    }

    const row = [
      Number(info.numero),
      info.dataApuracao || "",
      ...dezenas
    ];

    rows.push(row);
    Logger.log("Concurso " + n + " carregado.");
    Utilities.sleep(200);
  }

  if (rows.length > 0) {
    sheet.getRange(lastRow + 1, 1, rows.length, 17).setValues(rows);
    Logger.log("Inseridos " + rows.length + " concursos novos.");
  } else {
    Logger.log("Nenhuma linha a inserir.");
  }
}

function fetchJSON(url) {
  const params = {
    method: "get",
    muteHttpExceptions: true,
    headers: { "Accept": "application/json" }
  };

  try {
    const resp = UrlFetchApp.fetch(url, params);

    const code = resp.getResponseCode();
    if (code !== 200) {
      Logger.log("HTTP " + code + " em " + url);
      return null;
    }

    const text = resp.getContentText();
    if (!text) {
      Logger.log("Resposta vazia em " + url);
      return null;
    }

    return JSON.parse(text);
  } catch (e) {
    Logger.log("Erro ao acessar " + url + ": " + e);
    return null;
  }
}

function getUltimoConcurso() {
  const data = fetchJSON(BASE_URL);
  if (!data || !data.numero) {
    Logger.log("getUltimoConcurso: resposta inválida.");
    return null;
  }
  return Number(data.numero);
}

function getConcurso(n) {
  const url = BASE_URL + n;
  return fetchJSON(url);
}
