// Daniell–Jacobi cell: Zn | ZnSO4 || CuSO4 | Cu. A small pure model of its EMF.
// Zn → Zn²⁺ + 2e⁻ (anode, −), Cu²⁺ + 2e⁻ → Cu (cathode, +). At 25 °C the Nernst equation gives
// E = E° − (0,05916 / 2)·lg([Zn²⁺]/[Cu²⁺]) = 1,10 − 0,0296·lg([Zn²⁺]/[Cu²⁺]).
// The needle, the readout and the colour of the copper sulfate all come from here.

export const CELL = {
  standard: 1.1, // V, E°(Cu²⁺/Cu) − E°(Zn²⁺/Zn) = 0,34 − (−0,76)
  slope: 0.0296, // V per decade, 0,05916 / n with n = 2
  min: -3, // lg of the lowest concentration on the sliders (0,001 M)
  max: 0, // lg of the highest (1 M)
  full: 1.5, // V at the end of the voltmeter scale
};

export const emfOf = (zn, cu) => CELL.standard - CELL.slope * Math.log10(zn / cu);

// How blue the copper sulfate looks: deeper the more Cu²⁺ there is.
export const blueOf = (cu) => 0.18 + 0.72 * ((Math.log10(cu) - CELL.min) / (CELL.max - CELL.min));

const comma = (value, digits) => value.toFixed(digits).replace(".", ",");

export function molar(c) {
  if (c >= 0.995) return "1";
  if (c >= 0.1) return comma(c, 2).replace(/0$/, "");
  if (c >= 0.01) return comma(c, 3).replace(/0$/, "");
  return comma(c, 4).replace(/0$/, "");
}

export function readoutOf({ zn, cu, closed }) {
  const e = comma(emfOf(zn, cu), 3);
  return `${closed ? "U" : "ЭДС"} ${e} В · Zn²⁺ ${molar(zn)} M · Cu²⁺ ${molar(cu)} M`;
}
