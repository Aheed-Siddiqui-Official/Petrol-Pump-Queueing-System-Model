// ============================================================================
// Petrol Pump Queueing Models & Discrete-Event Simulation Engine
// Supports:
//   1. Analytical Theory: M/M/1, M/G/1, G/G/1 (Sakasegawa)
//   2. Discrete-Event Simulation: M/M/1 (1 Pump) and M/M/2 (2 Parallel Pumps)
// ============================================================================

const UNIT = { seconds: 1, minutes: 60, hours: 3600 };
const ONE  = { seconds: 'second', minutes: 'minute', hours: 'hour' };
const f = (x) => String(Number(x.toFixed(4)));

// Turn arrival or service input into mean time and standard deviation in the target display unit
function readSide(side, name, displayUnit, needSd) {
  if (!side || !UNIT[side.unit]) throw new Error(`${name}: choose a valid time unit.`);
  if (!(side.value > 0)) throw new Error(`${name}: the value must be greater than 0.`);
  if (needSd && !(typeof side.sd === 'number' && side.sd >= 0))
    throw new Error(`${name}: enter the standard deviation (0 or more).`);

  const meanSec = side.type === 'rate' ? UNIT[side.unit] / side.value : side.value * UNIT[side.unit];
  const sdSec = (side.sd || 0) * UNIT[side.unit];
  return { mean: meanSec / UNIT[displayUnit], sd: sdSec / UNIT[displayUnit] };
}

// ----------------------------------------------------------------------------
// Analytical Models (Steady-State Formulas)
// ----------------------------------------------------------------------------
function calculate(input) {
  const { model, displayUnit } = input;
  if (!['MM1', 'MG1', 'GG1'].includes(model)) throw new Error('Unknown queue model.');
  if (!UNIT[displayUnit]) throw new Error('Unknown display unit.');

  const arr = readSide(input.arrival, 'Arrival', displayUnit, model.startsWith('GG'));
  const svc = readSide(input.service, 'Service', displayUnit, model !== 'MM1');

  const one = ONE[displayUnit];
  const lambda = 1 / arr.mean; // arrivals per display unit
  const mu = 1 / svc.mean;     // services per display unit
  const rho = lambda / mu;     // utilization

  const steps = [
    `λ = 1 / mean inter-arrival time = 1 / ${f(arr.mean)} = ${f(lambda)} per ${one}`,
    `μ = 1 / mean service time = 1 / ${f(svc.mean)} = ${f(mu)} per ${one}`,
    `ρ = λ / μ = ${f(lambda)} / ${f(mu)} = ${f(rho)}`
  ];

  if (rho >= 1) {
    throw new Error(`The system is unstable: utilization ρ = ${f(rho)} must be below 1. Lower the arrival rate or increase service speed.`);
  }

  let Lq;
  if (model === 'MM1') {
    Lq = (rho ** 2) / (1 - rho);
    steps.push(`Lq = ρ² / (1 - ρ) = ${f(rho)}² / (1 - ${f(rho)}) = ${f(Lq)}`);
    steps.push(`P0 = 1 - ρ = ${f(1 - rho)}`);
  } else if (model === 'MG1') { // Pollaczek-Khinchine Formula
    const v = svc.sd ** 2;
    Lq = (lambda ** 2 * v + rho ** 2) / (2 * (1 - rho));
    steps.push(`σ² (service variance) = ${f(svc.sd)}² = ${f(v)}`);
    steps.push(`Lq = (λ²σ² + ρ²) / (2(1 - ρ)) = (${f(lambda)}² × ${f(v)} + ${f(rho)}²) / (2 × (1 - ${f(rho)})) = ${f(Lq)}`);
  } else { // GG1: Sakasegawa Approximation (c = 1)
    const ca2 = (arr.sd / arr.mean) ** 2;
    const cs2 = (svc.sd / svc.mean) ** 2;
    const WqSakasegawa = (rho / (1 - rho)) * ((ca2 + cs2) / 2) * svc.mean;
    Lq = lambda * WqSakasegawa;
    steps.push(`Ca² = (σa / mean)² = (${f(arr.sd)} / ${f(arr.mean)})² = ${f(ca2)}`);
    steps.push(`Cs² = (σs / mean)² = (${f(svc.sd)} / ${f(svc.mean)})² = ${f(cs2)}`);
    steps.push(`Wq ≈ [ρ / (1 - ρ)] × [(Ca² + Cs²) / 2] × (1/μ) = ${f(WqSakasegawa)} ${displayUnit}`);
    steps.push(`Lq = λ × Wq = ${f(lambda)} × ${f(WqSakasegawa)} = ${f(Lq)}`);
  }

  const Wq = Lq / lambda;
  const W = Wq + 1 / mu;
  const L = lambda * W;
  const p0 = 1 - rho;

  steps.push(`Wq = Lq / λ = ${f(Lq)} / ${f(lambda)} = ${f(Wq)} ${displayUnit}`);
  steps.push(`W = Wq + 1/μ = ${f(Wq)} + ${f(svc.mean)} = ${f(W)} ${displayUnit}`);
  steps.push(`L = λ × W = ${f(lambda)} × ${f(W)} = ${f(L)} vehicles`);

  const results = [
    { key: 'rho', label: 'Utilization (ρ)', value: rho, unit: '' },
    { key: 'Lq', label: 'Mean Number in Queue (Lq)', value: Lq, unit: '' },
    { key: 'Wq', label: 'Mean Wait in Queue (Wq)', value: Wq, unit: displayUnit },
    { key: 'L', label: 'Mean Number in System (L)', value: L, unit: '' },
    { key: 'W', label: 'Mean Wait in System (W)', value: W, unit: displayUnit },
    { key: 'p0', label: 'Idle Probability (P0)', value: p0, unit: '' }
  ];

  return { model, results, steps };
}

