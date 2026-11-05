// Положение элемента в «длинной» таблице: 18 столбцов, лантаноиды и актиноиды — отдельными рядами.
export function layoutOf(e) {
  if (e.z >= 57 && e.z <= 71) return { col: 3 + (e.z - 57), row: 9 };
  if (e.z >= 89 && e.z <= 103) return { col: 3 + (e.z - 89), row: 10 };
  return { col: e.group, row: e.period };
}

export const CAT_COLORS = {
  alkali: "#ff6b6b",
  alkaline: "#ffa94d",
  transition: "#ffd43b",
  "post-transition": "#8ce99a",
  metalloid: "#38d9a9",
  nonmetal: "#4dabf7",
  halogen: "#9775fa",
  noble: "#da77f2",
  lanthanide: "#f783ac",
  actinide: "#e599f7",
};

export const CAT_NAMES = {
  alkali: "Щелочные металлы",
  alkaline: "Щёлочноземельные металлы",
  transition: "Переходные металлы",
  "post-transition": "Постпереходные металлы",
  metalloid: "Полуметаллы",
  nonmetal: "Неметаллы",
  halogen: "Галогены",
  noble: "Благородные газы",
  lanthanide: "Лантаноиды",
  actinide: "Актиноиды",
};

export const STATE_NAMES = { solid: "твёрдое", liquid: "жидкое", gas: "газ", unknown: "неизвестно" };
