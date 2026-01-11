/**
 * Somente uma vez para ajustar o cabeçalho
 */

function repararConfigHistoricoHeader() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName("Config_Historico");
  if (!sh) throw new Error('Aba "Config_Historico" não existe.');

  // Insere 1 linha no topo e escreve o header correto (16 colunas A..P)
  sh.insertRowBefore(1);
  sh.getRange("A1:P1").setValues([[
    "timestamp",
    "mudou",
    "window_execucoes",
    "media_hits_recente",
    "w20_old", "w50_old", "w100_old", "wAtraso_old", "wBayes_old", "alphaScore_old",
    "w20_new", "w50_new", "w100_new", "wAtraso_new", "wBayes_new", "alphaScore_new"
  ]]);
}
