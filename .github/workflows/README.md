---

## 🤖 Automação de Posts (Sorte Fácil Bot)

Este repositório contém uma automação baseada em **Python** e **GitHub Actions** que gera imagens informativas para a Lotofácil diariamente.

### 🚀 Como Funciona
1.  **Agendamento**: O GitHub Actions executa o script automaticamente todos os dias às 12:00 UTC (09:00 Horário de Brasília).
2.  **Processamento**: O script `main.py` utiliza a biblioteca `Pillow` para:
    * Carregar uma imagem de base (`fundo.png`).
    * Inserir dinamicamente a data do dia.
    * Adicionar títulos e elementos visuais de chamada.
3.  **Atualização**: A imagem resultante é salva como `lotofacil.jpg` na raiz do projeto, ficando pronta para ser consumida por outros apps ou postada manualmente.

### 🛠️ Tecnologias Utilizadas
* **Linguagem**: Python 3.9
* **Biblioteca de Imagem**: Pillow (PIL)
* **CI/CD**: GitHub Actions

### 📂 Estrutura de Arquivos da Automação
* `.github/workflows/gerar_post.yml`: Configuração do agendamento e permissões do robô.
* `main.py`: Código principal que manipula a imagem e os textos.
* `fundo.png`: Template visual de alta qualidade utilizado como base.
* `lotofacil.jpg`: O resultado final gerado pela última execução do bot.

---
