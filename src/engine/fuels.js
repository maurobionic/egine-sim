// Tabela de combustíveis.
// afr  = relação ar/combustível estequiométrica (kg de ar por kg de combustível)
// lhv  = poder calorífico inferior (J/kg)
// knock = "limite de detonação" equivalente (quanto maior, mais compressão/pressão aguenta)
// cool = resfriamento por evaporação na admissão (K) – etanol e metanol esfriam muito a mistura
// density = kg/L (para mostrar L/h)
export const FUELS = {
  gasolinaComum: {
    name: 'Gasolina comum (E27)', kind: 'otto', afr: 13.2, lhv: 40.2e6,
    knock: 11.6, cool: 4, density: 0.75, effBonus: 0,
  },
  gasolinaPremium: {
    name: 'Gasolina premium (E25, alta octanagem)', kind: 'otto', afr: 13.3, lhv: 40.4e6,
    knock: 12.4, cool: 4, density: 0.75, effBonus: 0,
  },
  gasolinaPura: {
    name: 'Gasolina pura (sem etanol, 95 RON)', kind: 'otto', afr: 14.7, lhv: 43.4e6,
    knock: 11.9, cool: 0, density: 0.745, effBonus: 0,
  },
  gasolinaCorrida: {
    name: 'Gasolina de competição (~110 oct.)', kind: 'otto', afr: 14.5, lhv: 43.0e6,
    knock: 14.2, cool: 2, density: 0.72, effBonus: 0,
  },
  etanol: {
    name: 'Etanol hidratado (E100)', kind: 'otto', afr: 8.4, lhv: 24.8e6,
    knock: 15.3, cool: 28, density: 0.81, effBonus: 0.02,
  },
  e85: {
    name: 'E85', kind: 'otto', afr: 9.8, lhv: 29.2e6,
    knock: 14.8, cool: 20, density: 0.78, effBonus: 0.015,
  },
  metanol: {
    name: 'Metanol (arrancada)', kind: 'otto', afr: 6.45, lhv: 19.9e6,
    knock: 17.0, cool: 45, density: 0.79, effBonus: 0.03,
  },
  diesel: {
    name: 'Diesel S10', kind: 'diesel', afr: 14.5, lhv: 42.6e6,
    knock: 99, cool: 0, density: 0.84, effBonus: 0,
  },
  biodiesel: {
    name: 'Biodiesel (B100)', kind: 'diesel', afr: 12.5, lhv: 37.3e6,
    knock: 99, cool: 0, density: 0.88, effBonus: 0.005,
  },
};

export const isDieselFuel = (key) => FUELS[key]?.kind === 'diesel';
