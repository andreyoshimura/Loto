# 2-Loteria – Núcleo Lotofácil (5 jogos de 17 dezenas)

Este repositório concentra a parte de dados e automação do projeto **2-Loteria**, focado na Lotofácil com geração automática de:
- **5 jogos**
- Cada jogo com **17 dezenas** entre 1 e 25
- Conteúdo otimizado para posts automáticos (Instagram, Facebook, e-mail, etc.)

---

## 🏗️ Visão Geral da Arquitetura

1. **Fonte de Dados Oficial**: JSON público (GitHub/API da Caixa) com resultados históricos da Lotofácil.
2. **Camada de Ingestão**: Scripts Google Apps Script (`update-lotofacil.gs`) que atualizam a aba **Resultados** na planilha.
3. **Camada de Estatísticas e Análises**: 
   - **Resumo**: Fórmulas e scripts (`build-resumo.gs`) calculam frequência (total e janelas de 20/50/100), percentual de aparição e atraso atual.
   - **Análises de Afinidade**: Script `coocorrenciatendecia.gs` para calcular matrizes de números que saem juntos e padrões de tendência.
4. **Camada IA (Jogos 5×17)**: O modelo Gemini recebe os dados da aba **Resumo** e gera as combinações com comentários estatísticos.
5. **Automação Make (Instagram v8)**: Orquestra a leitura dos dados, geração via IA e publicação em redes sociais.

---

## 💾 Detalhe dos Insumos de Dados (Abas da Planilha)

| Nome da Aba | Status (Versão) | Detalhamento da Utilidade |
| :--- | :--- | :--- |
| **Resultados** | Atual | Fonte de todos os resultados históricos da Lotofácil. |
| **Resumo** | Atual | Estatísticas Primárias (Frequência, Atraso). Único insumo da IA na versão atual. |
| **Coocorrencia** | v2.0 / Atual | Matriz de frequência conjunta. Base para futura Inferência Bayesiana. |
| **Tendencias** | v2.0 / Atual | Padrões comuns (Par/Ímpar, Primos, Soma) para filtrar jogos. |
| **Performance_IA**| Planejada (v2.0)| Histórico de desempenho para ajuste de pesos do modelo. |

---

## 🚀 Como Começar

1. **Preparar a Planilha**: Crie um Google Sheets com as abas: `Resultados`, `Resumo`, `Coocorrencia` e `Tendencias`.
2. **Instalar os Scripts**: 
   - No Sheets, acesse `Extensões > Apps Script` e adicione os códigos da pasta `apps-script/`.
   - Execute `updateLotofacil()` para carregar o histórico.
   - Execute `buildResumo()` e `coocorrenciaTendencia()` para processar as análises.
3. **Configurar Fórmulas**: Siga o passo a passo em `sheets/modelo-resumo.md` para a aba **Resumo**.
4. **Integração Make**:
   - Configure o cenário para ler o intervalo `Resumo!A1:I26`.
   - Utilize o prompt de `prompts/lotofacil-ia-resumo-5x17.md` no módulo Gemini.
   - Ajuste os textos para refletir o formato de "5 jogos de 17 dezenas".

---

## 🔮 Próximos Passos (v2.0)

A evolução do modelo foca na implementação de **Inferência Bayesiana** e simulações **Monte Carlo** utilizando os dados das abas de Coocorrência e Tendências para refinar a precisão das dezenas escolhidas.

---

## ⚠️ Aviso

Todo o conteúdo gerado (jogos, textos e sugestões) é destinado apenas para **curiosidade e entretenimento**. Não há garantia de acerto ou ganho financeiro.
