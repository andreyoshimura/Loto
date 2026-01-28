/**
 * GATILHO 2
 * ============================================================
 * Resultados_Jogos — Registro automático de resultados e acertos
 * ============================================================
 *
 * Correções aplicadas (em relação ao seu código):
 * 1) Usa SpreadsheetApp.openById() para funcionar 100% via gatilho (evita "getActive" instável)
 * 2) Captura e grava a DATA DO SORTEIO (coluna B de "Resultados") em "Resultados_Jogos"
 *    - não usa "new Date()" para data_resultado (isso era o motivo do 14/01 não “aparecer” como você esperava)
 * 3) Dedup por concurso com LOG explícito (não é mais silencioso)
 * 4) Garante cabeçalho correto em "Resultados_Jogos" sem apagar dados
 * 5) Adiciona logs de diagnóstico úteis (ssId, concurso lido, etc.)
 *
 * Pré-requisitos:
 * - Aba "Resultados": A=concurso, B=data (Date), C..Q=15 dezenas
 * - Aba "Jogos_Gerados": (linha 1 cabeçalho), colunas A..C => [data, jogo_id, dezenas]
 * - Aba "Resultados_Jogos": A..F conforme headerRJ
 *
 * CONFIGURAÇÃO IMPORTANTE:
 * - Defina SPREADSHEET_ID com o ID da sua planilha.
 *   (na URL da planilha: /d/<ID>/edit)
 */

// >>>>>> AJUSTE AQUI <<<<<<
const SPREADSHEET_ID = "1I6QsovNx2BFRr81c9CGySfgpYZq3ENDsHuAwGqmVZwQ";

/**
 * registrarResultadoECalcularAcertosAuto()
 *
 * O que faz:
 * - Lê o ÚLTIMO concurso válido diretamente da aba "Resultados"
 * - Captura também a data do sorteio (coluna B)
 * - Chama registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr, dataSorteio)
 * - Evita duplicidade (não registra o mesmo concurso duas vezes em Resultados_Jogos)
 */
function registrarResultadoECalcularAcertosAuto() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  console.log(`[RJ] ssId=${ss.getId()}`);

  const shRes = ss.getSheetByName("Resultados");
  if (!shRes) throw new Error('Aba "Resultados" não encontrada.');

  const lastRow = shRes.getLastRow();
  if (lastRow < 2) throw new Error('"Resultados" não tem dados suficientes.');

  // Procura de baixo pra cima a última linha válida:
  // concurso + data + 15 dezenas distintas
  let concurso = null;
  let dezenas = null;
  let dataSorteio = null;

  for (let r = lastRow; r >= 2; r--) {
    // A..Q => 17 colunas: concurso, data, d1..d15
    const row = shRes.getRange(r, 1, 1, 17).getValues()[0];

    const c = row[0];     // col A (concurso)
    const dt = row[1];    // col B (data)
    const ds = row
      .slice(2, 17)       // C..Q
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 25);

    if (!c || ds.length !== 15) continue;

    const uniq = Array.from(new Set(ds)).sort((a, b) => a - b);
    if (uniq.length !== 15) continue;

    concurso = c;
    dezenas = uniq;
    dataSorteio = dt; // pode ser Date, string ou vazio — validamos mais abaixo
    break;
  }

  if (!concurso || !dezenas) {
    throw new Error('Não encontrei um concurso válido em "Resultados" (concurso + 15 dezenas em C..Q).');
  }

  const dezenasSorteadasStr = formatDezenas_(dezenas);
  console.log(`[RJ] concurso lido=${concurso} dezenas=${dezenasSorteadasStr}`);

  // Reusa a função principal (agora passando a data do sorteio)
  registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr, dataSorteio);
}

/**
 * registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr, dataSorteio)
 *
 * O que faz:
 * - Garante/valida a aba Resultados_Jogos (cabeçalho)
 * - Dedup por concurso (com log)
 * - Valida sorteio: 15 dezenas distintas (1..25)
 * - Lê "Jogos_Gerados" (cada jogo com 17 dezenas)
 * - Calcula acertos e faz append em "Resultados_Jogos"
 * - Grava data_resultado = DATA DO SORTEIO (coluna B de "Resultados")
 */
function registrarResultadoECalcularAcertos(concurso, dezenasSorteadasStr, dataSorteio) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const shJG = ss.getSheetByName("Jogos_Gerados");
  if (!shJG) throw new Error('Aba "Jogos_Gerados" não encontrada.');

  const shRJ = getOrCreateResultadosJogos_(ss);

  // Dedup por concurso (com log explícito)
  if (concursoJaRegistrado_(shRJ, concurso)) {
    console.log(`[RJ] Concurso ${concurso} já existe em Resultados_Jogos. Nenhuma nova gravação necessária.`);
    return;
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

  // Data do sorteio (preferida); fallback para "agora" apenas se vier inválida
  const dataResultado = normalizeDate_(dataSorteio) ?? new Date();

  // Jogos: lê e exige 17 dezenas
  const lr = shJG.getLastRow();
  if (lr < 2) throw new Error('"Jogos_Gerados" sem jogos para avaliar.');

  const jogos = shJG.getRange(2, 1, lr - 1, 3).getValues(); // [data, jogo_id, dezenas]

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
      dataResultado,
      concurso,
      formatDezenas_(dezenasSorteadas),
      jogoId,
      formatDezenas_(dezenasJogo),
      acertos
    ];
  });

  shRJ.getRange(shRJ.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.flush();
  console.log(`[RJ] Gravado concurso=${concurso} linhas=${rows.length} data=${dataResultado}`);
}

/**
 * Garante a aba Resultados_Jogos e o cabeçalho correto, sem apagar dados.
 */
function getOrCreateResultadosJogos_(ss) {
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

  const current = shRJ.getRange(1, 1, 1, headerRJ.length).getDisplayValues()[0];
  const isEmpty = current.every(x => String(x).trim() === "");
  const isDifferent = current.map(x => String(x).trim()).join("|") !== headerRJ.join("|");

  if (isEmpty || isDifferent) {
    shRJ.getRange(1, 1, 1, headerRJ.length).setValues([headerRJ]);
  }

  return shRJ;
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

/**
 * Normaliza data vinda do Google Sheets:
 * - se já for Date válida, retorna Date
 * - se for string (ex.: "14/01/2026"), tenta converter
 * - se inválido, retorna null
 */
function normalizeDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  // Em alguns casos o Sheets retorna string formatada
  const s = String(v ?? "").trim();
  if (!s) return null;

  // Tenta parse padrão
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1;

  // Tenta dd/MM/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    const d2 = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}
