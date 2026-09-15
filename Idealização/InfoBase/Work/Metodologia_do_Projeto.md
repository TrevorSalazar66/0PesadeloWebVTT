# 🧭 Metodologia Oficial de Trabalho — RetroForge VTT

Este documento formaliza as regras, estrutura de diretórios, convenções de comunicação e fluxo de desenvolvimento aplicados a todo o ciclo de vida do projeto **RetroForge VTT**.

---

## 📁 1. Estrutura Canônica de Diretórios

O projeto divide-se estritamente entre a área de execução técnica (`Código`) e a área conceitual e gerencial (`Idealização`):

```text
0PesadeloWebVTT/
├── .gitignore                        # Regras de exclusão do controle de versão
├── Código/                           # Implementação prática do sistema
│   ├── FrontEnd/                     # Interface do usuário (HTML5, CSS, JS modular)
│   ├── Backend/                      # Lógica serverless Cloudflare Workers (Node.js/ESM)
│   └── Banco/                        # Esquemas SQL, migrações e sementes (Cloudflare D1)
│
└── Idealização/                      # Gestão de conhecimento, ideias e planos
    ├── InfoBase/                     # Bússola e diretrizes gerais do projeto
    │   ├── Not_Work/                 # Tecnologias descartadas, antipatterns e proibições
    │   ├── Work/                     # Referências ativas, guias, assets e metodologia
    │   └── OriginalInfo/             # Registros e materiais brutos fornecidos pelo autor
    │
    └── Planjeamento/                 # Documentos de planejamento e planos de ação
        ├── Planejamento_humano/      # Visão, rascunhos e idealizações do autor (Read-Only para IA)
        └── Implementação_IA/         # Planos técnicos formais gerados pela IA (Imutáveis após criação)
```

---

## 🏷️ 2. Sistema de Etiquetas de Comunicação

Para assegurar controle absoluto do autor e manter limites nítidos entre pensar e executar, **toda mensagem do autor e da IA deve obrigatoriamente iniciar com uma das etiquetas abaixo**:

### `#> Planejamento`
- **Quando usar**: Durante alinhamento de ideias, debates de escopo, esclarecimento de requisitos e elaboração de planos.
- **Permissão da IA**: A IA pode ler qualquer documentação, propor abordagens e criar **exclusivamente** arquivos `.md` na pasta `Implementação_IA`. 
- **Restrição rígida**: Nenhum código na pasta `Código/` pode ser criado, editado ou executado nesta fase.

### `#> Implementação`
- **Quando usar**: Quando o autor der aval explícito a um plano de planejamento e solicitar a execução prática.
- **Permissão da IA**: Criação e modificação de arquivos de código, execução de scripts, comandos no terminal, testes locais e commits/sincronização no Git.

---

## 📝 3. Padrão dos Planos em `Implementação_IA`

Todos os planos gerados pela IA devem seguir a nomenclatura sequencial com objetivo claro (ex: `01_Definindo_Stack.md`, `02_Estrutura_FrontEnd_Basico.md`) e conter a seguinte estrutura obrigatória:

1. **Lista de Tópicos Resumidos**:
   - **Objetivo**: O que a etapa alcança.
   - **Método**: Como será feito tecnicamente.
   - **Resultados Esperados**: Critérios de sucesso tangíveis.
   - **Possíveis Problemas Pós-Implementação**: Riscos e como mitigá-los.
   - **Argumentação**: Por que esta abordagem foi escolhida em detrimento de outras.
2. **Detalhamento dos Tópicos**:
   - Um parágrafo aprofundado para cada tópico da lista.
3. **Mapeamento Explícito de Arquivos**:
   - Listagem exata das pastas e arquivos criados/modificados com a função individual de cada um.
4. **Imutabilidade**:
   - Uma vez criado o arquivo de planejamento, a IA **não pode editá-lo nem apagá-lo**. Qualquer ajuste subsequente exigirá um adendo ou uma nova fase.

---

## 🛡️ 4. Princípios e Diretrizes Técnicas do Projeto

- **Arquitetura Limpa e Modular**: O código deve ser desacoplado, legível e independente. Cada submódulo resolve um único problema de forma evidente.
- **Hospedagem Exclusiva Cloudflare**:
  - Frontend: Cloudflare Pages (HTML semântico, JavaScript puro em módulos ES6 e Tailwind CSS).
  - Backend: Cloudflare Workers com `nodejs_compat`.
  - Multiplayer: WebSockets gerenciados no Edge.
  - Banco de Dados: Cloudflare D1 (SQLite) e Cloudflare KV (Cache/Compêndios).
- **Filosofia de Persistência**: *"Só persistir e transmitir no backend o que realmente importa"*. Cálculos visuais e de interface são locais; regras e turnos são autoritários no backend.
- **Controle pelo Autor**: Nenhuma alteração não solicitada será realizada pela IA. O projeto permanece 100% legível e dominado pelo criador.
