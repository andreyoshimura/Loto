# 2-Loteria – Núcleo Lotofácil (5 jogos de 17 dezenas)

Este repositório concentra a parte de dados e automação do projeto 2-Loteria,
focado na Lotofácil com geração automática de:

- **5 jogos**
- **cada jogo com 17 dezenas entre 1 e 25**
- para uso em posts automáticos (Instagram, Facebook, e-mail etc.)

## Visão geral

Arquitetura atual:

1. **Fonte de dados oficial**
   - JSON público (GitHub) com resultados históricos da Lotofácil.

2. **Camada de ingestão**
   - Script Google Apps Script (`apps-script/update-lotofacil.gs`) roda dentro do Google Sheets:
     - Lê o JSON da Lotofácil.
     - Atualiza a aba `Resultados` com novos concursos.

3. **Camada de estatísticas**
   - Mesma planilha, aba `Resumo`:
     - Fórmulas calculam, para cada dezena (1–25):
       - Frequência total.
       - Percentual de aparição.
       - Último concurso em que saiu.
       - Atraso atual.
       - Frequência nos últimos 20, 50 e 100 concursos.

4. **Camada IA (jogos 5×17)**
   - Prompt em `prompts/lotofacil-ia-resumo-5x17.md`.
   - A IA recebe apenas a tabela de `Resumo` e gera:
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

## Como começar (resumo)

1. Criar planilha no Google Sheets com abas:
   - `Resultados`
   - `Resumo`

2. Instalar o script de atualização:
   - Copiar `apps-script/update-lotofacil.gs` para `Extensões > Apps Script`.

3. Configurar fórmulas da aba `Resumo` conforme `sheets/modelo-resumo.md`.

4. Integrar a planilha com a IA:
   - Na automação (Make), ler `Resumo` e passar para o prompt
     `prompts/lotofacil-ia-resumo-5x17.md`.

5. Atualizar o cenário do Make (Instagram v7 → v8):
   - Substituir o prompt do módulo Gemini pelo novo prompt.
   - Ajustar textos que falam em “15 jogos” para “5 jogos de 17 dezenas”.
# Loto
Automação com IA para jogos da Loteria
