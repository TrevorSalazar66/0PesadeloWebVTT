# Planejamento: Compêndio Geral de Itens e Adaptação Matemática para o Sistema AlphaD6

> [!NOTE]
> Este documento consolida a descrição completa, mecânicas detalhadas e o **balanceamento matemático exato** dos **67 itens do compêndio**, adaptados da base legada para as regras oficiais do **AlphaD6** no Arcana VTT.

---

## 1. Princípios de Equivalência e Balanceamento Matemática (AlphaD6)

### 1.1. Atributos Canônicos e Equivalência
O AlphaD6 utiliza 4 atributos fundamentais com pool de dados D6 (sucessos em $4, 5, 6$):
* **`Corpo`**: Substitui *Força*, *Agilidade* e *Constituição*. Regula vigor físico, combate corpo a corpo, armaduras, escudos, resistência a venenos e capacidade de carga ($2d6 + \text{Corpo}$).
* **`Mente`**: Substitui *Inteligência* e *Percepção*. Regula raciocínio lógico, medicina, perícias técnicas, alcance de armas de disparo e especializações.
* **`Social`**: Substitui *Carisma* e *Sedução*. Regula influência, primeira impressão, diplomacia e negócios.
* **`Espírito`**: Substitui *Sabedoria*, *Vontade* e *Resiliência Mental*. Regula força de vontade, resistência a horrores sobrenaturais, canalização de Anima, magias e poderes.

### 1.2. Barra Única de Anima e Estados Críticos
* **Anima ($2d6 + 10$)**: Representa a integridade física, vital e psíquica unificada.
* **Estado de Morrendo**: Ativado ao atingir $0$ de Anima. A recuperação e estabilização de emergência operam sobre os testes escalonados da cena.
* **Economia de Ações**: Cada personagem possui 4 ações por turno de combate. O uso de itens consumíveis custa **1 ação**, a menos que o item esteja alojado em um *Espaço Rápido / Coldre* ($0$ ações).
* **Deslocamento Base**: 3 metros por ação gasta em movimento.

### 1.3. Níveis de Riqueza ($\text{Mente} + \text{Social}$) e Escala de Preços (P)
| Tier de Riqueza | Faixa de Soma ($\text{M} + \text{S}$) | Faixa de Preço (P) | Exemplos de Itens Disponíveis |
| :--- | :---: | :---: | :--- |
| **Tier 1: Miserável** | $\le 3$ pontos | $10\text{P} - 30\text{P}$ | Prendedores, Cura Lenta Básica, Roupas Comuns. |
| **Tier 2: Pobre** | $4 - 7$ pontos | $40\text{P} - 80\text{P}$ | Cura Rápida, Motivadores, Ferramentas Simples, Fonte de Luz/Calor, Comunicador Pequeno, Saque Rápido. |
| **Tier 3: Classe Média Baixa** | $8 - 13$ pontos | $90\text{P} - 150\text{P}$ | Cura Complexa, Relaxante Lento, Sensores, Ferramentas Especializadas, Próteses Simples, Armazenamento Médio. |
| **Tier 4: Classe Média Alta** | $14 - 17$ pontos | $160\text{P} - 250\text{P}$ | Objetos Sentimentais, Transportadores Comuns, Cura Emergencial, Protetores Ambientais, Armazenamento Grande, Armadura Leve. |
| **Tier 5: Rico** | $18 - 21$ pontos | $260\text{P} - 450\text{P}$ | Próteses Avançadas, Recarregadores Portáteis, Escudos Médios, Kits de Perícia. |
| **Tier 6: Milionário** | $\ge 22$ pontos | $\ge 500\text{P}$ | Armaduras Pesadas/Completas, Escudos Grandes/Enormes, Itens Mágicos Supremos, Transportadores Rápidos. |

---

## 2. Compêndio Completo dos 67 Itens Adaptados

### 2.1. Categoria: Saúde, Vitalidade & Cura

#### 1. Cura Rápida Consumível
* **Descrição**: Pequeno objeto de uso único que recupera uma quantidade de vida/Anima em momentos de urgência.
* **Mecânica AlphaD6**: Gasta **1 ação** em combate. Contém **3 doses/usos** individuais. Cada dose recupera **$1d6 + \text{Corpo}$** pontos de Anima.
* **Slots de Carga**: 1 | **Custo**: 50P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Empilhável (até 12)`

#### 2. Cura Lenta Consumível
* **Descrição**: Objeto de efeito prolongado e lento, ideal para tratamentos contínuos e precauções médicas.
* **Mecânica AlphaD6**: Frasco de tratamento com **12 doses diárias**. A partir do 3º dia consecutivo de uso, passa a somar o bônus de **$\text{Corpo}$** na recuperação de Anima em todos os descansos e permite anular 1 condição física debilitante por dia.
* **Slots de Carga**: 2 | **Custo**: 30P | **Tier Riqueza**: Miserável (Tier 1) | **Traços**: `Consumível`, `Prolongado`

#### 3. Cura Complexa Consumível
* **Descrição**: Conjunto cirúrgico e farmacológico para uso médico avançado em situações de extremo risco de vida.
* **Mecânica AlphaD6**: Exige Especialização em *Medicina de Campo* (Mente). Realiza teste de Mente (Meta: 2 sucessos). Cura **$2d6 + \text{Mente}$** de Anima. Cada sucesso extra adiciona $+1d6$ na cura. Se o alvo estiver em estado de *Morrendo*, estabiliza-o imediatamente. Possui **12 usos**.
* **Slots de Carga**: 2 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Especializado`

