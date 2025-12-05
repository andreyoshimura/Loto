# 2-Loteria – Núcleo Lotofácil (Sheets + IA)

Este repositório concentra a parte de dados e automação para o projeto 2-Loteria, focado inicialmente na Lotofácil.

## Visão geral

Arquitetura atual:

1. **Fonte de dados oficial**  
   - JSON público (GitHub): resultados históricos da Lotofácil.

2. **Camada de ingestão**  
   - Script Google Apps Script (`apps-script/update-lotofacil.gs`) roda dentro da planilha do Google Sheets:
     - Lê o JSON da Lotofácil.
     - Atualiza a aba `Resultados` com novos concursos.

3. **Camada de estatísticas**  
   - Mesma planilha, aba `Resumo`:
     - Fórmulas calculam:
       - Frequência total por dezena.
       - Percentual de aparição.
       - Último concurso em que saiu.
       - Atraso atual.
       - Frequência nos últimos 20, 50 e 100 concursos.

4. **Camada IA**  
   - Prompts em `prompts/lotofacil-ia-resumo.md`:
     - A IA recebe apenas a tabela de `Resumo` e gera:
       - Jogos sugeridos.
       - Textos para posts (ex.: Instagram).
       - Comentários estatísticos.

5. **Automação de publicação**  
   - Documento `automations/fluxo-instagram.md` descreve:
     - Fluxo Make/Zapier ou outro.
     - Leitura da planilha.
     - Chamada à IA.
     - Postagem em redes sociais.

## Pastas

- `docs/`  
  Blueprint detalhado da solução.

- `apps-script/`  
  Código Apps Script para rodar dentro do Google Sheets.

- `sheets/`  
  Modelo da estrutura da planilha (abas `Resultados` e `Resumo`).

- `prompts/`  
  Prompts base utilizados pela IA para gerar jogos e textos.

- `automations/`  
  Descrição dos fluxos de automação (Make, Zapier, etc.).

## Como começar (resumo)

1. Criar planilha no Google Sheets com as abas:
   - `Resultados`
   - `Resumo`

2. Instalar o script de atualização:
   - Copiar o conteúdo de `apps-script/update-lotofacil.gs` para `Extensões > Apps Script`.

3. Configurar fórmulas da aba `Resumo` conforme `sheets/modelo-resumo.md`.

4. Integrar a planilha com a IA:
   - Usar o prompt em `prompts/lotofacil-ia-resumo.md`.

5. Configurar automação de postagem:
   - Seguir fluxo de `automations/fluxo-instagram.md`.
