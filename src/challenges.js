export const WORDS = [
  "ABACAXI", "ABAJUR", "ABELHA", "ABRAÇO", "AÇÚCAR", "ADESTRAR", "ADIVINHA", "AEROPORTO",
  "ALFACE", "ALFINETE", "ALGORITMO", "ALICATE", "ALMOFADA", "AMENDOIM", "ANEL", "ANIVERSARIO",
  "APARTAMENTO", "APITO", "APRENDER", "ARANHA", "ARCOIRIS", "AREIA", "ARMARIO", "ARQUITETO",
  "ARRANHAR", "ARTISTA", "ASPIRADOR", "ATALHO", "ATLETA", "AZEITE", "BACIA", "BACON",
  "BAGUNÇA", "BALANÇA", "BALDE", "BANANA", "BANCO", "BARALHO", "BARBEIRO", "BARRACA",
  "BATERIA", "BEBIDA", "BIBLIOTECA", "BICICLETA", "BISCOITO", "BOLINHA", "BOMBEIRO", "BORBOLETA",
  "BRASILEIRO", "BRIGADEIRO", "BROCOLIS", "BULE", "CACHORRO", "CADEADO", "CADEIRA", "CAFETEIRA",
  "CAMINHÃO", "CAMISETA", "CANETA", "CANGURU", "CAPIVARA", "CARIMBO", "CARRO", "CASAMENTO",
  "CASTELO", "CEBOLA", "CENOURA", "CEREBRO", "CHAVEIRO", "CHOCOLATE", "CHUVEIRO", "CINEMA",
  "COBERTOR", "COELHO", "COLHER", "COMPUTADOR", "CONSTRUÇÃO", "CORAÇÃO", "CORRIDA", "COZINHA",
  "CRIANÇA", "CRUZADINHA", "CUPCAKE", "DENTISTA", "DESAFIO", "DESENHO", "DIAMANTE", "DINOSSAURO",
  "DOCUMENTO", "DOMINGO", "EDIFÍCIO", "ELEVADOR", "EMBALAGEM", "ENXADA", "EQUILIBRIO", "ESCADA",
  "ESCOLA", "ESCUDO", "ESPELHO", "ESPONJA", "ESTANTE", "ESTRADA", "ESTRELA", "FANTASMA",
  "FARMACIA", "FATIA", "FERRAMENTA", "FESTA", "FIGURINHA", "FILTRO", "FLORESTA", "FOGUETE",
  "FORNALHA", "FRANGOS", "FRUTA", "FUTEBOL", "GARRAFA", "GELADEIRA", "GIRAFA", "GOIABADA",
  "GRAMADO", "GRAVATA", "GUARDA", "HABILIDADE", "HELICOPTERO", "HISTORIA", "HORTALIÇA", "HOSPITAL",
  "IDENTIDADE", "IGREJA", "ILUMINAÇÃO", "IMPACTO", "IMPRESSORA", "INVERNO", "JANELA", "JARDIM",
  "JORNADA", "JOYSTICK", "LABIRINTO", "LÂMPADA", "LARANJA", "LETRAS", "LIVRARIA", "LUNETA",
  "MACARRÃO", "MAMÃO", "MANDIOCA", "MAPA", "MARMITA", "MATERIAL", "MECÂNICO", "MELANCIA",
  "MERCADO", "MESA", "METEORO", "MONTANHA", "MORANGO", "MUSEU", "NAVEGADOR", "NEBLINA",
  "NOTEBOOK", "NUTRIÇÃO", "OCULOS", "OFICINA", "OMBRO", "ORQUESTRA", "PADARIA", "PANELA",
  "PARAFUSO", "PAREDE", "PARQUE", "PASSAGEM", "PEIXE", "PENDRIVE", "PENTEAR", "PERFUME",
  "PESQUISA", "PIÃO", "PIMENTA", "PINTURA", "PIPOCA", "PISCINA", "PLANETA", "PONTE",
  "PORTA", "PREFEITURA", "PRIMEIRO", "PROTETOR", "QUEIJO", "QUINTAL", "RÁDIO", "RAQUETE",
  "RELÓGIO", "RELOGIO", "REMÉDIO", "REPUBLICA", "RETRATO", "RODOVIA", "SABÃO", "SALADA",
  "SAPATO", "SEREIA", "SORVETE", "SOTÃO", "SUBTRAÇÃO", "TAMANHO", "TEATRO", "TELHADO",
  "TEMPERO", "TESOURA", "TIJOLO", "TOMATE", "TORNEIRA", "TRAVESSEIRO", "TROFÉU", "UNIVERSO",
  "VASSOURA", "VELA", "VENTILADOR", "VERDURA", "VIAGEM", "VITRINE", "XADREZ", "ZEBRA"
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
