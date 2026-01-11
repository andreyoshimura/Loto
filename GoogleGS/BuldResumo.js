/**
 * buildResumo()
 *
 * O que este script realmente faz:
 * - (Re)cria a aba "Resumo" e preenche uma tabela (1 linha por dezena 1..25) com
 *   métricas estatísticas calculadas a partir da aba "Resultados".
 * - Ele NÃO usa as abas "Coocorrencia" nem "Tendencias". É um resumo paralelo.
 *
 * Dependências (abas e formato):
 * - Aba obrigatória: "Resultados"
 *   - Linha 1: cabeçalho (pode ser qualquer coisa; o script começa na linha 2)
 *   - Coluna A (A2:A): identificador do concurso (número do concurso). Usado para:
 *       - descobrir o último concurso (MAX)
 *       - calcular "ultimo_concurso" de cada dezena
 *       - calcular "atraso_atual" = ultimo_id - ultimo_concurso_da_dezena
 *       - filtrar janelas "últimos 20/50/100" por ID (assume IDs contínuos)
 *   - Colunas C a Q (C2:Q): as 15 dezenas sorteadas do concurso (valores 1..25)
 *
 * Saídas geradas na aba "Resumo":
 * - Colunas A..I:
 *   A: dezena (1..25)
 *   B: freq_total           -> contagem total de ocorrências da dezena em Resultados!C:Q
 *   C: perc_total           -> freq_total / total_de_concursos * 100  (total = COUNTA(Resultados!A2:A))
 *   D: ultimo_concurso      -> maior ID de concurso (Resultados!A) em que a dezena apareceu
 *   E: atraso_atual         -> ultimo_id_concurso (MAX) - ultimo_concurso
 *   F: media_intervalo      -> vazio (placeholder)
 *   G: freq_ult_20          -> contagem nos concursos com ID >= ultimo_id-19
 *   H: freq_ult_50          -> contagem nos concursos com ID >= ultimo_id-49
 *   I: freq_ult_100         -> contagem nos concursos com ID >= ultimo_id-99
 *
 * Observações importantes:
 * - "perc_total" usa o total REAL de concursos (linhas preenchidas em Resultados!A2:A),
 *   e não depende de MAX(concurso).
 * - As janelas 20/50/100 usam o ID do concurso (coluna A). Se houver buracos na numeração,
 *   a janela pode não representar exatamente "últimos N concursos" por linha; representa
 *   "IDs nos últimos N".
 */
function buildResumo() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("Resumo");

  // Cria ou limpa a aba Resumo
  if (!sheet) sheet = ss.insertSheet("Resumo");
  else sheet.clear();

  // Cabeçalhos A1:I1
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

  // K1: total REAL de concursos (quantidade de linhas com ID em Resultados!A2:A)
  sheet.getRange("K1").setFormula("=COUNTA(Resultados!A$2:A)");

  // K2: último ID de concurso (maior número em Resultados!A2:A)
  sheet.getRange("K2").setFormula("=MAX(Resultados!A$2:A)");

  const rows = [];

  // Linhas 2–26 para dezenas 1–25
  for (let d = 1; d <= 25; d++) {
    const r = d + 1; // número da linha na aba Resumo
    const row = [];

    // A: dezena
    row[0] = d;

    // B: freq_total (contagem total da dezena em todas as colunas C:Q)
    row[1] = `=COUNTIF(Resultados!C$2:Q;A${r})`;

    // C: perc_total (freq_total / total_concursos * 100)
    row[2] = `=IF($K$1=0;"";B${r}/$K$1*100)`;

    // D: ultimo_concurso (maior ID onde a dezena apareceu em C:Q)
    row[3] =
      `=IFERROR(` +
      `MAX(` +
      `FILTER(` +
      `Resultados!A$2:A;` +
      `MMULT(--(Resultados!C$2:Q=A${r});TRANSPOSE(COLUMN(Resultados!C$2:Q)^0))>0` +
      `)` +
      `)` +
      `;""` +
      `)`;

    // E: atraso_atual (último ID - último concurso em que a dezena apareceu)
    row[4] = `=IF(D${r}="";"";$K$2-D${r})`;

    // F: media_intervalo (placeholder)
    row[5] = "";

    // G/H/I: frequências em janelas baseadas em ID (últimos 20/50/100 IDs)
    row[6] = `=COUNTIF(FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$2-19);A${r})`;
    row[7] = `=COUNTIF(FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$2-49);A${r})`;
    row[8] = `=COUNTIF(FILTER(Resultados!C$2:Q;Resultados!A$2:A>=$K$2-99);A${r})`;

    rows.push(row);
  }

  // Escreve todas as linhas de uma vez
  sheet.getRange(2, 1, 25, 9).setValues(rows);

  // Força aplicar mudanças (útil se outro processo for ler em seguida)
  SpreadsheetApp.flush();
}