#### 4. Cura Emergencial (Desfibrilador de Alma / Soro Fênix)
* **Descrição**: Artefato extremo que permite aumentar as chances de sobreviver ao estado de morrendo uma única vez na jornada.
* **Mecânica AlphaD6**: Se o personagem entrar no estado de *Morrendo*, na rodada seguinte ele pode gastar **todas as suas 4 ações** para reviver imediatamente com **50% da sua Anima Máxima**. Em contrapartida, 1 atributo sorteado ($1d4$: 1-Corpo, 2-Mente, 3-Social, 4-Espírito) é reduzido permanentemente para o dado mínimo ($1d4$) e nunca mais poderá ser evoluído.
* **Slots de Carga**: 1 | **Custo**: 200P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Consumível`, `Limitado (1 por personagem)`, `Extremo`

---

### 2.2. Categoria: Foco Mental, Estresse & Vontade

#### 5. Relaxante Rápido Consumível
* **Descrição**: Pequeno objeto de uso único que alivia o nível de tensão e estresse do personagem.
* **Mecânica AlphaD6**: Gasta **1 ação** (limite de 1 uso por dia; frasco com **3 doses**). Anula penalidades de pânico, estresse ou medo no próximo teste de Espírito ou Mente do personagem.
* **Slots de Carga**: 1 | **Custo**: 60P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Empilhável (até 12)`

#### 6. Relaxante Lento Consumível
* **Descrição**: Objeto de efeito prolongado e gradual, perfeito para tratamento de traumas graves e estresse acumulado.
* **Mecânica AlphaD6**: Tratamento com **12 doses diárias**. A partir do 3º dia de uso, remove penalidades de abalos mentais a cada 3 dias e trata traumas permanentes a cada 5 dias de descanso longo.
* **Slots de Carga**: 2 | **Custo**: 90P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Consumível`, `Terapêutico`

#### 7. Motivador Rápido Consumível
* **Descrição**: Pequeno objeto estimulante de uso único que restaura a força de vontade e o foco.
* **Mecânica AlphaD6**: Gasta **1 ação** (contém **2 doses**). Concede **$+1d6$ de bônus na reserva de dados** em qualquer teste de Atributo realizado durante as próximas 2 rodadas.
* **Slots de Carga**: 1 | **Custo**: 50P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Empilhável (até 12)`

#### 8. Motivador Lento Consumível
* **Descrição**: Objeto de uso prolongado que amplia a determinação e vigor mental durante um período contínuo.
* **Mecânica AlphaD6**: Tratamento com **12 doses**. A partir do 3º dia consecutivo, concede **$+4$ pontos de Anima Máxima temporária** e bônus de $+1d6$ em testes de resistência de Espírito enquanto mantiver o uso diário.
* **Slots de Carga**: 2 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Ampliador`, `Temporário`

#### 9. Objeto Motivador (Relíquia Sentimental)
* **Descrição**: Objeto com imenso valor sentimental para o personagem (foto, medalha, carta, amuleto de família).
* **Mecânica AlphaD6**: **1x por sessão de jogo**: Se o personagem entrar em *Morrendo* ou sofrer colapso crítico de moral, pode evocar o significado do objeto e realizar um teste de Espírito com bônus de $-2$ a $+2$ dados arbitrado pela interpretação da cena, recuperando o valor obtido em pontos de Anima.
* **Slots de Carga**: 2 | **Custo**: 130P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Limitado (1 por personagem)`, `Restaurador`

#### 10. Objeto Relaxante (Relíquia de Conforto)
* **Descrição**: Objeto de apego emocional que traz conforto e estabilidade em momentos de horror extremo.
* **Mecânica AlphaD6**: **1x por sessão**: Ao ser alvo de terror sobrenatural, magia psíquica ou estresse extremo, o jogador pode segurar o objeto e realizar um teste de Espírito com **$+2d6$ de bônus** para anular o efeito ou dissipar o trauma.
* **Slots de Carga**: 2 | **Custo**: 160P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Limitado (1 por personagem)`, `Emergencial`

#### 11. Amplificador de Capacidades (Injeção de Adrenalina / Fúria Alquímica)
* **Descrição**: Estimulante extremo que maximiza todas as capacidades do herói por um breve instante ao custo de estafa severa posterior.
* **Mecânica AlphaD6**: Uso único (gasta 1 ação). Concede **$+2d6$ de bônus em todos os testes** durante uma cena inteira. Ao término da cena, o corpo entra em colapso sofrendo **$-2d6$ de penalidade em todos os atributos** até que receba tratamento com *Cura Complexa Consumível*.
* **Slots de Carga**: 1 | **Custo**: 180P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Consumível`, `Limitado (1 por personagem)`, `Risco Severo`

---

