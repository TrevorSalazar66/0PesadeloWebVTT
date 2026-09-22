# 26. Oficina do Mestre: Gerenciamento de Compêndio (AlphaD6 & Herança Delta)

Este documento estabelece o planejamento detalhado e a especificação da arquitetura do **Módulo de Gerenciamento de Compêndio** na **Oficina do Mestre**, adaptado para o sistema **AlphaD6**, contemplando o modelo de blocos visuais editáveis, herança delta, esqueletos base de dados e integração com a comunidade.

---

## 🧠 1. Visão Geral e Arquitetura

O **Compêndio** funciona como a biblioteca central reutilizável de dados da campanha e do universo do jogo. Ele gerencia 5 tipos fundamentais de elementos:
1. **Itens Consumíveis / Gerais**: Poções, suprimentos, munição, ferramentas.
2. **Equipamentos & Armas**: Armas, armaduras, escudos, trajes e acessórios.
3. **Criaturas / NPCs / Entidades**: Bestiário, aliados, monstros e PNJs com atributos AlphaD6.
4. **Poderes / Habilidades / Magias**: Técnicas ativas/passivas e efeitos mágicos.
5. **Pistas / Segredos / Lore**: Documentos, fragmentos de informação e itens de enigma.

---

## 🧩 2. Design de UI por Blocos Visuais & Visibilidade Granular

### 2.1. Organização dos Campos em Blocos Visuais
Em vez de chaves simples soltas, a interface de edição de qualquer elemento é dividida em **Blocos Visuais Reutilizáveis**. Cada bloco visual possui:
* **Identificador Visual / ID do Bloco**: ex: `bloco_dano`, `bloco_custo`, `bloco_uso`, `bloco_efeito_magico`, `bloco_traço_1`.
* **Conteúdo**: O dado propriamente dito (texto, número, rolagens d6 ou ícone).
* **Chave de Visibilidade (Toggle On/Off)**: Localizada no canto inferior direito do bloco.
  * **ON (Verde)**: Visível para os jogadores ao inspecionarem o item/ficha.
  * **OFF (Vermelho/Cinza)**: Oculto para os jogadores, visível apenas para o Mestre/Admin.

### 2.2. Integração com o Motor No-Code de Gatilhos
No-code triggers podem manipular diretamente blocos visuais específicos via seu **ID Visual**:
$$\text{[GATILHO]} \longrightarrow \text{Alterar Visibilidade } (\text{ID\_Bloco}, \text{Visible: true}) \quad \text{OU} \quad \text{Alterar Conteúdo } (\text{ID\_Bloco}, \text{NovoTexto})$$

---

## 🏛️ 3. Herança Delta (Semi-Dependente)

Para otimização extrema de banco de dados SQLite / Cloudflare D1:
* **Item Pai (Oficial do Sistema)**: Contém a estrutura e valores originais do compêndio público.
* **Item Filho (Delta do Mestre)**: Armazena exclusivamente o `parent_id` e o objeto `delta_changes` (contendo apenas blocos/propriedades modificadas).
* **Resolução**: O backend efetua o merge em tempo de execução:
  $$\text{ElementoFinal} = \text{merge}(\text{DadoPai}, \text{DeltaChanges})$$

---

## 📊 4. Esqueletos Base de Modelos por Tipo (AlphaD6)

Cada tipo de elemento possui um modelo esqueleto padronizado no banco de dados e no frontend:

1. **Esqueleto de Item Consumível**:
   - `id`, `name`, `type: "item"`, `base_asset_id`, `blocks: { uso, quantidade, efeito, valor_pratas, raridade }`
2. **Esqueleto de Equipamento / Arma**:
   - `id`, `name`, `type: "equipment"`, `base_asset_id`, `blocks: { tipo_arma, dano_alphad6, alcance, peso, durabilidade, requisitos }`
3. **Esqueleto de Criatura / NPC**:
   - `id`, `name`, `type: "creature"`, `base_asset_id`, `blocks: { vigor, agilidade, mente, anima_max, defesa, ataques, especializacoes }`
4. **Esqueleto de Poder / Habilidade**:
   - `id`, `name`, `type: "power"`, `base_asset_id`, `blocks: { custo_anima, alcance, duracao, efeito_alphad6, gatilho_ativacao }`
5. **Esqueleto de Pista / Segredo**:
   - `id`, `name`, `type: "clue"`, `base_asset_id`, `blocks: { resumo_publico, lore_oculta, localizacao_revelacao, enigma_solucao }`

---

## 🎯 5. Plano de Ação para Implementação em Código

- [x] Elaborar o documento de planejamento `26_Oficina_Mestre_Gerenciamento_Compendio.md`.
- [ ] Criar esquemas/esqueletos de dados base para Compêndio no Backend (SQLite/D1).
- [ ] Criar rotas no backend para busca, criação delta e listagem comunitária de compêndio.
- [ ] Implementar a interface da Oficina do Mestre (aba Compêndio) no Frontend com a lógica de blocos visuais e chaves de visibilidade.
