# Planejamento: Organização Hierárquica de Personagens, Trava de 1 por Campanha e Diário de Mesa

## 1. Visão Geral e Diretrizes do Usuário

Este documento estabelece as regras de organização, restrições de integridade e visualização das fichas de personagens no ecossistema **RetroForge VTT / Arcana**:

1. **Vínculo Estrito ao Sistema e Campanha**:
   - As fichas do sistema **AlphaD6** são estritamente vinculadas ao sistema e a uma campanha ativa (`campaign_id`).
   - **Regra de Unicidade**: Cada jogador pode ter no **máximo 1 personagem por campanha** (`user_id + campaign_id`).
2. **Navegação em Árvore / Pastas na Home (`index.html`)**:
   - Na aba **Personagens** da página inicial, a listagem não é uma lista plana e genérica, mas organizada em **árvore hierárquica por pastas expansíveis**:
     $$\text{Sistemas} \longrightarrow \text{Campanhas} \longrightarrow \text{Personagens}$$
   - Exemplo visual:
     - 📂 **AlphaD6 RPG**
       - 📁 *O Labirinto da Lua Negra* (#TAVERNA-42)
         - 🪪 **Valerius Lunaprata** (Nível 1 • Mago • Elfo • Anima: 18/18 • Defesa: 3 • Riqueza: Classe Média Baixa)
3. **Aba Diário & Fichas nas Campanhas (`campanha.html`)**:
   - Na aba **Diário** da tela de sessão da campanha, exibir os personagens da *party* (grupo de aventureiros daquela mesa).
   - Visualização dos cards dos heróis dos jogadores com estatísticas vitais, avatar, atributos, especializações, equipamentos vestidos e anotações do diário/crônicas da mesa.
   - Acesso rápido para o jogador abrir/editar sua ficha ou para o Mestre inspecionar as fichas dos jogadores.
   - Se o jogador ainda não criou seu personagem naquela campanha, destaque visual para iniciar o assistente de criação.

---

## 2. Regra de Negócio: Limite de 1 Personagem por Jogador por Campanha

### 2.1. Trava no Backend (`syncService.js` e `rpgEngineService.js`)
- Antes de registrar a criação de um novo personagem (`rpg.character.createAlphaD6` ou `characters.create`):
  1. O sistema verifica se `campaignId` foi informado e se o usuário é participante da campanha.
  2. Executa a query `getCharactersByUserAndCampaign(userId, campaignId)`.
  3. Se já existir um personagem ativo pertencente àquele `user_id` naquela `campaign_id`, a requisição é rejeitada com o erro:
     > `"Limite atingido: Você já possui o personagem '[Nome]' vinculado a esta campanha. Cada jogador pode ter apenas 1 personagem por campanha."`
  4. Caso o jogador queira alterar seu herói, ele deve editar a ficha existente ou transferir/arquivar.

### 2.2. Feedback no Frontend (`criar_personagem.js` e `index.html`)
- Ao selecionar a campanha no assistente de criação (`criar_personagem.html`), o formulário avisa instantaneamente se o jogador já possui um personagem registrado nela, desabilitando a submissão duplicada.

---

## 3. Estrutura de Pastas na Aba Personagens (`index.html`)

### 3.1. Arquitetura da Árvore Hierárquica
```
[ Aba Personagens ]
 ├── Cabeçalho com Busca, Filtro e Botão "+ Criar Personagem"
 └── Árvore de Pastas (Accordion Dark Fantasy)
      ├── 📂 [Sistema] AlphaD6 RPG (Total: X personagens)
      │    ├── 📁 [Campanha] Mina de Phandelver (#PHAN-01)
      │    │    └── 🪪 [Personagem] Thorek Escudo de Ferro (Guerreiro Nv.2)
      │    └── 📁 [Campanha] O Labirinto da Lua Negra (#LUA-09)
      │         └── 🪪 [Personagem] Valerius Lunaprata (Mago Nv.1)
      └── 📂 [Sistema] Custom / Outros
           └── 📁 [Campanha] Crônicas de Sangue (#SANG-03)
                └── 🪪 [Personagem] Drake (Ladino Nv.1)
```

### 3.2. Componente de Card de Personagem no Hub
Cada card de personagem na pasta exibe:
- **Avatar / Token Redondo** com moldura temática.
- **Nome do Personagem**, **Nível**, **Raça**, **Sexo**, **Idade** e **Arquétipo Livre**.
- **Pílulas de Status**: Anima ($HP$), Defesa Total, Riqueza (Tier).
- **Atributos em d6**: Corpo $\text{Xd6}$, Mente $\text{Xd6}$, Social $\text{Xd6}$, Espírito $\text{Xd6}$.
- **Botões de Ação Rápida**:
  - 🚪 *Acessar Mesa* $\rightarrow$ Redireciona para `campanha.html?id=...`
  - 📜 *Ver Ficha Completa* $\rightarrow$ Abre modal/drawer com silhueta Paperdoll, inventário e poderes.

---

## 4. Estrutura da Aba Diário na Campanha (`campanha.html`)

### 4.1. Seções da Aba Diário
1. **Quadro de Aventureiros da Mesa (Party Showcase)**:
   - Grade com os personagens de todos os jogadores da campanha.
   - Status em tempo real (Anima atual/máxima, Defesa, Condições ativas).
2. **Lore Coletiva & Crônicas de Sessão**:
   - Registro de acontecimentos, notas de sessão e diário compartilhado da aventura.
3. **Anotações Pessoais & Lore Individual**:
   - Aba para o jogador registrar a história, objetivos imediatos e pensamentos do seu personagem.
4. **Card de Convite / Criação**:
   - Caso um jogador ainda não tenha ficha na mesa, exibe banner convocatório para criar seu herói.

---

## 5. Endpoints e Contratos no Backend

### 5.1. `characters.listHierarchical` (ou `rpg.character.listHierarchical`)
- **Entrada**: `{}` (autenticado via JWT/Cookie)
- **Saída**:
```json
{
  "sucesso": true,
  "dados": {
    "alphad6": {
      "systemName": "AlphaD6 RPG",
      "campaigns": [
        {
          "campaignId": "cmp_123",
          "campaignName": "O Labirinto da Lua Negra",
          "simpleId": "LUA-09",
          "characters": [
            {
              "id": "chr_456",
              "name": "Valerius Lunaprata",
              "sheet": { "nivel": 1, "arquetipo": "Mago", "atributos": { "corpo": 2, "mente": 4, "social": 2, "espirito": 2 }, "max_anima": 18, "current_anima": 18, "defesa_total": 3, "wealth": { "tier_nome": "Classe Média Baixa" } }
            }
          ]
        }
      ]
    }
  }
}
```

### 5.2. `campaigns.characters.list` (ou `rpg.campaign.characters`)
- **Entrada**: `{ "campaignId": "cmp_123" }`
- **Saída**:
```json
{
  "sucesso": true,
  "dados": [
    {
      "characterId": "chr_456",
      "userId": "usr_789",
      "playerName": "João",
      "playerNickname": "joao_mestre",
      "characterName": "Valerius Lunaprata",
      "sheet": { ... }
    }
  ]
}
```

---

## 6. Plano de Verificação

1. **Testes Unitários & Integração no Backend**:
   - Validar que a tentativa de criar um 2º personagem para o mesmo jogador na mesma campanha retorna erro 400 (`LIMIT_REACHED`).
   - Validar que criar 1 personagem em campanhas distintas para o mesmo jogador é permitido.
   - Validar endpoint de agrupamento hierárquico.
2. **Validação Visual Frontend**:
   - Verificar renderização da árvore expansível em `index.html` (aba Personagens).
   - Verificar renderização dos cards do grupo na aba Diário de `campanha.html`.
