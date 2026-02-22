export const WORDS = ["ABACAXI", "BANANA", "CACHORRO", "DIAMANTE", "ELEFANTE", "FOGUETE", "GIRAFA", "HELICOPTERO", "IGREJA", "JACARE", "KARAOKE", "LEAO", "MACACO", "NAVIO", "OVELHA", "PANDA", "QUEIJO", "RATO", "SAPATO", "TIGRE", "URSO", "VASSOURA", "WAFERS", "XICARA", "ZEBRA", "AVIAO", "BOLA", "CARRO", "DADO", "ESCRITA", "FACA", "GATO", "HARPA", "ILHA", "JANELA", "LIMAO", "MORANGO", "NUVEM", "OCULOS", "PATO", "QUADRO", "ROUPA", "SOL", "TESOURA", "UVA", "VELA", "XADREZ"];

export function generateMath() {
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;
  const op = Math.random() > 0.5 ? '+' : '-';
  return {
    text: `${a} ${op} ${b}`,
    answer: op === '+' ? (a + b).toString() : (a - b).toString()
  };
}