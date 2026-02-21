const WORD_CHALLENGES = [
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
  { answer: "TRAVESSEIRO", hint: "Apoio da cabeca para dormir" },
  { answer: "COZINHEIRO", hint: "Profissional que prepara alimentos" },
  { answer: "BICICLETA", hint: "Transporte de duas rodas" },
  { answer: "FOTOGRAFIA", hint: "Registro visual de um momento" },
  { answer: "VENTILADOR", hint: "Equipamento que move o ar" },
  { answer: "AEROPORTO", hint: "Local de pouso e decolagem" },
  { answer: "IMPRESSORA", hint: "Dispositivo que imprime documentos" },
  { answer: "TERREMOTO", hint: "Abalo sismico" },
  { answer: "LANTERNA", hint: "Iluminacao portatil" },
  { answer: "MONTANHA", hint: "Elevacao natural do relevo" },
  { answer: "LIVRARIA", hint: "Loja de livros" },
  { answer: "GUITARRA", hint: "Instrumento musical de cordas" },
  { answer: "COLCHAO", hint: "Base da cama" },
  { answer: "ALMOFADA", hint: "Apoio macio para descanso" },
  { answer: "MELANCIA", hint: "Fruta grande de polpa vermelha" },
  { answer: "TARTARUGA", hint: "Animal de casco" },
  { answer: "POLTRONA", hint: "Assento largo e confortavel" },
  { answer: "BOMBEIRO", hint: "Profissional que combate incendios" },
  { answer: "MARTELO", hint: "Ferramenta de impacto" },
  { answer: "TESOURA", hint: "Instrumento de corte" },
  { answer: "CACHOEIRA", hint: "Queda natural de agua" },
  { answer: "DESERTO", hint: "Regiao seca com pouca chuva" },
  { answer: "PLANETA", hint: "Corpo celeste em orbita" },
  { answer: "GALAXIA", hint: "Conjunto enorme de estrelas" },
  { answer: "SATELITE", hint: "Corpo que orbita outro" },
  { answer: "CINEMA", hint: "Lugar para assistir filmes" },
  { answer: "TEATRO", hint: "Espaco de apresentacoes artisticas" },
  { answer: "ORQUESTRA", hint: "Grupo grande de musicos" },
  { answer: "VIOLINO", hint: "Instrumento de cordas tocado com arco" },
  { answer: "FLAUTA", hint: "Instrumento de sopro" },
  { answer: "BANDEIRA", hint: "Simbolo de um pais ou grupo" },
  { answer: "PIRAMIDE", hint: "Construcao antiga de base larga" },
  { answer: "CASTELO", hint: "Fortificacao medieval" },
  { answer: "CAVALEIRO", hint: "Guerreiro montado" },
  { answer: "LABIRINTO", hint: "Caminho com varias bifurcacoes" },
  { answer: "SEMAFORO", hint: "Sinal luminoso de transito" },
  { answer: "RODOVIA", hint: "Estrada principal entre cidades" },
  { answer: "CENOURA", hint: "Legume alaranjado" },
  { answer: "BETERRABA", hint: "Raiz roxa" },
  { answer: "LARANJEIRA", hint: "Arvore que produz laranja" },
  { answer: "MANGUEIRA", hint: "Arvore de manga" },
  { answer: "TORNEIRA", hint: "Ponto de saida de agua" },
  { answer: "CHUVEIRO", hint: "Equipamento para banho" },
  { answer: "SABONETE", hint: "Produto de higiene" },
  { answer: "PADARIA", hint: "Comercio de paes" },
  { answer: "MERCADO", hint: "Loja de compras do dia a dia" },
  { answer: "FARMACIA", hint: "Loja de medicamentos" },
  { answer: "PRAIA", hint: "Faixa de areia junto ao mar" },
  { answer: "OCEANO", hint: "Grande massa de agua salgada" },
  { answer: "ANCORA", hint: "Peca que fixa embarcacao" },
  { answer: "AÇÚCAR", hint: "Ingrediente doce de cozinha" }
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

function randomDecimal(min, max) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(2));
}

function generateMathChallenge() {
  const operation = Math.random() < 0.5 ? "+" : "-";
  let a = randomDecimal(1, 99.99);
  let b = randomDecimal(1, 99.99);

  if (operation === "-" && b > a) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  const result = operation === "+" ? a + b : a - b;
  const numericAnswer = Number(result.toFixed(2));

  return {
    answerType: "number",
    numericAnswer,
    hint: "Conta decimal de adicao ou subtracao",
    masked: `${a.toFixed(2)} ${operation} ${b.toFixed(2)} = ?`
  };
}

export function buildChallengeDeck() {
  return shuffle(WORD_CHALLENGES);
}

function drawWordFromDeck(deck) {
  if (!deck.length) {
    return null;
  }

  const selected = deck.pop();
  return {
    answerType: "text",
    answer: selected.answer,
    hint: selected.hint,
    masked: maskWord(selected.answer)
  };
}

export function drawChallengeForMode(deck, mode) {
  if (mode === "WORDS_MATH") {
    if (Math.random() < 0.5) {
      return generateMathChallenge();
    }
  }

  return drawWordFromDeck(deck);
}
