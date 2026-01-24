# Automação de Imagens – SorteFácil

Este repositório implementa uma **automação completa de geração de imagens da Lotofácil**, com **troca automática de fundo conforme a campanha mensal**, utilizando **Python + GitHub Actions**.

O objetivo é manter uma imagem sempre atualizada, com:
- Nome de arquivo fixo
- Troca automática mensal de campanha
- Execução totalmente automatizada
- Zero intervenção manual ao longo do ano

---

## 📁 Estrutura do Repositório


├── main.py # Script principal do projeto (outras funções)
├── gerar_imagem.py # Script EXCLUSIVO para geração de imagens
├── fundo.png # Fundo ATIVO (sobrescrito automaticamente)
├── lotofacil.jpg # Imagem final gerada diariamente
├── fundos/ # Fundos mensais por campanha
│ ├── janeiro_branco.png
│ ├── fevereiro_roxo.png
│ ├── marco_azul_marinho.png
│ ├── abril_verde.png
│ ├── maio_amarelo.png
│ ├── junho_vermelho.png
│ ├── julho_amarelo.png
│ ├── agosto_dourado.png
│ ├── setembro_amarelo.png
│ ├── outubro_rosa.png
│ ├── novembro_azul.png
│ ├── dezembro_vermelho.png
│ └── padrao.png
└── .github/
└── workflows/
├── Automacao Sorte Facil.yml
└── gerar-imagem-mensal.yml

🛡️ Arquivo padrao.png

O arquivo padrao.png é um fallback de segurança.

Ele é utilizado automaticamente caso:

Um mês não esteja mapeado no script

Um arquivo mensal seja removido ou renomeado incorretamente

Uma nova campanha seja adicionada sem imagem correspondente

Sua função é evitar falhas no workflow.

🤖 GitHub Actions
Workflow de imagens

Arquivo: .github/workflows/gerar-imagem-mensal.yml

Responsabilidades:

Executar o script gerar_imagem.py

Atualizar fundo.png

Gerar lotofacil.jpg

Commitar automaticamente os arquivos

Agendamento
cron: "2 2 * * *"


02:02 UTC

23:02 (BRT – UTC-3) do dia anterior

A troca do fundo mensal ocorre na primeira execução do novo mês.

Controle de concorrência
concurrency:
  group: sortefacil-imagem
  cancel-in-progress: false


Evita conflitos de commit caso mais de um workflow rode ao mesmo tempo.

🔁 Fluxo automático completo

GitHub Actions é disparado

gerar_imagem.py identifica o mês

Fundo mensal é copiado para fundo.png

lotofacil.jpg é gerada

Arquivos são commitados no repositório

URLs e integrações permanecem inalteradas

🧠 Boas práticas adotadas

Separação clara de responsabilidades

Nome fixo para arquivos finais

Automação resiliente a erro humano

Escalável para novas campanhas

Compatível com execução local e CI/CD

⚠️ Observações importantes

Não remover arquivos da pasta /fundos

Não alterar nomes sem atualizar o script

Manter sempre o padrao.png

Para novas campanhas: adicionar imagem + mapear no script

✅ Estado do Projeto

✔ Automação mensal funcional
✔ Automação diária funcional
✔ Fundos completos para 12 meses
✔ Workflow estável
✔ Pronto para operação contínua anual
