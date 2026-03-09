// ── DOM References ──────────────────────────────────────
const nextXInput      = document.getElementById("next-x");
const nextYInput      = document.getElementById("next-y");
const checkBtn        = document.getElementById("checkPathBtn");
const resetBtn        = document.getElementById("resetBtn");
const locationEl      = document.getElementById("current-location");
const ruleEl          = document.getElementById("current-rule");
const stepSizeEl      = document.getElementById("step-size");
const feedbackBox     = document.getElementById("ai-feedback-box");
const feedbackTitle   = document.getElementById("feedback-title");
const feedbackText    = document.getElementById("feedback-text");
const reflectionSec   = document.getElementById("reflection-section");
const nextStageBtn    = document.getElementById("next-stage-btn");
const ctx             = document.getElementById("slopeChart").getContext("2d");

// ── Game State ──────────────────────────────────────────
const stages = [
  { stepSize: 1,   stepsNeeded: 5 },
  { stepSize: 0.5, stepsNeeded: 10 }
];

let currentStage = 0;
let path = [{ x: 0, y: 0 }];   // points the student has confirmed
let stepSize = stages[0].stepSize;

// Slope rule: steepness = x + 1
function slopeAt(x) {
  return x + 1;
}

// ── Chart Setup ─────────────────────────────────────────
const slopeChart = new Chart(ctx, {
  type: "scatter",
  data: { datasets: [] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: "x", color: "#94a3b8", font: { family: "Fira Code" } },
        grid: { color: "#1e293b" },
        ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
        border: { color: "#475569" },
        min: -1, max: 7
      },
      y: {
        type: "linear",
        title: { display: true, text: "y", color: "#94a3b8", font: { family: "Fira Code" } },
        grid: { color: "#1e293b" },
        ticks: { color: "#94a3b8", font: { family: "Fira Code" } },
        border: { color: "#475569" },
        min: -1, max: 20
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

// ── Drawing ─────────────────────────────────────────────
function updateChart() {
  const datasets = [];

  // Path line connecting confirmed points
  if (path.length >= 2) {
    datasets.push({
      label: "Your Path",
      data: path.map(p => ({ x: p.x, y: p.y })),
      borderColor: "#38bdf8",
      backgroundColor: "#38bdf8",
      borderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: true
    });
  }

  // All confirmed points
  datasets.push({
    label: "Points",
    data: path.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: "#38bdf8",
    pointRadius: 7,
    pointHoverRadius: 9,
    showLine: false
  });

  // Rise/Run staircase segments for each step
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    // Run (horizontal)
    datasets.push({
      label: i === 0 ? "Run (Δx)" : "",
      data: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p1.y }],
      borderColor: "#4ade80",
      borderWidth: 2,
      borderDash: [4, 3],
      pointRadius: 0,
      showLine: true
    });
    // Rise (vertical)
    datasets.push({
      label: i === 0 ? "Rise (Δy)" : "",
      data: [{ x: p2.x, y: p1.y }, { x: p2.x, y: p2.y }],
      borderColor: "#f87171",
      borderWidth: 2,
      borderDash: [4, 3],
      pointRadius: 0,
      showLine: true
    });
  }

  // Auto-scale
  const allX = path.map(p => p.x);
  const allY = path.map(p => p.y);
  const pad = 2;
  slopeChart.options.scales.x.min = Math.min(0, ...allX) - pad;
  slopeChart.options.scales.x.max = Math.max(5, ...allX) + pad;
  slopeChart.options.scales.y.min = Math.min(0, ...allY) - pad;
  slopeChart.options.scales.y.max = Math.max(5, ...allY) + pad;

  slopeChart.data.datasets = datasets;
  slopeChart.update();
}

// ── Update the info display ─────────────────────────────
function updateDisplay() {
  const last = path[path.length - 1];
  locationEl.textContent = `(${last.x}, ${last.y})`;
  stepSizeEl.textContent = stepSize;
  ruleEl.textContent = "x + 1";
  // Clarification: the slope at each point = (that point's x-value) + 1
}

