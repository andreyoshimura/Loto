# Apps Script – Automação Lotofácil

Este diretório contém o backend do projeto Loto implementado em Google Apps Script.  
Os scripts aqui gerenciam toda a coleta, processamento e estruturação dos dados da Lotofácil dentro do Google Sheets.

---

## 📁 Estrutura da Pasta

```
apps-script/
│
├── update-lotofacil.gs       → Busca concursos na API da Caixa e mantém a aba Resultados
├── build-resumo.gs           → Gera automaticamente a aba Resumo com estatísticas
├── generate-analyses.gs      → (Opcional) Tendências e coocorrência
└── README.md                 → Documentação desta pasta
```

---

## 🟦 update-lotofacil.gs

Script responsável por sincronizar a aba **Resultados** com os concursos oficiais da Lotofácil.

### Funções incluídas
- **updateLotofacil()**  
  Controla todo o fluxo de importação.

- **fetchJSON(url)**  
  Requisição segura com tratamento de erro.

- **getUltimoConcurso()**  
  Obtém o último concurso disponível na API.

- **getConcurso(n)**  
  Retorna os dados de um concurso específico.

### Recursos do script
- Atualização incremental (não reinicia do zero)
- Gravação em *batches* para evitar timeout
- Ordenação automática das dezenas
- Resiliência contra falhas na API da Caixa

---

## 🟩 build-resumo.gs

Gera automaticamente a aba **Resumo**, que contém estatísticas essenciais por dezena:

- Frequência total  
- Percentual de ocorrência  
- Último concurso em que saiu  
- Atraso atual  
- Frequências nos últimos 20, 50 e 100 concursos  

### Características
- Usa **funções do Google Sheets em inglês**  
- Usa **separador de argumentos `;`**, padrão PT-BR  
- Remove e recria a aba Resumo sempre que executado

---

## 🟨 generate-analyses.gs

(Em desenvolvimento)

Responsável por:

- Criar a aba **Coocorrencia**  
- Criar a aba **Tendencias**  
- Calcular score, ranking e comportamento recente das dezenas  

---

## 🚀 Orquestrador Geral

Para executar todos os módulos automaticamente:

```javascript
function Loto_UpdateAll() {
  updateLotofacil();
  buildResumo();
  // generateAnalyses(); // habilitar quando finalizado
}
```

Recomenda-se configurar um gatilho diário no Google Apps Script.

---

## 📌 Requisitos da Planilha

- Configuração:  
  File → Settings → **Always use English function names**
- Separador de argumentos: **;**
- Estrutura obrigatória da aba Resultados:
  - Coluna A → concurso
  - Coluna B → data
  - Colunas C–Q → d1…d15

---

## 📚 Objetivo

Esta pasta mantém todos os scripts essenciais para rodar:

- Atualização automática da base Lotofácil  
- Estatísticas completas por dezena  
- Análises estruturadas para IA e automações externas  
- Manutenção simples através de versionamento GitHub  

