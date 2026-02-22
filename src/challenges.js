export const WORD_BANK = [
  { word: "RELÓGIO", hint: "Usado para marcar horas" },
  { word: "CELULAR", hint: "Dispositivo para comunicação e internet" },
  { word: "CHAVE", hint: "Usada para abrir portas" },
  { word: "CARRO", hint: "Meio de transporte com motor" },
  { word: "CADEIRA", hint: "Usada para sentar" },
  { word: "MESA", hint: "Superfície para apoiar objetos" },
  { word: "COMPUTADOR", hint: "Usado para trabalho ou estudo" },
  { word: "LIVRO", hint: "Conjunto de páginas com texto" },
  { word: "CANETA", hint: "Usada para escrever" },
  { word: "PAPEL", hint: "Material para escrita ou impressão" },

  { word: "ÓCULOS", hint: "Usado para melhorar a visão" },
  { word: "SAPATO", hint: "Calçado para os pés" },
  { word: "COPO", hint: "Usado para beber líquidos" },
  { word: "PRATO", hint: "Usado para servir comida" },
  { word: "FOGÃO", hint: "Usado para cozinhar" },
  { word: "GELADEIRA", hint: "Mantém alimentos frios" },
  { word: "TELEVISÃO", hint: "Usada para assistir vídeos" },
  { word: "CONTROLE", hint: "Comanda aparelhos à distância" },
  { word: "PORTA", hint: "Permite entrada e saída" },
  { word: "JANELA", hint: "Entrada de luz e ventilação" },

  { word: "CAMA", hint: "Usada para dormir" },
  { word: "TRAVESSEIRO", hint: "Apoio para a cabeça" },
  { word: "BANHEIRO", hint: "Local de higiene" },
  { word: "CHUVEIRO", hint: "Usado para banho" },
  { word: "TOALHA", hint: "Usada para secar" },
  { word: "ESCOVA", hint: "Usada para limpar ou pentear" },
  { word: "PENTE", hint: "Usado para arrumar cabelo" },
  { word: "SABÃO", hint: "Produto de limpeza" },
  { word: "DETERGENTE", hint: "Usado para lavar louça" },
  { word: "LIXEIRA", hint: "Local para descarte" },

  { word: "MOCHILA", hint: "Usada para carregar objetos" },
  { word: "BOLSA", hint: "Guarda itens pessoais" },
  { word: "CARTEIRA", hint: "Guarda dinheiro e documentos" },
  { word: "DOCUMENTO", hint: "Serve para identificação" },
  { word: "SENHA", hint: "Permite acesso a sistemas" },
  { word: "INTERNET", hint: "Rede de comunicação digital" },
  { word: "WI-FI", hint: "Conexão sem fio" },
  { word: "TOMADA", hint: "Fornece energia elétrica" },
  { word: "CARREGADOR", hint: "Recarrega baterias" },
  { word: "BATERIA", hint: "Armazena energia" },

  { word: "APLICATIVO", hint: "Programa instalado no celular" },
  { word: "MENSAGEM", hint: "Informação enviada a alguém" },
  { word: "E-MAIL", hint: "Comunicação digital escrita" },
  { word: "ARQUIVO", hint: "Documento digital salvo" },
  { word: "FOTO", hint: "Registro visual" },
  { word: "VÍDEO", hint: "Imagem em movimento" },
  { word: "SOM", hint: "O que é ouvido" },
  { word: "FONE", hint: "Usado para ouvir áudio" },
  { word: "MICROFONE", hint: "Capta som" },
  { word: "CÂMERA", hint: "Registra imagens" }
];

function pickTwoDigits() {
  return Math.floor(Math.random() * 90) + 10;
}

export function generateMath() {
  const a = pickTwoDigits();
  const b = pickTwoDigits();
  const op = Math.random() > 0.5 ? "+" : "-";
  return {
    answerType: "number",
    text: `${a} ${op} ${b}`,
    answer: String(op === "+" ? a + b : a - b),
    hint: "Conta no formato XX + XX ou XX - XX"
  };
}

export function maskWord(word) {
  const chars = [...String(word || "")];
  const visibleIndexes = new Set();

  for (let i = 0; i < chars.length; i += 1) {
    if (i % 3 === 0) {
      visibleIndexes.add(i);
    }
  }

  return chars
    .map((ch, idx) => {
      if (!/[A-ZÀ-ÿÇ]/i.test(ch)) return ch;
      return visibleIndexes.has(idx) ? ch : "_";
    })
    .join(" ");
}