// ── Check the student's step ────────────────────────────
function checkStep() {
  const nx = parseFloat(nextXInput.value);
  const ny = parseFloat(nextYInput.value);

  if (Number.isNaN(nx) || Number.isNaN(ny)) {
    showFeedback("Oops!", "Please enter numbers for both x and y.", "error");
    return;
  }

  const last = path[path.length - 1];
  const expectedX = Math.round((last.x + stepSize) * 1000) / 1000;
  const slope = slopeAt(last.x);
  const expectedY = Math.round((last.y + slope * stepSize) * 1000) / 1000;

  const xCorrect = Math.abs(nx - expectedX) < 0.01;
  const yCorrect = Math.abs(ny - expectedY) < 0.01;

  if (xCorrect && yCorrect) {
    path.push({ x: expectedX, y: expectedY });
    updateChart();
    updateDisplay();

    const stepsCompleted = path.length - 1;
    const stepsNeeded = stages[currentStage].stepsNeeded;

    if (stepsCompleted >= stepsNeeded) {
      showFeedback("🎉 Stage Complete!",
        `You plotted ${stepsNeeded} steps! Because the slope at each point equals that point's x-value + 1, the path curves upward — the steeper it gets, the faster y grows.`,
        "success");
      if (currentStage < stages.length - 1) {
        reflectionSec.classList.remove("hidden");
      } else {
        showFeedback("🏆 Challenge Complete!",
          "You finished both stages! Notice how smaller steps made a smoother curve.",
          "success");
      }
    } else {
      showFeedback("✅ Correct!",
        `Slope at x = ${last.x} was ${slope}, so rise = ${slope} × ${stepSize} = ${(slope * stepSize)}. ` +
        `New point: (${expectedX}, ${expectedY}). ${stepsNeeded - stepsCompleted} steps left!`,
        "success");
    }

    // Clear inputs for next step
    nextXInput.value = "";
    nextYInput.value = "";
    nextXInput.focus();

  } else {
    // Give specific feedback on what went wrong
    let hint = "";
    if (!xCorrect) {
      hint += `The x-value should be ${last.x} + ${stepSize} = ${expectedX}. `;
    }
    if (!yCorrect) {
      hint += `The slope at x = ${last.x} is ${slope}, so rise = ${slope} × ${stepSize} = ${slope * stepSize}. ` +
              `y should be ${last.y} + ${slope * stepSize} = ${expectedY}.`;
    }
    showFeedback("❌ Not quite!", hint, "error");
  }
}

function showFeedback(title, text, type) {
  feedbackTitle.textContent = title;
  feedbackText.textContent = text;
  feedbackBox.classList.remove("hidden");
  feedbackBox.style.borderColor = type === "success" ? "#4ade80" : "#f87171";
}

// ── Next Stage ──────────────────────────────────────────
function advanceStage() {
  currentStage++;
  if (currentStage >= stages.length) return;

  stepSize = stages[currentStage].stepSize;
  path = [{ x: 0, y: 0 }];
  reflectionSec.classList.add("hidden");
  feedbackBox.classList.add("hidden");
  nextXInput.value = "";
  nextYInput.value = "";
  updateDisplay();
  updateChart();
}

// ── Reset ───────────────────────────────────────────────
function resetAll() {
  currentStage = 0;
  stepSize = stages[0].stepSize;
  path = [{ x: 0, y: 0 }];
  feedbackBox.classList.add("hidden");
  reflectionSec.classList.add("hidden");
  nextXInput.value = "";
  nextYInput.value = "";
  updateDisplay();
  updateChart();
}

// ── Event Listeners ─────────────────────────────────────
checkBtn.addEventListener("click", checkStep);
resetBtn.addEventListener("click", resetAll);
nextStageBtn.addEventListener("click", advanceStage);

document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkStep();
  });
});

// ── Initialize ──────────────────────────────────────────
updateDisplay();
updateChart();
