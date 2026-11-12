# Simulador de Motores

Planeje, monte peça por peça, teste no dinamômetro e dirija o seu motor, tudo no navegador e rodando localmente (Mac, Windows ou Linux).

**Fluxo:** 1 · Planejar → 2 · Montar → 3 · Dinamômetro → 4 · Test drive → 5 · Motor por dentro

## Como rodar no Mac

1. Instale o [Node.js](https://nodejs.org) (versão LTS). Se já tiver o Python 3, ele também serve.
2. Dê dois cliques em `start.command`. Se o Mac bloquear, clique com o botão direito → Abrir.
   - Pelo Terminal: `npm start` e abra <http://localhost:8080>
3. Clique em **🔈 Ligar som** (o navegador só libera áudio depois de um clique).

Não precisa instalar nenhuma dependência: é HTML + JavaScript puro, sem etapa de build.

## O que dá para fazer

**Planejar:** objetivo (econômico, esportivo, pista, arrancada, trabalho), carroceria, combustível, injeção ou carburador, aspiração, nitro, arquitetura, cilindros, cilindrada, híbrido, tração e câmbio. O planejador gera um projeto coerente (diâmetro/curso, taxa, comando, coletores, câmbio).

**Montar (peças):**
- **Catálogo de componentes reais**, aplicados separadamente para permitir combinações exóticas:
  - Motores: VW EA211 1.0 TSI, VR6 2.8 e 3.6, W12 6.0, EA888 Gen3, BMW N55 / B58 / S55, Mercedes-AMG M177 / M156 / M256 (com EQ Boost), Ford 1.0 e 2.3 EcoBoost, Ford Rocam 1.0 e 1.6, Honda K20A / K20C1 / R18A, MWM Sprint 2.8, Fiat Fire 1.0 e E.torQ 1.8, BYD 1.5 Xiaoyun (Atkinson), GWM 1.5T
  - Motores elétricos: BYD Song Plus DM-i, Seal (RWD/AWD), Dolphin, GWM H6 HEV/PHEV, Geely EX2, Porsche Taycan Turbo S, Volvo XC40 Recharge, Mercedes EQ Boost
  - Baterias: BYD Blade (18,3 / 44,9 / 82,5 kWh), GWM, Geely, Volvo (78 e 18,8 kWh), Porsche (Taycan 93,4 e Cayenne 25,9 kWh), Mercedes 48 V
  - Carros completos: 28 modelos, de Uno 1.0 a Taycan
- **Bloco:** em linha, V, boxer, W; 1 a 16 cilindros; ângulo do V; virabrequim plano ou cruzado; diâmetro, curso, taxa, corte, marcha lenta, volante, ciclo Atkinson, limitador de torque
- **Cabeçote:** OHV, SOHC, DOHC, válvulas eletromagnéticas (camless); 2 a 5 válvulas; perfil do comando; VVT; VTEC; levante variável (tipo Valvetronic)
- **Admissão:** filtro (papel, esportivo, cônico, sem), borboleta única ou ITB, comprimento do coletor, aspirado / turbo / biturbo / supercharger, pressão, tamanho da turbina, intercooler, válvula de alívio
- **Nitro:** tamanho do kit, cilindro, rotação de ativação
- **Combustível:** gasolina comum (E27), premium, pura, de competição, etanol, E85, metanol, diesel, biodiesel; carburador (CFM, gicleur, parafuso da lenta), injeção indireta/direta/dupla, diesel indireto/direto/common-rail; vazão dos bicos, bomba e pressão da linha; mistura (λ) e limite de fumaça
- **Ignição:** distribuidor (falha em giro alto e não tem sensor de detonação), centelha perdida, bobina individual; avanço do ponto
- **Escape:** coletor original, dimensionado curto ou longo, comprimentos desiguais, saída simples ou dupla, diâmetro, comprimento, catalisador, abafador, ressonador
- **Câmbio:** manual ou automático, 1 a 10 marchas com cada relação ajustável, diferencial, embreagem (capacidade e automática/manual)
- **Híbrido / elétrico:** potência, torque e rotação do motor elétrico, redução própria, bateria (kWh, kW, peso), freio regenerativo, modos híbrido / esporte / elétrico / carregar, e carro 100% elétrico

**Dinamômetro:** curva calculada (torque, cv, boost e faixa do VTEC), curva "fantasma" para comparar mudanças, puxada real com lag de turbo, freio com carga ajustável.

**Test drive:** estrada na praia com 700 m planos (0–100 km/h e 400 m cronometrados) e depois morros. Acelerador, freio, troca de marcha, embreagem manual, nitro, partida, motor morrendo, pneu patinando, chamas no escape.

**Motor por dentro:** pistões, bielas, virabrequim, válvulas, vela e fases do ciclo animados com a ordem de ignição real, em câmera lenta ajustável, mais o diagrama de energia do híbrido (motor → rodas, bateria carregando/descarregando, regeneração e freio a disco).

**Telemetria ao vivo:** rotação, torque, cv, kW, acelerador, boost, pressão no coletor, rotação da turbina, fluxo de ar, fluxo de combustível, consumo (L/h e L/100 km), λ, AFR, temperatura do ar, da água, do óleo e do escape, eficiência volumétrica e térmica, consumo específico, ponto e atraso por detonação, duty dos bicos, uso da bomba, falhas, saúde do motor, bateria, motor elétrico e mais.

**O motor quebra:** passar do giro (biela, ou válvula batendo no pistão), detonação, escape quente demais, mistura pobre em carga, superaquecimento, óleo quente, turbina acima do limite e giro alto com motor frio. O radiador e o óleo têm temperatura simulada.

## Controles

| Tecla | Ação |
|---|---|
| ↑ / W | acelerar |
| ↓ / S | frear |
| E / → | sobe marcha (no automático: N → D) |
| Q / ← | reduz marcha (até N e R) |
| C | embreagem (desligue a "embreagem automática" no câmbio) |
| N | nitro |
| I | liga/desliga o motor |
| R | volta para a largada |
| M | mudo |

## Como o modelo funciona

- **Motor** (`src/engine/engine.js`): modelo de valor médio por ciclo, baseado em equações físicas.
  Torque = (PMEi − PMEatrito − PMEbombeamento) · Vd / 4π. A massa de ar por ciclo vem da eficiência volumétrica (comando, VVT/VTEC, coletores sintonizados, limite de fluxo das válvulas, flutuação, restrições de filtro, catalisador, abafador e diâmetro do escape) e da densidade no coletor (borboleta, boost, intercooler, resfriamento pelo combustível). A eficiência térmica segue o ciclo Otto/Diesel corrigido. A detonação compara a "demanda" (taxa, pressão, temperatura, mistura, avanço) com o limite do combustível. A turbina tem enchimento com lag, choke e válvula de alívio.
- **Catálogo** (`src/engine/catalog.js`): dados de ficha técnica. Ao aplicar um motor, ele é calibrado (pressão do turbo, faixa do comando e enchimento) para bater os cv e o torque oficiais. Vazão de bicos e bomba, diâmetro de escape e algumas relações de câmbio **são estimativas**, porque as montadoras não publicam.
- **Carro** (`src/sim/vehicle.js`): passo fixo de 1 ms; embreagem e pneus com modelo gruda/escorrega; transferência de peso; aerodinâmica; rampas; ABS; freio regenerativo combinado; híbrido P2 com redução própria; bateria com limite de potência.
- **Som** (`src/audio/`): síntese em tempo real num AudioWorklet. Cada explosão gera um pulso na ordem de ignição real; o pulso passa por um "escape virtual" (ressonância do tubo, diâmetro, abafador, ressonador) e soma admissão, turbina, válvula de alívio, supercharger, motor elétrico, batida de válvulas, "tec-tec" do diesel e o grilo da detonação.

### Precisão

As curvas de cv e torque dos motores do catálogo batem com a ficha técnica (há um teste automático para isso), e os tempos de 0–100 km/h dos carros ficam perto dos reais. Mesmo assim, é um modelo de valor médio: ele não resolve o gás dentro do cilindro grau a grau. Esse é o próximo passo (ver abaixo).

## Próximos passos

1. **Física por ângulo de virabrequim (base do Engine Simulator do AngeTheGreat, licença MIT):** compilar o núcleo de simulação dele (C++: gás nos cilindros e coletores, combustão, válvulas, virabrequim e sintetizador de som por pressão no escape) para WebAssembly e usá-lo como "motor de alta fidelidade" dentro deste projeto, mantendo nossas peças, catálogo, híbrido, test drive e telemetria. O som passa a vir da pressão simulada no escape, como no original.
2. Test drive em 3D (Three.js), com câmera atrás do carro.
3. Mais motores e carros no catálogo; importar os motores `.mr` da comunidade do Engine Simulator.
4. App nativo para Mac (empacotando com Tauri ou Electron).

## Testes

```
npm test
```

## Estrutura

```
index.html, css/style.css     interface
src/main.js                   ligação de tudo + laço principal
src/engine/                   motor, combustíveis, configuração, planejador, catálogo real
src/sim/                      carro/câmbio/híbrido, dinamômetro, pista
src/audio/                    síntese do som (AudioWorklet)
src/render/                   test drive 2D, gráficos, motor por dentro
src/ui/                       planejador, montador, telemetria
tests/run.mjs                 testes do modelo
```
