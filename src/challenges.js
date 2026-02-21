const CHALLENGES = [
  { answer: "PREFEITURA", hint: "Orgao do governo municipal" },
  { answer: "GELADEIRA", hint: "Eletrodomestico que conserva alimentos frios" },
  { answer: "BIBLIOTECA", hint: "Lugar com livros para estudo" },
  { answer: "COMPUTADOR", hint: "Maquina de trabalho digital" },
  { answer: "BRINQUEDO", hint: "Objeto usado para brincar" },
  { answer: "CHOCOLATE", hint: "Doce feito de cacau" },
  { answer: "JANELA", hint: "Abertura para luz e ventilacao" },
  { answer: "ELEFANTE", hint: "Animal de grande porte com tromba" },
  { answer: "TELEFONE", hint: "Aparelho para ligar" },
  { answer: "HOSPITAL", hint: "Unidade de atendimento medico" },
  { answer: "ABACAXI", hint: "Fruta tropical de casca espinhosa" },
  { answer: "CADERNO", hint: "Item escolar para anotacoes" },
  { answer: "MOTOQUEIRO", hint: "Pessoa que conduz moto" },
  { answer: "CAMINHAO", hint: "Veiculo grande de carga" },
  { answer: "ESCULTURA", hint: "Arte em tres dimensoes" },
  { answer: "PARALELO", hint: "Linha que nunca se cruza com outra" },
  { answer: "TRAVESSEIRO", hint: "Apoio da cabeca para dormir" },
  { answer: "COZINHEIRO", hint: "Profissional que prepara alimentos" },
  { answer: "BICICLETA", hint: "Transporte de duas rodas" },
  { answer: "PIPOCA", hint: "Milho estourado" },
  { answer: "ANEL", hint: "Acessorio usado no dedo" },
  { answer: "FOTOGRAFIA", hint: "Registro visual de um momento" },
  { answer: "CAFETEIRA", hint: "Aparelho para preparar cafe" },
  { answer: "VENTILADOR", hint: "Equipamento que move o ar" },
  { answer: "AEROPORTO", hint: "Local de pouso e decolagem" },
  { answer: "IMPRESSORA", hint: "Dispositivo que imprime documentos" },
  { answer: "MARGARIDA", hint: "Flor branca com miolo amarelo" },
  { answer: "TERREMOTO", hint: "Abalo sismico" },
  { answer: "FUTEBOL", hint: "Esporte com bola e gols" },
  { answer: "LANTERNA", hint: "Iluminacao portatil" },
  { answer: "PALHACO", hint: "Artista de circo" },
  { answer: "MONTANHA", hint: "Elevacao natural do relevo" },
  { answer: "LIVRARIA", hint: "Loja de livros" },
  { answer: "RELAMPAGO", hint: "Descarga eletrica no ceu" },
  { answer: "GUITARRA", hint: "Instrumento musical de cordas" },
  { answer: "BALOEIRO", hint: "Pessoa que vende baloes" },
  { answer: "COLCHAO", hint: "Base da cama" },
  { answer: "ALMOFADA", hint: "Apoio macio para descanso" },
  { answer: "MELANCIA", hint: "Fruta grande de polpa vermelha" },
  { answer: "TARTARUGA", hint: "Animal de casco" },
  { answer: "POLTRONA", hint: "Assento largo e confortavel" },
  { answer: "BOMBEIRO", hint: "Profissional que combate incendios" },
  { answer: "ENGENHEIRO", hint: "Profissional de projetos tecnicos" },
  { answer: "PINTOR", hint: "Profissional de pintura" },
  { answer: "MARTELO", hint: "Ferramenta de impacto" },
  { answer: "TESOURA", hint: "Instrumento de corte" },
  { answer: "CACHOEIRA", hint: "Queda natural de agua" },
  { answer: "DESERTO", hint: "Regiao seca com pouca chuva" },
  { answer: "PLANETA", hint: "Corpo celeste em orbita" },
  { answer: "GALAXIA", hint: "Conjunto enorme de estrelas" },
  { answer: "ASTRONAUTA", hint: "Pessoa treinada para missao espacial" },
  { answer: "SATELITE", hint: "Corpo que orbita outro" },
  { answer: "CINEMA", hint: "Lugar para assistir filmes" },
  { answer: "TEATRO", hint: "Espaco de apresentacoes artisticas" },
  { answer: "ORQUESTRA", hint: "Grupo grande de musicos" },
  { answer: "BATERIA", hint: "Instrumento de percussao" },
  { answer: "VIOLINO", hint: "Instrumento de cordas tocado com arco" },
  { answer: "FLAUTA", hint: "Instrumento de sopro" },
  { answer: "ANELAR", hint: "Colocar anel em algo" },
  { answer: "BANDEIRA", hint: "Simbolo de um pais ou grupo" },
  { answer: "PIRAMIDE", hint: "Construcao antiga de base larga" },
  { answer: "CASTELO", hint: "Fortificacao medieval" },
  { answer: "CAVALEIRO", hint: "Guerreiro montado" },
  { answer: "ESCUDO", hint: "Equipamento de defesa" },
  { answer: "ESPADA", hint: "Arma branca comprida" },
  { answer: "TABULEIRO", hint: "Superficie de jogo" },
  { answer: "XADREZ", hint: "Jogo estrategico de pecas" },
  { answer: "DAMA", hint: "Jogo de tabuleiro simples" },
  { answer: "LABIRINTO", hint: "Caminho com varias bifurcacoes" },
  { answer: "SEMAFORO", hint: "Sinal luminoso de transito" },
  { answer: "RODOVIA", hint: "Estrada principal entre cidades" },
  { answer: "FAROL", hint: "Sinalizacao para navegacao" },
  { answer: "BALSAMO", hint: "Substancia calmante" },
  { answer: "CENOURA", hint: "Legume alaranjado" },
  { answer: "BETERRABA", hint: "Raiz roxa" },
  { answer: "LARANJEIRA", hint: "Arvore que produz laranja" },
  { answer: "MANGUEIRA", hint: "Arvore de manga" },
  { answer: "PESSEGUEIRO", hint: "Arvore de pessego" },
  { answer: "FRUTEIRA", hint: "Recipiente para frutas" },
  { answer: "TORNEIRA", hint: "Ponto de saida de agua" },
  { answer: "CHUVEIRO", hint: "Equipamento para banho" },
  { answer: "SABONETE", hint: "Produto de higiene" },
  { answer: "TOALHA", hint: "Tecido para secar" },
  { answer: "ESCOVA", hint: "Utensilio para pentear ou limpar" },
  { answer: "PASTELARIA", hint: "Loja especializada em pasteis" },
  { answer: "PADARIA", hint: "Comercio de paes" },
  { answer: "ACOUGUE", hint: "Comercio de carnes" },
  { answer: "MERCADO", hint: "Loja de compras do dia a dia" },
  { answer: "FARMACIA", hint: "Loja de medicamentos" },
  { answer: "PRAIA", hint: "Faixa de areia junto ao mar" },
  { answer: "OCEANO", hint: "Grande massa de agua salgada" },
  { answer: "ILHA", hint: "Porcao de terra cercada por agua" },
  { answer: "PORTO", hint: "Local de embarque de navios" },
  { answer: "ANCORA", hint: "Peca que fixa embarcacao" }
];

function maskWord(word) {
  const chars = word.split("");
  return chars.map((c, i) => (i % 3 === 1 ? "_" : c)).join(" ");
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function buildChallengeDeck() {
  return shuffle(CHALLENGES);
}

export function drawFromDeck(deck) {
  if (!deck.length) {
    return null;
  }
  const selected = deck.pop();
  return {
    answer: selected.answer,
    hint: selected.hint,
    masked: maskWord(selected.answer)
  };
}
