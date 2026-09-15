# 02 — Planejamento do FrontEnd Básico (SPA em Arquivo Único)

Este documento estabelece o planejamento técnico detalhado para a implementação da interface gráfica inicial do projeto **RetroForge VTT / Arcana VTT**, tomando como modelo exato as capturas e mockups presentes em `Idealização/InfoBase/Work/FrontEnd-Exemplo`.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Estrutura Visual e Arquitetura SPA em Arquivo Único (`index.html`)
- **Objetivo**: Implementar a interface completa do sistema reunida em um único arquivo HTML autocontido (`Código/FrontEnd/index.html`), englobando a tela de Login ("Entrar na taverna"), a Barra Lateral fixa de navegação (Sidebar), o Dashboard (Início), as telas de Campanhas, Sistemas de RPG, Biblioteca de Assets, Personagens, Perfil e a Barra Flutuante inferior de ferramentas (Dock).
- **Método**: Utilizar HTML5 semântico organizado em seções modulares identificadas por IDs (ex: `#view-auth`, `#view-dashboard`, `#view-campaigns`, etc.), cuja visibilidade e alternância serão governadas por funções simples em JavaScript puro nativo.
- **Resultados Esperados**: Navegação instantânea e fluida entre abas sem recarregar a página, máxima transparência e facilidade de leitura do código pelo autor e fidelidade visual aos mockups de referência.
- **Possíveis Problemas Pós-Implementação**: À medida que mais funcionalidades forem criadas, o arquivo único pode crescer em linhas de código, exigindo seções muito bem comentadas e delimitadas para manter a legibilidade.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Atende estritamente à preferência do autor por centralização em um arquivo HTML limpo, evitando a sobrecarga de ferramentas de empacotamento, roteadores externos complexos ou frameworks reativos, tornando a execução direta no navegador ou Cloudflare Pages imediata.

---

### Tópico 2: Estética Dark Fantasy, Paleta de Cores e Tipografia
- **Objetivo**: Reproduzir fielmente a atmosfera visual imersiva e sofisticada observada nas referências: fundo escuro profundo, painéis contrastantes, tipografia clássica e realces em dourado/âmbar nobre.
- **Método**: Aplicar estilos consistentes inspirados no Tailwind CSS e CSS nativo:
  - Fundo geral com gradiente radial escuro (`#080811` a `#10101f`).
  - Cards e superfícies com cantos arredondados (`rounded-xl` / `rounded-2xl`) em tom grafite/navy (`#131322` / `#16162a`) com bordas suaves (`#25253e`).
  - Acentos em dourado quente (`#d4a34b` e `#e5b758`) para botões de destaque, ícones de navegação ativos e títulos nobres.
  - Badges verdes (`#10b981`) para indicação de papel (ex: `[Jogador]`).
  - Tipografia: Fonte serifada para títulos (*Cinzel* ou *Playfair Display*) e sem serifa para textos/menus (*Inter*).
- **Resultados Esperados**: Identidade visual refinada, agradável para longas sessões de RPG e com visual idêntico ao modelo de referência.
- **Possíveis Problemas Pós-Implementação**: Necessidade de carregamento das fontes via CDN (Google Fonts), requerendo fontes locais seguras de fallback caso executado totalmente offline.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: A combinação de tons profundos com dourado estabelece o padrão estético dos melhores VTTs do mercado, garantindo imersão sem poluição visual.

---

### Tópico 3: Ciclo de Telas e Dinâmica de Interação
- **Objetivo**: Permitir que o usuário experimente a transição real entre o estado de não-autenticado (Tela de Login) e autenticado (Painel com Sidebar e telas internas), navegando livremente entre todas as áreas do sistema.
- **Método**: Desenvolver uma lógica de chaveamento de estados em JavaScript Vanilla:
  - Ação de "Entrar" simula o login, oculta a tela de autenticação e revela a interface principal (Sidebar + Área de Conteúdo + Dock inferior).
  - Ação de "Sair" restaura a tela de autenticação.
  - Cliques nos itens da Sidebar alternam dinamicamente qual tela de conteúdo está ativa, atualizando o indicador dourado do menu.
- **Resultados Esperados**: Protótipo de frontend 100% funcional na parte visual e interativa, pronto para futuramente receber as conexões de API e WebSockets do Backend.
- **Possíveis Problemas Pós-Implementação**: Manter o estado da aba ativa persistente caso a página seja recarregada (resolvido facilmente via `localStorage`).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Uma máquina de estados leve e explícita no próprio arquivo garante que o autor possa inspecionar e testar qualquer tela sem dependência de um servidor ativo.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — Arquitetura da SPA em Arquivo Único
O arquivo `index.html` será estruturado em duas camadas principais: a camada de autenticação (`#auth-container`) e a camada do aplicativo autenticado (`#app-container`). Dentro do aplicativo autenticado, a tela é dividida entre uma barra lateral fixa à esquerda com largura ergonômica (260px) contendo o logotipo, links de navegação com ícones SVG inline nítidos e botões de suporte/logout; e a área central principal, que abriga contêineres individuais para cada tela (Início, Campanhas com estado vazio acolhedor, Sistemas com indicador de carregamento, Biblioteca com suas abas de filtros, Personagens com estado vazio e Perfil). No rodapé da tela, o dock flutuante conterá os atalhos rápidos com cantos em pílula (`rounded-full`), completando a composição exata das capturas.

### Detalhamento do Tópico 2 — Sistema de Cores e Tipografia Imersiva
Para evitar dependências externas de compilação durante os testes iniciais e garantir que o arquivo possa ser aberto com um duplo clique em qualquer navegador, o `index.html` incluirá as definições de variáveis CSS de cores personalizadas e classes utilitárias fundamentadas no Tailwind CSS (via CDN ou classes compiladas). A fonte *Cinzel* conferirá a personalidade medieval/fantástica aos títulos dos cards e saudação ("Saudações, aventureiro.", "Entrar na taverna"), enquanto a fonte *Inter* proporcionará legibilidade aos textos de apoio, inputs e botões.

### Detalhamento do Tópico 3 — Navegação e Controle de Estado Interativo
O script embutido gerenciará as transições de forma declarativa. Uma função central `navegarPara(telaId)` removerá a classe de destaque dos demais botões, adicionará a borda e fundo dourado sutil no item selecionado e exibirá a seção correspondente com uma transição suave de opacidade (`transition-opacity duration-200`). As abas da Biblioteca de Assets (`Ícones`, `Avatares`, `Tiles`, `Tokens`) também possuirão comportamento de seleção interativa, permitindo alternar entre as categorias de assets.

---

## 🗂️ Mapeamento de Pastas e Arquivos Previstos

A implementação prática criará o seguinte arquivo:

```text
Código/
└── FrontEnd/
    └── index.html       # Arquivo único da SPA contendo toda a estrutura HTML, estilos dark fantasy e lógica de alternância de telas
```

---

## 📌 Próximos Passos
1. Submeter este plano ao controle de versão (Git commit e push).
2. Aguardar o aval explícito do autor sob a etiqueta **`#> Implementação`** para dar início à codificação do arquivo `Código/FrontEnd/index.html`.
