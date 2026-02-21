const WORDS = [
  { answer: "PREFEITURA", hint: "Órgão do governo municipal" },
  { answer: "GELADEIRA", hint: "Eletrodoméstico que mantém alimentos frios" },
  { answer: "BIBLIOTECA", hint: "Lugar com livros para estudo e empréstimo" },
  { answer: "COMPUTADOR", hint: "Máquina usada para tarefas digitais" },
  { answer: "BRINQUEDO", hint: "Objeto usado para diversão infantil" },
  { answer: "CHOCOLATE", hint: "Doce feito a partir do cacau" },
  { answer: "JANELA", hint: "Abertura em parede para entrada de luz e ar" },
  { answer: "ELEFANTE", hint: "Animal grande com tromba" },
  { answer: "TELEFONE", hint: "Aparelho para chamadas" },
  { answer: "HOSPITAL", hint: "Local de atendimento médico" },
  { answer: "ABACAXI", hint: "Fruta tropical de casca espinhosa" },
  { answer: "CADERNO", hint: "Item escolar para anotações" },
  { answer: "MOTOQUEIRO", hint: "Pessoa que conduz moto" },
  { answer: "CAMINHAO", hint: "Veículo grande de carga" },
  { answer: "ESCULTURA", hint: "Obra de arte tridimensional" }
];

function maskWord(word) {
  const chars = word.split("");
  return chars.map((c, i) => (i % 3 === 1 ? "_" : c)).join(" ");
}

export function drawChallenge() {
  const selected = WORDS[Math.floor(Math.random() * WORDS.length)];
  return {
    answer: selected.answer,
    hint: selected.hint,
    masked: maskWord(selected.answer)
  };
}
