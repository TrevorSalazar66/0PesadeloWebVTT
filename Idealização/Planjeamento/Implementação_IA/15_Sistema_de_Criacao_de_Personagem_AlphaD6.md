# Planejamento: Criação de Personagens, Ficha Interativa, Variáveis de Sistema, Silhueta e Lore (AlphaD6)

## 1. Visão Geral

Este documento consolida o **Assistente de Criação de Personagens (Wizard)** e a **Ficha Interativa Completa** do sistema **AlphaD6** no *RetroForge VTT*, incorporando todos os requisitos canônicos e refinamentos:
- **Identidade Completa & Criação Livre**: Nome, Sexo, Idade, Raça, Nível (inicial 1) e Arquétipo 100% livre.
- **Lore & Biografia Expandida**: História de origem, traços de personalidade, motivações/objetivos e diário de anotações.
- **Silhueta de Equipamento (Paperdoll)**: 9 slots pré-definidos vestidos no corpo (*Cabeça, Tronco, Costas, Mão Primária, Mão Secundária, Pernas, Pés, 2 Acessórios*) integrados à mochila de carga geral ($2d6 + \text{Corpo}$).
- **Sistema de Poderes**: Gestão de poderes passivos e ativos com acionamento interativo e dedução de Anima.
- **Variáveis de Estado do Sistema & Backend (Metadados de Motor)**: Estrutura vinculada à ficha que gerencia variáveis de combate, economia de ações (padrão 4 ações), reações, velocidade/deslocamento, condições ativas e modificadores temporários.

---

## 2. Estrutura de Identidade & Lore

### 2.1. Identidade Básica
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| **Nome** | Texto | Nome de registro do personagem. |
| **Sexo / Gênero** | Texto | Sexo, gênero ou pronomes. |
| **Idade** | Número/Texto | Idade do personagem. |
| **Raça** | Texto | Raça ou ancestralidade (livre). |
| **Nível** | Número | Inicia em 1 (com XP 0). |
| **Arquétipo** | Texto Livre | Conceito aberto para livre digitação e criação pelo jogador. |
| **Avatar / Token** | URL | Retrato do personagem para visualização e token no VTT. |
| **Campanha** | Seletor | Vinculação à campanha atual ou criação avulsa. |

### 2.2. Seção de Lore & Biografia
- **História de Origem (`historia_origem`)**: Passado, antecedentes e eventos marcantes.
- **Personalidade & Maneirismos (`personalidade`)**: Comportamentos, vícios, virtudes e estilo de interpretação.
- **Motivação Central (`motivacao`)**: O que impulsiona o personagem na jornada.
- **Diário de Campanha (`diario_anotacoes`)**: Notas pessoais do jogador ao longo das sessões.

---

## 3. Distribuição de Atributos & Especializações

- **Atributos Base**: Cada um dos 4 atributos inicia em 1 ponto (*Corpo: 1, Mente: 1, Social: 1, Espírito: 1*).
- **Pontos de Criação**: O jogador distribui **6 pontos livres** (totalizando 10 pontos de atributo no nível 1).
- **Especializações por Mente**: Concede exatamente **1 vaga de Especialização para cada ponto final em Mente** (ex: Mente 3 $\rightarrow$ 3 vagas livres).

---

## 4. Rolagens Iniciais & Estatísticas Derivadas

1. **Anima Inicial**: Rolagem de $2d6 + \sum(\text{Atributos}) = 2d6 + 10$ (define `max_anima` e `current_anima`).
2. **Capacidade de Carga (Mochila)**: Rolagem de $2d6 + \text{Corpo}$ (define o limite de slots de itens na mochila).
3. **Riqueza Abstrata**: Calculada por $\text{Mente} + \text{Social}$ nos 6 níveis canônicos (*Miserável, Pobre, Classe Média Baixa, Classe Média Alta, Rico, Milionário*).
4. **Os 3 Contatos Obrigatórios**: Nome, Vínculo (*Amizade, Dívida, Favor, Antigo Aliado*), Ocupação e Histórico.

---

## 5. Silhueta de Equipamento (Paperdoll) & Mochila

