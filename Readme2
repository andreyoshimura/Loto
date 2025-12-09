# 2-Loteria – Núcleo Lotofácil (5 jogos de 17 dezenas)

Este repositório concentra a parte de dados e automação do projeto 2-Loteria,
focado na Lotofácil com geração automática de:

- **5 jogos**
- cada jogo com **17 dezenas** entre 1 e 25
- para uso em posts automáticos (Instagram, Facebook, e-mail etc.)

## Visão geral

Arquitetura atual:

1. **Fonte de dados oficial**
   - JSON público (GitHub) com resultados históricos da Lotofácil.

2. **Camada de ingestão**
   - Script Google Apps Script (`apps-script/update-lotofacil.gs`) roda dentro do Google Sheets:
     - Lê o JSON da Lotofácil.
     - Atualiza a aba **`Resultados`** com novos concursos.

3. **Camada de estatísticas**
   - Mesma planilha, aba **`Resumo`**:
     - Fórmulas calculam, para cada dezena (1–25):
       - Frequência total.
       - Percentual de aparição.
       - Último concurso em que saiu.
       - Atraso atual.
       - Frequência nos últimos 20, 50 e 100 concursos.

4. **Camada IA (jogos 5×17)**
   - Prompt em `prompts/lotofacil-ia-resumo-5x17.md`.
   - A IA recebe apenas a tabela de **`Resumo`** e gera:
     - 5 jogos com 17 dezenas cada.
     - Breve comentário estatístico.
     - Texto de apoio para posts.

5. **Automação Make (Instagram v8)**
   - Baseada no cenário “Instagram v7”:
     - Módulo Gemini gera os jogos (5×17) + texto.
     - Módulos de saída:
       - E-mail (envio interno).
       - Log em planilha.
       - Post no Instagram.
       - Post no Facebook.

---

## 💾 Detalhe dos Insumos de Dados (Abas da Planilha)

A planilha é a base de dados do projeto. As abas a seguir são **atuais** (Resultados, Resumo) ou **planejadas** (Coocorrência, Tendências) para versões futuras do modelo:

| Nome da Aba (Arquivo) | Status (Versão) | Detalhamento da Utilidade |
| :--- | :--- | :--- |
| **Resultados** | Atual | Fonte de todos os resultados da Lotofácil. Usado pela Camada de Ingestão para manter o histórico e pela Camada de Estatísticas para os cálculos iniciais. |
| **Resumo** | Atual | Estatísticas Primárias (Frequência, Atraso) por dezena. Os dados desta aba são o único **insumo estatístico** alimentado à IA na versão atual. |
| **Coocorrencia** | Planejada (v2.0) | Matriz que mede a frequência com que dois números **saem juntos**. Será o insumo crucial para a futura **Inferência Bayesiana**, ajustando probabilidades de forma condicional. |
| **Tendencias** | Planejada (v2.0) | Padrões de sorteio mais comuns (Par/Ímpar, Primos, Faixa de Soma). Será usada para **filtrar e validar** as combinações geradas, descartando jogos fora do padrão vencedor. |
| **Performance\_IA** | Planejada (v2.0) | Histórico de desempenho do modelo. Será usada para **ajustar os pesos** (hiperparâmetros) do modelo nas versões futuras. |

---

## Próximos Passos (Implementação Futura)

A próxima grande melhoria no modelo (v2.0) envolverá a implementação da **Inferência Bayesiana** e da simulação **Monte Carlo** para refinar a escolha das dezenas, usando os dados das abas **Coocorrência** e **Tendências**.

---

## Como começar

1. Criar uma planilha no Google Sheets com as abas:
   - `Resultados`
   - `Resumo`
   - `Coocorrencia` (a ser implementada)
   - `Tendencias` (a ser implementada)

2. Instalar o script de atualização:
   - Abrir `Extensões > Apps Script` na planilha.
   - Copiar o conteúdo de `apps-script/update-lotofacil.gs`.
   - Salvar e executar a função `updateLotofacil()` uma vez para carregar o histórico.

3. Configurar fórmulas da aba `Resumo`:
   - Seguir o passo a passo em `sheets/modelo-resumo.md`.

4. Integrar a planilha com a IA:
   - No Make (ou outro orquestrador), ler o intervalo `Resumo!A1:I26`.
   - Transformar em JSON.
   - Inserir esse JSON no prompt `prompts/lotofacil-ia-resumo-5x17.md`.

5. Atualizar o cenário do Make (Instagram v7 →...)