### 2.3. Categoria: Descanso, Acampamento & Abrigo

#### 12. Objeto de Descanso Relaxante
* **Descrição**: Acessório aromatizador, incensário ou caixinha de música suave para acampamentos.
* **Mecânica AlphaD6**: Usado durante Descansos Curtos ou Longos. Permite ao personagem e a até 2 aliados recuperarem $+2$ pontos de Anima adicionais e começarem a primeira cena seguinte com $+1d6$ de iniciativa. Não cumulativo com outros bônus de descanso.
* **Slots de Carga**: 1 | **Custo**: 140P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Restaurador`, `Adicional Descanso`

#### 13. Objeto de Descanso Confortável (Saco de Dormir Térmico / Isolante)
* **Descrição**: Equipamento ergonômico de descanso para proteção corporal durante o sono.
* **Mecânica AlphaD6**: Usado em descansos. Adiciona **$+1d6$ na rolagem de recuperação de Anima** em qualquer Descanso Curto ou Longo. Não cumulativo com outros itens de descanso.
* **Slots de Carga**: 1 | **Custo**: 120P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Restaurador`, `Adicional Descanso`

#### 14. Objeto Protetor de Descanso (Alarme de Perímetro / Sinos Rúnicos)
* **Descrição**: Dispositivo que protege o acampamento de perturbações e eventos naturais ou emboscadas desatentas.
* **Mecânica AlphaD6**: Garante que o descanso não seja interrompido por eventos climáticos leves ou criaturas irracionais. Caso inimigos conscientes ataquem, o alarme dispara instantaneamente, impedindo que o grupo seja pego de surpresa e concedendo 1 reação livre a todos.
* **Slots de Carga**: 2 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Adicional Descanso`, `Defensivo`

#### 15. “Local” de Descanso Portátil (Tenda de Expedição)
* **Descrição**: Tenda dobrável que abriga confortavelmente duas pessoas em qualquer ambiente seguro.
* **Mecânica AlphaD6**: Permite que 2 personagens realizem descansos com conforto pleno mesmo sob chuva, vento ou tempestades em ambientes selvagens.
* **Slots de Carga**: 3 | **Custo**: 180P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Abrigo Coletivo`

#### 16. “Local” de Descanso Emergencial (Casulo / Rede de Ancoragem Tática)
* **Descrição**: Rede ou casulo selado que pode ser fixado em qualquer superfície vertical ou íngreme.
* **Mecânica AlphaD6**: Permite que 1 personagem descanse em locais perigosos (copas de árvores, paredões rochosos, vigas de ruínas), viabilizando Descanso Curto ou Longo seguro.
* **Slots de Carga**: 2 | **Custo**: 200P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Abrigo Emergencial`

---

### 2.4. Categoria: Expressão Cultural, Arte & Social

#### 17. Instrumento Musical Pequeno (Flauta / Gaita / Pandeiro)
* **Descrição**: Instrumento portátil de sopro ou percussão manual.
* **Mecânica AlphaD6**: Concede **$+1d6$ em 1 teste de Social** por cena ou $+1$ ponto de Anima recuperado aos ouvintes durante um Descanso Curto.
* **Slots de Carga**: 1 | **Custo**: 50P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Musical`, `Auxiliar`

#### 18. Instrumento Musical Médio (Violão / Alaúde / Tambor de Guerra)
* **Descrição**: Instrumento acústico de cordas ou percussão média.
* **Mecânica AlphaD6**: Concede **$+1d6$ em até 2 testes de Social** na cena e inspira a equipe com $+2$ pontos de Anima adicionais no Descanso.
* **Slots de Carga**: 2 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Musical`, `Auxiliar`

#### 19. Instrumento Musical Grande (Harmônio / Violoncelo de Concerto)
* **Descrição**: Instrumento nobre de grande porte e sonoridade monumental.
* **Mecânica AlphaD6**: Concede **$+2d6$ em testes de Performance/Corte** e recupera $+1d6$ de Anima para todo o grupo em descansos.
* **Slots de Carga**: 5 | **Custo**: 500P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Musical`, `Monumental`

#### 20. Jogos Portáteis (Baralho / Dados de Aposta / Tarot)
* **Descrição**: Estojo compacto para jogos de azar, diversão em tavernas ou leitura oracular.
* **Mecânica AlphaD6**: Facilita integração em tavernas e permite trapaças ou leituras com **$+1d6$ em testes de Social**.
* **Slots de Carga**: 1 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Social`, `Recreativo`

#### 21. Objeto de Importância Simbólica e Cultural (Insígnia / Brasão)
* **Descrição**: Símbolo heráldico, medalha militar ou relíquia sagrada reconhecível.
* **Mecânica AlphaD6**: Concede **$+1d6$ em testes de Social** na primeira impressão e negociações com personagens da mesma cultura ou facção.
* **Slots de Carga**: 1 | **Custo**: 40P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Social`, `Diplomacia`

---

### 2.5. Categoria: Energia, Luz & Calor

