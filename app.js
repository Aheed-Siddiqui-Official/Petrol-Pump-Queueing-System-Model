// Frontend: reads the form, sends it to the backend, and shows the answer.
const $ = (id) => document.getElementById(id);

const MODELS = [
  ['MM1', 'M/M/1 (Poisson arrivals, Exponential service)'],
  ['MG1', 'M/G/1 (Poisson arrivals, General service variance)'],
  ['GG1', 'G/G/1 (General arrivals, General service)']
];

// Fill the model list
function fillModels() {
  $('model').innerHTML = MODELS
    .map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
}

// Show only the fields the chosen model needs, and update the labels
function refreshForm() {
  const m = $('model').value;
  const generalArrival = m.startsWith('GG');
  const generalService = m !== 'MM1';

  $('arrSdRow').hidden = !generalArrival;
  $('svcSdRow').hidden = !generalService;
  $('arrLegend').textContent = generalArrival ? 'Arrival (general distribution)' : 'Arrival (Poisson)';
  $('svcLegend').textContent = generalService ? 'Service (general distribution)' : 'Service (exponential)';

  for (const side of ['arr', 'svc']) {
    const unit = $(side + 'Unit').value;
    const rate = $(side + 'Type').value === 'rate';
    const name = side === 'arr' ? 'Arrival' : 'Service';
    const timeName = side === 'arr' ? 'inter-arrival time' : 'service time';
    $(side + 'ValueLabel').textContent = rate ? `${name} rate, per ${unit.slice(0, -1)}` : `Mean ${timeName} (${unit})`;
    $(side + 'SdLabel').textContent = `Standard deviation of ${timeName} (${unit})`;
  }

  // Highlight the active model's formula card in the reference guide
  document.querySelectorAll('.formula-item').forEach((item) => {
    item.classList.toggle('active-formula', item.getAttribute('data-model') === m);
  });
}

const num = (id) => ($(id).value === '' ? null : Number($(id).value));

function readForm() {
  return {
    model: $('model').value,
    displayUnit: $('displayUnit').value,
    arrival: { unit: $('arrUnit').value, type: $('arrType').value, value: num('arrValue'), sd: num('arrSd') },
    service: { unit: $('svcUnit').value, type: $('svcType').value, value: num('svcValue'), sd: num('svcSd') }
  };
}

function show(message, isError) {
  $('message').textContent = message;
  $('message').className = isError ? 'message error' : 'message';
  $('message').hidden = !message;
}

function showResults(data) {
  const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(4));
  $('cards').innerHTML = data.results.map((r) =>
    `<div class="card"><span>${r.label}</span><strong>${fmt(r.value)} <small>${r.unit}</small></strong></div>`
  ).join('');

  const rho = data.results.find((r) => r.key === 'rho').value;
  $('gaugeText').textContent = (rho * 100).toFixed(1) + '%';
  $('gaugeFill').style.width = Math.min(rho * 100, 100) + '%';
  $('gaugeFill').className = rho >= 0.9 ? 'hot' : '';
  $('gaugeBox').hidden = false;

  $('steps').innerHTML = data.steps.map((s) => `<div>${s}</div>`).join('');
  $('stepsBox').hidden = false;
  show('', false);
}

function clearResults() {
  $('cards').innerHTML = '';
  $('gaugeBox').hidden = true;
  $('stepsBox').hidden = true;
}

async function calculate() {
  clearResults();
  const formPayload = readForm();
  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formPayload)
    });
    if (res.ok) {
      const data = await res.json();
      return showResults(data);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (data && data.error) return show(data.error, true);
    }
  } catch (err) {
    // Network failure or static host
  }

  // Fallback to client-side math (works 100% on GitHub Pages & offline)
  if (window.queueModels && typeof window.queueModels.calculate === 'function') {
    try {
      const localData = window.queueModels.calculate(formPayload);
      return showResults(localData);
    } catch (calcErr) {
      return show(calcErr.message, true);
    }
  }
  show('Could not calculate results. Please check your inputs.', true);
}

function clearForm() {
  for (const id of ['arrValue', 'arrSd', 'svcValue', 'svcSd']) $(id).value = '';
  clearResults();
  show('Enter your values and press Calculate.', false);
}

for (const id of ['model', 'arrUnit', 'arrType', 'svcUnit', 'svcType']) $(id).addEventListener('change', refreshForm);
$('calcBtn').addEventListener('click', calculate);
$('clearBtn').addEventListener('click', clearForm);

const toggleBtn = $('toggleTheoryBtn');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const grid = $('theoryGrid');
    const isHidden = grid.classList.toggle('collapsed');
    toggleBtn.textContent = isHidden ? 'Expand Reference' : 'Minimize';
  });
}

fillModels();
refreshForm();
