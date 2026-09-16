# 07 — Planejamento do Sistema de Criação e Listagem de Campanhas (Mesas de RPG)

Este documento estabelece o planejamento técnico, arquitetural e visual para o fluxo de **Criação de Campanhas**, sua modelagem relacional no banco de dados Cloudflare D1 (SQLite), as regras de negócio e limites de jogadores, e a renderização responsiva dos **Cards Horizontais** das mesas ativas na interface da Taverna.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Modelagem e Expansão da Tabela de Campanhas no Cloudflare D1 (SQLite)

- **Objetivo**: Estruturar a persistência definitiva de todas as informações da campanha no banco de dados relacional, incluindo sistema, tema, limite de jogadores, lore, imagem, banner e o código/ID simples da mesa.
- **Método**:
  - Atualização da tabela `campaigns` no `schema.sql` e no `localD1.js`:
    - `id TEXT PRIMARY KEY`: ID interno exclusivo (ex: `cmp_a8f9d3b1`).
    - `simple_id TEXT UNIQUE NOT NULL`: Código curto, amigável e legível para compartilhamento rápido entre jogadores (ex: `CMP-8421` ou `ARC-7X9K`).
    - `name TEXT NOT NULL`: Nome épico da campanha (3 a 60 caracteres).
    - `owner_id TEXT NOT NULL`: ID do criador da campanha (FK para `users(id)`).
    - `system_id TEXT NOT NULL`: Identificador do sistema de regras (ex: `dnd5e`, `tormenta20`, `cthulhu`, `ordem`, `custom`).
    - `theme_id TEXT NOT NULL`: Tema narrativo/estético (ex: `dark-fantasy`, `high-fantasy`, `cosmic-horror`, `cyberpunk`, `investigation`).
    - `lore_description TEXT NOT NULL DEFAULT ''`: Sinopse, lore e ganchos iniciais da aventura.
    - `image_url TEXT NOT NULL DEFAULT ''`: Ilustração ou brasão da campanha selecionado da pool temática.
    - `banner_url TEXT NOT NULL DEFAULT ''`: Banner panorâmico para ambientação do card e da mesa.
    - `max_players INTEGER NOT NULL DEFAULT 5 CHECK (max_players >= 1 AND max_players <= 20)`: Limite estrito de vagas para aventureiros.
    - `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`.
  - Manutenção e refinamento da tabela `campaign_players`:
    - Ao criar a campanha, o criador é inserido automaticamente com cargo `'Mestre'` na tabela de participantes.
    - Relação que permite calcular o número exato de jogadores ativos (`COUNT(user_id)`) em tempo real para exibir `atual / máximo`.
- **Resultados Esperados**: Armazenamento relacional consistente, integridade referencial com remoção em cascata e consultas ultra-rápidas para a listagem da Taverna.
- **Possíveis Problemas Pós-Implementação**: Conflito em bancos de desenvolvimento pré-existentes (mitigado com migração segura de colunas `ALTER TABLE ADD COLUMN` automática no `localD1.js`).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Persistir cada atributo em colunas dedicadas do SQLite permite filtros, ordenação nativa por data/sistema e evita a lentidão de descompactar campos JSON em consultas de listagem.

---

### Tópico 2: Ações de Backend no Gateway RPC (`/api/sync`) e Regras de Permissão

- **Objetivo**: Disponibilizar os métodos seguros `campaigns.create`, `campaigns.list` e `campaigns.get` com validação de payload, sanitização contra XSS e governança de permissões.
- **Método**:
  - **`campaigns.create`**:
    - Permissões: Verificação de acesso conforme o modelo de cargos (jogadores podem criar mesas como mestres de sua própria campanha, ou restrito a categorias autorizadas).
    - Validação de dados: Comprimento do nome, limites de jogadores (1 a 20), validação se o `system_id` e o `theme_id` pertencem às listas oficiais, e escape sanitizado da lore.
    - Geração automática de `simple_id` único e não colidente.
    - Transação atômica: insere a campanha e vincula o criador como `'Mestre'` em `campaign_players`.
  - **`campaigns.list`**:
    - Busca todas as campanhas em que o usuário logado é dono (`owner_id = user.id`) ou participante (`campaign_players`), trazendo o contador consolidado de participantes (`current_players / max_players`).
  - **`campaigns.get`**:
    - Retorna a ficha completa da campanha por ID ou por `simple_id` com a lista dos jogadores já confirmados.
- **Resultados Esperados**: Endpoints resilientes, protegidos por JWT, blindados contra injeção SQL e com tratamento de erros padronizado.
- **Possíveis Problemas Pós-Implementação**: Sobrecarga em listagens grandes (mitigado com índices em `owner_id`, `campaign_id` e paginação limpa).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Centralizar a sincronização no `/api/sync` mantém o padrão unificado de mensagens RPC já testado e aprovado com 100% de cobertura nos testes de integração.

---

### Tópico 3: Pools Pré-Prontas de Sistemas, Temas, Imagens e Banners

