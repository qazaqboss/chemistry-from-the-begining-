// Hofmann voltameter: a small pure model of water electrolysis.
// 2 H2O -> 2 H2 + O2. Cathode (-) makes H2, anode (+) makes O2, always 2 : 1 by volume.
// Everything the figure shows (levels, bubbles, needle, readout) is computed from here.

export const CELL = {
  faraday: 96485, // C/mol
  molarVolume: 24040, // mL/mol of an ideal gas at 20 °C and 101.3 kPa
  theory: 1.23, // V, thermodynamic decomposition voltage of water
  onset: 1.8, // V, practical onset on platinum (overpotentials included)
  resistance: 8, // ohm, dilute electrolyte between the two electrodes
  maxVolts: 12,
  speed: 60, // the figure runs 60x faster than the real cell
  scale: 50, // mL, the graduated length of each outer tube
};

// Current through the cell. Below the onset voltage practically nothing flows.
export function cellCurrent(volts) {
  return Math.max(0, (volts - CELL.onset) / CELL.resistance);
}

// Gas made per second of real cell time, in mL. Two electrons per H2, four per O2.
export function gasRates(amps) {
  const h2 = (amps / (2 * CELL.faraday)) * CELL.molarVolume;
  return { h2, o2: h2 / 2 };
}

// One step of the figure: dt is seconds of figure time. While the stopcocks are open the
// collected gas escapes (both volumes shrink by the same factor, so 2 : 1 holds throughout).
export function stepGas(gas, amps, dt, open) {
  if (open) {
    const keep = Math.exp(-dt / 0.32);
    const h2 = gas.h2 * keep;
    return h2 < 0.02 ? { h2: 0, o2: 0 } : { h2, o2: gas.o2 * keep };
  }
  const rate = gasRates(amps);
  const h2 = Math.min(CELL.scale, gas.h2 + rate.h2 * CELL.speed * dt);
  return { h2, o2: h2 / 2 };
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

// Water level for a given volume above the start of a table.
export function levelFor(table, volume) {
  if (volume <= 0) return table[0][0];
  for (let index = 1; index < table.length; index++) {
    const [z0, v0] = table[index - 1];
    const [z1, v1] = table[index];
    if (volume <= v1) return z0 + ((z1 - z0) * (volume - v0)) / (v1 - v0 || 1);
  }
  return table[table.length - 1][0];
}

const comma = (value, digits) => value.toFixed(digits).replace(".", ",");

export function readoutOf({ volts, amps, h2, o2 }) {
  return `U ${comma(volts, 1)} В · I ${comma(amps, 2)} А · H₂ ${comma(h2, 1)} мл · O₂ ${comma(o2, 1)} мл`;
}
