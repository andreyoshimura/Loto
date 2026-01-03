# Sheets – Base Analítica do Projeto Loto

Este diretório contém a planilha **DB_Loto** principal do projeto que funciona como:
- banco de dados histórico,
- motor de estatísticas,
- área de backtest,
- suporte às simulações e geração de jogos usados pela IA.

A planilha **não é apenas dados**: ela materializa toda a lógica estatística que o código consome ou replica.

---

## Visão Geral do Fluxo

1. **Resultados**  
   Entrada dos concursos oficiais da Lotofácil -> apps-script/update-lotofacil.gs e apps-script/MonteCarloBayes.gs
2. **Resumo / Tendências / Coocorrência**  
   Estatísticas derivadas do histórico -> apps-script/CoocorrenciaTendencias.gs e apps-script/BuldResumo.gs e apps-script/MonteCarloBayes.gs
3. **Simulações / Scores / Configurações**  
   Apoio à IA e Monte Carlo.
4. **Jogos Gerados / Backtest**  
   Avaliação de desempenho dos jogos sugeridos.

---

## Descrição das Abas

### Abas Núcleo (citadas no README principal)

#### Resultados
Base histórica dos concursos:
- Concurso
- Data
- Dezenas sorteadas (d1–d15)

É a **fonte primária** de todas as análises.

---

#### Resumo
Estatísticas calculadas a partir de `Resultados`:
- Frequência total por dezena
- Frequência em janelas (20 / 50 / 100)
- Percentuais
- Atraso

Na versão atual do projeto, esta aba é o **principal input da IA**.

---

#### Coocorrencia
Matriz 25×25 indicando:
- Quantas vezes duas dezenas saíram juntas no mesmo concurso.

Base para:
- inferência estatística,
- futura implementação bayesiana.

---

#### Tendencias
Ranking e score por dezena:
- Frequências por janela
- Atraso
- Score ponderado
- Ranking final

Usada para priorização e filtros de geração de jogos.

---

### Abas de Geração de Jogos

#### SUGESTOES_DIA
Resultado final da execução ->apps-script/SUGESTOES_DIA.gs:
- Timestamp
- Origem do método
- Jogos sugeridos com dezenas

É a **saída prática** do sistema.

---

#### JOGOS
Cadastro estruturado dos jogos (Jogo 1..N) com suas dezenas.

---

#### Jogos_Gerados
Log de cada execução:
- Data/hora
- ID do jogo
- Dezenas geradas

---

#### Historico_Jogos
Histórico acumulado de todas as execuções anteriores.

---

### Abas de Backtest e Conferência

#### Resultados_Jogos
Cruzamento entre:
- concursos sorteados
- jogos gerados

Calcula os **acertos por jogo**.

---

#### Resumo_Jogos
Estatísticas consolidadas -> apps-script/SUGESTOES_DIA.gs:
- Quantidade de concursos avaliados
- Ocorrências de 11, 12, 13, 14 e 15 acertos

---

#### Concursos_14plus
Lista de concursos onde algum jogo atingiu **14 ou mais acertos**. -> apps-script/SUGESTOES_DIA.gs

---

### Abas de Simulação e IA (Evolução do Projeto)

#### Simulador_MC
Base de simulações Monte Carlo -> apps-script/MonteCarloBayes.gs:
- combinações geradas
- suporte a análises probabilísticas

---

#### Config
Parâmetros ativos da IA:
- pesos de frequência (20/50/100)
- peso de atraso
- peso bayesiano

---

#### Config_Historico
Histórico de alterações de parâmetros:
- timestamp
- valores antigos e novos

---

#### Config_Historico_Backtest
Histórico específico de parâmetros usados em backtests:
- janela analisada
- modo de execução
- pesos aplicados

---

#### Performance_IA
Aba reservada para métricas futuras de desempenho da IA  
(atualmente estrutura criada, sem dados).

---

### Aba Operacional

#### Entrada_Resultado (Desativar)
Interface simplificada para inserir o último concurso:
- número do concurso
- dezenas sorteadas (string)

Não será ais necessário, a aba RESULTADOS já possui os dados neessários..

---

## Observações Importantes

- Esta planilha **define a lógica estatística do projeto**.
- Qualquer implementação em código deve manter **consistência com estas regras**.
- Alterações em fórmulas impactam diretamente:
  - geração de jogos,
  - backtests,
  - desempenho da IA.

---

## Relação com o Projeto

Este diretório é parte integrante do repositório:

👉 https://github.com/andreyoshimura/Loto

Sem estas planilhas, o projeto perde:
- rastreabilidade,
- validação estatística,
- capacidade de ajuste fino da IA.