#### 22. Fonte de Energia (Bateria / Cristal de Éter / Célula de Combustível)
* **Descrição**: Unidade concentrada de energia necessária para abastecer artefatos e maquinários.
* **Mecânica AlphaD6**: Possui **6 cargas**. Cada uso de item dependente de energia consome 1 carga.
* **Slots de Carga**: 2 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Consumível`, `Energizador`

#### 23. Fonte de Luz (Lanterna / Tocha Alquímica)
* **Descrição**: Emissor de luz direcionada ou omnidirecional.
* **Mecânica AlphaD6**: Ilumina completamente um ambiente em raio de 15 metros, anulando penalidades de escuridão. Gasta 1 carga de energia a cada 3 cenas (ou 5 horas de uso contínuo).
* **Slots de Carga**: 1 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Iluminação`, `Utilitário`

#### 24. Fonte de Calor (Aquecedor Rúnico / Brasero Portátil)
* **Descrição**: Gerador térmico para proteção contra intempéries climáticas.
* **Mecânica AlphaD6**: Aquece com eficiência uma área de 15m² por 4 cenas (ou 6 horas), protegendo contra frio extremo e hipotermia. Consome 1 carga de energia.
* **Slots de Carga**: 1 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Térmico`, `Sobrevivência`

#### 25. Recarregador Portátil de Energia (Coletor Solar / Cinético)
* **Descrição**: Coletor sustentável que capta luz, vento ou movimento do ambiente para recarregar baterias.
* **Mecânica AlphaD6**: Exposto a uma fonte natural por 4 horas (ou durante um Descanso Longo), recarrega 1 carga de energia para uma bateria (capacidade máxima de 10 cargas).
* **Slots de Carga**: 2 | **Custo**: 350P | **Tier Riqueza**: Rico (Tier 5) | **Traços**: `Sustentável`, `Utilitário`

---

### 2.6. Categoria: Comunicação, Informação & Sensores

#### 26. Comunicador Pequeno (Curto Alcance)
* **Descrição**: Conjunto de 4 microtransceptores para contato tático próximo.
* **Mecânica AlphaD6**: Permite comunicação clara por áudio entre os 4 aparelhos em até **500 metros** de distância.
* **Slots de Carga**: 1 | **Custo**: 60P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Comunicação`

#### 27. Comunicador Médio (Médio Alcance)
* **Descrição**: Conjunto de 4 rádio-transmissores ou espelhos mágicos pareados.
* **Mecânica AlphaD6**: Permite comunicação nítida entre os 4 aparelhos em raio de até **15 km**.
* **Slots de Carga**: 2 | **Custo**: 120P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Comunicação`

#### 28. Comunicador Grande (Longo Alcance / Estação Global)
* **Descrição**: Estação portátil de alta potência ou ressonador de éter.
* **Mecânica AlphaD6**: Comunicação sem limites de distância (alcance continental / intermunicipal).
* **Slots de Carga**: 3 | **Custo**: 240P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Comunicação`, `Carga Pesada`

#### 29. Retentor de Informações (Codex Digital / Livro de Anotações Ocultas)
* **Descrição**: Terminal de dados, notebook ou caderno encadernado para consulta e produção de arquivos.
* **Mecânica AlphaD6**: Armazena mapas, arquivos de áudio, códigos, registros de pistas e diário de bordo da campanha.
* **Slots de Carga**: 1 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Dados`, `Registro`

#### 30. Sensor Variado (Bússola Arcana / Detector Específico)
* **Descrição**: Detector configurado para uma substância específica (metais, radiação, anomalias de Anima, venenos).
* **Mecânica AlphaD6**: Funciona como radar mostrando direção e concentração do elemento em raio de **50 metros**.
* **Slots de Carga**: 2 | **Custo**: 150P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Investigação`

#### 31. Localizador (Transmissor Rastreador)
* **Descrição**: Pequeno emissor de sinal que pode ser fixado em superfícies, veículos ou alvos.
* **Mecânica AlphaD6**: Emite coordenadas constantes que podem ser rastreadas em tempo real pelo *Retentor de Informações*.
* **Slots de Carga**: 1 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Rastreio`

#### 32. Possibilitador de Percepção (Visor Noturno / Óculos Espectrais)
* **Descrição**: Óculos especiais que ampliam o espectro de visão além dos limites biológicos.
* **Mecânica AlphaD6**: Gasta 1 carga de energia por cena. Permite enxergar no escuro absoluto e rastrear fluxos de energia ou pegadas invisíveis.
* **Slots de Carga**: 2 | **Custo**: 140P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Percepção Especial`

#### 33. Facilitador de Percepção (Luneta de Precisão / Lupa de Investigação)
* **Descrição**: Lentes polidas para observação detalhada e reconhecimento à distância.
* **Mecânica AlphaD6**: Concede **$+1d6$ em testes de Mente** voltados para Investigação e Percepção Fina.
* **Slots de Carga**: 1 | **Custo**: 120P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Percepção Fina`, `Auxiliar`

#### 34. Objeto Informativo (Guia Regional / Bestiário de Campo)
* **Descrição**: Livro, enciclopédia ou mapa topográfico detalhado.
* **Mecânica AlphaD6**: **1x por sessão**: Ao consultar o guia, ganha **$+1d6$ em teste de Mente** sobre fauna, flora, monstros ou geografia local.
* **Slots de Carga**: 1 | **Custo**: 60P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Conhecimento`, `Auxiliar`

