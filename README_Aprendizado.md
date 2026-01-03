# 🎯 Loto — Motor Estatístico Autônomo para Lotofácil

Este repositório implementa um **motor estatístico autônomo** para geração, avaliação e aprendizado de jogos da Lotofácil, utilizando **dados históricos**, **Monte Carlo ponderado**, **regras configuráveis** e **backtest fiel com rollback automático**.

> ⚠️ Projeto de caráter **educacional e experimental**. Não há garantia de ganhos ou previsões determinísticas.

---

## 🧠 Visão Geral

O sistema funciona como um **pipeline fechado**, totalmente executado em **Google Apps Script**, integrado a uma planilha Google Sheets, sem dependência de IA generativa em produção.

### Principais características
- Geração de jogos com **17 dezenas**
- Uso de **estatísticas históricas reais**
- **Aprendizado automático controlado**
- **Rollback** em caso de regressão de performance
- Execução **100% automática** via gatilho diário

---

## 🏗️ Arquitetura Geral

O projeto é dividido em quatro camadas:

1. **Ingestão de Dados**
   - Sorteios oficiais armazenados na aba `Resultados`

2. **Análises Estatísticas**
   - Frequências, atrasos e coocorrência de dezenas

3. **Geração de Jogos**
   - Monte Carlo ponderado sem reposição
   - Regras combinatórias configuráveis

4. **Aprendizado Automático**
   - Backtest fiel ao gerador real
   - Ajuste incremental de pesos
   - Trava de regressão (rollback)

---

## 📊 Estrutura das Abas (Google Sheets)

### `Resultados`
Fonte oficial dos concursos.
- Coluna A: número do concurso
- Colunas C..Q: 15 dezenas sorteadas

---

### `Resumo`
Resumo estatístico por dezena:
- frequência total
- atraso atual
- frequência nas janelas 20 / 50 / 100 concursos

---

### `Tendencias`
Ranking dinâmico por dezena:
- Freq 20 / 50 / 100
- atraso
- score ponderado
- ranking

---

### `Coocorrencia`
Matriz 25×25 com contagem de pares históricos de dezenas.

---

### `Config`
Parâmetros do sistema no formato **key / value**.

Exemplos:
- Pesos estatísticos:  
  `w20`, `w50`, `w100`, `wAtraso`, `wBayes`, `alphaScore`
- Regras:  
  `MAX_SEQ`, `MIN_DIFF`, `BOTTOM_PARES`, `PENALTY_WEAK_PAIR`
- Produção:  
  `QTDE_JOGOS`, `JOGO_DEZENAS`, `N_SIM`

---

### `Jogos_Gerados`
Saída final do sistema.
- Sobrescrita a cada execução
- Contém os jogos recomendados para o próximo concurso

---

### `Resultados_Jogos`
Histórico de avaliação:
- jogo gerado
- dezenas sorteadas
- quantidade de acertos

---

### `Config_Historico`
Auditoria completa do aprendizado:
- `best_score_media_hits`
- pesos antigos vs novos
- marcação de rollback
- modo de execução (`BACKTEST_FIEL_50`, etc.)

---

## ⚙️ Scripts Principais

### `gerarAnalises()`
Gera automaticamente:
- aba `Tendencias`
- aba `Coocorrencia`

---

### `gerarJogosAgressivo()`
Gerador principal de jogos.

Características:
- Monte Carlo ponderado sem reposição
- Score por dezena baseado em:
  - frequência (20 / 50 / 100)
  - atraso
  - Bayes suavizado
- Regras aplicadas:
  - exatamente 17 dezenas
  - proibição de sequência ≥ 5
  - diversidade mínima entre jogos
  - penalização de pares historicamente fracos

Saída:
- `Jogos_Gerados`
- `Historico_Jogos`

---

### `registrarResultadoECalcularAcertosAuto()`
- Compara jogos gerados com sorteio real
- Calcula acertos
- Registra resultados em `Resultados_Jogos`

---

### `Learning_config.gs`
Camada de aprendizado automático:

- Backtest fiel ao gerador real
- Janela móvel de 50 concursos
- Métrica: **média de acertos dos jogos**
- Ajuste automático dos pesos do `Config`
- Registro completo de auditoria
- Não utiliza IA

---

### `Prod_Auto.gs` ⭐ (produção)

Pipeline automático completo:

1. Lê o último sorteio diretamente da aba `Resultados`
2. Registra acertos
3. Executa aprendizado (backtest fiel)
4. Aplica **trava de regressão**
   - rollback automático se performance cair
5. Gera novos jogos

Funções principais:
- `executarModoProducao()`
- `executarModoProducaoGuardado()`

---

## ⏰ Automação

- Execução via **gatilho diário** do Google Apps Script
- Processa **apenas concursos novos**
- Evita duplicação usando controle interno
- Não requer ação manual

---

## 🛡️ Controles de Segurança

- Rollback automático de configurações
- Auditoria versionada
- Bloqueio de reprocessamento
- Tolerância a execuções estocásticas do Monte Carlo

---

## 🎯 Objetivo do Projeto

Criar um **framework estatístico auditável e reproduzível** para:
- estudo de heurísticas em jogos combinatórios
- experimentação de aprendizado incremental
- análise de estratégias sem “caixa-preta” de IA

---

## 🔮 Próximas Evoluções (opcional)

- Otimização automática das regras combinatórias
- Dashboard visual de performance
- Exportação via API / JSON
- Modo congelado por X concursos

---

## 📜 Licença

Uso livre para fins educacionais e experimentais.
Sem garantias de desempenho ou retorno financeiro.
