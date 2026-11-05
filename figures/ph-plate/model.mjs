// Pure model of the pH scale: colour of universal indicator, [H+] and a household example.
// Shared by the build (static drawing) and the live page (readout, meter needle).

// Typical colours of a universal indicator (pH paper / solution chart), pH 0…14.
export const COLOURS = [
  "#c8102e", // 0  тёмно-красный
  "#e4232b", // 1  красный
  "#ee4f25", // 2  красно-оранжевый
  "#f57f20", // 3  оранжевый
  "#f9a51b", // 4  жёлто-оранжевый
  "#f6d10f", // 5  жёлтый
  "#c4d22a", // 6  жёлто-зелёный
  "#5fb846", // 7  зелёный
  "#22a46b", // 8  сине-зелёный
  "#14999c", // 9  бирюзовый
  "#1f76b8", // 10 синий
  "#3150a2", // 11 индиго
  "#4a3a94", // 12 сине-фиолетовый
  "#5f2d88", // 13 фиолетовый
  "#6d2479", // 14 тёмно-фиолетовый
];

export const EXAMPLES = [
  "соляная кислота", // 0
  "желудочный сок", // 1
  "лимонный сок", // 2
  "уксус", // 3
  "томатный сок", // 4
  "кофе", // 5
  "молоко", // 6
  "чистая вода", // 7
  "морская вода", // 8
  "пищевая сода", // 9
  "мыло", // 10
  "нашатырный спирт", // 11
  "известковая вода", // 12
  "отбеливатель", // 13
  "средство для труб", // 14
];

// The wells on the spot plate, left to right.
export const WELLS = [1, 3, 5, 7, 9, 11, 13];

export const clampPh = (ph) => Math.min(14, Math.max(0, ph));

export function mediumOf(ph) {
  if (Math.abs(ph - 7) < 0.05) return "нейтральная среда";
  return ph < 7 ? "кислая среда" : "щелочная среда";
}

const SUPER = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const superscript = (text) => [...String(text)].map((char) => SUPER[char] ?? char).join("");

// Hydrogen-ion concentration in mol/L: [H+] = 10^(-pH).
export const hydrogenOf = (ph) => Math.pow(10, -ph);
export const hydrogenText = (ph) => `10${superscript(-Math.round(ph))} моль/л`;

// Colour for any pH, blended between whole steps (used by the needle band and readout).
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
export function colourOf(ph) {
  const p = clampPh(ph);
  const low = Math.floor(p);
  const high = Math.min(14, low + 1);
  return mix(COLOURS[low], COLOURS[high], p - low);
}

export function describe(ph) {
  const p = Math.round(clampPh(ph));
  return {
    ph: p,
    colour: COLOURS[p],
    example: EXAMPLES[p],
    medium: mediumOf(p),
    hydrogen: hydrogenOf(p),
    hydrogenText: hydrogenText(p),
    readout: `pH ${p} · ${EXAMPLES[p]} · ${mediumOf(p)}`,
  };
}