- **Objetivo**: Fornecer coleções padronizadas, ricas e imersivas para que o usuário monte sua campanha com identidade visual premium imediatamente, mesmo antes do upload de arquivos customizados.
- **Método**:
  - **Pool de Sistemas de RPG**:
    - D&D 5ª Edição (`dnd5e`)
    - Tormenta 20 (`tormenta20`)
    - Chamado de Cthulhu 7e (`cthulhu`)
    - Ordem Paranormal RPG (`ordem`)
    - Sistema Próprio / Livre (`custom`)
  - **Pool de Temas Narrativos**:
    - Fantasia Sombria / Dark Fantasy (`dark-fantasy`)
    - Alta Fantasia Épica (`high-fantasy`)
    - Terror Cósmico & Mistério (`cosmic-horror`)
    - Cyberpunk / Sci-Fi Distópico (`cyberpunk`)
    - Investigação Sobrenatural (`investigation`)
  - **Pool Visual de Avatares (Brasões de Mesa)**:
    - 6 a 8 ilustrações estilizadas em arte escura de alta resolução (dragão sombrio, tomo arcano, crânio rúnico, elmo de guerreiro, olho cósmico, espada ancestral).
  - **Pool Visual de Banners Horizontais**:
    - 6 a 8 panoramas épicos com gradiente dark (masmorra subterrânea, castelo em tempestade, floresta amaldiçoada, taverna à meia-noite, ruínas estelares).
- **Resultados Esperados**: O mestre cria uma campanha rica esteticamente em menos de 1 minuto sem precisar de arquivos externos.
- **Possíveis Problemas Pós-Implementação**: Usuário querer enviar imagem própria de imediato (mitigado: interface terá a marcação visual indicando que upload customizado virá na fase de assets).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Pools pré-curadas garantem harmonia visual imediata na interface, sem quebras de layout por imagens de tamanhos desproporcionais.

---

### Tópico 4: Interface do Modal/Formulário de Criação de Campanha

- **Objetivo**: Desenvolver o componente modal dinâmico no FrontEnd para input dos dados com estética refinada Dark Fantasy, runas douradas e preview em tempo real.
- **Método**:
  - Estrutura `#modal-criar-campanha` acionada pelo botão `+ Criar Nova Campanha`:
    1. **Nome da Campanha**: Input de texto com placeholder temático ("Ex: A Praga de Valíria").
    2. **Capacidade da Mesa**: Seletor numérico elegante com botões `-` e `+` ou slider (1 a 10 jogadores recomendados, máx 20).
    3. **Seleção de Sistema**: Dropdown estilizado com ícones de cada sistema RPG.
    4. **Seleção de Tema**: Dropdown estilizado com cores de destaque de cada clima narrativo.
    5. **Lore da Campanha**: Textarea com contador de caracteres (ex: 0/1000) e suporte a quebra de parágrafos.
    6. **Galeria de Avatares e Banners**: Grade visual com cartões de seleção clicáveis com borda dourada ativa.
    7. **Preview do Card em Tempo Real**: Conforme o mestre digita o nome e escolhe a imagem/banner, uma miniatura exibe exatamente como o card horizontal ficará na lista.
    8. **Botões de Rodapé**: *"Cancelar"* e *"Forjar Campanha"*.
- **Resultados Esperados**: Experiência fluida, sem recarregamento de página, com feedback imediato via toast e inserção reativa na listagem.
- **Possíveis Problemas Pós-Implementação**: Formulário ficar extenso verticalmente (mitigado com scroll interno suave e divisão em passos lógicos/abas ou layout em duas colunas).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O modal com preview evita que o usuário crie mesas "às cegas", permitindo visualizar o acabamento estético antes de salvar.

---

### Tópico 5: Design e Interatividade dos Cards Horizontais de Campanha

- **Objetivo**: Renderizar as campanhas na tela `#view-campanhas` em formato de retângulos horizontais com bordas arredondadas, banner panorâmico, imagem de destaque, metadados e contador de jogadores.
- **Método**:
  - Estrutura do Card Horizontal:
    - **Formato**: Retângulo horizontal `border-radius: 12px` (ou `var(--radius-lg)`), fundo com imagem de banner sobreposta por uma máscara em degradê escuro translúcido (`linear-gradient(to right, rgba(12, 10, 18, 0.95), rgba(12, 10, 18, 0.65))`).
    - **Lado Esquerdo**: Brasão/Avatar da campanha com moldura dourada chanfrada (`width: 72px; height: 72px; object-fit: cover`).
    - **Corpo Central**:
      - Título da Campanha com tipografia imersiva (ex: `font-family: 'Cinzel', serif; font-size: 1.25rem`).
      - Badges temáticas de Sistema (ex: `[D&D 5e]`) e Tema (ex: `[Dark Fantasy]`).
      - Trecho resumido da Lore (com `text-overflow: ellipsis` em 2 linhas).
      - ID Simples visível discretamente (ex: `#CMP-4821` com botão rápido de copiar código de convite).
    - **Lado Direito / Metadados**:
      - Indicador de vagas com ícone de grupo: `0/5 Jogadores` (com cor verde se houver vagas, âmbar se estiver quase lotada e vermelha se cheia).
      - Tag de status da mesa (`Ativa`, `Recrutando`).
      - Ícone de seta dourada indicando clique (`chevron-right`).
    - **Micro-animações**: Efeito hover com leve elevação (`transform: translateY(-2px)`), brilho sutil na borda dourada e expansão suave da imagem de fundo.
    - **Ação de Clique**: Ao clicar em qualquer parte do card, transiciona suavemente para a visão de detalhes da campanha (que será construída nos próximos passos), passando o ID da mesa selecionada.