// ----------------------------------------------------------------------------
// Discrete-Event Simulation (M/M/1 and M/M/2)
// ----------------------------------------------------------------------------
function simulateQueue(input) {
  const model = input.model === 'MM2' ? 'MM2' : 'MM1';
  const timeUnit = input.timeUnit || 'seconds';
  if (!UNIT[timeUnit]) throw new Error('Unknown time unit.');

  const customerCount = Math.max(1, Math.min(500, Number(input.customerCount) || 10));
  const arr = readSide(input.arrival, 'Arrival', timeUnit, false);
  const svc = readSide(input.service, 'Service', timeUnit, false);

  const lambda = 1 / arr.mean;
  const mu = 1 / svc.mean;
  const servers = model === 'MM2' ? 2 : 1;

  // Pseudo-random generator (seeded or Math.random)
  let seedState = typeof input.seed === 'number' && !isNaN(input.seed) ? input.seed : null;
  function randomUniform() {
    if (seedState !== null) {
      seedState = (seedState * 9301 + 49297) % 233280;
      return Math.max(0.00001, Math.min(0.99999, seedState / 233280));
    }
    return Math.max(0.00001, Math.min(0.99999, Math.random()));
  }

  const rows = [];
  let currentArrivalClock = 0;
  let pump1FreeAt = 0;
  let pump2FreeAt = 0;
  let pump1BusyTime = 0;
  let pump2BusyTime = 0;

  for (let i = 1; i <= customerCount; i++) {
    let rArr = Number(randomUniform().toFixed(5));
    let interArrival;

    if (i === 1) {
      interArrival = 0;
      currentArrivalClock = 0;
    } else {
      interArrival = Math.max(0.01, Number((-Math.log(1 - rArr) / lambda).toFixed(2)));
      currentArrivalClock = Number((currentArrivalClock + interArrival).toFixed(2));
    }

    let rSvc = Number(randomUniform().toFixed(5));
    let serviceTime = Math.max(0.01, Number((-Math.log(1 - rSvc) / mu).toFixed(2)));

    let assignedServer;
    let serviceStart;
    let serviceEnd;
    let idleTime = 0;

    if (servers === 1) {
      assignedServer = 'Pump 1';
      if (currentArrivalClock >= pump1FreeAt) {
        idleTime = Number((currentArrivalClock - pump1FreeAt).toFixed(2));
        serviceStart = currentArrivalClock;
      } else {
        idleTime = 0;
        serviceStart = pump1FreeAt;
      }
      serviceEnd = Number((serviceStart + serviceTime).toFixed(2));
      pump1FreeAt = serviceEnd;
      pump1BusyTime += serviceTime;
    } else {
      // MM2 (2 Parallel Pumps)
      if (pump1FreeAt <= currentArrivalClock) {
        assignedServer = 'Pump 1';
        idleTime = Number((currentArrivalClock - pump1FreeAt).toFixed(2));
        serviceStart = currentArrivalClock;
        serviceEnd = Number((serviceStart + serviceTime).toFixed(2));
        pump1FreeAt = serviceEnd;
        pump1BusyTime += serviceTime;
      } else if (pump2FreeAt <= currentArrivalClock) {
        assignedServer = 'Pump 2';
        idleTime = Number((currentArrivalClock - pump2FreeAt).toFixed(2));
        serviceStart = currentArrivalClock;
        serviceEnd = Number((serviceStart + serviceTime).toFixed(2));
        pump2FreeAt = serviceEnd;
        pump2BusyTime += serviceTime;
      } else {
        // Both busy, route to whichever ends earlier
        if (pump1FreeAt <= pump2FreeAt) {
          assignedServer = 'Pump 1';
          idleTime = 0;
          serviceStart = pump1FreeAt;
          serviceEnd = Number((serviceStart + serviceTime).toFixed(2));
          pump1FreeAt = serviceEnd;
          pump1BusyTime += serviceTime;
        } else {
          assignedServer = 'Pump 2';
          idleTime = 0;
          serviceStart = pump2FreeAt;
          serviceEnd = Number((serviceStart + serviceTime).toFixed(2));
          pump2FreeAt = serviceEnd;
          pump2BusyTime += serviceTime;
        }
      }
    }

    const waitInQueue = Number(Math.max(0, serviceStart - currentArrivalClock).toFixed(2));
    const timeInSystem = Number((serviceEnd - currentArrivalClock).toFixed(2));

    rows.push({
      customerId: i,
      randomArrival: i === 1 ? 0 : rArr,
      interArrivalTime: interArrival,
      arrivalTime: currentArrivalClock,
      randomService: rSvc,
      serviceTime: serviceTime,
      assignedServer: assignedServer,
      serviceStartTime: serviceStart,
      serviceEndTime: serviceEnd,
      waitInQueue: waitInQueue,
      timeInSystem: timeInSystem,
      serverIdleTime: idleTime
    });
  }

  const totalSimulationTime = Number((servers === 1 ? pump1FreeAt : Math.max(pump1FreeAt, pump2FreeAt)).toFixed(2));
  const simUtil = Number(((pump1BusyTime + pump2BusyTime) / (servers * (totalSimulationTime || 1))).toFixed(4));
  const s1Util = Number((pump1BusyTime / (totalSimulationTime || 1)).toFixed(4));
  const s2Util = servers === 2 ? Number((pump2BusyTime / (totalSimulationTime || 1)).toFixed(4)) : null;

  const sumWait = rows.reduce((acc, r) => acc + r.waitInQueue, 0);
  const sumSystem = rows.reduce((acc, r) => acc + r.timeInSystem, 0);
  const sumInterArr = rows.slice(1).reduce((acc, r) => acc + r.interArrivalTime, 0);
  const sumSvc = rows.reduce((acc, r) => acc + r.serviceTime, 0);

  const avgWq = Number((sumWait / customerCount).toFixed(4));
  const avgW = Number((sumSystem / customerCount).toFixed(4));
  const avgLq = Number((sumWait / (totalSimulationTime || 1)).toFixed(4));
  const avgL = Number((sumSystem / (totalSimulationTime || 1)).toFixed(4));

  const customersWaited = rows.filter(r => r.waitInQueue > 0.001).length;
  const customersWaitedPct = Number(((customersWaited / customerCount) * 100).toFixed(1));
  const maxWait = Math.max(...rows.map(r => r.waitInQueue));

  let maxQueue = 0;
  for (const r of rows) {
    const inQueue = rows.filter(o => o.arrivalTime <= r.arrivalTime && o.serviceStartTime > r.arrivalTime).length;
    if (inQueue > maxQueue) maxQueue = inQueue;
  }

  // Theoretical comparison
  let theoreticalRho;
  let isStable;
  let theoLq = null;
  let theoWq = null;
  let theoL = null;
  let theoW = null;
  let theoP0 = null;

  if (servers === 1) {
    theoreticalRho = lambda / mu;
    isStable = theoreticalRho < 1;
    if (isStable) {
      theoP0 = 1 - theoreticalRho;
      theoLq = (theoreticalRho ** 2) / (1 - theoreticalRho);
      theoWq = theoLq / lambda;
      theoW = theoWq + (1 / mu);
      theoL = lambda * theoW;
    }
  } else {
    const r = lambda / mu;
    theoreticalRho = r / 2;
    isStable = theoreticalRho < 1;
    if (isStable) {
      const p0Inv = 1 + r + ((r ** 2) / (2 * (1 - theoreticalRho)));
      theoP0 = 1 / p0Inv;
      theoLq = (theoP0 * (r ** 2) * theoreticalRho) / (2 * ((1 - theoreticalRho) ** 2));
      theoWq = theoLq / lambda;
      theoW = theoWq + (1 / mu);
      theoL = theoLq + r;
    }
  }

  return {
    model,
    servers,
    customerCount,
    timeUnit,
    totalSimulationTime,
    simulatedUtilization: simUtil,
    server1Utilization: s1Util,
    server2Utilization: s2Util,
    avgWaitQueue: avgWq,
    avgTimeSystem: avgW,
    avgQueueLength: avgLq,
    avgNumberSystem: avgL,
    maxWaitTime: maxWait,
    maxQueueLength: maxQueue,
    customersWaitedCount: customersWaited,
    customersWaitedPercent: customersWaitedPct,
    avgInterArrivalTime: rows.length > 1 ? Number((sumInterArr / (rows.length - 1)).toFixed(2)) : 0,
    avgServiceTime: Number((sumSvc / customerCount).toFixed(2)),
    theoreticalRho: Number(theoreticalRho.toFixed(4)),
    isTheoreticalStable: isStable,
    theoreticalLq: theoLq !== null ? Number(theoLq.toFixed(4)) : null,
    theoreticalWq: theoWq !== null ? Number(theoWq.toFixed(4)) : null,
    theoreticalL: theoL !== null ? Number(theoL.toFixed(4)) : null,
    theoreticalW: theoW !== null ? Number(theoW.toFixed(4)) : null,
    theoreticalP0: theoP0 !== null ? Number(theoP0.toFixed(4)) : null,
    rows
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculate, simulateQueue };
}
if (typeof window !== 'undefined') {
  window.queueModels = { calculate, simulateQueue };
}