---

### 2.7. Categoria: Ferramentas, Manuseio & Armazenamento

#### 35. Conjunto de Ferramentas Simples
* **Descrição**: Estojo multiuso com ferramentas manuais essenciais (alicate, chave de fenda, martelo, faca).
* **Mecânica AlphaD6**: Permite realizar reparos simples e desmonte de objetos sem sofrer penalidades por falta de equipamento.
* **Slots de Carga**: 2 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Geral`, `Utilitário`

#### 36. Conjunto de Ferramentas Especializadas
* **Descrição**: Ferramentas mecânicas/elétricas de precisão (parafusadeiras, kits de gazua fina, forja portátil).
* **Mecânica AlphaD6**: Requer no mínimo 2 pontos investidos ou Especialização em perícia relacionada (*Mecânica*, *Engenharia*, *Ladinagem*). Concede **$+1d6$ de bônus** e habilita feitos complexos.
* **Slots de Carga**: 2 | **Custo**: 150P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Especializado`

#### 37. Prendedores (Grampos de Escalada / Fixadores Rápidos)
* **Descrição**: Conjunto de 6 ganchos, pregos de pressão ou adesivos de ancoragem rápida.
* **Mecânica AlphaD6**: Fixa e ancora cordas e objetos em qualquer superfície sólida de forma segura. Possui **6 usos**.
* **Slots de Carga**: 1 | **Custo**: 20P | **Tier Riqueza**: Miserável (Tier 1) | **Traços**: `Consumível`, `Empilhável (até 12)`

#### 38. Protetor de Risco Ambiental (Máscara de Gás / Traje de Radiação)
* **Descrição**: Equipamento hermético de proteção respiratória ou dérmica.
* **Mecânica AlphaD6**: Concede imunidade total a um risco passivo do ambiente (gases tóxicos, esporos fúngicos ou radiação).
* **Slots de Carga**: 2 | **Custo**: 200P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Imunidade Ambiental`

#### 39. Objeto de Armazenamento Médio (Bornal Tático / Bolsa de Cintura)
* **Descrição**: Pequena bolsa acoplável para organização de carga leve.
* **Mecânica AlphaD6**: Concede **$+4$ slots adicionais** na mochila para guardar itens que ocupem até 2 slots de carga. Limite de 3 por personagem.
* **Slots de Carga**: 0 (acoplado) | **Custo**: 120P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Ampliador de Carga`, `Limitado (3 por personagem)`

#### 40. Objeto de Armazenamento Grande (Mochila de Grande Expedição)
* **Descrição**: Mochila estruturada com armação ergonômica para expedições longas.
* **Mecânica AlphaD6**: Concede **$+8$ slots adicionais** de capacidade na mochila para guardar itens que ocupem até 4 slots de carga. Limite de 1 por personagem.
* **Slots de Carga**: 0 (acoplado) | **Custo**: 160P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Ampliador de Carga`, `Limitado (1 por personagem)`

#### 41. Objeto Facilitador de Uso (Coldre de Saque Rápido / Bainha Magnética)
* **Descrição**: Suporte tático de saque veloz para armas ou itens pequenos.
* **Mecânica AlphaD6**: Cria **3 "Espaços Rápidos"** no inventário. Itens de 1 slot guardados nesses espaços podem ser sacados com **$0$ ações (ação livre)** 1x por rodada em combate. Limite de 1 por personagem.
* **Slots de Carga**: 2 | **Custo**: 60P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Facilitador`, `Limitado (1 por personagem)`

#### 42. Recipiente Lacrado (Frascos Herméticos / Recipiente Blindado)
* **Descrição**: Tubos de vidro temperado ou cápsulas de chumbo hermeticamente vedadas.
* **Mecânica AlphaD6**: Permite transportar com segurança substâncias corrosivas, gases inflamáveis ou amostras contagiosas sem risco de vazamento.
* **Slots de Carga**: 2 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Empilhável (até 12)`, `Isolamento`

#### 43. Purificador (Destilador Alquímico / Filtro de Éter)
* **Descrição**: Dispositivo purificador que extrai toxinas, impurezas e maldições de líquidos e alimentos.
* **Mecânica AlphaD6**: Torna águas e rações contaminadas perfeitamente potáveis e permite isolar a substância venenosa em um frasco separado.
* **Slots de Carga**: 2 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Purificação`, `Utilitário`

---

### 2.8. Categoria: Treinamento, Influência & Debuffs

#### 44. Objeto de Treino Físico (Halteres de Campo / Elásticos Tensores)
* **Descrição**: Equipamento para manutenção de força e tônus muscular.
* **Mecânica AlphaD6**: Usado em períodos de intervalo (downtime). Concede bônus de desenvolvimento acelerado para evolução do atributo **`Corpo`**.
* **Slots de Carga**: 2 | **Custo**: 50P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Desenvolvimento`

#### 45. Objeto de Treino Mental (Quebra-Cabeças de Lógica / Foco Psíquico)
* **Descrição**: Livros de enigmas ou esferas de concentração mental.
* **Mecânica AlphaD6**: Usado em períodos de intervalo (downtime). Concede bônus de desenvolvimento para evolução dos atributos **`Mente`** ou **`Espírito`**.
* **Slots de Carga**: 2 | **Custo**: 50P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Desenvolvimento`

