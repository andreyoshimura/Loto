function buildResumo() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("Resumo");

  // Cria ou limpa a aba Resumo
  if (!sheet) {
    sheet = ss.insertSheet("Resumo");
  } else {
    sheet.clear();
  }

  // Cabeçalhos
  sheet.getRange("A1:I1").setValues([[
    "dezena",
    "freq_total",
    "perc_total",
    "ultimo_concurso",
    "atraso_atual",
    "media_intervalo",
    "freq_ult_20",
    "freq_ult_50",
    "freq_ult_100"
  ]]);

  // Total de concursos em K1
  sheet.getRange("K1").setFormula("=MAX(Resultados!A:A)");

  const rows = [];

  // Linhas 2–26 para dezenas 1–25
  for (let d = 1; d <= 25; d++) {
    const r = d + 1; // número da linha
    const row = [];

    // A: dezena
    row[0] = d;

    // B: freq_total
    row[1] = `=COUNTIF(Resultados!C$2:Q;A${r})`;

    // C: perc_total
    row[2] = `=B${r}/$K$1*100`;

    // D: ultimo_concurso
    row[3] =
      `=IFERROR(` +
      `MAX(` +
      `FILTER(` +
      `Resultados!A$2:A;` +
      `MMULT(--(Resultados!C$2:Q=A${r});TRANSPOSE(COLUMN(Resultados!C$2:Q)^0))>0` +
      `)` +
      `)` +
      `;"")`;

    // E: atraso_atual
    row[4] = `=IF(D${r}="";"";$K$1-D${r})`;

    // F: media_intervalo (placeholder por enquanto)
    row[5] = "";

    // G: freq_ult_20
    row[6] =
      `=COUNTIF(` +
      `FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$1-19);` +
      `A${r}` +
      `)`;

    // H: freq_ult_50
    row[7] =
      `=COUNTIF(` +
      `FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$1-49);` +
      `A${r}` +
      `)`;

    // I: freq_ult_100
    row[8] =
      `=COUNTIF(` +
      `FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$1-99);` +
      `A${r}` +
      `)`;

    rows.push(row);
  }

  // Escreve todas as linhas de uma vez
  sheet.getRange(2, 1, 25, 9).setValues(rows);
}
