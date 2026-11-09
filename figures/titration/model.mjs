// Acid–base titration: 25 mL of 0,1 M HCl titrated with 0,1 M NaOH, phenolphthalein as indicator.
// A small pure model: pH from the charge balance, indicator colour from its acid–base equilibrium,
// flow from the stopcock. Everything the figure shows (levels, colour, display, readout) comes from here.

export const TIT = {
  acid: 25, // mL of HCl in the flask
  ca: 0.1, // mol/L HCl
  cb: 0.1, // mol/L NaOH in the burette
  kw: 1e-14,
  pKin: 9.4, // phenolphthalein: colourless below about 8,2, crimson above about 10
  scale: 50, // mL, the burette's graduated length
  maxRate: 2.4, // mL/s through the fully open stopcock (figure time)
  drop: 0.05, // mL in one drop
};

export const equivalence = () => (TIT.acid * TIT.ca) / TIT.cb;

// pH after `added` mL of base: [H+] − [OH−] = (n(HCl) − n(NaOH)) / V, with [H+][OH−] = Kw.
export function phOf(added) {
  const v = (TIT.acid + added) / 1000;
  const d = (TIT.acid * TIT.ca - added * TIT.cb) / 1000 / v;
  const h = (d + Math.sqrt(d * d + 4 * TIT.kw)) / 2;
  return -Math.log10(h);
}

// Share of the indicator in its crimson form; below ~0,05 the eye sees no colour.
export function pinkOf(ph) {
  const f = 1 / (1 + Math.pow(10, TIT.pKin - ph));
  return Math.max(0, Math.min(1, (f - 0.03) / 0.8));
}

// Flow through the stopcock for an opening of 0..1 (the key's quarter turn).
export const flowOf = (open) => TIT.maxRate * Math.pow(Math.max(0, open), 1.6);

const comma = (value, digits) => value.toFixed(digits).replace(".", ",");
export const phText = (ph) => comma(ph, 2);

export function readoutOf({ added }) {
  return `добавлено ${comma(added, 2)} мл · pH ${phText(phOf(added))}`;
}

// Cumulative volume table for a body of revolution given as [z, r] knots (r of the inside).
export function volumeTable(profile, from, step = 0.25) {
  const radiusAt = (z) => {
    for (let index = 1; index < profile.length; index++) {
      const [z0, r0] = profile[index - 1];
      const [z1, r1] = profile[index];
      if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0 || 1);
    }
    return profile[profile.length - 1][1];
  };
  const top = profile[profile.length - 1][0];
  const rows = [[from, 0]];
  let volume = 0;
  for (let z = from; z < top; z += step) {
    const r = radiusAt(z + step / 2);
    volume += Math.PI * r * r * step;
    rows.push([z + step, volume]);
  }
  return rows;
}

export function levelFor(table, volume) {
  if (volume <= 0) return table[0][0];
  for (let index = 1; index < table.length; index++) {
    const [z0, v0] = table[index - 1];
    const [z1, v1] = table[index];
    if (volume <= v1) return z0 + ((z1 - z0) * (volume - v0)) / (v1 - v0 || 1);
  }
  return table[table.length - 1][0];
}

export const volumeAt = (table, z) => {
  for (let index = 1; index < table.length; index++) {
    const [z0, v0] = table[index - 1];
    const [z1, v1] = table[index];
    if (z <= z1) return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0 || 1);
  }
  return table[table.length - 1][1];
};
