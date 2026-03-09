// ── DOM References ──────────────────────────────────────
const x1Input   = document.getElementById("x1");
const y1Input   = document.getElementById("y1");
const x2Input   = document.getElementById("x2");
const y2Input   = document.getElementById("y2");
const plotBtn   = document.getElementById("plotBtn");
const resetBtn  = document.getElementById("resetBtn");
const resultsEl = document.getElementById("results");
const riseEl    = document.getElementById("rise");
const runEl     = document.getElementById("run");
const slopeEl   = document.getElementById("slope");
const eqEl      = document.getElementById("equation");
const ctx       = document.getElementById("slopeChart").getContext("2d");

// ── Chart Setup ─────────────────────────────────────────
let slopeChart = createChart();

function createChart() {
  return new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "linear",
          position: "center",
          title: { display: true, text: "x", color: "#94a3b8", font: { family: "Fira Code" } },
          grid: { color: "#1e293b" },
          ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
          border: { color: "#475569" }
        },
        y: {
          type: "linear",
          position: "center",
          title: { display: true, text: "y", color: "#94a3b8", font: { family: "Fira Code" } },
          grid: { color: "#1e293b" },
          ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
          border: { color: "#475569" }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#cbd5e1", font: { family: "Inter" } }
        },
        tooltip: {
          callbacks: {
            label: (tip) => `(${tip.parsed.x}, ${tip.parsed.y})`
          }
        }
      }
    }
  });
}

// ── Core Logic ──────────────────────────────────────────
function calculate() {
  const x1 = parseFloat(x1Input.value);
  const y1 = parseFloat(y1Input.value);
  const x2 = parseFloat(x2Input.value);
  const y2 = parseFloat(y2Input.value);

  if ([x1, y1, x2, y2].some(Number.isNaN)) return;

  const rise = y2 - y1;
  const run  = x2 - x1;

  // Display results
  riseEl.textContent = rise;
  runEl.textContent  = run;

  if (run === 0) {
    slopeEl.textContent = "undefined (vertical line)";
    eqEl.textContent    = `x = ${x1}`;
  } else {
    const m = rise / run;
    const b = y1 - m * x1;
    slopeEl.textContent = Number.isInteger(m) ? m : m.toFixed(3);

    const bSign = b >= 0 ? "+" : "−";
    const bAbs  = Math.abs(b);
    const bStr  = Number.isInteger(bAbs) ? bAbs : bAbs.toFixed(3);
    const mStr  = Number.isInteger(m) ? m : m.toFixed(3);
    eqEl.textContent = `y = ${mStr}x ${bSign} ${bStr}`;
  }

  resultsEl.classList.remove("hidden");

  // ── Build chart datasets ──────────────────────────────
  // Padding around points for axis range
  const allX = [x1, x2];
  const allY = [y1, y2];
  const pad  = 2;
  const xMin = Math.min(...allX) - pad;
  const xMax = Math.max(...allX) + pad;
  const yMin = Math.min(...allY) - pad;
  const yMax = Math.max(...allY) + pad;

  const datasets = [];

  // 1. The two user-selected points
  datasets.push({
    label: "Points",
    data: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    backgroundColor: "#38bdf8",
    pointRadius: 7,
    pointHoverRadius: 9,
    showLine: false
  });

  // 2. Line through the two points
  if (run !== 0) {
    const m = rise / run;
    const b = y1 - m * x1;
    datasets.push({
      label: "Line",
      data: [{ x: xMin, y: m * xMin + b }, { x: xMax, y: m * xMax + b }],
      borderColor: "#38bdf8",
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      borderDash: [6, 4]
    });
  } else {
    // Vertical line
    datasets.push({
      label: "Line",
      data: [{ x: x1, y: yMin }, { x: x1, y: yMax }],
      borderColor: "#38bdf8",
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      borderDash: [6, 4]
    });
  }

  // 3. Rise / Run staircase
  datasets.push({
    label: "Rise (Δy)",
    data: [{ x: x2, y: y1 }, { x: x2, y: y2 }],
    borderColor: "#f87171",
    backgroundColor: "#f87171",
    borderWidth: 3,
    pointRadius: 0,
    showLine: true
  });

  datasets.push({
    label: "Run (Δx)",
    data: [{ x: x1, y: y1 }, { x: x2, y: y1 }],
    borderColor: "#4ade80",
    backgroundColor: "#4ade80",
    borderWidth: 3,
    pointRadius: 0,
    showLine: true
  });

  // Update chart
  slopeChart.data.datasets = datasets;
  slopeChart.options.scales.x.min = xMin;
  slopeChart.options.scales.x.max = xMax;
  slopeChart.options.scales.y.min = yMin;
  slopeChart.options.scales.y.max = yMax;
  slopeChart.update();
}

// ── Reset ───────────────────────────────────────────────
function resetAll() {
  x1Input.value = "1";
  y1Input.value = "2";
  x2Input.value = "5";
  y2Input.value = "8";
  resultsEl.classList.add("hidden");

  slopeChart.data.datasets = [];
  slopeChart.options.scales.x.min = undefined;
  slopeChart.options.scales.x.max = undefined;
  slopeChart.options.scales.y.min = undefined;
  slopeChart.options.scales.y.max = undefined;
  slopeChart.update();
}

// ── Event Listeners ─────────────────────────────────────
plotBtn.addEventListener("click", calculate);
resetBtn.addEventListener("click", resetAll);

// Allow Enter key to trigger calculation
document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") calculate();
  });
});

// Plot on initial load
calculate();
