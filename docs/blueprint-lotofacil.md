# Blueprint – Núcleo Lotofácil (2-Loteria)

## Objetivo

Permitir que a IA gere jogos e análises baseadas em estatísticas reais da Lotofácil sem precisar processar todo o histórico a cada chamada.

O trabalho pesado é feito pelo Google Sheets; a IA consome apenas o resumo estatístico.

---

## Componentes

### 1. Fonte de dados

- JSON público com todos os concursos da Lotofácil.
- Estrutura esperada (exemplo):

```json
{
  "1": [1, 2, 3, ..., 15 dezenas],
  "2": [ ... ],
  "3": [ ... ]
}
