const WORDS = [
  "PREFEITURA",
  "GELADEIRA",
  "BIBLIOTECA",
  "COMPUTADOR",
  "BRINQUEDO",
  "CHOCOLATE",
  "JANELA",
  "ELEFANTE",
  "TELEFONE",
  "HOSPITAL",
  "ABACAXI",
  "CADERNO",
  "MOTOQUEIRO",
  "CAMINHAO",
  "ESCULTURA"
];

function maskWord(word) {
  const chars = word.split("");
  return chars.map((c, i) => (i % 3 === 1 ? "_" : c)).join(" ");
}

export function drawChallenge() {
  const answer = WORDS[Math.floor(Math.random() * WORDS.length)];
  return {
    answer,
    masked: maskWord(answer)
  };
}
