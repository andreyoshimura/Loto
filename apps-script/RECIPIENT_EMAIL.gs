/**
 * Lotofácil: confere jogos da aba "SUGESTOES_DIA" (1 linha = 1 jogo, colunas n1..n15)
 * e envia por e-mail via Gmail (zero custo), necessario criar um job para rodar diariamente.
 *
 * Layout esperado (cabeçalho):
 * DataExecucao | JogoID | Origem | n1 | n2 | ... | n15
 */

const CONFIG = {
  SHEET_NAME: "SUGESTOES_DIA",
  RECIPIENT_EMAIL: "andre@dragon.net.br", // troque se quiser
  API_URL: "https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest",
  DATE_COL: "DataExecucao",
  N_PREFIX: "n",
  N_COUNT: 15,
};

function lotofacilEnviarAcertosPorEmail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Aba não encontrada: ${CONFIG.SHEET_NAME}`);

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) throw new Error("A aba não tem dados suficientes (precisa cabeçalho + linhas).");

  const header = values[0].map(v => String(v || "").trim());
  const rows = values.slice(1);

  // Mapa coluna -> índice
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));

  if (!(CONFIG.DATE_COL in idx)) {
    throw new Error(`Coluna ${CONFIG.DATE_COL} não encontrada no cabeçalho.`);
  }

  // Validar existência de n1..n15
  for (let i = 1; i <= CONFIG.N_COUNT; i++) {
    const col = `${CONFIG.N_PREFIX}${i}`;
    if (!(col in idx)) throw new Error(`Coluna ${col} não encontrada no cabeçalho.`);
  }

  // Seleciona a data mais recente (por DataExecucao)
  const latestTime = getLatestDateTime(rows, idx[CONFIG.DATE_COL]);
  if (latestTime === null) throw new Error(`Não consegui ler datas válidas na coluna ${CONFIG.DATE_COL}.`);

  const rowsDoDia = rows.filter(r => {
    const d = r[idx[CONFIG.DATE_COL]];
    return d instanceof Date && !isNaN(d.getTime()) && d.getTime() === latestTime;
  });

  if (rowsDoDia.length === 0) {
    throw new Error("Nenhuma linha encontrada para a data mais recente.");
  }

  const jogos = extractGamesFromRows(rowsDoDia, idx);
  if (jogos.length === 0) {
    throw new Error("Nenhum jogo válido identificado (n1..n15) nas linhas da data mais recente.");
  }

  const result = fetchLatestLotofacil();
  const sorteadasSet = new Set(result.dezenas);

  // Monta relatório
  const report = [];
  report.push(`Concurso: ${result.concurso}`);
  report.push(`Data do sorteio: ${result.data}`);
  report.push(`Dezenas sorteadas: ${result.dezenas.join(", ")}`);
  report.push("");
  report.push(`Aba: ${CONFIG.SHEET_NAME}`);
  report.push(`DataExecucao (mais recente): ${formatDateTime(new Date(latestTime))}`);
  report.push(`Jogos avaliados: ${jogos.length}`);
  report.push("");

  // Ordena por mais acertos primeiro
  const avaliados = jogos.map((j, i) => {
    const hits = j.dezenas.filter(n => sorteadasSet.has(n));
    return {
      i: i + 1,
      jogoId: j.jogoId,
      origem: j.origem,
      dezenas: j.dezenas,
      hits,
      acertos: hits.length,
    };
  }).sort((a, b) => b.acertos - a.acertos);

  avaliados.forEach(j => {
    const meta = [];
    if (j.jogoId !== null) meta.push(`JogoID=${j.jogoId}`);
    if (j.origem) meta.push(`Origem=${j.origem}`);
    report.push(`Jogo ${j.i}${meta.length ? " (" + meta.join(", ") + ")" : ""}: ${j.dezenas.join(", ")}`);
    report.push(`Acertos: ${j.acertos} | Bateram: ${j.hits.length ? j.hits.join(", ") : "-"}`);
    report.push("");
  });

  const subject = `Lotofácil - Acertos (${result.concurso} - ${result.data})`;
  MailApp.sendEmail(CONFIG.RECIPIENT_EMAIL, subject, report.join("\n"));
}

/** Retorna o timestamp (ms) mais recente encontrado numa coluna de datas. */
function getLatestDateTime(rows, dateColIdx) {
  let best = null;
  rows.forEach(r => {
    const d = r[dateColIdx];
    if (d instanceof Date && !isNaN(d.getTime())) {
      const t = d.getTime();
      if (best === null || t > best) best = t;
    }
  });
  return best;
}

/**
 * Extrai jogos (1 linha = 1 jogo) das colunas n1..n15.
 * Também tenta incluir JogoID e Origem se existirem.
 */
function extractGamesFromRows(rows, idx) {
  const hasJogoId = ("JogoID" in idx);
  const hasOrigem = ("Origem" in idx);

  const jogos = [];

  rows.forEach(r => {
    const dezenas = [];
    for (let i = 1; i <= CONFIG.N_COUNT; i++) {
      const v = r[idx[`${CONFIG.N_PREFIX}${i}`]];
      if (v === null || v === "" || typeof v === "boolean") return;
      const n = Number(String(v).trim());
      if (!Number.isFinite(n) || n < 1 || n > 25) return;
      dezenas.push(pad2(n));
    }

    const unique = new Set(dezenas);
    if (unique.size !== CONFIG.N_COUNT) return;

    jogos.push({
      jogoId: hasJogoId ? String(r[idx["JogoID"]] ?? "").trim() || null : null,
      origem: hasOrigem ? String(r[idx["Origem"]] ?? "").trim() : "",
      dezenas,
    });
  });

  return jogos;
}

function pad2(n) {
  return String(Math.trunc(n)).padStart(2, "0");
}

function formatDateTime(d) {
  // formata no timezone da planilha/script
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

/** Busca resultado mais recente da Lotofácil. */
function fetchLatestLotofacil() {
  const resp = UrlFetchApp.fetch(CONFIG.API_URL, { muteHttpExceptions: true });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Falha ao buscar API (${code}): ${resp.getContentText()}`);
  }

  const data = JSON.parse(resp.getContentText());

  // campos comuns nessa API (podem variar)
  const concurso = data.concurso || data.numero || data.loteria?.concurso || "desconhecido";
  const dataSorteio = data.data || data.dataApuracao || data.loteria?.data || "desconhecida";

  const dezenasRaw = data.dezenas || data.listaDezenas || data.resultado || data.dezenasSorteadas;
  if (!Array.isArray(dezenasRaw) || dezenasRaw.length < 15) {
    throw new Error("API retornou formato inesperado de dezenas (esperava array com 15 dezenas).");
  }

  const dezenas = dezenasRaw
    .slice(0, 15)
    .map(x => pad2(Number(String(x).trim())))
    .filter(x => /^\d{2}$/.test(x));

  if (dezenas.length !== 15) {
    throw new Error("Não consegui normalizar as 15 dezenas do resultado.");
  }

  return { concurso, data: dataSorteio, dezenas };
}
