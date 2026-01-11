# Apps Script – Automação Lotofácil

Este diretório contém o backend do projeto Loto implementado em Google Apps Script.  
Os scripts aqui gerenciam toda a coleta, processamento e estruturação dos dados da Lotofácil dentro do Google Sheets.

---

## 📁 Estrutura da Pasta

```
apps-script/
│
├── update-lotofacil.gs           → Busca concursos na API da Caixa e mantém a aba Resultados
├── build-resumo.gs               → Gera automaticamente a aba Resumo com estatísticas
├── coocorrenciatendecia.gs       → Calcula coocorrência e tendência das dezenas
├── generate-analyses.gs          → (Opcional) Tendências e coocorrência (versão antiga / modular)
└── README.md                     → Documentação desta pasta
```

---

## 🟦 update-lotofacil.gs

Script responsável por sincronizar a aba **Resultados** com os concursos oficiais da Lotofácil.

### Funções incluídas
- **updateLotofacil()**  
  Controla todo o fluxo de importação.

- **fetchJSON(url)**  
  Requisição segura com tratamento de erro.

- **getUltimoConcurso()**  
  Obtém o último concurso disponível na API.

- **getConcurso(n)**  
  Retorna os dados de um concurso específico.

### Recursos do script
- Atualização incremental (não reinicia do zero)
- Gravação em *batches* para evitar timeout
- Ordenação automática das dezenas
- Resiliência contra falhas na API da Caixa

---

## 🟩 Prod_Auto.gs

 **executarModoProducao()**

-Lê o último concurso e dezenas na aba Resultados (A=concurso, C..Q=15 dezenas)
-Lê baseline em Config_Historico (média de N linhas da coluna best_score_media_hits ou alternativas)
-Faz snapshot da aba Config (pares chave/valor)
-Chama backtestFielEAutoAjustarConfig_50()
-Se cair mais que MAX_DROP, faz rollback da Config e marca modo na última linha do histórico
-Chama gerarJogosAgressivo() e dá flush()
- Frequência total  
- PLê o último concurso e dezenas na aba Resultados (A=concurso, C..Q=15 dezenas) 
- Lê baseline em Config_Historico (média de N linhas da coluna best_score_media_hits ou alternativas)
- Faz snapshot da aba Config (pares chave/valor)
- Chama gerarJogosAgressivo() e dá flush()

### Características
- Usa **funções do Google Sheets em inglês**  
- Usa **separador de argumentos `;`**, padrão PT-BR  
- Remove e recria a aba Resumo sempre que executado

---

## 🟩 build-resumo.gs

Gera automaticamente a aba **Resumo**, que contém estatísticas essenciais por dezena:

- Frequência total  
- Percentual de ocorrência  
- Último concurso em que saiu  
- Atraso atual  
- Frequências nos últimos 20, 50 e 100 concursos  

### Características
- Usa **funções do Google Sheets em inglês**  
- Usa **separador de argumentos `;`**, padrão PT-BR  
- Remove e recria a aba Resumo sempre que executado

---

## 🟥 coocorrenciatendecia.gs

Script dedicado ao cálculo completo de **coocorrência** e **tendência** entre dezenas.

### O que ele faz
- Cria/atualiza a aba **CoocorrenciaTendencia**  
- Analisa concursos históricos para determinar:
  - Quais dezenas aparecem juntas com maior frequência  
  - Score e ranking de força das dezenas  
  - Tendências recentes versus comportamento histórico  
- Produz matriz estruturada pronta para uso em IA ou análises externas

### Características
- Leitura direta das abas **Resultados** e **Resumo**  
- Cálculo eficiente mesmo em grandes volumes de concursos  
- Arquitetado para complementar as estatísticas do `build-resumo.gs`

---

## 🟨 RECIPIENT_EMAIL.gs

Script responsável por conferir os jogos da aba "SUGESTOES_DIA"com os concursos oficiais da Lotofácil e enviar email através do acionador.

### Funções incluídas
- **lotofacilEnviarAcertosPorEmail**  
  Envio do email

---

## 🟨 generate-analyses.gs

(Em desenvolvimento / versão modular antiga)

Responsável por:

- Criar a aba **Coocorrencia**  
- Criar a aba **Tendencias**  
- Calcular score, ranking e comportamento recente das dezenas  

> Observação: parte das funcionalidades foi migrada para `coocorrenciatendecia.gs`.

---

## 🚀 Orquestrador Geral

Para executar todos os módulos automaticamente:

```javascript
function Loto_UpdateAll() {
  updateLotofacil();
  buildResumo();
  coocorrenciaTendencia(); // novo script incluído
  // generateAnalyses(); // habilitar se necessário
}
```

Recomenda-se configurar um gatilho diário no Google Apps Script.

---

## 📌 Requisitos da Planilha

- Configuração:  
  File → Settings → **Always use English function names**
- Separador de argumentos: **;**
- Estrutura obrigatória da aba Resultados:
  - Coluna A → concurso
  - Coluna B → data
  - Colunas C–Q → d1…d15

---

## 📚 Objetivo

Esta pasta mantém todos os scripts essenciais para rodar:

- Atualização automática da base Lotofácil  
- Estatísticas completas por dezena  
- Coocorrência e tendências atualizadas  
- Análises estruturadas para IA e automações externas  
- Manutenção simples através de versionamento GitHub  
