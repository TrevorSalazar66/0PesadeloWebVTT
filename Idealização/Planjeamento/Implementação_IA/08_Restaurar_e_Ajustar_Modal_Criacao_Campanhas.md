# 08 — Planejamento para Auditoria e Validação do Modal de Criação de Campanhas (Forjar Mesa)

Este documento descreve o plano de ação detalhado para revisar, auditar e garantir que a tela/modal de criação de campanhas ("Forjar Nova Campanha") abra corretamente ao clicar no botão de criação, validando a integração dos campos, regras de acesso e submissão ao backend.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Verificação da Estrutura HTML e Estilos CSS do Modal `#modal-criar-campanha`
- **Objetivo**: Garantir que o modal `#modal-criar-campanha` e suas classes CSS (como `.modal-overlay`, `.modal-card-large`, `.pool-selection-grid` e `.pool-banner-grid`) estejam perfeitamente montados e visíveis ao receber a classe `.active`.
- **Método**:
  - Inspecionar a estrutura do elemento `<div class="modal-overlay" id="modal-criar-campanha">` no `index.html`.
  - Confirmar a integridade das seleções visuais de avatares (pool de brasões), estandartes (pool de banners) e o contêiner de prévia em tempo real (`#camp-card-preview-wrapper`).
- **Resultados Esperados**: O modal é exibido de forma fluida, sobreposto à tela com transição de opacidade/escala e rolagem interna suave.
- **Possíveis Problemas Pós-Implementação**: Conflitos de z-index ou estouro de altura em telas menores (mitigado pelas regras `max-height: 88vh; overflow-y: auto;`).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Manter o modal em overlay evita navegação de página desnecessária, permitindo ao mestre preencher os dados e visualizar o card em tempo real.

---

### Tópico 2: Validação da Lógica de Abertura, Controle de Permissões e Fechamento (`abrirModalCriarCampanha`)
- **Objetivo**: Garantir que a função JavaScript `abrirModalCriarCampanha()` valide corretamente os papéis dos usuários e adicione a classe `.active` ao modal quando disparada pelos botões da interface.
- **Método**:
  - Revisar a verificação de permissão: apenas perfis com `role` igual a `'mestre'`, `'admin'` ou `'superadmin'` devem ter acesso à abertura.
  - Verificar os eventos de clique dos botões: o botão do topo da tela de campanhas (`#btn-open-create-campaign`) e o botão do estado vazio (`.empty-state-box .btn-create-campaign`).
  - Executar a inicialização das pools visuais (`renderizarPoolsCampanha()`) e a atualização da prévia (`atualizarPreviewCampanha()`) imediatamente ao abrir.
- **Resultados Esperados**: O modal abre instantaneamente para usuários autorizados, inicializando avatares, banners e o card de prévia sem erros de JS no console.
- **Possíveis Problemas Pós-Implementação**: `currentUser` ser nulo no momento da abertura (mitigado com fallbacks seguros e verificação de autenticação prévia).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: A verificação de papel no frontend fornece feedback imediato (via Toast) antes mesmo da requisição chegar ao backend.

---

### Tópico 3: Teste do Fluxo de Submissão (`submeterCriacaoCampanha`) e Persistência no Backend
- **Objetivo**: Garantir que o preenchimento do formulário envie os dados validados via RPC (`campaigns.create`) para o backend e atualize a lista de campanhas dinamicamente.
- **Método**:
  - Validar os seletores dos campos (`#camp-input-name`, `#camp-select-system`, `#camp-select-theme`, `#camp-input-players`, `#camp-input-lore`).
  - Testar a requisição `window.apiClient.createCampaign(...)` com desabilitação temporária do botão de submit ("Forjando mesa...").
  - Confirmar a resposta de sucesso, exibição de Toast afirmativo e fechamento automático do modal com chamada a `carregarCampanhas()`.
- **Resultados Esperados**: Criação bem-sucedida de campanhas no banco SQLite D1 e atualização reativa do grid de campanhas na Taverna.
- **Possíveis Problemas Pós-Implementação**: Falha de rede ou validação no backend (mitigado com tratamento `try/catch` e restauração do botão no bloco `finally`).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O padrão RPC (`campaigns.create`) garante transação atômica entre a criação da campanha e o vínculo do criador como mestre na tabela `campaign_players`.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1: Verificação da Estrutura HTML e Estilos CSS
O modal de criação de campanhas (`#modal-criar-campanha`) está localizado no arquivo `index.html` e utiliza a classe `.modal-overlay` com `.modal-card-large`. Ele foi desenhado para ser uma janela flutuante com suporte a visualização responsiva de brasões e banners panorâmicos. A verificação garante que a regra `.modal-overlay.active { display: flex; opacity: 1; }` esteja intacta e sem interferência de chaves de CSS malfechadas.

### Detalhamento do Tópico 2: Validação da Lógica de Abertura e Permissões
A função `abrirModalCriarCampanha()` consulta a variável global `currentUser.role` para assegurar que apenas usuários autorizados (mestre, admin ou superadmin) possam abrir o formulário. Quando chamada, ela invoca `renderizarPoolsCampanha()` para preencher os seletores visuais e `atualizarPreviewCampanha()` para que o card de demonstração reflita os valores padrão configurados.

### Detalhamento do Tópico 3: Submissão e Integração com Backend
A função `submeterCriacaoCampanha(event)` intercepta o envio do formulário, realiza a sanitização básica e o limite de tamanho do nome (entre 3 e 60 caracteres), e envia os dados no formato JSON para o gateway `/api/sync` com a ação `campaigns.create`. Ao receber confirmação, limpa os campos, fecha o modal e dispara `carregarCampanhas()` para que a nova mesa apareça imediatamente na tela do usuário.