#### 46. Objeto Influenciador Mental Consumível (Soro da Verdade / Essência Hipnótica)
* **Descrição**: Substância volátil ou incenso hipnótico de uso único.
* **Mecânica AlphaD6**: Uso único (1 dose). O alvo deve passar em teste de Espírito ou sofrerá **$-2d6$ de penalidade em testes de percepção/pensamento** até o próximo descanso e responderá perguntas com honestidade forçada.
* **Slots de Carga**: 1 | **Custo**: 80P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Consumível`, `Empilhável (até 12)`

#### 47. Objeto Enfraquecedor Consumível (Peçonha Debilitante)
* **Descrição**: Veneno letal de uso único aplicável em lâminas ou disparos.
* **Mecânica AlphaD6**: Uso único (1 dose). O alvo atingido perde $1$ dado em um atributo a cada 2 horas. Se o atributo chegar a zero e não for tratado, entra em estado de *Morrendo*.
* **Slots de Carga**: 1 | **Custo**: 100P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Consumível`, `Empilhável (até 12)`

---

### 2.9. Categoria: Mobilidade & Veículos

#### 48. Facilitador de Deslocamento (Botas de Cravos / Ganchos de Neve)
* **Descrição**: Calçado reforçado para travessia em terrenos difíceis.
* **Mecânica AlphaD6**: Equipado nos pés. Anula penalidades de terreno difícil específico (gelo, lamaçal, escombros), mantendo deslocamento padrão de 3 metros por ação.
* **Slots de Carga**: 2 | **Custo**: 60P | **Tier Riqueza**: Pobre (Tier 2) | **Traços**: `Mobilidade`, `Vestimenta`

#### 49. Transportador (Bicicleta de Carga / Montaria Terrestre)
* **Descrição**: Meio de locomoção constante por terra, ar ou mar.
* **Mecânica AlphaD6**: Triplica a velocidade de deslocamento do grupo em viagens. Consome 4 cargas de energia por viagem longa.
* **Slots de Carga**: 3 | **Custo**: 200P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Transporte`

#### 50. Transportador Rápido (Veículo Motorizado / Deslizador Aéreo)
* **Descrição**: Veículo de alta potência e velocidade extrema.
* **Mecânica AlphaD6**: Deslocamento ultrarrápido impossível de ser interceptado a pé. Consome 10 cargas de energia por viagem.
* **Slots de Carga**: 3 | **Custo**: 500P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Alta Velocidade`

---

### 2.10. Categoria: Barreira, Supressão & Próteses

#### 51. “Local” Isolante (Domo Isolador de Anima / Gaiola de Faraday)
* **Descrição**: Gerador de campo ou talismãs de proteção em volta de uma área.
* **Mecânica AlphaD6**: Bloqueia completamente a manifestação ou passagem de energias mágicas, transmissões tecnológicas ou presenças sobrenaturais na área.
* **Slots de Carga**: 3 | **Custo**: 175P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Barreira`, `Carga Pesada`

#### 52. “Local” Restritor (Âncora de Supressão de Força)
* **Descrição**: Dispositivo que dissipa o impacto e a potência de energias na área.
* **Mecânica AlphaD6**: Diminui a força de ataques ou magias hostis realizadas dentro da área, impondo **$-2d6$ de penalidade no dano/potência**.
* **Slots de Carga**: 3 | **Custo**: 150P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Supressor`, `Carga Pesada`

#### 53. Próteses Simples (Braço, Perna, Tronco ou Sentidos Mecânicos Básicos)
* **Descrição**: Membro mecânico ou arcanotécnico com funcionalidade rudimentar.
* **Mecânica AlphaD6**: Substitui membro amputado restaurando a funcionalidade essencial, porém com **$-1$ dado permanente** em testes que exijam destreza fina daquele membro. O atributo só pode ser melhorado via upgrades na prótese.
  * *Braço / Perna / Tronco*: Afeta testes de `Corpo`.
  * *Olho / Ouvido / Crânio*: Afeta testes de `Mente`.
  * *Pele / Rosto*: Afeta testes de `Social`.
* **Slots de Carga**: 2 | **Custo**: 150P | **Tier Riqueza**: Classe Média Baixa (Tier 3) | **Traços**: `Prótese`, `Membro`

#### 54. Próteses Avançadas (Membro Biomecânico de Alta Performance)
* **Descrição**: Prótese de última geração com sensores refinados e ligas de alta durabilidade.
* **Mecânica AlphaD6**: Substitui membro perdido concedendo **$+1d6$ de bônus fixo** no atributo correspondente (`Corpo`, `Mente` ou `Social`). Além disso, possui um compartimento interno embutido para **acoplar 1 item de até 2 slots de carga**, permitindo acioná-lo ou sacá-lo instantaneamente com $0$ ações.
* **Slots de Carga**: 3 | **Custo**: 300P | **Tier Riqueza**: Rico (Tier 5) | **Traços**: `Prótese Avançada`, `Membro`, `Compartimento Embutido`

