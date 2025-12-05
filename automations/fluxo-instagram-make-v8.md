# Fluxo de Automação – Instagram v8 (Lotofácil 5×17)

Baseado no cenário “Instagram v7” do Make, ajustado para:

- 5 jogos
- 17 dezenas em cada jogo

## Visão geral do fluxo

1. Disparo agendado (Make):
   - Ex.: todos os dias em horário definido (cron).

2. Módulo Gemini (id 6):
   - Modelo: `gemini-2.0-flash` (ou equivalente).
   - Campo `text`: usar o conteúdo de `prompts/lotofacil-ia-resumo-5x17.md`, adaptado para texto simples.
   - Entrada opcional futura: resumo estatístico vindo do Google Sheets.

3. Módulos de saída (baseado no blueprint original Instagram v7):

- **Módulo `email:ActionSendMeEmail` (id 3)**  
  Envia e-mail interno com os 5 jogos de 17 dezenas.

- **Módulo `google-email:sendAnEmail` (id 16)**  
  Envia e-mail via Gmail com os mesmos jogos.

- **Módulo `google-sheets:addRow` (id 7)**  
  Insere uma nova linha em uma aba de log:
  - Coluna A: data/hora da execução.
  - Coluna B: texto completo com os 5 jogos (`{{6.result}}`).

- **Módulo `instagram-business:CreatePostPhoto` (id 9)**  
  Cria post no Instagram:
  - Imagem: arquivo fixo (template do projeto).
  - Legenda, exemplo:
    ```text
    📊 Lotofácil – Jogos automáticos

    5 jogos com 17 dezenas sugeridos hoje:
    {{6.result}}

    Conteúdo para curiosidade e entretenimento. Sem garantia de acertos.
    ```

- **Módulo `facebook-pages:CreatePost` (id 17)**  
  Cria post na página do Facebook:
  - Mensagem:
    ```text
    5 jogos com 17 dezenas da Lotofácil – apenas para entretenimento:

    {{6.result}}
    ```

## Integração futura com estatísticas reais (aba `Resumo`)

Para usar os dados reais da aba `Resumo`:

1. Adicionar, antes do Gemini, um módulo `Google Sheets`:
   - Operação: `Get a range values`.
   - Intervalo: `Resumo!A1:I26`.
2. Transformar o resultado em JSON (módulo `Tools > JSON` ou script interno).
3. Injetar esse JSON dentro do prompt, na parte “Dados de entrada (Resumo Estatístico)”.

Assim, o Gemini passa a usar:

- `freq_total`
- `perc_total`
- `ultimo_concurso`
- `atraso_atual`
- `freq_ult_20`, `freq_ult_50`, `freq_ult_100`

como base numérica real para decidir as dezenas, mantendo o formato final de 5 jogos com 17 dezenas.

## Aviso

Toda a automação e os jogos gerados são apenas para curiosidade e entretenimento.  
Não há qualquer promessa, garantia ou responsabilidade quanto a ganhos em jogos de loteria.
