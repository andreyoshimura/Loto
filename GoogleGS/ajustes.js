// Uso unico
function setupConfigHistoricoBacktest() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName("Config_Historico_Backtest");
  if (!sh) sh = ss.insertSheet("Config_Historico_Backtest");

  sh.clear();

  sh.getRange("A1:R1").setValues([[
    "timestamp",
    "mudou",
    "window_concursos",
    "candidatos_testados",
    "best_score_media_hits",
    "w20_old","w50_old","w100_old","wAtraso_old","wBayes_old","alphaScore_old",
    "w20_new","w50_new","w100_new","wAtraso_new","wBayes_new","alphaScore_new",
    "modo"
  ]]);
}