---

### 2.11. Categoria: Defesas Pessoais (Escudos & Armaduras)

#### 55. Escudo Pequeno (Broquel / Escudo de Braço)
* **Descrição**: Pequeno escudo metálico ou de madeira leve preso ao antebraço.
* **Mecânica AlphaD6**: Equipado na Mão Secundária. Concede **$+1$ de Defesa Total** sem impor penalidades de mobilidade.
* **Requisito**: Nenhum | **Penalidade**: Nenhuma
* **Slots de Carga**: 1 | **Custo**: 300P | **Tier Riqueza**: Rico (Tier 5) | **Traços**: `Proteção`, `Escudo Leve`

#### 56. Escudo Médio (Escudo de Duelo / Gota)
* **Descrição**: Escudo tradicional de carvalho reforçado com ferro.
* **Mecânica AlphaD6**: Equipado na Mão Secundária. Concede **$+2$ de Defesa Total**.
* **Requisito**: `Corpo 2d6` | **Penalidade**: Reduz o deslocamento em **$-1$ metro por ação** (deslocamento passa a ser de 2m por ação).
* **Slots de Carga**: 2 | **Custo**: 400P | **Tier Riqueza**: Rico (Tier 5) | **Traços**: `Proteção`, `Escudo`

#### 57. Escudo Grande (Escudo de Infantaria / Torre)
* **Descrição**: Escudo largo e pesado de muralha que cobre a maior parte do corpo.
* **Mecânica AlphaD6**: Equipado na Mão Secundária. Concede **$+3$ de Defesa Total**.
* **Requisito**: `Corpo 3d6` | **Penalidade**: Reduz o deslocamento em **$-2$ metros por ação** (mínimo de 1m por ação) e $-1d6$ em testes de Furtividade.
* **Slots de Carga**: 2 | **Custo**: 500P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Proteção`, `Escudo Pesado`

#### 58. Escudo Enorme (Pavise / Baluarte Móvel)
* **Descrição**: Escudo monumental de cerco que pode ser fincado no chão para fornecer cobertura total.
* **Mecânica AlphaD6**: Equipado na Mão Secundária. Concede **$+4$ de Defesa Total** e fornece cobertura sólida contra disparos à distância.
* **Requisito**: `Corpo 4d6` | **Penalidade**: Reduz o deslocamento em **$-3$ metros por ação** (movimenta-se no máximo 1m por ação) e $-2d6$ em Furtividade.
* **Slots de Carga**: 3 | **Custo**: 600P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Proteção`, `Escudo Baluarte`, `Carga Pesada`

#### 59. Armadura Leve (Gibão de Couro Batido / Traje Balístico)
* **Descrição**: Proteção corporal flexível e leve que resguarda os órgãos vitais.
* **Mecânica AlphaD6**: Vestida no Tronco. Concede **$+1$ de Defesa Total** sem penalidades de mobilidade.
* **Requisito**: Nenhum | **Penalidade**: Nenhuma
* **Slots de Carga**: 2 | **Custo**: 250P | **Tier Riqueza**: Classe Média Alta (Tier 4) | **Traços**: `Proteção`, `Armadura Leve`

#### 60. Armadura Média (Cota de Malha / Brigantina Reforçada)
* **Descrição**: Armadura de anéis de ferro ou placas entrelaçadas sobre couro grosso.
* **Mecânica AlphaD6**: Vestida no Tronco. Concede **$+2$ de Defesa Total**.
* **Requisito**: `Corpo 2d6` | **Penalidade**: Reduz o deslocamento em **$-1$ metro por ação** e impõe **$-1d6$ em testes de Furtividade**.
* **Slots de Carga**: 2 | **Custo**: 500P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Proteção`, `Armadura Média`

#### 61. Armadura Pesada (Meia-Armadura de Placas de Aço)
* **Descrição**: Conjunto de placas rígidas de aço articuladas sobre o tórax, braços e pernas.
* **Mecânica AlphaD6**: Vestida no Tronco. Concede **$+3$ de Defesa Total**.
* **Requisito**: `Corpo 3d6` | **Penalidade**: Reduz o deslocamento em **$-2$ metros por ação** e impõe **$-2d6$ em testes de Furtividade**.
* **Slots de Carga**: 3 | **Custo**: 1000P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Proteção`, `Armadura Pesada`

