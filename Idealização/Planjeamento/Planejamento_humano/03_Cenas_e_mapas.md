# Funcionamento das Cenas e Mapas

> As cenas são telas html onde os jogadores podem interagir com os elementos de forma pré scriptada pelo mestre.

As cenas devem ter:
    - Nome
    - Descrição Narrativa
    - Modelo
    - Limite de jogadore ativos

---

## Ideia Basilar do Funcionamento das Cenas

1. O criador define o Modelo, que pode ser Grid, Majong, Senha, ou qualquer coisa futura que eu possa criar;
2. O criador define o tamanho do Modelo, (tamanho do grid, quantidade de tiles, slots de senha, etc);
3. O criador define a Estética do Modelo (cores, fontes, linhas, etc);
4. O criador define as Regras do Modelo (o que acontece quando o jogador interage com o modelo, o que acontece quando o jogador sai do modelo, etc);
5. O jogador entra na cena e interage com o modelo.

No caso do Grid e outros modelos similares, que o criador pode distribuir elementos visuais no cenário, cada elemento tem seu comportamento padrão, como uma parede, o jogador não pode atravessar ou se sobrepor a ela e ela é indestrutivel, mas o mestre na criação da cena pode mudar isso, setando um evento especifico prédefinido no codigo (como por exemplo, "quando o jogador clicar nisso"), um efeito especifico ocorre (como deletar a parede tornando possivel passar por aquele tile), essa ação deve ser verificada no backend. Esse sistema modular de gatilhos e efeito é a essencia do sistema de cenas.

As cenas tem limites de usarios a depender do seu modelo e podem ser assincronas ou sincronas no caso de mais de um usario ativo

A ideia essencia das cenas é que elas podem ser interconectadas pelo sistema de gatilhos, onde certas ações podem levar o jogador para outra cena.

---

Os modelos padrão são:

1. Grid: O criador da cena define um numero de largura e altura (com limite máximo de 500), cada tile é convertido no backend em um valor num array 2d, cada tile é inicalmente 0 (vazio), cada valor no array deve ser o ID de algo, como um item, estrutura, npc, etc. O frontend recebe esse array e converte no visual, os jogadores podem interagir com os tiles e enviar requisições de movimento ou interação com objetos. Para que o frontend consiga renderizar o mapa sem depender do backend, deve ter no frontend a relação dos IDs com os assets, mas deve ter um validador das respostas do frontend no backend. Alem disso os IDs do frontend devem ser só de assets e não referenciar regras (isso fica no backend). Então cada elemento terá 2 IDs. A estetica que eu busco seria um fundo cinza, com as linhas pretas ou douradas (o mestre define) (bordinhas) para demarcação dos tiles. Os icones serão vetoriais (svg) transparentes, e o mestre pode ao montar a cena, mudar a cor das linhas do vetor/icone livremente, salvando como css da cena. Além disso terá 3 layers no grid, layer1 (o jogador/entidades passam por cima do item), layer2 (o jogador/entidades estão no mesmo layer que isso, então eles não atravessam ou se sobrepõem), layer 3 (o jogador/entidades passam por baixo do item). Essa é uma cena que aceita mais de um usario ativo por vez e é sincrona.

2. Mecanica Majong: a ideia desse modelo de cena é misturar joga da memoria, com majong, e campo minado, da seguinte forma: A. No inicio da cena todas os tiles estão preenchidos e visiveis claramente, e quando o jogador fizer o primeiro par de majong, todas as peças ficam ocultas (assumindo uma figura de interrogação); B. cada figura no majong vai ser correlacioada a um numero (oculto ao jogador, então o jogador deve aprender intuitivamente qual simbolo é relacionado a qual numero), essa correlação é sorteado no inicio do acesso a essa cena; C. As bombas do campo minado são nesse jogo peças de manjong Vermelhas com fundo Lilas, e dão dano ao jogador (definido pelo mestre na criação da cena); D. Cada vez que o jogador fizer um par de majong as peças envolvidas no par somem do mapa e o jogador ganha 1 ponto; E. Quando o jogador tirar todas as peças de manjong que não forem bombas da tela, a tela é limpa e reinicia o processo, mantendo os pontos e vida da ultima rodada; F. O mestre deve configurar o que acontece quando a vida do jogador chegar a 0, e o que ocorre quandos certas quantidades de pontos são conseguidos (tudo modular e livre, podendo configurar mais de uma consequencia); G. O jogador pode sair da cena quando quiser retirando o que conseguiu seguindo as configurações do mestre, restaurando toda a saude perdida. Essa renderização do manjog segue a mesma logica do assets e regras do grid. Esse é um modelo que permite apenas um usario assincrono, sem sincronicidade.

3. Mecanica de Senha:  A mecanica de senhas funciona da seguinte forma: A. o mestre define na criação da cena o numero de slots que a senha vai ter, cada slot pode ter um conteudo, sendo eles: a. numeros dentro de um internvalo permitido configurado pelo mestre, b. icones (assets), c. letras., as possibilidades dessas coisas que podem ser colocadas nos slots são definidos pelo mestre e estarão disponiveis para o jogador tentar acertar a ordem (como uma serie pré definida de assets, de letras ou numeros). B. O mestre define se a combinação é aleatoria ou fixa na criação da cena(quando aleatoria, ela é gerada no acesso do jogador a cena, e muda toda vez que ele acessa novamente); C. Toda vez que o jogador tenta uma combinação errada, ele toma dano (definido pelo mestre na criação da cena); D. O mestre define o que acontece quando o jogador acerta a senha, como adicionar algo a ficha do jogador (XP, item, habildiade, informação), ou se ele é levado para outra cena. E. O mestre define se há dicas e quais são na criação da cena (podendo iniciar sem dicas e depois de um numerod e tentativas por um mesmo jogador começar a aparecer as dicas gradualmente, sistema de gatilhos), as dicas funcionam da seguinte forma: a. dica livre (o mestre escreve um texto), b. cada asset, letra ou numero é vinculado a um valor, quando a multiplicação desses valores (na ordem que são colocados, da esquerda pra direita) usados na combinação é acima do valor alvo (senha correta) as linhas dos tiles fica vermelho, quando o resultado da multiplicação é menor que o valor alvo (senha correta) as linhas dos tiles fica azul, c. segue a mesma logica de atribuir valores matematicos a cada item possivel pra combinação da senha, mas agora cada tile em especifico fica vermelho (acima do valor alvo pra aquele tile), verde (exatamente no valor alvo para aquele tile) ou azul (abaixo do valor alvo para aquele tile). Essa é uma cena que aceita apenas um jogador ativo por vez, e é assincrona.

4. Mecanica de conversa: O mestre cria mensagems, e pode vincular imagens (via link) e opções de resposta, assim podendo fazer uma arvore de dialogos com varias rotas possiveis pré definidas, e gatilhos que podem ter efeitos a depender das escolhas do jogador nessa cena.Essa é uma cena que aceita apenas um jogador ativo por vez, e é assincrona.

5. Mecanica de Combate essa cena se baseia nos combates de jogos classicos como final fantasy e pokemon, combate por turnos. usando as informações reais da ficha do jogador e do compendio (pra npcs, bestiario, itens, armas, etc).