- **Resultados Esperados**: Layout deslumbrante, alta legibilidade, informações imediatas sobre vagas e navegação intuitiva.
- **Possíveis Problemas Pós-Implementação**: Adaptação em telas mobile estreitas (mitigado com design responsivo que converte o retângulo horizontal em um card empilhado compacto sem quebras).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O formato horizontal aproveita melhor a largura de telas desktop comuns em jogos de RPG de mesa e permite exibir o banner e a lore de forma muito mais imersiva do que cartões verticais genéricos.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento da Modelagem no Banco de Dados (Cloudflare D1)

```sql
-- Expansão da Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    simple_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    system_id TEXT NOT NULL DEFAULT 'custom',
    theme_id TEXT NOT NULL DEFAULT 'dark-fantasy',
    lore_description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    max_players INTEGER NOT NULL DEFAULT 5 CHECK (max_players >= 1 AND max_players <= 20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_simple_id ON campaigns(simple_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
```

### Detalhamento do ID Simples (`simple_id`)
Para facilitar a comunicação entre os jogadores sem exigir o envio de UUIDs longos e feios como `usr_superadmin_trevor` ou `cmp_1a2b3c4d-5e6f-7a8b`, o sistema forjará um identificador simples, elegante e único:
- Padrão recomendado: `CMP-` seguido de 4 caracteres alfanuméricos em caixa alta sem caracteres ambíguos (ex: `CMP-7K9W`, `CMP-4X2R`), ou número sequencial legível.
- Garantia de unicidade via loop de checagem ou hash abreviado com índice `UNIQUE` no SQLite.

### Detalhamento da Estrutura Visual do Card Horizontal
```html
<div class="campaign-horizontal-card" onclick="abrirDetalhesCampanha('cmp_xyz')">
  <div class="campaign-card-banner" style="background-image: url('assets/banners/dungeon_dark.jpg');"></div>
  <div class="campaign-card-overlay"></div>
  
  <div class="campaign-card-content">
    <div class="campaign-avatar-wrapper">
      <img src="assets/avatars/skull_rune.jpg" alt="Brasão" class="campaign-avatar-img">
    </div>
    
    <div class="campaign-info-wrapper">
      <div class="campaign-header-row">
        <h3 class="campaign-title">O Labirinto da Lua Negra</h3>
        <span class="campaign-simple-id">#CMP-7K9W</span>
      </div>
      <div class="campaign-tags-row">
        <span class="tag-system">D&D 5e</span>
        <span class="tag-theme">Dark Fantasy</span>
      </div>
      <p class="campaign-lore-preview">
        Sob as ruínas da fortaleza esquecida, antigas divindades murmuram segredos proibidos...
      </p>
    </div>

    <div class="campaign-meta-wrapper">
      <div class="campaign-players-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="players-count"><strong>0</strong> / 5 Vagas</span>
      </div>
      <span class="btn-enter-campaign">Acessar &rarr;</span>
    </div>
  </div>
</div>
```

---

## 🎯 Decisões de Arquitetura e Regras de Negócio Aprovadas

1. **Permissão de Criação de Campanhas**:
   - Estritamente restrito a contas com cargo `mestre`, `admin` ou `superadmin`. Usuários na categoria base `jogador` ou `assistente de mestre` são barrados pelo backend com `HTTP 403 Forbidden`. No frontend, o botão "+ Criar Nova Campanha" orienta o jogador sobre a necessidade de ser Mestre para forjar mesas.
2. **ID Simples da Campanha**:
   - Padrão temático místico + número (ex: `TAVERNA-42`, `DRAGAO-107`, `ARCANA-315`, `GRIMORIO-88`). Lista curada de palavras arcanas combinada a números gerados com garantia de unicidade no SQLite.
3. **Navegação ao Clicar no Card**:
   - Transiciona para a tela/view dedicada `#view-campanha-detalhes`, exibindo o banner completo, brasão, cabeçalho épico, tags de sistema e tema, sinopse da lore, lista de aventureiros confirmados e preparação para a sessão VTT.
4. **Capacidade Máxima de Jogadores**:
   - Definida pelo Mestre criador da campanha (mínimo 1, padrão 5), com teto rígido global de **12 jogadores ativos** vinculados à mesma campanha.