### 5.1. Slots de Equipamento Vestido
A silhueta humana na ficha possui slots interativos:
- **Cabeça (`cabeca`)**: Elmos, capuzes, máscaras, óculos.
- **Tronco / Armadura (`tronco`)**: Armaduras leves/médias/pesadas (+1, +2, +4 de Defesa), sobretudos, túnicas.
- **Costas (`costas`)**: Capas, mantos, aljavas.
- **Mão Primária (`mao_primaria`)**: Arma principal em punho (corpo a corpo ou fogo).
- **Mão Secundária (`mao_secundaria`)**: Escudo, arma leve secundária, tocha ou foco místico.
- **Pernas (`pernas`)**: Calças reforçadas, grevas.
- **Pés (`pes`)**: Botas de viagem, calçados furtivos.
- **Acessório 1 & 2 (`acessorio_1`, `acessorio_2`)**: Anéis, amuletos, relógios, talismãs.

### 5.2. Mochila de Carga Geral
- Armazena itens não equipados, poções, ferramentas e suprimentos.
- Capacidade máxima calculada por $2d6 + \text{Corpo}$. Itens pequenos/leves não consomem espaço de carga.

---

## 6. Sistema de Poderes

- **Poderes Passivos**: Habilidades permanentes sem custo de Anima.
- **Poderes Ativos**: Manifestações com custo de Anima, gatilhos de sacrifício e efeitos mecânicos.
- Botão interativo de **"Manifestar Poder"** direto na ficha, deduzindo a Anima em tempo real via WebSocket/Sync.

---

## 7. Variáveis de Estado do Sistema & Backend (Metadados de Motor)

O bloco `sistema_estado` na ficha armazena as variáveis técnicas utilizadas pelo motor de regras e backend:

```json
{
  "acoes_por_rodada": 4,
  "acoes_restantes": 4,
  "reacoes_disponiveis": 0,
  "deslocamento_metros": 9,
  "defesa_total": 2,
  "iniciativa_modificador": 0,
  "estado_vital": "ativo",
  "condicoes": [],
  "recursos_customizados": {}
}
```

### 7.1. Funcionalidades das Variáveis de Sistema
- **Economia de Ações**: Controle em tempo real das 4 ações por turno e sua conversão em reações.
- **Cálculo Consolidado de Defesa**: Soma automática da Defesa Base + bônus de equipamentos da silhueta (ex: Armadura $+2$, Escudo $+1$).
- **Condições e Status**: Gerenciamento de status como *envenenado, sangrando, atordoado, morrendo, acelerado*.
- **Recursos Customizados**: Espaço flexível para variáveis criadas pelo Mestre (ex: estresse, corrupção, munição especial, calor de arma).

---

## 8. Arquitetura Técnica & Endpoints

### 8.1. Validador Backend (`rpgEngineService.js`)
- `validateCharacterCreationAlphaD6(...)`: Validação completa de identidade, 6 pontos de atributos, especializações de Mente, 3 contatos, poderes, lore, silhueta e inicialização das variáveis de sistema.
- `calculateEquippedDefenseAndWeapons(...)`: Consolidação da Defesa e armas ativas a partir da silhueta.

### 8.2. Sync Gateway (`syncService.js`)
- `rpg.character.createAlphaD6`: Criação e inserção segura no D1.
- `rpg.character.equipSlot`: Equipar/desequipar slots da silhueta com recálculo automático.
- `rpg.character.updateLore`: Atualização dos textos de biografia e diário de bordo.
- `rpg.character.updateSystemState`: Atualização de ações, condições ou variáveis técnicas de combate pelo jogador ou Mestre.

---

## 9. Plano de Verificação e Testes

1. **Testes Unitários em `rpgEngine.test.js`**:
   - Validação da criação completa com identidade aberta, lore, silhueta, poderes e variáveis de sistema.
   - Validação do cálculo de Defesa e iniciativa considerando itens vestidos.
2. **Testes de Integração em `test_rpg_sync.js`**:
   - Criação via `rpg.character.createAlphaD6` e recuperação no banco.
   - Atualização de lore e equipamentos da silhueta.
