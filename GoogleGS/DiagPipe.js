function diagPipeline() {
  const ss = SpreadsheetApp.getActive();
  Logger.log("Spreadsheet name: " + ss.getName());
  Logger.log("Spreadsheet ID: " + ss.getId());

  const need = ["Entrada_Resultado", "Jogos_Gerados", "Resultados_Jogos"];
  need.forEach(n => {
    const sh = ss.getSheetByName(n);
    Logger.log(`Sheet ${n}: ` + (sh ? "OK (rows=" + sh.getLastRow() + ", cols=" + sh.getLastColumn() + ")" : "MISSING"));
    if (sh && n === "Resultados_Jogos") {
      const h = sh.getRange(1, 1, 1, 6).getDisplayValues()[0];
      Logger.log("Resultados_Jogos header: " + JSON.stringify(h));
    }
  });
}
