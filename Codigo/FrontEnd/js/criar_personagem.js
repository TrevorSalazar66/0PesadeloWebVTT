/**
 * Controlador do Assistente de Criação de Personagens (AlphaD6)
 * RetroForge VTT - Arcana
 */

import { apiClient } from './api/client.js';

let passoAtual = 1;
const totalPassos = 7;

// Estado da criação
const criacaoState = {
  atributos: {
    corpo: 1,
    mente: 1,
    social: 1,
    espirito: 1
  },
  pontosLivresRestantes: 6,
  especializacoesCatalogo: [],
  especializacoesAlocadas: {}, // { [id]: { id, nome, nivel, atributo, categoria, desc } }
  filtroSpecCategoria: 'todos',
  buscaSpecTexto: '',
  compendioCompleto: [],
  filtroCompendioAtual: 'todos',
  mochila: [], // Array de objetos de itens adicionados pelo jogador
  equipamentoSilhueta: {
    cabeca: null,
    tronco: null,
    costas: null,
    mao_primaria: null,
    mao_secundaria: null,
    pernas: null,
    pes: null,
    acessorios: null
  }
};

// ===================================================
// CATÁLOGO CANÔNICO DE 40 ESPECIALIZAÇÕES & PERÍCIAS (ALPHAD6)
// ===================================================
const SPECIALIZATIONS_FALLBACK = [
  // 1. Combate & Táticas Marciais
  { id: 'acrobacia', nome: 'Acrobacia', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Manobras evasivas, saltos circenses, amortecimento de quedas e travessia ágil de obstáculos em combate.' },
  { id: 'armas_brancas', nome: 'Armas Brancas', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Manejo refinado de lâminas, maças, machados, lanças e armas de haste corpo a corpo.' },
  { id: 'armas_fogo', nome: 'Armas de Fogo', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Domínio balístico de pistolas, carabinas, rifles de longo alcance e armamento pesado.' },
  { id: 'armas_exoticas', nome: 'Armas Exóticas', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Uso de armas raras, incomuns ou arcanotécnicas (chicotes, correntes, lâminas giratórias, chakrams).' },
  { id: 'arremesso_disparo', nome: 'Arremesso & Disparo', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Precisão em lançar facas, granadas, dardos, flechas de arco e virotes de besta.' },
  { id: 'esquiva_reflexos', nome: 'Esquiva & Reflexos', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Agilidade instintiva para desviar de golpes corpo a corpo, disparos e armadilhas de área.' },
  { id: 'furtividade', nome: 'Furtividade', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Movimentação silenciosa, camuflagem em sombras e infiltração sem ser detectado.' },
  { id: 'luta_desarmada', nome: 'Luta Desarmada', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Artes marciais, socos, chutes, imobilizações e combate desarmado corpo a corpo.' },
  { id: 'tolerancia_dor', nome: 'Tolerância a Dor', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Resiliência biológica extrema para suportar tortura, venenos e continuar lutando após ferimentos graves.' },

  // 2. Físicas, Exploração & Sobrevivência
  { id: 'atletismo', nome: 'Atletismo', atributo: 'corpo', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Corridas de alta velocidade, escalada de paredes íngremes, levantamento de peso e saltos longos.' },
  { id: 'adestramento_montaria', nome: 'Adestramento & Montaria', atributo: 'social', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Domar, treinar, cavalgar e comandar animais, montarias terrestres e bestas fantásticas.' },
  { id: 'natacao_mergulho', nome: 'Natação & Mergulho', atributo: 'corpo', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Deslocamento aquático veloz, fôlego prolongado e sobrevivência em correntezas fluviais ou marítimas.' },
  { id: 'pilotagem', nome: 'Pilotagem', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Condução e controle de veículos terrestres motorizados, barcos, aeronaves e deslizadores de éter.' },
  { id: 'sobrevivencia_pesca', nome: 'Sobrevivência & Pesca', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Rastreio em ermos, busca de água potável, pesca, caça, acampamento e previsão climática.' },
  { id: 'preparo_engenhosidade', nome: 'Preparo & Engenhosidade', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Capacidade tática de planejar com antecedência; teste de sorte para ter um item utilitário na cena.' },

  // 3. Ofícios & Engenharia (Crafting)
  { id: 'alfaiataria_couro', nome: 'Alfaiataria & Couro', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Confecção, conserto, reforço e isolamento térmico de vestimentas, tecidos e armaduras de couro.' },
  { id: 'carpintaria_estruturas', nome: 'Carpintaria & Estruturas', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Modelagem de madeira, construção de barricadas, portas reforçadas, barcos e estruturas de abrigo.' },
  { id: 'lapidacao_joalheria', nome: 'Lapidação & Joalheria', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Lapidação de cristais arcanos, focos de energia, lentes de precisão e avaliação de gemas.' },
  { id: 'metalurgia_forja', nome: 'Metalurgia & Forja', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Forja, têmpera, reparo e aprimoramento de armas brancas de aço, placas de armadura e escudos.' },
  { id: 'quimica_alquimia', nome: 'Química & Alquimia', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Produção de poções restauradoras, ácidos corrosivos, venenos, antídotos e compostos herméticos.' },
  { id: 'engenharia_eletrica_mecanica', nome: 'Engenharia Elétrica & Mecânica', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Manutenção de circuitos, geradores rúnicos, automações, fechaduras complexas e próteses.' },

  // 4. Investigação, Percepção & Ladinagem
  { id: 'percepcao_fina_audicao', nome: 'Percepção Fina & Audição', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Detecção de sussurros, estalos distantes, passos nas sombras e pequenos detalhes visuais no ambiente.' },
  { id: 'hackeamento_criptografia', nome: 'Hackeamento & Criptografia', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Invasão de redes digitais, descriptografia de códigos, bypass de terminais e codex de dados.' },
  { id: 'interrogatorio_intimidacao', nome: 'Interrogatório & Intimidação', atributo: 'social', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Obtenção de confissões e pistas secretas através de pressão psicológica, postura ameaçadora ou blefe.' },
  { id: 'investigacao_deducao', nome: 'Investigação & Dedução', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Análise metódica de cenas de crime, reconstituição de eventos, cruzamento de pistas e resolução de mistérios.' },
  { id: 'ladinagem_arrombamento', nome: 'Ladinagem & Arrombamento', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Abertura de fechaduras trancadas com gazua, desarme de armadilhas mecânicas e furto leve.' },
  { id: 'rastreamento', nome: 'Rastreamento', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Seguir pegadas, galhos quebrados, manchas de sangue e rastros deixados por alvos na terra ou cidades.' },
  { id: 'intuicao_sentido_psiquico', nome: 'Intuição & Sentido Psíquico', atributo: 'espirito', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Percepção empática para notar mentiras, pressentir emboscadas ocultas ou intenções malignas.' },

  // 5. Conhecimento Intelectual & Erudição
  { id: 'cartografia_navegacao', nome: 'Cartografia & Navegação', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Leitura e confecção de mapas topográficos detalhados, triangulação de rotas e orientação por astros.' },
  { id: 'ciencias_naturais_fisica', nome: 'Ciências Naturais & Física', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Compreensão de leis naturais, balística, cinemática, gravidade, mineralogia e geologia.' },
  { id: 'historia_arqueologia', nome: 'História & Arqueologia', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Domínio sobre dinastias esquecidas, eventos antigos, monumentos em ruínas e genealogia nobre.' },
  { id: 'idiomas_linguistica', nome: 'Idiomas & Linguística', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Tradução de línguas mortas, dialetos regionais, códigos secretos e comunicação poliglota fluente.' },
  { id: 'medicina_campo_cirurgia', nome: 'Medicina de Campo & Cirurgia', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Diagnóstico de moléstias, cirurgias de trauma, suturas complexas, amputações e estabilização de feridos graves.' },
  { id: 'primeiros_socorros_paramedicina', nome: 'Primeiros Socorros & Paramedicina', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Cuidados rápidos com bandagens estéreis, estancamento de hemorragias e reanimação de choque em combate.' },
  { id: 'gastronomia_nutricao', nome: 'Gastronomia & Nutrição', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Culinária avançada, conservação de rações de expedição e preparo de banquetes restauradores de Anima.' },

  // 6. Expressão Cultural & Social
  { id: 'diplomacia_negociacao', nome: 'Diplomacia & Negociação', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Mediação de conflitos, barganha comercial vantajosa, acordos de paz e etiqueta nobre.' },
  { id: 'enganacao_disfarce', nome: 'Enganação & Disfarce', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Criar identidades falsas, mentir com convicção absoluta e forjar documentos convincentes.' },
  { id: 'performance_musica', nome: 'Performance & Música', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Tocar instrumentos musicais, cantar, atuar em palco, inspirar multidões e elevar a moral do grupo.' },
  { id: 'psicologia_empatia', nome: 'Psicologia & Empatia', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Análise psicológica do comportamento humano, suporte para crises de pânico e leitura de motivações.' },

  // 7. Artes Místicas, Ocultismo & Magia
  { id: 'ocultismo_teoria_arcana', nome: 'Ocultismo & Teoria Arcana', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Identificação de runas, círculos mágicos, criaturas do Vazio, maldições e análise de fenômenos esotéricos.' },
  { id: 'divinacao_oraculos', nome: 'Divinação & Oráculos', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Práticas oraculares de leitura do futuro e revelação do oculto através de tarô, runas e astrologia.' },
  { id: 'invocacao_canalizacao', nome: 'Invocação & Canalização', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Arte de canalizar entidades cósmicas ou forças espirituais para dentro do próprio corpo como mediador.' },
  { id: 'evocacao_espiritual', nome: 'Evocação Espiritual', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Chamar e projetar espíritos e elementais para o ambiente exterior sem permitir posse no usuário.' },
  { id: 'encantamento_protecao', nome: 'Encantamento & Proteção', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Conjuração de barreiras mágicas, bênçãos de proteção, auras de santuário e rituais de cura mística.' },
  { id: 'transmutacao_alquimia_arcana', nome: 'Transmutação & Alquimia Arcana', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Manipulação mágica da matéria e dos estados físicos, transmutando substâncias e manipulando fluxos elementais.' }
];

// Catálogo Canônico Local de Fallback para Itens
const COMPENDIO_FALLBACK = [
  // Saúde & Foco Mental
  { id: 'cura_rapida', nome: 'Cura Rápida Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação. Contém 3 doses. Cada dose recupera 1d6 + Corpo de Anima.' },
  { id: 'cura_lenta', nome: 'Cura Lenta Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 2, custo: 30, riquezaMinima: 'miseravel', tracos: ['Consumível', 'Prolongado'], desc: '12 doses diárias. A partir do 3º dia consecutivo, soma o bônus de Corpo na recuperação de Anima em descansos e anula 1 condição por dia.' },
  { id: 'cura_complexa', nome: 'Cura Complexa Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Consumível', 'Especializado'], desc: 'Exige Especialização em Medicina de Campo (Mente). Teste de Mente (Meta 2). Cura 2d6 + Mente de Anima (+1d6 por sucesso extra). Estabiliza estado de Morrendo. Possui 12 usos.' },
  { id: 'cura_emergencial', nome: 'Cura Emergencial (Desfibrilador de Alma / Soro Fênix)', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 1, custo: 200, riquezaMinima: 'classe_media_alta', tracos: ['Consumível', 'Limitado (1 por personagem)', 'Extremo'], desc: 'Ao entrar em Morrendo, gasta as 4 ações do turno para reviver com 50% da Anima Máxima. Reduz permanentemente 1 atributo sorteado para 1d4 sem evolução.' },
  { id: 'relaxante_rapido', nome: 'Relaxante Rápido Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação (3 doses, limite 1x/dia). Anula penalidades de pânico, estresse ou medo no próximo teste de Espírito ou Mente.' },
  { id: 'relaxante_lento', nome: 'Relaxante Lento Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 2, custo: 90, riquezaMinima: 'classe_media_baixa', tracos: ['Consumível', 'Terapêutico'], desc: '12 doses diárias. A partir do 3º dia, remove penalidades mentais a cada 3 dias e trata traumas permanentes a cada 5 dias de descanso longo.' },
  { id: 'motivador_rapido', nome: 'Motivador Rápido Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação (2 doses). Concede +1d6 de bônus na reserva de dados em qualquer teste de atributo nas próximas 2 rodadas.' },
  { id: 'motivador_lento', nome: 'Motivador Lento Consumível', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Consumível', 'Ampliador', 'Temporário'], desc: '12 doses diárias. A partir do 3º dia, concede +4 de Anima Máxima temporária e +1d6 em testes de resistência de Espírito enquanto mantiver o uso diário.' },
  { id: 'objeto_motivador', nome: 'Objeto Motivador (Relíquia Sentimental)', slot: 'acessorios', categoria: 'saude_mente', slotsCarga: 2, custo: 130, riquezaMinima: 'classe_media_baixa', tracos: ['Limitado (1 por personagem)', 'Restaurador'], desc: '1x por sessão: Se entrar em Morrendo ou sofrer colapso moral, evoca o objeto e testa Espírito (com bônus de -2 a +2 dados) para recuperar Anima.' },
  { id: 'objeto_relaxante', nome: 'Objeto Relaxante (Relíquia de Conforto)', slot: 'acessorios', categoria: 'saude_mente', slotsCarga: 2, custo: 160, riquezaMinima: 'classe_media_alta', tracos: ['Limitado (1 por personagem)', 'Emergencial'], desc: '1x por sessão: Ao ser alvo de terror sobrenatural ou trauma psíquico, segurar o objeto concede +2d6 no teste de Espírito para dissipar o efeito.' },
  { id: 'amplificador_capacidades', nome: 'Amplificador de Capacidades (Injeção de Adrenalina / Fúria Alquímica)', slot: 'mochila', categoria: 'saude_mente', slotsCarga: 1, custo: 180, riquezaMinima: 'classe_media_alta', tracos: ['Consumível', 'Limitado (1 por personagem)', 'Risco Severo'], desc: 'Uso único (1 ação). Concede +2d6 de bônus em todos os testes na cena. Ao fim da cena, sofre colapso com -2d6 em todos os atributos até receber Cura Complexa.' },

  // Descanso & Abrigo
  { id: 'descanso_relaxante', nome: 'Objeto de Descanso Relaxante (Incensário / Aromatizador)', slot: 'mochila', categoria: 'descanso_abrigo', slotsCarga: 1, custo: 140, riquezaMinima: 'classe_media_baixa', tracos: ['Restaurador', 'Adicional Descanso'], desc: 'Em descansos, permite ao herói e até 2 aliados recuperarem +2 Anima e começarem a primeira cena com +1d6 na iniciativa.' },
  { id: 'descanso_confortavel', nome: 'Objeto de Descanso Confortável (Saco de Dormir Térmico)', slot: 'costas', categoria: 'descanso_abrigo', slotsCarga: 1, custo: 120, riquezaMinima: 'classe_media_baixa', tracos: ['Restaurador', 'Adicional Descanso'], desc: 'Adiciona +1d6 na rolagem de recuperação de Anima em qualquer Descanso Curto ou Longo.' },
  { id: 'protetor_descanso', nome: 'Objeto Protetor de Descanso (Alarme de Perímetro / Sinos Rúnicos)', slot: 'mochila', categoria: 'descanso_abrigo', slotsCarga: 2, custo: 100, riquezaMinima: 'classe_media_baixa', tracos: ['Adicional Descanso', 'Defensivo'], desc: 'Protege contra intempéries leves. Caso atacados por inimigos, dispara instantaneamente impedindo surpresa e concedendo 1 reação livre.' },
  { id: 'tenda_expedicao', nome: 'Local de Descanso Portátil (Tenda de Expedição)', slot: 'costas', categoria: 'descanso_abrigo', slotsCarga: 3, custo: 180, riquezaMinima: 'classe_media_alta', tracos: ['Abrigo Coletivo'], desc: 'Abriga confortavelmente 2 personagens com proteção plena contra intempéries climáticas severas.' },
  { id: 'casulo_descanso_emergencial', nome: 'Local de Descanso Emergencial (Casulo / Rede Tática de Ancoragem)', slot: 'costas', categoria: 'descanso_abrigo', slotsCarga: 2, custo: 200, riquezaMinima: 'classe_media_alta', tracos: ['Abrigo Emergencial'], desc: 'Rede/casulo fixável em superfícies verticais, copas de árvores ou paredões para descanso seguro.' },

  // Arte, Social & Veículos
  { id: 'instrumento_musical_pequeno', nome: 'Instrumento Musical Pequeno (Flauta / Gaita / Pandeiro)', slot: 'acessorios', categoria: 'social_arte', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Musical', 'Auxiliar'], desc: 'Concede +1d6 em 1 teste de Social por cena ou +1 ponto de Anima recuperado aos ouvintes durante Descanso Curto.' },
  { id: 'instrumento_musical_medio', nome: 'Instrumento Musical Médio (Violão / Alaúde / Tambor)', slot: 'costas', categoria: 'social_arte', slotsCarga: 2, custo: 100, riquezaMinima: 'classe_media_baixa', tracos: ['Musical', 'Auxiliar'], desc: 'Concede +1d6 em até 2 testes de Social na cena e inspira aliados com +2 Anima no descanso.' },
  { id: 'instrumento_musical_grande', nome: 'Instrumento Musical Grande (Harmônio / Violoncelo)', slot: 'costas', categoria: 'social_arte', slotsCarga: 5, custo: 500, riquezaMinima: 'milionario', tracos: ['Musical', 'Monumental'], desc: 'Concede +2d6 em testes de Performance/Corte e recupera +1d6 de Anima para todo o grupo em descansos.' },
  { id: 'jogos_portateis', nome: 'Jogos Portáteis (Baralho / Dados de Aposta / Tarot)', slot: 'acessorios', categoria: 'social_arte', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Social', 'Recreativo'], desc: 'Estojo para jogos e leituras oraculares. Concede +1d6 em testes de Social em tavernas e jogos.' },
  { id: 'simbolo_cultural', nome: 'Objeto Simbólico e Cultural (Insígnia / Brasão)', slot: 'acessorios', categoria: 'social_arte', slotsCarga: 1, custo: 40, riquezaMinima: 'pobre', tracos: ['Social', 'Diplomacia'], desc: 'Concede +1d6 em testes de Social na primeira impressão com personagens da mesma cultura ou facção.' },

  // Ferramentas, Utilitários & Carga
  { id: 'fonte_energia', nome: 'Fonte de Energia (Bateria / Cristal de Éter / Célula de Combustível)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 100, riquezaMinima: 'classe_media_baixa', tracos: ['Consumível', 'Energizador'], desc: 'Unidade com 6 cargas de energia para abastecer artefatos e maquinários.' },
  { id: 'fonte_luz', nome: 'Fonte de Luz (Lanterna / Tocha Alquímica)', slot: 'mao_secundaria', categoria: 'utilitarios_ferramentas', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Iluminação', 'Utilitário'], desc: 'Ilumina 15 metros em raio. Gasta 1 carga de energia a cada 3 cenas (ou 5h de uso contínuo).' },
  { id: 'fonte_calor', nome: 'Fonte de Calor (Aquecedor Rúnico / Brasero Portátil)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Térmico', 'Sobrevivência'], desc: 'Aquece 15m² por 4 cenas protegendo contra frio extremo. Consome 1 carga de energia.' },
  { id: 'recarregador_energia', nome: 'Recarregador Portátil de Energia (Coletor Solar / Cinético)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 350, riquezaMinima: 'rico', tracos: ['Sustentável', 'Utilitário'], desc: 'Exposto ao ambiente natural por 4 horas ou Descanso Longo, recupera 1 carga para bateria (máx 10 cargas).' },
  { id: 'ferramentas_simples', nome: 'Conjunto de Ferramentas Simples', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Geral', 'Utilitário'], desc: 'Estojo multiuso para reparos simples e desmonte de objetos sem penalidades por falta de equipamento.' },
  { id: 'ferramentas_especializadas', nome: 'Conjunto de Ferramentas Especializadas', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 150, riquezaMinima: 'classe_media_baixa', tracos: ['Especializado'], desc: 'Requer especialização (Mecânica/Engenharia/Ladinagem). Concede +1d6 de bônus e habilita feitos técnicos complexos.' },
  { id: 'prendedores', nome: 'Prendedores (Grampos de Escalada / Fixadores Rápidos)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 1, custo: 20, riquezaMinima: 'miseravel', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Conjunto com 6 ancoradores rápidos para fixar cordas e equipamentos com firmeza absoluta.' },
  { id: 'protetor_risco_ambiental', nome: 'Protetor de Risco Ambiental (Máscara de Gás / Traje de Radiação)', slot: 'cabeca', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 200, riquezaMinima: 'classe_media_alta', tracos: ['Imunidade Ambiental'], desc: 'Concede imunidade total a um risco ambiental passivo (gases tóxicos, esporos fúngicos ou radiação).' },
  { id: 'armazenamento_medio', nome: 'Objeto de Armazenamento Médio (Bornal Tático / Bolsa de Cintura)', slot: 'acessorios', categoria: 'utilitarios_ferramentas', slotsCarga: 0, custo: 120, riquezaMinima: 'classe_media_baixa', tracos: ['Ampliador de Carga', 'Limitado (3 por personagem)'], desc: 'Concede +4 slots adicionais na mochila para itens de até 2 slots. Limite de 3 por personagem.' },
  { id: 'armazenamento_grande', nome: 'Objeto de Armazenamento Grande (Mochila de Grande Expedição)', slot: 'costas', categoria: 'utilitarios_ferramentas', slotsCarga: 0, custo: 160, riquezaMinima: 'classe_media_alta', tracos: ['Ampliador de Carga', 'Limitado (1 por personagem)'], desc: 'Concede +8 slots adicionais de capacidade na mochila para itens de até 4 slots. Limite de 1 por personagem.' },
  { id: 'facilitador_uso_saque', nome: 'Objeto Facilitador de Uso (Coldre de Saque Rápido / Bainha Magnética)', slot: 'acessorios', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 60, riquezaMinima: 'pobre', tracos: ['Facilitador', 'Limitado (1 por personagem)'], desc: 'Cria 3 Espaços Rápidos. Itens de 1 slot neles podem ser sacados como Ação Livre (0 ações) 1x por rodada.' },
  { id: 'recipiente_lacrado', nome: 'Recipiente Lacrado (Frascos Herméticos / Recipiente Blindado)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 100, riquezaMinima: 'classe_media_baixa', tracos: ['Empilhável (até 12)', 'Isolamento'], desc: 'Permite transportar substâncias corrosivas, inflamáveis ou contagiosas sem vazamento.' },
  { id: 'purificador', nome: 'Purificador (Destilador Alquímico / Filtro de Éter)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Purificação', 'Utilitário'], desc: 'Torna águas e rações contaminadas potáveis e permite isolar venenos em frascos separados.' },

  // Sensores & Comunicação
  { id: 'comunicador_pequeno', nome: 'Comunicador Pequeno (Curto Alcance)', slot: 'acessorios', categoria: 'comunicacao_sensores', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Comunicação'], desc: 'Conjunto de 4 microtransceptores para áudio nítido em até 500 metros.' },
  { id: 'comunicador_medio', nome: 'Comunicador Médio (Médio Alcance)', slot: 'costas', categoria: 'comunicacao_sensores', slotsCarga: 2, custo: 120, riquezaMinima: 'classe_media_baixa', tracos: ['Comunicação'], desc: 'Conjunto de 4 rádio-transmissores ou espelhos mágicos pareados com alcance de até 15 km.' },
  { id: 'comunicador_grande', nome: 'Comunicador Grande (Longo Alcance / Estação Global)', slot: 'costas', categoria: 'comunicacao_sensores', slotsCarga: 3, custo: 240, riquezaMinima: 'classe_media_alta', tracos: ['Comunicação', 'Carga Pesada'], desc: 'Estação portátil de transmissão continental sem limite de distância.' },
  { id: 'retentor_informacoes', nome: 'Retentor de Informações (Codex Digital / Caderno Oculto)', slot: 'mochila', categoria: 'comunicacao_sensores', slotsCarga: 1, custo: 100, riquezaMinima: 'classe_media_baixa', tracos: ['Dados', 'Registro'], desc: 'Armazena mapas, áudios, pistas e o diário de bordo da campanha.' },
  { id: 'sensor_variado', nome: 'Sensor Variado (Bússola Arcana / Detector Específico)', slot: 'mochila', categoria: 'comunicacao_sensores', slotsCarga: 2, custo: 150, riquezaMinima: 'classe_media_baixa', tracos: ['Investigação'], desc: 'Radar configurado para detectar substâncias, venenos, radiação ou anomalias de Anima em 50m.' },
  { id: 'localizador', nome: 'Localizador (Transmissor Rastreador)', slot: 'mochila', categoria: 'comunicacao_sensores', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Rastreio'], desc: 'Emissor de sinal fixável em alvos ou veículos, rastreável pelo Retentor de Informações.' },
  { id: 'possibilitador_percepcao', nome: 'Possibilitador de Percepção (Visor Noturno / Óculos Espectrais)', slot: 'cabeca', categoria: 'comunicacao_sensores', slotsCarga: 2, custo: 140, riquezaMinima: 'classe_media_baixa', tracos: ['Percepção Especial'], desc: 'Visão no escuro absoluto e rastreio de fluxos de energia ou pegadas invisíveis (1 carga por cena).' },
  { id: 'facilitador_percepcao', nome: 'Facilitador de Percepção (Luneta de Precisão / Lupa de Investigação)', slot: 'acessorios', categoria: 'comunicacao_sensores', slotsCarga: 1, custo: 120, riquezaMinima: 'classe_media_baixa', tracos: ['Percepção Fina', 'Auxiliar'], desc: 'Concede +1d6 em testes de Mente voltados para Investigação e Percepção Fina.' },
  { id: 'objeto_informativo', nome: 'Objeto Informativo (Guia Regional / Bestiário de Campo)', slot: 'mochila', categoria: 'comunicacao_sensores', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Conhecimento', 'Auxiliar'], desc: '1x por sessão: Concede +1d6 em testes de Mente ao pesquisar sobre fauna, monstros, flora ou geografia local.' },

  // Proteções & Escudos
  { id: 'armadura_leve', nome: 'Armadura Leve (Gibão de Couro Batido / Traje Balístico)', slot: 'tronco', categoria: 'protecoes', slotsCarga: 2, custo: 250, riquezaMinima: 'classe_media_alta', bonusDefesa: 1, tracos: ['Proteção', 'Armadura Leve'], desc: 'Vestida no Tronco. Concede +1 de Defesa Total sem penalidades de mobilidade.' },
  { id: 'armadura_media', nome: 'Armadura Média (Cota de Malha / Brigantina Reforçada)', slot: 'tronco', categoria: 'protecoes', slotsCarga: 2, custo: 500, riquezaMinima: 'milionario', bonusDefesa: 2, tracos: ['Proteção', 'Armadura Média', 'Req: Corpo 2d6', 'Penalidade: -1m mov, -1d6 furtividade'], desc: 'Vestida no Tronco. Concede +2 de Defesa Total. Requer Corpo 2d6, reduz movimento em -1m por ação e impõe -1d6 em Furtividade.' },
  { id: 'armadura_pesada', nome: 'Armadura Pesada (Meia-Armadura de Placas de Aço)', slot: 'tronco', categoria: 'protecoes', slotsCarga: 3, custo: 1000, riquezaMinima: 'milionario', bonusDefesa: 3, tracos: ['Proteção', 'Armadura Pesada', 'Req: Corpo 3d6', 'Penalidade: -2m mov, -2d6 furtividade'], desc: 'Vestida no Tronco. Concede +3 de Defesa Total. Requer Corpo 3d6, reduz movimento em -2m por ação e impõe -2d6 em Furtividade.' },
  { id: 'armadura_completa', nome: 'Armadura Completa (Placas Completas / Traje de Exotitânio)', slot: 'tronco', categoria: 'protecoes', slotsCarga: 4, custo: 1500, riquezaMinima: 'milionario', bonusDefesa: 4, tracos: ['Proteção', 'Armadura Completa', 'Req: Corpo 4d6', 'Penalidade: -3m mov, -3d6 furtividade', 'Carga Pesada'], desc: 'Vestida no Tronco. Concede +4 de Defesa Total. Requer Corpo 4d6, reduz movimento em -3m por ação e impõe -3d6 em Furtividade.' },
  { id: 'escudo_pequeno', nome: 'Escudo Pequeno (Broquel / Escudo de Braço)', slot: 'mao_secundaria', categoria: 'protecoes', slotsCarga: 1, custo: 300, riquezaMinima: 'rico', bonusDefesa: 1, tracos: ['Proteção', 'Escudo Leve'], desc: 'Equipado na Mão Secundária. Concede +1 de Defesa Total sem penalidades de mobilidade.' },
  { id: 'escudo_medio', nome: 'Escudo Médio (Escudo de Duelo / Gota)', slot: 'mao_secundaria', categoria: 'protecoes', slotsCarga: 2, custo: 400, riquezaMinima: 'rico', bonusDefesa: 2, tracos: ['Proteção', 'Escudo', 'Req: Corpo 2d6', 'Penalidade: -1m mov'], desc: 'Equipado na Mão Secundária. Concede +2 de Defesa Total. Requer Corpo 2d6 e reduz movimento em -1m por ação.' },
  { id: 'escudo_grande', nome: 'Escudo Grande (Escudo de Infantaria / Torre)', slot: 'mao_secundaria', categoria: 'protecoes', slotsCarga: 2, custo: 500, riquezaMinima: 'milionario', bonusDefesa: 3, tracos: ['Proteção', 'Escudo Pesado', 'Req: Corpo 3d6', 'Penalidade: -2m mov, -1d6 furtividade'], desc: 'Equipado na Mão Secundária. Concede +3 de Defesa Total. Requer Corpo 3d6, reduz movimento em -2m e impõe -1d6 em Furtividade.' },
  { id: 'escudo_enorme', nome: 'Escudo Enorme (Pavise / Baluarte Móvel)', slot: 'mao_secundaria', categoria: 'protecoes', slotsCarga: 3, custo: 600, riquezaMinima: 'milionario', bonusDefesa: 4, tracos: ['Proteção', 'Escudo Baluarte', 'Req: Corpo 4d6', 'Penalidade: -3m mov, -2d6 furtividade', 'Carga Pesada'], desc: 'Equipado na Mão Secundária. Concede +4 de Defesa Total e cobertura sólida. Requer Corpo 4d6, reduz movimento em -3m e impõe -2d6 em Furtividade.' },

  // Armas & Focos
  { id: 'orbe_magia', nome: 'Orbe de Magia (Foco Primordial)', slot: 'mao_secundaria', categoria: 'armas_focos', slotsCarga: 1, custo: 900, riquezaMinima: 'milionario', tracos: ['Foco Arcano', 'Mágico'], desc: 'Equipado na Mão Secundária/Acessórios. Permite manifestar 1 Poder Arcano de maior potência sem o sacrifício requerido.' },
  { id: 'cajado_arcano', nome: 'Cajado Arcano (Canalizador de Éter)', slot: 'mao_primaria', categoria: 'armas_focos', slotsCarga: 2, custo: 1000, riquezaMinima: 'milionario', dano: '1d6+2', tracos: ['Foco Arcano', 'Canalizador', 'Mágico', 'Duas Mãos'], desc: 'Equipado na Mão Primária. Reduz o custo de Anima de todas as magias e poderes ativos em 50% (mínimo de 1).' },
  { id: 'grimorio_feiticos', nome: 'Grimório de Feitiços (Tomo Arcano)', slot: 'mao_secundaria', categoria: 'armas_focos', slotsCarga: 2, custo: 700, riquezaMinima: 'milionario', tracos: ['Grimório', 'Mágico'], desc: 'Equipado na Mão Secundária ou Mochila. Concede o domínio e registro de +1 Poder ou Elemento Arcano adicional na ficha.' },
  { id: 'varinha_arcana', nome: 'Varinha Arcana (Condutor de Foco)', slot: 'mao_secundaria', categoria: 'armas_focos', slotsCarga: 1, custo: 600, riquezaMinima: 'milionario', tracos: ['Foco Arcano', 'Condutor', 'Mágico'], desc: 'Empunhada na Mão Primária ou Secundária. Concede +1d6 de bônus fixo em todos os testes de conjuração mágica e canalização de Espírito.' },
  { id: 'kit_especializacao', nome: 'Kit de Especialização (Medicina, Ladinagem, etc.)', slot: 'mochila', categoria: 'utilitarios_ferramentas', slotsCarga: 1, custo: 300, riquezaMinima: 'rico', tracos: ['Especializado', 'Consumível (12 usos)', 'Auxiliar'], desc: 'Possui 12 usos vinculados à especialização escolhida. Antes de rolar um teste da perícia, gasta 1 uso para receber +1d6 na rolagem.' },
  { id: 'arma_cortante_pequena', nome: 'Arma Cortante Pequena (Adaga/Faca)', dano: '1d4+1', riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Leve'], desc: 'Lâmina ágil para combate corpo a corpo rápido.' },
  { id: 'arma_cortante_grande', nome: 'Arma Cortante Grande (Espada Longa/Machado)', dano: '1d6+2', riquezaMinima: 'classe_media_baixa', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada'], desc: 'Lâmina nobre forjada em aço temperado.' },
  { id: 'arma_impactante_pequena', nome: 'Arma Impactante Pequena (Porrete/Clava)', dano: '1d6+2', riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: [], desc: 'Clava resistente de madeira ou ferro fundido.' },
  { id: 'arma_impactante_grande', nome: 'Arma Impactante Grande (Marreta/Martelo de Guerra)', dano: '1d8+3', riquezaMinima: 'classe_media_alta', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Pesada'], desc: 'Impacto esmagador que quebra escudos e ossos.' },
  { id: 'arma_perfurante_pequena', nome: 'Arma Perfurante Pequena (Estilete/Florete Leve)', dano: '1d4+3', riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Perfuração'], desc: 'Lâmina pontiaguda para perfurar pontos fracos.' },
  { id: 'arma_perfurante_grande', nome: 'Arma Perfurante Grande (Lança/Pique)', dano: '1d6+4', riquezaMinima: 'classe_media_alta', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Alcance'], desc: 'Lança reforçada com ponta de aço e alcance tático.' },
  { id: 'arma_de_haste', nome: 'Arma de Haste (Alabarda/Glaive)', dano: '1d10+2', riquezaMinima: 'rico', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Longa', 'Duas Mãos'], desc: 'Arma imponente de duas mãos para controle de espaço.' },
  { id: 'chicote', nome: 'Chicote de Couro Rúnico', dano: '1d8+2', riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Longa', 'Laço'], desc: 'Arma flexível para desarmar e imobilizar oponentes.' },
  { id: 'arma_de_arremesso', nome: 'Adagas de Arremesso (Conjunto com 3)', dano: '1d4', riquezaMinima: 'miseravel', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Munição (3)'], desc: 'Conjunto balanceado de facas finas para arremesso.' },
  { id: 'arco_e_flecha', nome: 'Arco e Flecha Caçador', dano: '1d6+3', riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Munição (12)', 'Recarregável'], desc: 'Arco longo recurvo para disparos silenciosos.' },
  { id: 'arremessador', nome: 'Funda / Arremessador de Projéteis', dano: '1d4+2', riquezaMinima: 'miseravel', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Recarregável'], desc: 'Tira de couro reforçado para projetar esferas metálicas.' },
  { id: 'fogo_pequena_fraca', nome: 'Pistola Leve Calibre Curto', dano: '2d4', riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (6)'], desc: 'Pistola compacta de porte veloz e recuo moderado.' },
  { id: 'fogo_pequena_forte', nome: 'Revólver Pesado / Magnum', dano: '2d6+3', riquezaMinima: 'classe_media_baixa', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (8)'], desc: 'Tambor reforçado com disparos de alto poder de parada.' },
  { id: 'fogo_media_fraca', nome: 'Carabina de Repetição Leve', dano: '2d8+2', riquezaMinima: 'classe_media_baixa', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (12)'], desc: 'Fuzil leve com sistema ágil por alavanca.' },
  { id: 'fogo_media_forte', nome: 'Espingarda de Cano Duplo', dano: '2d8+4', riquezaMinima: 'classe_media_alta', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (14)', 'Impacto'], desc: 'Dispersão letal de chumbo a curta distância.' },
  { id: 'fogo_grande_fraca', nome: 'Rifle de Longo Alcance', dano: '2d10+4', riquezaMinima: 'classe_media_alta', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (16)', 'Longo Alcance'], desc: 'Rifle de caça pesado com alcance kilométrico.' },
  { id: 'fogo_grande_forte', nome: 'Rifle de Precisão de Elite', dano: '2d10+6', riquezaMinima: 'rico', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (18)', 'Perfurante'], desc: 'Lentes com ajuste balístico e munição blindada.' },
  { id: 'fogo_especial_fraca', nome: 'Armamento Pesado Automático', dano: '2d12+6', riquezaMinima: 'rico', atributo: 'mente', slotsCarga: 3, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (20)', 'Rajada'], desc: 'Metralhadora com cadência de disparo avassaladora.' },
  { id: 'fogo_especial_forte', nome: 'Canhão Portátil Rúnico', dano: '2d12+8', riquezaMinima: 'milionario', atributo: 'mente', slotsCarga: 3, slot: 'mao_primaria', categoria: 'armas_focos', tracos: ['Especializada', 'Recarregável', 'Munição (22)', 'Devastador'], desc: 'Dispositivo arcanotécnico destruidor de estruturas.' },

  // Vestimentas & Acessórios
  { id: 'capuz_couro', nome: 'Capuz de Couro e Lã', slot: 'cabeca', categoria: 'social_arte', slotsCarga: 0, custo: 20, riquezaMinima: 'miseravel', bonusDefesa: 0, desc: 'Protege contra intempéries e oculta o semblante.' },
  { id: 'elmo_ferro', nome: 'Elmo de Ferro Forjado', slot: 'cabeca', categoria: 'protecoes', slotsCarga: 1, custo: 100, riquezaMinima: 'classe_media_baixa', bonusDefesa: 0, desc: 'Proteção robusta contra golpes contundentes.' },
  { id: 'oculos_precisao', nome: 'Óculos de Lentes de Precisão', slot: 'cabeca', categoria: 'comunicacao_sensores', slotsCarga: 0, custo: 140, riquezaMinima: 'classe_media_alta', bonusDefesa: 0, desc: 'Melhora a acuidade visual e inspeção de detalhes.' },
  { id: 'mascara_gas', nome: 'Máscara Rúnica Respiratória / Anti-Gás', slot: 'cabeca', categoria: 'utilitarios_ferramentas', slotsCarga: 1, custo: 200, riquezaMinima: 'rico', bonusDefesa: 0, desc: 'Filtra toxinas, vapores do Vazio e fumaça densa.' },
  { id: 'mochila_aventureiro', nome: 'Mochila de Couro Reforçada', slot: 'costas', categoria: 'utilitarios_ferramentas', slotsCarga: 0, custo: 80, riquezaMinima: 'pobre', bonusSlots: 2, desc: 'Aumenta a capacidade de carga do herói em +2 slots.' },
  { id: 'capa_viagem', nome: 'Capa de Viagem Impermeável', slot: 'costas', categoria: 'descanso_abrigo', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Resiste a chuva, lama e ventos cortantes.' },
  { id: 'aljava_flechas', nome: 'Aljava Rígida de Caça', slot: 'costas', categoria: 'armas_focos', slotsCarga: 1, custo: 40, riquezaMinima: 'pobre', desc: 'Armazena com segurança até 24 flechas ou virotes.' },
  { id: 'coldre_duplo', nome: 'Coldre Duplo de Ombro', slot: 'costas', categoria: 'armas_focos', slotsCarga: 0, custo: 100, riquezaMinima: 'classe_media_baixa', desc: 'Permite saque rápido de armas de porte leve.' },
  { id: 'calcas_couro', nome: 'Calças de Couro Tratado', slot: 'pernas', categoria: 'social_arte', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Resistentes e confortáveis para longas jornadas.' },
  { id: 'caneleiras_aco', nome: 'Caneleiras de Aço Reforçado', slot: 'pernas', categoria: 'protecoes', slotsCarga: 1, custo: 110, riquezaMinima: 'classe_media_baixa', desc: 'Protegem contra armadilhas de solo e impactos baixos.' },
  { id: 'calcas_nobreza', nome: 'Calças de Seda Nobre com Fios de Ouro', slot: 'pernas', categoria: 'social_arte', slotsCarga: 0, custo: 350, riquezaMinima: 'rico', desc: 'Demonstra prestígio social inegável perante cortesãos.' },
  { id: 'botas_viagem', nome: 'Botas de Couro de Viagem', slot: 'pes', categoria: 'social_arte', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Duráveis, impermeáveis e anatômicas.' },
  { id: 'botas_infantaria', nome: 'Botas Pesadas de Infantaria com Biqueira de Aço', slot: 'pes', categoria: 'protecoes', slotsCarga: 1, custo: 100, riquezaMinima: 'classe_media_baixa', desc: 'Excelente estabilidade em terrenos acidentados.' },
  { id: 'sapatos_gala', nome: 'Sapatos Envernizados de Gala', slot: 'pes', categoria: 'social_arte', slotsCarga: 0, custo: 200, riquezaMinima: 'classe_media_alta', desc: 'Apropriados para banquetes e ambientes da alta sociedade.' },
  { id: 'anel_sinete', nome: 'Anel de Sinete da Família', slot: 'acessorios', categoria: 'social_arte', slotsCarga: 0, custo: 180, riquezaMinima: 'classe_media_alta', desc: 'Símbolo heráldico usado para lacrar documentos e atestar linhagem.' },
  { id: 'amuleto_protecao', nome: 'Amuleto Protetor Talhado em Obsidiana', slot: 'acessorios', categoria: 'saude_mente', slotsCarga: 0, custo: 80, riquezaMinima: 'pobre', desc: 'Talismã com gravuras protetoras contra o Vazio.' },
  { id: 'relogio_bolso', nome: 'Relógio de Bolso de Precisão a Corda', slot: 'acessorios', categoria: 'comunicacao_sensores', slotsCarga: 0, custo: 160, riquezaMinima: 'classe_media_alta', desc: 'Mede as horas exatas com mecanismo de engrenagens de precisão.' },
  { id: 'cantil_prata', nome: 'Cantil de Prata Maciça', slot: 'acessorios', categoria: 'utilitarios_ferramentas', slotsCarga: 0, custo: 100, riquezaMinima: 'classe_media_baixa', desc: 'Preserva bebidas puras e ressalta a elegância do aventureiro.' }
];

document.addEventListener('DOMContentLoaded', async () => {
  await carregarEspecializacoes();
  await carregarCompendio();
  atualizarHUDAtributos();
  atualizarPainelMochila();
  renderizarOpcoesSilhueta();
  atualizarPreviewDefesa();
  await carregarCampanhasDisponiveis();
});

// ==========================================
// CARREGAMENTO DE CAMPANHAS
// ==========================================

async function carregarCampanhasDisponiveis() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedCampaignId = urlParams.get('campaignId') || urlParams.get('campaign') || urlParams.get('id');
    const selectCampaign = document.getElementById('input-campanha');
    if (!selectCampaign) return;

    const res = await apiClient.sync('campaign.list', {});
    if (res && res.sucesso && Array.isArray(res.dados) && res.dados.length > 0) {
      selectCampaign.innerHTML = '<option value="" disabled selected>Selecione a campanha para o seu personagem...</option>';
      res.dados.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name || 'Campanha #' + c.id} (Sistema: ${c.system || 'AlphaD6'})`;
        if (preselectedCampaignId && String(c.id) === String(preselectedCampaignId)) {
          opt.selected = true;
        }
        selectCampaign.appendChild(opt);
      });

      // Se só houver 1 campanha e nenhuma pré-selecionada, auto-seleciona
      if (res.dados.length === 1 && !preselectedCampaignId) {
        selectCampaign.selectedIndex = 1;
      }
    } else {
      selectCampaign.innerHTML = '<option value="" disabled selected>⚠️ Nenhuma campanha ativa encontrada. Crie ou entre em uma campanha primeiro!</option>';
    }
  } catch (err) {
    console.warn('Não foi possível carregar campanhas ativas:', err);
  }
}

// ==========================================
// PASSO 1 & 2: ATRIBUTOS & DERIVADOS
// ==========================================

function alterarAtributo(attrKey, delta) {
  const atual = criacaoState.atributos[attrKey] || 1;
  const novo = atual + delta;
  if (novo < 1 || novo > 4) return;

  const somaAtual = Object.values(criacaoState.atributos).reduce((a, b) => a + b, 0);
  const somaNova = somaAtual + delta;

  // No nível 1, a soma dos 4 atributos deve ser exatamente 10 (4 base + 6 livres)
  if (somaNova > 10 && delta > 0) return;

  criacaoState.atributos[attrKey] = novo;
  atualizarHUDAtributos();
  atualizarPainelMochila();
  atualizarEstadoEspecializacoesAposMudancaMente();
}

function atualizarHUDAtributos() {
  const attrs = criacaoState.atributos;
  for (const [k, v] of Object.entries(attrs)) {
    const valEl = document.getElementById(`val-${k}`);
    if (valEl) valEl.textContent = v;
    const badgeEl = document.getElementById(`badge-${k}`);
    if (badgeEl) badgeEl.textContent = `${v}d6`;
  }

  const soma = Object.values(attrs).reduce((a, b) => a + b, 0);
  criacaoState.pontosLivresRestantes = Math.max(0, 10 - soma);
  
  const bannerPts = document.getElementById('pontos-restantes-banner');
  if (bannerPts) bannerPts.textContent = criacaoState.pontosLivresRestantes;

  // Atualiza indicadores de Mente no Passo 3
  const specMenteTotal = document.getElementById('spec-mente-total');
  if (specMenteTotal) specMenteTotal.textContent = attrs.mente;

  atualizarBannerPontosEspecializacao();
}

// ==========================================
// PASSO 3: ESPECIALIZAÇÕES & CATÁLOGO (ALPHAD6)
// ==========================================

async function carregarEspecializacoes() {
  const countLabel = document.getElementById('spec-catalog-count');
  try {
    const res = await apiClient.sync('rpg.compendium.specializations', {});
    if (res && res.sucesso && Array.isArray(res.dados) && res.dados.length > 0) {
      criacaoState.especializacoesCatalogo = res.dados;
    } else {
      criacaoState.especializacoesCatalogo = SPECIALIZATIONS_FALLBACK;
    }
  } catch (err) {
    console.warn('Compêndio de especializações online indisponível, usando fallback local:', err);
    criacaoState.especializacoesCatalogo = SPECIALIZATIONS_FALLBACK;
  }

  if (countLabel) {
    countLabel.textContent = `${criacaoState.especializacoesCatalogo.length} perícias disponíveis`;
  }

  renderizarCatalogoEspecializacoes();
  renderizarPainelEspecializacoesSelecionadas();
}

function filtrarEspecializacoesCategoria(cat) {
  criacaoState.filtroSpecCategoria = cat;

  // Atualiza classe active nos botões
  const btns = document.querySelectorAll('#spec-filters-container .compendium-filter-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (window.event && window.event.target) {
    window.event.target.classList.add('active');
  }

  renderizarCatalogoEspecializacoes();
}

function filtrarEspecializacoes() {
  const searchInput = document.getElementById('spec-search-input');
  criacaoState.buscaSpecTexto = searchInput ? searchInput.value.trim().toLowerCase() : '';
  renderizarCatalogoEspecializacoes();
}

function calcularTotalPontosEspecializacaoAlocados() {
  return Object.values(criacaoState.especializacoesAlocadas).reduce((acc, item) => acc + (item.nivel || 0), 0);
}

function atualizarBannerPontosEspecializacao() {
  const menteTotal = criacaoState.atributos.mente;
  const totalAlocado = calcularTotalPontosEspecializacaoAlocados();
  const pontosRestantes = Math.max(0, menteTotal - totalAlocado);

  const banner = document.getElementById('pontos-especializacao-banner');
  if (banner) banner.textContent = pontosRestantes;

  const summary = document.getElementById('spec-selected-summary');
  if (summary) summary.textContent = `${totalAlocado} / ${menteTotal} ponto(s) alocado(s)`;
}

function atualizarEstadoEspecializacoesAposMudancaMente() {
  const menteTotal = criacaoState.atributos.mente;
  let totalAlocado = calcularTotalPontosEspecializacaoAlocados();

  // Se o total de pontos alocados ultrapassar o novo valor de Mente, reduz proporcionalmente
  if (totalAlocado > menteTotal) {
    for (const specId of Object.keys(criacaoState.especializacoesAlocadas)) {
      while (criacaoState.especializacoesAlocadas[specId]?.nivel > 0 && totalAlocado > menteTotal) {
        criacaoState.especializacoesAlocadas[specId].nivel -= 1;
        totalAlocado -= 1;
        if (criacaoState.especializacoesAlocadas[specId].nivel === 0) {
          delete criacaoState.especializacoesAlocadas[specId];
          break;
        }
      }
      if (totalAlocado <= menteTotal) break;
    }
  }

  atualizarBannerPontosEspecializacao();
  renderizarCatalogoEspecializacoes();
  renderizarPainelEspecializacoesSelecionadas();
}

function alterarRankEspecializacao(specId, delta) {
  const menteTotal = criacaoState.atributos.mente;
  const totalAlocado = calcularTotalPontosEspecializacaoAlocados();
  const atual = criacaoState.especializacoesAlocadas[specId]?.nivel || 0;
  const novoNivel = atual + delta;

  if (novoNivel < 0) return;
  if (novoNivel > 3) {
    alert('O limite máximo por especialização é Nível 3 (+3d6).');
    return;
  }

  if (delta > 0 && totalAlocado >= menteTotal) {
    alert(`Você já distribuiu todos os ${menteTotal} pontos de especialização disponíveis.`);
    return;
  }

  const specInfo = criacaoState.especializacoesCatalogo.find(s => s.id === specId) || SPECIALIZATIONS_FALLBACK.find(s => s.id === specId);
  if (!specInfo) return;

  if (novoNivel === 0) {
    delete criacaoState.especializacoesAlocadas[specId];
  } else {
    criacaoState.especializacoesAlocadas[specId] = {
      ...specInfo,
      nivel: novoNivel,
      bonusDados: novoNivel
    };
  }

  atualizarBannerPontosEspecializacao();
  renderizarCatalogoEspecializacoes();
  renderizarPainelEspecializacoesSelecionadas();
}

function renderizarCatalogoEspecializacoes() {
  const grid = document.getElementById('spec-items-grid');
  if (!grid) return;

  let specs = criacaoState.especializacoesCatalogo;
  const filtroCat = criacaoState.filtroSpecCategoria;
  const busca = criacaoState.buscaSpecTexto;

  if (filtroCat && filtroCat !== 'todos') {
    specs = specs.filter(s => s.categoria.toLowerCase() === filtroCat.toLowerCase());
  }

  if (busca) {
    specs = specs.filter(s => s.nome.toLowerCase().includes(busca) || s.desc.toLowerCase().includes(busca) || s.categoria.toLowerCase().includes(busca));
  }

  if (specs.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 2rem; grid-column: 1 / -1;">Nenhuma perícia encontrada com os filtros atuais.</div>';
    return;
  }

  const menteTotal = criacaoState.atributos.mente;
  const totalAlocado = calcularTotalPontosEspecializacaoAlocados();
  const pontosRestantes = Math.max(0, menteTotal - totalAlocado);

  grid.innerHTML = specs.map(s => {
    const alocado = criacaoState.especializacoesAlocadas[s.id];
    const nivel = alocado?.nivel || 0;
    const isAllocated = nivel > 0;
    const canIncrement = nivel < 3 && pontosRestantes > 0;
    const canDecrement = nivel > 0;

    const rankLabel = nivel === 0 ? 'Não Treinada' : `Nível ${nivel} (+${nivel}d6)`;
    const attrClass = `spec-attr-${s.atributo.toLowerCase()}`;

    return `
      <div class="spec-card ${isAllocated ? 'allocated' : ''}" id="spec-card-${s.id}">
        <div>
          <div class="spec-card-header">
            <span class="spec-name">${s.nome}</span>
            <span class="spec-attr-badge ${attrClass}">${s.atributo}</span>
          </div>
          <p class="spec-desc" style="margin-top: 0.35rem;">${s.desc}</p>
        </div>

        <div class="spec-controls">
          <span class="spec-rank-badge ${nivel === 3 ? 'maxed' : ''}">${rankLabel}</span>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="btn-spec-rank" onclick="alterarRankEspecializacao('${s.id}', -1)" ${!canDecrement ? 'disabled' : ''} title="Diminuir Nível">-</button>
            <span style="font-weight: 700; font-size: 0.9rem; min-width: 14px; text-align: center;">${nivel}</span>
            <button type="button" class="btn-spec-rank" onclick="alterarRankEspecializacao('${s.id}', +1)" ${!canIncrement ? 'disabled' : ''} title="Aumentar Nível">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderizarPainelEspecializacoesSelecionadas() {
  const listEl = document.getElementById('spec-selected-list');
  if (!listEl) return;

  const entries = Object.values(criacaoState.especializacoesAlocadas);

  if (entries.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 2rem 0; font-size: 0.85rem;">
        Nenhuma perícia selecionada.<br>Clique nos botões <strong>[+]</strong> no catálogo ao lado para alocar seus pontos de Mente.
      </div>
    `;
    return;
  }

  listEl.innerHTML = entries.map(item => `
    <div class="spec-selected-entry">
      <div>
        <div style="font-weight: 700; color: var(--gold-light);">${item.nome}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          Nível ${item.nivel} ➔ <strong style="color: var(--accent-cyan);">+${item.nivel}d6 de bônus</strong> (${item.atributo.toUpperCase()})
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.25rem;">
        <button type="button" class="btn-spec-rank" onclick="alterarRankEspecializacao('${item.id}', -1)" title="Diminuir Nível">-</button>
        <button type="button" class="btn-spec-rank" onclick="alterarRankEspecializacao('${item.id}', +1)" ${item.nivel >= 3 || calcularTotalPontosEspecializacaoAlocados() >= criacaoState.atributos.mente ? 'disabled' : ''} title="Aumentar Nível">+</button>
      </div>
    </div>
  `).join('');
}

// ==========================================
// PASSO 5: COMPÊNDIO & MOCHILA DE ITENS
// ==========================================

async function carregarCompendio() {
  const countLabel = document.getElementById('compendium-count');
  try {
    const res = await apiClient.sync('rpg.compendium.items', {});
    if (res && res.sucesso && Array.isArray(res.dados) && res.dados.length > 0) {
      criacaoState.compendioCompleto = res.dados;
    } else {
      criacaoState.compendioCompleto = COMPENDIO_FALLBACK;
    }
  } catch (err) {
    console.warn('Compêndio online não disponível, usando compêndio local canônico:', err);
    criacaoState.compendioCompleto = COMPENDIO_FALLBACK;
  }

  if (countLabel) {
    countLabel.textContent = `${criacaoState.compendioCompleto.length} itens disponíveis`;
  }

  renderizarCatalogoCompendio();
}

function filtrarCompendio(categoria) {
  criacaoState.filtroCompendioAtual = categoria;
  
  document.querySelectorAll('.compendium-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (window.event && window.event.target) {
    window.event.target.classList.add('active');
  }

  renderizarCatalogoCompendio();
}

function renderizarCatalogoCompendio() {
  const listContainer = document.getElementById('compendium-items-list');
  if (!listContainer) return;

  let itens = criacaoState.compendioCompleto;
  const filtro = criacaoState.filtroCompendioAtual;

  if (filtro === 'armas_focos' || filtro === 'armas') {
    itens = itens.filter(i => i.categoria === 'armas_focos' || i.categoria === 'Arma Branca' || i.categoria === 'Arma de Fogo' || i.categoria === 'Disparo' || i.categoria === 'Arremesso' || i.categoria === 'Focos Arcanos & Mágicos' || i.dano || i.slot === 'mao_primaria');
  } else if (filtro === 'protecoes') {
    itens = itens.filter(i => i.categoria === 'protecoes' || i.categoria === 'Escudos & Armaduras' || i.bonusDefesa > 0);
  } else if (filtro === 'saude_mente') {
    itens = itens.filter(i => i.categoria === 'saude_mente' || i.categoria === 'Saúde & Cura' || i.categoria === 'Foco Mental & Vontade');
  } else if (filtro === 'utilitarios_ferramentas' || filtro === 'utilitarios') {
    itens = itens.filter(i => i.categoria === 'utilitarios_ferramentas' || i.categoria === 'Ferramentas & Armazenamento' || i.categoria === 'Energia, Luz & Calor' || i.categoria === 'Kits de Especialização' || i.categoria === 'Barreiras & Próteses');
  } else if (filtro === 'descanso_abrigo') {
    itens = itens.filter(i => i.categoria === 'descanso_abrigo' || i.categoria === 'Descanso & Abrigo');
  } else if (filtro === 'comunicacao_sensores') {
    itens = itens.filter(i => i.categoria === 'comunicacao_sensores' || i.categoria === 'Comunicação & Sensores');
  } else if (filtro === 'social_arte' || filtro === 'social_veiculos' || filtro === 'vestimentas' || filtro === 'acessorios') {
    itens = itens.filter(i => i.categoria === 'social_arte' || i.categoria === 'Arte & Social' || i.categoria === 'Mobilidade & Veículos' || i.categoria === 'Vestimentas & Anatomia' || i.slot === 'acessorios' || i.slot === 'cabeca' || i.slot === 'pernas' || i.slot === 'pes' || i.slot === 'costas');
  }

  if (itens.length === 0) {
    listContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 2rem;">Nenhum item nesta categoria.</div>';
    return;
  }

  listContainer.innerHTML = itens.map(item => {
    const slotNome = formatarSlotNome(item.slot);
    const slotsCarga = item.slotsCarga !== undefined ? item.slotsCarga : 1;
    const custoInfo = item.custo ? `<span style="color: var(--gold-light); font-weight: 600;">💰 ${item.custo}P</span>` : '';
    const statsInfo = item.dano ? `⚔️ ${item.dano}` : (item.bonusDefesa ? `🛡️ +${item.bonusDefesa} Defesa` : '');

    return `
      <div class="compendium-item-card">
        <div>
          <div class="compendium-item-name">${item.nome}</div>
          <div class="compendium-item-meta">
            <span class="item-badge-slot">${slotNome}</span>
            <span class="item-badge-load">${slotsCarga} Slot(s)</span>
            ${custoInfo}
            ${statsInfo ? `<span style="color: var(--accent-cyan); font-weight: 600;">${statsInfo}</span>` : ''}
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; line-height: 1.35;">
            ${item.desc || (item.tracos ? item.tracos.join(', ') : 'Equipamento canônico do sistema.')}
          </p>
        </div>
        
        <button type="button" class="btn-add-item" onclick="adicionarItemMochila('${item.id}')">
          + Guardar na Mochila
        </button>
      </div>
    `;
  }).join('');
}

function formatarSlotNome(slot) {
  const mapa = {
    cabeca: '👑 Cabeça',
    tronco: '🛡️ Tronco',
    costas: '🧥 Costas',
    pernas: '👖 Pernas',
    mao_primaria: '⚔️ Mão Principal',
    mao_secundaria: '🛡️ Mão Secundária',
    pes: '👢 Pés',
    acessorios: '💍 Acessório',
    mochila: '🎒 Mochila'
  };
  return mapa[slot] || '🎒 Item';
}

function adicionarItemMochila(itemId) {
  const item = criacaoState.compendioCompleto.find(i => i.id === itemId) || COMPENDIO_FALLBACK.find(i => i.id === itemId);
  if (!item) return;

  criacaoState.mochila.push({ ...item, uid: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) });
  atualizarPainelMochila();
  renderizarOpcoesSilhueta();
}

function removerItemMochila(index) {
  const itemRemovido = criacaoState.mochila[index];
  if (!itemRemovido) return;

  for (const slotKey of Object.keys(criacaoState.equipamentoSilhueta)) {
    if (criacaoState.equipamentoSilhueta[slotKey]?.uid === itemRemovido.uid) {
      criacaoState.equipamentoSilhueta[slotKey] = null;
      const sel = document.getElementById(`slot-${slotKey.replace('_', '-')}`);
      if (sel) sel.value = '';
    }
  }

  criacaoState.mochila.splice(index, 1);
  atualizarPainelMochila();
  renderizarOpcoesSilhueta();
  atualizarPreviewDefesa();
}

function atualizarPainelMochila() {
  const listEl = document.getElementById('backpack-items-list');
  const counterEl = document.getElementById('backpack-load-counter');
  const barEl = document.getElementById('backpack-load-bar');
  const wealthTierEl = document.getElementById('backpack-wealth-tier');

  const capSlots = 7 + criacaoState.atributos.corpo;
  const slotsOcupados = criacaoState.mochila.reduce((acc, i) => acc + (i.slotsCarga !== undefined ? i.slotsCarga : 1), 0);

  if (counterEl) {
    counterEl.textContent = `${slotsOcupados} / ${capSlots} Slots`;
  }

  if (barEl) {
    const pct = Math.min(100, Math.round((slotsOcupados / capSlots) * 100));
    barEl.style.width = `${pct}%`;
    barEl.classList.toggle('overload', slotsOcupados > capSlots);
  }

  const somaMS = criacaoState.atributos.mente + criacaoState.atributos.social;
  let riquezaLabel = 'Miserável';
  if (somaMS >= 22) riquezaLabel = 'Milionário';
  else if (somaMS >= 18) riquezaLabel = 'Rico';
  else if (somaMS >= 14) riquezaLabel = 'Classe Média Alta';
  else if (somaMS >= 8) riquezaLabel = 'Classe Média Baixa';
  else if (somaMS >= 4) riquezaLabel = 'Pobre';

  if (wealthTierEl) {
    wealthTierEl.textContent = `Poder de Compra: ${riquezaLabel} (${somaMS})`;
  }

  if (listEl) {
    if (criacaoState.mochila.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 1.5rem 0; font-size: 0.85rem;">
          Sua mochila está vazia.<br>Escolha itens do catálogo ao lado.
        </div>
      `;
    } else {
      listEl.innerHTML = criacaoState.mochila.map((it, idx) => `
        <div class="backpack-entry">
          <div>
            <span style="font-weight: 600; color: var(--text-main);">${it.nome}</span>
            <span style="font-size: 0.75rem; color: var(--text-dim); margin-left: 4px;">(${it.slotsCarga || 1}s)</span>
          </div>
          <button type="button" class="btn-remove-item" onclick="removerItemMochila(${idx})" title="Remover da Mochila">✕</button>
        </div>
      `).join('');
    }
  }
}

// ==========================================
// PASSO 6: SILHUETA HUD ANATÔMICA & EQUIPAMENTOS
// ==========================================

function renderizarOpcoesSilhueta() {
  const slotsConfig = [
    { key: 'cabeca', elemId: 'slot-cabeca', labelVazio: '(Nenhum item equipado)' },
    { key: 'tronco', elemId: 'slot-tronco', labelVazio: '(Roupas Comuns - +0 Defesa)' },
    { key: 'costas', elemId: 'slot-costas', labelVazio: '(Nenhum item equipado)' },
    { key: 'pernas', elemId: 'slot-pernas', labelVazio: '(Nenhum item equipado)' },
    { key: 'mao_primaria', elemId: 'slot-mao-primaria', labelVazio: '(Desarmado - 1d6 Desarmado)' },
    { key: 'mao_secundaria', elemId: 'slot-mao-secundaria', labelVazio: '(Mão Livre / Vazia)' },
    { key: 'pes', elemId: 'slot-pes', labelVazio: '(Nenhum item equipado)' },
    { key: 'acessorios', elemId: 'slot-acessorios', labelVazio: '(Nenhum item equipado)' }
  ];

  slotsConfig.forEach(cfg => {
    const select = document.getElementById(cfg.elemId);
    if (!select) return;

    const valorAnterior = criacaoState.equipamentoSilhueta[cfg.key]?.uid || '';
    select.innerHTML = `<option value="">${cfg.labelVazio}</option>`;

    const itensCompativeis = criacaoState.mochila.filter(item => {
      if (cfg.key === 'mao_primaria') return item.categoria === 'armas_focos' || item.slot === 'mao_primaria' || item.dano;
      if (cfg.key === 'mao_secundaria') return item.slot === 'mao_secundaria' || item.categoria === 'protecoes' || item.bonusDefesa > 0;
      if (cfg.key === 'tronco') return item.slot === 'tronco' || item.categoria === 'protecoes';
      return item.slot === cfg.key;
    });

    itensCompativeis.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.uid;
      const extraStat = item.bonusDefesa ? ` (+${item.bonusDefesa} Def)` : (item.dano ? ` (${item.dano})` : '');
      opt.textContent = `${item.nome}${extraStat}`;
      if (item.uid === valorAnterior) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    if (valorAnterior && !itensCompativeis.some(i => i.uid === valorAnterior)) {
      criacaoState.equipamentoSilhueta[cfg.key] = null;
    }
  });

  atualizarPreviewDefesa();
}

function aoEquiparItem(slotKey) {
  const elemId = `slot-${slotKey.replace('_', '-')}`;
  const select = document.getElementById(elemId);
  if (!select) return;

  const itemUid = select.value;
  if (!itemUid) {
    criacaoState.equipamentoSilhueta[slotKey] = null;
  } else {
    const itemEncontrado = criacaoState.mochila.find(i => i.uid === itemUid);
    criacaoState.equipamentoSilhueta[slotKey] = itemEncontrado || null;
  }

  atualizarPreviewDefesa();
}

function atualizarPreviewDefesa() {
  let bonusDefesaArmadura = 0;
  let bonusDefesaEscudo = 0;
  let bonusDefesaExtra = 0;

  const itemTronco = criacaoState.equipamentoSilhueta.tronco;
  if (itemTronco && itemTronco.bonusDefesa) {
    bonusDefesaArmadura = Number(itemTronco.bonusDefesa) || 0;
  }
  const tagTronco = document.getElementById('tag-tronco-defesa');
  if (tagTronco) tagTronco.textContent = `+${bonusDefesaArmadura} Defesa`;

  const itemMaoSec = criacaoState.equipamentoSilhueta.mao_secundaria;
  if (itemMaoSec && itemMaoSec.bonusDefesa) {
    bonusDefesaEscudo = Number(itemMaoSec.bonusDefesa) || 0;
  }

  if (criacaoState.equipamentoSilhueta.cabeca?.bonusDefesa) bonusDefesaExtra += Number(criacaoState.equipamentoSilhueta.cabeca.bonusDefesa) || 0;
  if (criacaoState.equipamentoSilhueta.pernas?.bonusDefesa) bonusDefesaExtra += Number(criacaoState.equipamentoSilhueta.pernas.bonusDefesa) || 0;

  const itemArma = criacaoState.equipamentoSilhueta.mao_primaria;
  const tagArma = document.getElementById('tag-arma-dano');
  if (tagArma) {
    tagArma.textContent = itemArma?.dano ? `Dano: ${itemArma.dano}` : 'Dano: 1d6';
  }

  const totalDefesa = 1 + bonusDefesaArmadura + bonusDefesaEscudo + bonusDefesaExtra;
  const label = document.getElementById('preview-defesa-total');
  if (label) label.textContent = totalDefesa;

  const revDef = document.getElementById('rev-defesa');
  if (revDef) revDef.textContent = `Defesa Total: ${totalDefesa}`;
}

// ==========================================
// PASSO 7: LORE & RESUMO CONSOLIDADO
// ==========================================

function atualizarResumo() {
  const nome = document.getElementById('input-nome')?.value || 'Sem Nome';
  const arquetipo = document.getElementById('input-arquetipo')?.value || 'Aventureiro';
  const raca = document.getElementById('input-raca')?.value || 'Humano';

  const revNome = document.getElementById('rev-nome');
  if (revNome) revNome.textContent = nome;

  const revSub = document.getElementById('rev-subtitulo');
  if (revSub) revSub.textContent = `${arquetipo} • ${raca}`;

  document.getElementById('rev-corpo').textContent = `${criacaoState.atributos.corpo}d6`;
  document.getElementById('rev-mente').textContent = `${criacaoState.atributos.mente}d6`;
  document.getElementById('rev-social').textContent = `${criacaoState.atributos.social}d6`;
  document.getElementById('rev-espirito').textContent = `${criacaoState.atributos.espirito}d6`;

  const somaMS = criacaoState.atributos.mente + criacaoState.atributos.social;
  let riquezaLabel = 'Miserável';
  if (somaMS >= 22) riquezaLabel = 'Milionário';
  else if (somaMS >= 18) riquezaLabel = 'Rico';
  else if (somaMS >= 14) riquezaLabel = 'Classe Média Alta';
  else if (somaMS >= 8) riquezaLabel = 'Classe Média Baixa';
  else if (somaMS >= 4) riquezaLabel = 'Pobre';

  const revRiqueza = document.getElementById('rev-riqueza');
  if (revRiqueza) revRiqueza.textContent = `Riqueza: ${riquezaLabel} (${somaMS})`;

  const listaEquipEl = document.getElementById('rev-equipamentos-lista');
  if (listaEquipEl) {
    const eq = criacaoState.equipamentoSilhueta;
    const equipados = [];
    if (eq.cabeca) equipados.push(`👑 Cabeça: ${eq.cabeca.nome}`);
    if (eq.tronco) equipados.push(`🛡️ Tronco: ${eq.tronco.nome} (+${eq.tronco.bonusDefesa || 0} Def)`);
    if (eq.costas) equipados.push(`🧥 Costas: ${eq.costas.nome}`);
    if (eq.mao_primaria) equipados.push(`⚔️ Mão Principal: ${eq.mao_primaria.nome} (${eq.mao_primaria.dano || '1d6'})`);
    if (eq.mao_secundaria) equipados.push(`🛡️ Mão Secundária: ${eq.mao_secundaria.nome}`);
    if (eq.pernas) equipados.push(`👖 Pernas: ${eq.pernas.nome}`);
    if (eq.pes) equipados.push(`👢 Pés: ${eq.pes.nome}`);
    if (eq.acessorios) equipados.push(`💍 Acessório: ${eq.acessorios.nome}`);

    const mochItens = criacaoState.mochila.map(i => i.nome).join(', ') || 'Nenhum item avulso.';
    const specsList = Object.values(criacaoState.especializacoesAlocadas).map(s => `${s.nome} (Nível ${s.nivel} — +${s.nivel}d6)`).join(' | ') || 'Nenhuma perícia.';

    listaEquipEl.innerHTML = `
      <div style="margin-bottom: 4px;"><strong>🎯 Perícias:</strong> ${specsList}</div>
      ${equipados.length > 0 ? `<div><strong>🛡️ Vestidos:</strong> ${equipados.join(' | ')}</div>` : '<div><em>Nenhum equipamento vestido na silhueta.</em></div>'}
      <div style="margin-top: 4px;"><strong>🎒 Mochila (${criacaoState.mochila.length} itens):</strong> ${mochItens}</div>
    `;
  }
}

// ==========================================
// CONTROLE DE FLUXO DO WIZARD
// ==========================================

async function avancarPasso(direcao) {
  if (direcao > 0) {
    if (passoAtual === 1) {
      const nome = document.getElementById('input-nome').value.trim();
      const arquetipo = document.getElementById('input-arquetipo').value.trim();
      const campaignId = document.getElementById('input-campanha').value.trim();

      if (!nome) {
        alert('Por favor, digite o nome do personagem.');
        return;
      }
      if (!arquetipo) {
        alert('Por favor, defina o arquétipo do seu personagem.');
        return;
      }
      if (!campaignId) {
        alert('É obrigatório selecionar uma campanha ativa para vincular o personagem. Não é permitido criar personagens desvinculados.');
        return;
      }
    } else if (passoAtual === 2) {
      if (criacaoState.pontosLivresRestantes > 0) {
        alert(`Você ainda possui ${criacaoState.pontosLivresRestantes} ponto(s) para distribuir nos seus atributos. Todos os 6 pontos devem ser alocados.`);
        return;
      }
    } else if (passoAtual === 3) {
      const menteTotal = criacaoState.atributos.mente;
      const totalAlocado = calcularTotalPontosEspecializacaoAlocados();

      if (totalAlocado < menteTotal) {
        alert(`Você possui ${menteTotal} pontos em Mente e precisa distribuir todos eles em Especializações (atualmente alocados: ${totalAlocado}/${menteTotal}).`);
        return;
      }
      if (totalAlocado > menteTotal) {
        alert(`Excesso de especializações: você possui ${menteTotal} pontos em Mente e alocou ${totalAlocado}. Ajuste os pontos.`);
        return;
      }
    } else if (passoAtual === 4) {
      const c1 = document.getElementById('contato-1-nome').value.trim();
      const c2 = document.getElementById('contato-2-nome').value.trim();
      const c3 = document.getElementById('contato-3-nome').value.trim();
      if (!c1 || !c2 || !c3) {
        alert('Por favor, cadastre os 3 contatos obrigatórios do passado do seu personagem.');
        return;
      }
    } else if (passoAtual === 5) {
      renderizarOpcoesSilhueta();
    } else if (passoAtual === 6) {
      atualizarResumo();
    } else if (passoAtual === totalPassos) {
      await submeterCriacaoPersonagem();
      return;
    }
  }

  passoAtual += direcao;
  passoAtual = Math.max(1, Math.min(totalPassos, passoAtual));

  for (let i = 1; i <= totalPassos; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    const nodeEl = document.getElementById(`node-${i}`);
    if (stepEl) {
      stepEl.classList.toggle('active', i === passoAtual);
    }
    if (nodeEl) {
      nodeEl.classList.toggle('active', i === passoAtual);
      nodeEl.classList.toggle('done', i < passoAtual);
    }
  }

  const btnVoltar = document.getElementById('btn-voltar');
  const btnProx = document.getElementById('btn-proximo');

  btnVoltar.style.visibility = passoAtual === 1 ? 'hidden' : 'visible';
  btnProx.textContent = passoAtual === totalPassos ? 'Concluir & Criar Personagem ⚔️' : 'Próximo Passo →';

  if (passoAtual === 3) {
    atualizarBannerPontosEspecializacao();
    renderizarCatalogoEspecializacoes();
    renderizarPainelEspecializacoesSelecionadas();
  } else if (passoAtual === 5) {
    atualizarPainelMochila();
  } else if (passoAtual === 6) {
    renderizarOpcoesSilhueta();
  } else if (passoAtual === totalPassos) {
    atualizarResumo();
  }
}

// ==========================================
// SUBMISSÃO FINAL
// ==========================================

async function submeterCriacaoPersonagem() {
  const btnProx = document.getElementById('btn-proximo');
  btnProx.disabled = true;
  btnProx.textContent = 'Gravando Personagem...';

  const nome = document.getElementById('input-nome').value.trim();
  const arquetipo = document.getElementById('input-arquetipo').value.trim();
  const raca = document.getElementById('input-raca').value.trim() || 'Humano';
  const sexo = document.getElementById('input-sexo').value.trim() || 'Não informado';
  const idade = document.getElementById('input-idade').value.trim() || 'Adulto';
  const campaignId = document.getElementById('input-campanha').value.trim();

  if (!campaignId) {
    alert('É obrigatório selecionar uma campanha ativa para vincular seu personagem.');
    btnProx.disabled = false;
    btnProx.textContent = 'Concluir & Criar Personagem ⚔️';
    return;
  }

  // Lista de Especializações Ranqueadas (1 a 3 pontos por perícia)
  const especializacoes = Object.values(criacaoState.especializacoesAlocadas).map(s => ({
    id: s.id,
    nome: s.nome,
    nivel: s.nivel,
    atributo: s.atributo,
    categoria: s.categoria
  }));

  // Contatos
  const contatos = [
    {
      nome: document.getElementById('contato-1-nome').value.trim(),
      vinculo: document.getElementById('contato-1-vinculo').value,
      ocupacao: document.getElementById('contato-1-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-1-detalhes').value.trim()
    },
    {
      nome: document.getElementById('contato-2-nome').value.trim(),
      vinculo: document.getElementById('contato-2-vinculo').value,
      ocupacao: document.getElementById('contato-2-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-2-detalhes').value.trim()
    },
    {
      nome: document.getElementById('contato-3-nome').value.trim(),
      vinculo: document.getElementById('contato-3-vinculo').value,
      ocupacao: document.getElementById('contato-3-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-3-detalhes').value.trim()
    }
  ];

  // Silhueta Equipamentos
  const equipamentoSilhueta = { ...criacaoState.equipamentoSilhueta };

  // Mochila Itens
  const itensMochila = criacaoState.mochila.map(i => ({
    id: i.id,
    nome: i.nome,
    slot: i.slot,
    categoria: i.categoria,
    slotsCarga: i.slotsCarga || 1,
    bonusDefesa: i.bonusDefesa || 0,
    dano: i.dano || null,
    tracos: i.tracos || []
  }));

  // Lore
  const lore = {
    historia_origem: document.getElementById('input-historia').value.trim(),
    personalidade: document.getElementById('input-personalidade').value.trim(),
    motivacao: document.getElementById('input-motivacao').value.trim(),
    diario_anotacoes: ''
  };

  try {
    const result = await apiClient.sync('rpg.character.createAlphaD6', {
      name: nome,
      arquetipo,
      raca,
      sexo,
      idade,
      nivel: 1,
      atributos: criacaoState.atributos,
      especializacoes,
      contatos,
      equipamentoSilhueta,
      itensMochila,
      lore,
      campaignId
    });

    if (result && result.sucesso) {
      alert(`🎉 Personagem "${nome}" criado com sucesso!`);
      window.location.href = `campanha.html?id=${campaignId}`;
    } else {
      alert(`Erro ao criar personagem: ${(result && result.erro) || 'Falha na validação dos dados.'}`);
      btnProx.disabled = false;
      btnProx.textContent = 'Concluir & Criar Personagem ⚔️';
    }
  } catch (err) {
    alert(`Erro de conexão com o servidor: ${err.message}`);
    btnProx.disabled = false;
    btnProx.textContent = 'Concluir & Criar Personagem ⚔️';
  }
}

// Exportar funções necessárias no escopo global para acionamento pelos eventos de template HTML
if (typeof window !== 'undefined') {
  window.alterarAtributo = alterarAtributo;
  window.alterarRankEspecializacao = alterarRankEspecializacao;
  window.filtrarEspecializacoes = filtrarEspecializacoes;
  window.filtrarEspecializacoesCategoria = filtrarEspecializacoesCategoria;
  window.filtrarCompendio = filtrarCompendio;
  window.adicionarItemMochila = adicionarItemMochila;
  window.removerItemMochila = removerItemMochila;
  window.aoEquiparItem = aoEquiparItem;
  window.atualizarPreviewDefesa = atualizarPreviewDefesa;
  window.avancarPasso = avancarPasso;
  window.submeterCriacaoPersonagem = submeterCriacaoPersonagem;
}