#### 62. Armadura Completa (Armadura de Placas Completa / Traje de Exotitânio)
* **Descrição**: Armadura completa fechada da cabeça aos pés, forjada com blindagem absoluta.
* **Mecânica AlphaD6**: Vestida no Tronco. Concede **$+4$ de Defesa Total**.
* **Requisito**: `Corpo 4d6` | **Penalidade**: Reduz o deslocamento em **$-3$ metros por ação** (movimenta-se no máximo 1m por ação) e impõe **$-3d6$ em testes de Furtividade**.
* **Slots de Carga**: 4 | **Custo**: 1500P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Proteção`, `Armadura Completa`, `Carga Pesada`

---

### 2.12. Categoria: Focos Arcanos & Itens Mágicos
> *Regra de Aquisição*: Personagens de arquétipo mágico recebem 1 item mágico básico gratuitamente na criação da ficha; personagens de outros arquétipos precisam comprá-los ou conquistá-los em narrativa.

#### 63. Orbe de Magia (Foco Primordial)
* **Descrição**: Esfera de cristal puro ou matéria estelar concentrada que ressoa com forças arcanas cósmicas.
* **Mecânica AlphaD6**: Equipado na Mão Secundária ou Acessórios. Permite manifestar **1 Poder Arcano de maior potência** sem exigir o pré-requisito de sacrifício daquele poder (o poder desbloqueado é definido no momento da aquisição e se torna fixo).
* **Slots de Carga**: 1 | **Custo**: 900P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Foco Arcano`, `Mágico`

#### 64. Cajado Arcano (Canalizador de Éter)
* **Descrição**: Cajado entalhado em madeira sagrada ou haste metálica de ressonância elemental.
* **Mecânica AlphaD6**: Equipado na Mão Primária (requer 2 mãos para conjurar). **Reduz o custo de Anima de todas as magias e poderes ativos em 50%** (arredondado para baixo, mínimo de 1 de Anima).
* **Slots de Carga**: 2 | **Custo**: 1000P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Foco Arcano`, `Canalizador`, `Mágico`

#### 65. Grimório de Feitiços (Tomo Arcano)
* **Descrição**: Livro antigo encadernado em couro místico contendo fórmulas e segredos esotéricos.
* **Mecânica AlphaD6**: Equipado na Mão Secundária ou Mochila. Concede o domínio e registro de **$+1$ Poder ou Elemento Arcano adicional** na ficha do personagem.
* **Slots de Carga**: 2 | **Custo**: 700P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Grimório`, `Mágico`

#### 66. Varinha Arcana (Condutor de Foco)
* **Descrição**: Varinha feita de madeira nobre com núcleo condutor de cristal ou cinza de fênix.
* **Mecânica AlphaD6**: Empunhada na Mão Primária ou Secundária. Concede **$+1d6$ de bônus fixo** na reserva de dados em todos os testes de conjuração mágica e canalização de Espírito enquanto estiver empunhada.
* **Slots de Carga**: 1 | **Custo**: 600P | **Tier Riqueza**: Milionário (Tier 6) | **Traços**: `Foco Arcano`, `Condutor`, `Mágico`

---

### 2.13. Categoria: Kits de Especialização / Perícia

#### 67. Kit de Especialização (Medicina, Ladinagem, Investigação, Ocultismo, Mecânica, etc.)
* **Descrição**: Conjunto de ferramentas, manuais e reagentes especializados dedicados a uma única especialização não-combatente.
* **Mecânica AlphaD6**:
  * No momento da aquisição, o jogador escolhe a **Especialização fixa** a qual o kit pertence (ex: *Kit de Medicina de Campo*, *Kit de Ladinagem & Gazua*, *Kit de Investigação Forense*, *Kit de Ocultismo*, *Kit de Mecânica*).
  * Possui **12 usos**. O uso é opcional: antes de rolar um teste da especialização vinculada, o jogador pode gastar 1 uso para receber **$+1d6$ de bônus na rolagem** (vantagem tática).
  * Não é permitido combinar mais de 1 Kit no mesmo teste. Após 12 usos, o kit se esgota.
* **Slots de Carga**: 1 | **Custo**: 300P | **Tier Riqueza**: Rico (Tier 5) | **Traços**: `Especializado`, `Consumível (12 usos)`, `Auxiliar`

---

## 3. Matriz Consolidada dos Traços Mecânicos

* **`Consumível`**: Item com número fixo de usos/cargas que se esgota após o uso.
* **`Empilhável`**: Até 12 unidades do mesmo item ocupam o mesmo espaço de 1 slot no inventário.
* **`Auxiliar`**: Item que interage diretamente com testes e regras, concedendo bônus na rolagem.
* **`Musical`**: Beneficia todos os aliados e ouvintes na cena com efeitos de inspiração ou recuperação.
* **`Ampliador de Carga`**: Aumenta o limite máximo de slots da mochila do personagem.
* **`Limitado`**: Possui restrição estrita de quantidade máxima que 1 personagem pode possuir simultaneamente.
* **`Especializado`**: Exige investimento prévio em perícia/especialização para ser operado.
* **`Adicional Descanso`**: Ativa seus benefícios durante a resolução de Descansos Curtos ou Longos.
* **`Proteção`**: Concede bônus fixo na Defesa Total do personagem.
* **`Foco Arcano`**: Instrumento canalizador para manipulação e redução de custos de Anima em poderes mágicos.

---

## 4. Próxima Etapa de Execução
Após sua validação e aprovação deste plano de adaptação matemática, implementaremos o compêndio completo com os 67 itens:
1. No Backend: Em `rpgEngineService.js` (com a tabela completa `ITEMS_COMPENDIUM` e filtros de busca).
2. No Frontend: Em `criar_personagem.js` (catálogo interativo e filtros por categoria no Passo 5).
3. Testes automatizados cobrindo a lista completa e a integração de dados no motor de regras.
