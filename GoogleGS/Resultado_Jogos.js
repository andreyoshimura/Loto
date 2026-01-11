/**
 * registrarResultadoECalcularAcertosAuto()
 *
 * O que faz (versão sem Entrada_Resultado):
 * - Lê o ÚLTIMO concurso válido diretamente da aba "Resultados"
 *   Layout esperado (conforme seu arquivo):
 *     A=concurso, B=data, C..Q=d1..d15 (15 dezenas)
 * - Chama registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr)
 * - Evita duplicidade (não registra o mesmo concurso duas vezes em Resultados_Jogos)
 */
function registrarResultadoECalcularAcertosAuto() {
  const ss = SpreadsheetApp.getActive();

  const shRes = ss.getSheetByName("Resultados");
  if (!shRes) throw new Error('Aba "Resultados" não encontrada.');

  const lastRow = shRes.getLastRow();
  if (lastRow < 2) throw new Error('"Resultados" não tem dados suficientes.');

  // Procura de baixo pra cima a última linha válida (concurso + 15 dezenas distintas)
  let concurso = null;
  let dezenas = null;

  for (let r = lastRow; r >= 2; r--) {
    // A..Q => 17 colunas (concurso, data, d1..d15)
    const row = shRes.getRange(r, 1, 1, 17).getValues()[0];

    const c = row[0]; // col A
    const ds = row
      .slice(2, 17) // C..Q
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 25);

    if (!c || ds.length !== 15) continue;

    const uniq = Array.from(new Set(ds)).sort((a, b) => a - b);
    if (uniq.length !== 15) continue;

    concurso = c;
    dezenas = uniq;
    break;
  }

  if (!concurso || !dezenas) {
    throw new Error('Não encontrei um concurso válido em "Resultados" (concurso + 15 dezenas em C..Q).');
  }

  const dezenasSorteadasStr = formatDezenas_(dezenas);

  // Reusa a função principal
  registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr);
}

/**
 * registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr)
 *
 * O que faz:
 * - Valida sorteio: 15 dezenas distintas (1..25)
 * - Lê "Jogos_Gerados" (cada jogo com 17 dezenas)
 * - Calcula acertos e faz append em "Resultados_Jogos"
 * - Evita duplicidade: se o concurso já existe em "Resultados_Jogos", não grava novamente
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

  // Evita duplicidade por concurso
  if (concursoJaRegistrado_(shRJ, concurso)) {
    return; // comportamento silencioso
    // ou, se preferir falhar explicitamente:
    // throw new Error(`Concurso ${concurso} já registrado em "Resultados_Jogos".`);
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
 * Retorna true se já existir qualquer linha em Resultados_Jogos com o mesmo concurso (coluna B).
 */
function concursoJaRegistrado_(shRJ, concurso) {
  const lr = shRJ.getLastRow();
  if (lr < 2) return false;

  const concursos = shRJ.getRange(2, 2, lr - 1, 1).getValues().flat(); // B2:B
  const alvo = String(concurso).trim();
  return concursos.some(c => String(c).trim() === alvo);
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
