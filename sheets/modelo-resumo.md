# Modelo da aba `Resumo` (Google Sheets)

Esta aba será a “API estatística” para a IA.  
Ela lê a aba `Resultados` e consolida:

- Frequência total por dezena
- Percentual de aparição
- Último concurso em que a dezena saiu
- Atraso atual
- Frequências nos últimos 20, 50 e 100 concursos

## Estrutura da aba

### Cabeçalho (linha 1)

| A        | B          | C          | D               | E            | F               | G           | H           | I            |
|----------|------------|------------|-----------------|--------------|-----------------|-------------|-------------|--------------|
| dezena   | freq_total | perc_total | ultimo_concurso | atraso_atual | media_intervalo | freq_ult_20 | freq_ult_50 | freq_ult_100 |

Você pode deixar `media_intervalo` em branco por enquanto ou preencher depois via script.

### Dezenas (linhas 2 a 26)

Em `A2` até `A26`, coloque as dezenas de 1 a 25:

- A2: `1`
- A3: `2`
- ...
- A26: `25`

Ou use a fórmula abaixo em `A2` e arraste até `A26`:

```gs
=SE(LINHA()<=26; LINHA()-1; "")
