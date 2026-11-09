// Simple distillation of an ethanol–water mixture: a small pure model.
// The pot is heated, warms up to the bubble point of the mixture and boils; the vapour is richer in
// ethanol than the liquid (vapour–liquid equilibrium at 101,3 kPa), so the first distillate is mostly
// alcohol, the pot gets poorer in alcohol and its boiling point climbs toward 100 °C.
// Everything the figure shows (thermometer, levels, drops, readout) is computed from here.

export const MIX = {
  ethanol: 70, // mL of ethanol in the flask at the start
  water: 30, // mL of water
  vE: 58.4, // mL/mol, molar volume of ethanol at 20 °C
  vW: 18.07, // mL/mol, water
  hE: 38600, // J/mol, heat of vaporisation of ethanol
  hW: 40700, // J/mol, water
  heatCap: 340, // J/K, the liquid with the glass of the flask
  loss: 1.1, // W/K lost to the room
  ambient: 20, // °C
  maxPower: 260, // W, the hotplate at full
  lag: 7, // s, how long the condensate takes through the condenser
  minLeft: 12, // mL, the hotplate is switched off before the flask runs dry
  speed: 10, // the figure runs 10x faster than the real still
};

// Ethanol–water at 101,3 kPa: mole fraction of ethanol in the liquid x, in the vapour y, boiling point T.
const VLE = [
  [0, 0, 100],
  [0.019, 0.17, 95.5],
  [0.0721, 0.3891, 89.0],
  [0.0966, 0.4375, 86.7],
  [0.1238, 0.4704, 85.3],
  [0.1661, 0.5089, 84.1],
  [0.2337, 0.5445, 82.7],
  [0.2608, 0.558, 82.3],
  [0.3273, 0.5826, 81.5],
  [0.3965, 0.6122, 80.7],
  [0.5079, 0.6564, 79.8],
  [0.5198, 0.6599, 79.7],
  [0.5732, 0.6841, 79.3],
  [0.6763, 0.7385, 78.74],
  [0.7472, 0.7815, 78.41],
  [0.8943, 0.8943, 78.15],
  [1, 1, 78.3],
];

function vle(x, column) {
  for (let i = 1; i < VLE.length; i++) {
    const a = VLE[i - 1];
    const b = VLE[i];
    if (x <= b[0]) return a[column] + ((b[column] - a[column]) * (x - a[0])) / (b[0] - a[0]);
  }
  return VLE[VLE.length - 1][column];
}
export const vapourOf = (x) => vle(Math.min(1, Math.max(0, x)), 1);
export const boilingOf = (x) => vle(Math.min(1, Math.max(0, x)), 2);

export function freshStill() {
  return {
    T: MIX.ambient, // °C of the liquid in the flask
    th: MIX.ambient, // °C the thermometer shows (vapour at the side arm)
    plate: MIX.ambient, // °C of the hotplate disc
    nE: MIX.ethanol / MIX.vE,
    nW: MIX.water / MIX.vW,
    pE: 0, // condensate on its way through the condenser, mol
    pW: 0,
    dE: 0, // collected in the receiver, mol
    dW: 0,
    boiling: false,
    flow: 0, // mL/s of distillate leaving the adapter (figure time)
  };
}

export const potVolume = (s) => s.nE * MIX.vE + s.nW * MIX.vW;
export const collected = (s) => s.dE * MIX.vE + s.dW * MIX.vW;
export const alcoholShare = (s) => (collected(s) > 0.01 ? (s.dE * MIX.vE) / collected(s) : 0);

// One step. power is 0..1 of the hotplate, dt is seconds of figure time.
export function stepStill(s, power, dt) {
  const h = dt * MIX.speed;
  const out = { ...s };
  const left = potVolume(s);
  const watts = left > MIX.minLeft ? power * MIX.maxPower : 0;
  // the hotplate disc follows its power (glow), the pot gets what the disc gives
  out.plate = s.plate + (MIX.ambient + watts * 0.9 - s.plate) * (1 - Math.exp(-h / 40));
  const x = s.nE / (s.nE + s.nW);
  const tb = boilingOf(x);
  const net = watts - MIX.loss * (s.T - MIX.ambient);
  if (s.T < tb - 0.01 || net <= 0) {
    out.T = Math.min(tb, s.T + (net * h) / MIX.heatCap);
    out.boiling = false;
  } else {
    const y = vapourOf(x);
    const n = Math.min((net * h) / (y * MIX.hE + (1 - y) * MIX.hW), (s.nE + s.nW) * 0.2);
    out.nE = Math.max(0, s.nE - y * n);
    out.nW = Math.max(0, s.nW - (1 - y) * n);
    out.pE = s.pE + y * n;
    out.pW = s.pW + (1 - y) * n;
    out.T = boilingOf(out.nE / (out.nE + out.nW || 1));
    out.boiling = true;
  }
  // the thermometer bulb sits in the vapour at the side arm: it reads the boiling point while vapour
  // reaches it, and only a little of the pot's warmth before that
  const want = out.boiling ? out.T : MIX.ambient + (out.T - MIX.ambient) * 0.12;
  out.th = s.th + (want - s.th) * (1 - Math.exp(-h / (out.boiling ? 9 : 30)));
  // condensate runs through the condenser and drips into the receiver
  const pass = 1 - Math.exp(-h / MIX.lag);
  const fE = s.pE * pass;
  const fW = s.pW * pass;
  out.pE = out.pE - fE;
  out.pW = out.pW - fW;
  out.dE = s.dE + fE;
  out.dW = s.dW + fW;
  out.flow = dt > 0 ? (fE * MIX.vE + fW * MIX.vW) / dt : 0;
  return out;
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

const comma = (value, digits) => value.toFixed(digits).replace(".", ",");

export function readoutOf(s) {
  const ml = collected(s);
  const share = ml > 0.05 ? `спирта ${Math.round(alcoholShare(s) * 100)} %` : "спирта —";
  return `t ${comma(s.th, 1)} °C · собрано ${comma(ml, 1)} мл · ${share}`;
}
