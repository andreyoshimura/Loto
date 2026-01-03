/**
 * registrarResultadoECalcularAcertosAuto()
 *
 * O que faz:
 * - Lê concurso e dezenas sorteadas da aba "Entrada_Resultado" (B1 e B2)
 * - Valida que o sorteio tem 15 dezenas distintas (1..25)
 * - Lê "Jogos_Gerados" (cada jogo com 17 dezenas)
 * - Calcula acertos e faz append em "Resultados_Jogos"
 *
 * Por que existe:
 * - Evita erro por executar função sem parâmetros (caso que aconteceu agora).
 */
function registrarResultadoECalcularAcertosAuto() {
  const ss = SpreadsheetApp.getActive();

  const shIn = ss.getSheetByName("Entrada_Resultado") || ss.insertSheet("Entrada_Resultado");

  // Garante rótulos mínimos (opcional)
  if (shIn.getLastRow() < 2) {
    shIn.getRange("A1").setValue("concurso");
    shIn.getRange("A2").setValue("dezenas_sorteadas");
  }

  const concurso = shIn.getRange("B1").getValue();
  const dezenasSorteadasStr = shIn.getRange("B2").getDisplayValue();

  if (!concurso) {
    throw new Error('Entrada_Resultado!B1 (concurso) está vazio.');
  }
  if (!dezenasSorteadasStr) {
    throw new Error('Entrada_Resultado!B2 (dezenas_sorteadas) está vazio.');
  }

  // Reusa a função que já calcula tudo
  registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr);
}

/**
 * registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr)
 *
 * Mantém a versão que valida 15 dezenas no sorteio e 17 dezenas no jogo.
 */
function registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr) {
  const ss = SpreadsheetApp.getActive();

  const shJG = ss.getSheetByName("Jogos_Gerados");
  if (!shJG) throw new Error('Aba "Jogos_Gerados" não encontrada.');

  let shRJ = ss.getSheetByName("Resultados_Jogos");
  if (!shRJ) {
    shRJ = ss.insertSheet("Resultados_Jogos");
    shRJ.getRange("A1:F1").setValues([[
      "data_resultado", "concurso", "dezenas_sorteadas", "jogo_id", "dezenas_jogo", "acertos"
    ]]);
  }

  // Sorteio: 15 dezenas distintas
  const dezenasSorteadas = parseDezenasRobusto_(dezenasSorteadasStr);
  if (dezenasSorteadas.length !== 15) {
    throw new Error(
      `Sorteio inválido: esperado 15 dezenas distintas (1..25). ` +
      `Obtido=${dezenasSorteadas.length}. Lidas=[${dezenasSorteadas.join(", ")}]. ` +
      `Entrada="${dezenasSorteadasStr}"`
    );
  }
  const setSorteio = new Set(dezenasSorteadas);

  // Jogos: lê e exige 17 dezenas
  const lr = shJG.getLastRow();
  if (lr < 2) throw new Error('"Jogos_Gerados" sem jogos para avaliar.');

  const jogos = shJG.getRange(2, 1, lr - 1, 3).getValues(); // [data, jogo_id, dezenas]
  const hoje = new Date();

  const rows = jogos.map((r, idx) => {
    const jogoId = String(r[1] || `J${String(idx + 1).padStart(2, "0")}`);
    const dezenasJogoStr = String(r[2] || "");
    const dezenasJogo = parseDezenasRobusto_(dezenasJogoStr);

    if (dezenasJogo.length !== 17) {
      throw new Error(
        `Jogo inválido em Jogos_Gerados: ${jogoId} deveria ter 17 dezenas. ` +
        `Obtido=${dezenasJogo.length}. Lidas=[${dezenasJogo.join(", ")}]. ` +
        `Entrada="${dezenasJogoStr}"`
      );
    }

    const acertos = dezenasJogo.reduce((c, d) => c + (setSorteio.has(d) ? 1 : 0), 0);

    return [
      hoje,
      concurso,
      formatDezenas_(dezenasSorteadas),
      jogoId,
      formatDezenas_(dezenasJogo),
      acertos
    ];
  });

  shRJ.getRange(shRJ.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.flush();
}

/**
 * Parser robusto: extrai números, filtra 1..25, remove duplicadas, ordena.
 */
function parseDezenasRobusto_(input) {
  const s = String(input ?? "");
  const matches = s.match(/\d+/g) || [];
  const nums = matches
    .map(x => Number(x))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 25);

  const uniq = Array.from(new Set(nums));
  uniq.sort((a, b) => a - b);
  return uniq;
}

/**
 * Formata [1,2,...] => "01-02-..."
 */
function formatDezenas_(arr) {
  return arr
    .slice()
    .sort((a, b) => a - b)
    .map(n => String(n).padStart(2, "0"))
    .join("-");
}
