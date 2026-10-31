// All the queueing maths lives here. Inputs are converted to the "display unit"
// first, then every formula runs in that one unit.

const UNIT = { seconds: 1, minutes: 60, hours: 3600 };      // length in seconds
const ONE  = { seconds: 'second', minutes: 'minute', hours: 'hour' };
const f = (x) => String(Number(x.toFixed(4)));              // tidy number for display

// Turn one side (arrival or service) into a mean time and std deviation in the display unit.
function readSide(side, name, displayUnit, needSd) {
  if (!side || !UNIT[side.unit]) throw new Error(`${name}: choose a time unit.`);
  if (!(side.value > 0)) throw new Error(`${name}: the value must be greater than 0.`);
  if (needSd && !(typeof side.sd === 'number' && side.sd >= 0))
    throw new Error(`${name}: enter the standard deviation (0 or more).`);
  const meanSec = side.type === 'rate' ? UNIT[side.unit] / side.value : side.value * UNIT[side.unit];
  const sdSec = (side.sd || 0) * UNIT[side.unit];
  return { mean: meanSec / UNIT[displayUnit], sd: sdSec / UNIT[displayUnit] };
}

function calculate(input) {
  const { model, displayUnit } = input;
  if (!['MM1', 'MG1', 'GG1'].includes(model)) throw new Error('Unknown queue model.');
  if (!UNIT[displayUnit]) throw new Error('Unknown display unit.');

  const arr = readSide(input.arrival, 'Arrival', displayUnit, model.startsWith('GG'));
  const svc = readSide(input.service, 'Service', displayUnit, model !== 'MM1');

  const one = ONE[displayUnit];
  const lambda = 1 / arr.mean;                // arrivals per time unit
  const mu = 1 / svc.mean;                    // services per time unit
  const rho = lambda / mu;                    // utilization (single server)

  const steps = [
    `λ = 1 / mean inter-arrival time = 1 / ${f(arr.mean)} = ${f(lambda)} per ${one}`,
    `μ = 1 / mean service time = 1 / ${f(svc.mean)} = ${f(mu)} per ${one}`,
    `ρ = λ / μ = ${f(lambda)} / ${f(mu)} = ${f(rho)}`
  ];
  if (rho >= 1)
    throw new Error(`The system is unstable: utilization ρ = ${f(rho)} must be below 1. Lower the arrival rate or increase service speed.`);

  let Lq, p0 = null;

  if (model === 'MM1') {
    Lq = rho ** 2 / (1 - rho);
    p0 = 1 - rho;
    steps.push(`Lq = ρ² / (1 - ρ) = ${f(rho)}² / (1 - ${f(rho)}) = ${f(Lq)}`);
    steps.push(`P0 = 1 - ρ = ${f(p0)}`);

  } else if (model === 'MG1') {                       // Pollaczek-Khinchine
    const v = svc.sd ** 2;
    Lq = (lambda ** 2 * v + rho ** 2) / (2 * (1 - rho));
    steps.push(`σ² (service variance) = ${f(svc.sd)}² = ${f(v)}`);
    steps.push(`Lq = (λ²σ² + ρ²) / (2(1 - ρ)) = (${f(lambda)}² × ${f(v)} + ${f(rho)}²) / (2 × (1 - ${f(rho)})) = ${f(Lq)}`);

  } else {                                            // GG1: Sakasegawa approximation (c = 1)
    const ca2 = (arr.sd / arr.mean) ** 2;
    const cs2 = (svc.sd / svc.mean) ** 2;
    const Wq = (rho / (1 - rho)) * ((ca2 + cs2) / 2) * svc.mean;
    Lq = lambda * Wq;
    steps.push(`Ca² = (σa / mean)² = (${f(arr.sd)} / ${f(arr.mean)})² = ${f(ca2)}`);
    steps.push(`Cs² = (σs / mean)² = (${f(svc.sd)} / ${f(svc.mean)})² = ${f(cs2)}`);
    steps.push(`Wq ≈ [ρ / (1 - ρ)] × [(Ca² + Cs²) / 2] × (1/μ) = ${f(Wq)} ${displayUnit}`);
    steps.push(`Lq = λ × Wq = ${f(lambda)} × ${f(Wq)} = ${f(Lq)}`);
  }

  const Wq = Lq / lambda;
  const W = Wq + 1 / mu;
  const L = lambda * W;
  steps.push(`Wq = Lq / λ = ${f(Lq)} / ${f(lambda)} = ${f(Wq)} ${displayUnit}`);
  steps.push(`W = Wq + 1/μ = ${f(Wq)} + ${f(svc.mean)} = ${f(W)} ${displayUnit}`);
  steps.push(`L = λ × W = ${f(lambda)} × ${f(W)} = ${f(L)} vehicles`);

  const results = [
    { key: 'meanIa', label: 'Mean inter-arrival time', value: arr.mean, unit: displayUnit },
    { key: 'meanSv', label: 'Mean service time', value: svc.mean, unit: displayUnit },
    { key: 'lambda', label: 'Arrival rate (λ)', value: lambda, unit: `per ${one}` },
    { key: 'mu', label: 'Service rate (μ)', value: mu, unit: `per ${one}` },
    { key: 'rho', label: 'Utilization (ρ)', value: rho, unit: '' },
    { key: 'L', label: 'Vehicles in system (L)', value: L, unit: '' },
    { key: 'Lq', label: 'Vehicles in queue (Lq)', value: Lq, unit: '' },
    { key: 'W', label: 'Time in system (W)', value: W, unit: displayUnit },
    { key: 'Wq', label: 'Waiting time (Wq)', value: Wq, unit: displayUnit }
  ];
  if (p0 !== null) results.push({ key: 'p0', label: 'System empty (P0)', value: p0, unit: '' });

  return { model, results, steps };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculate };
}
if (typeof window !== 'undefined') {
  window.queueModels = { calculate };
}
