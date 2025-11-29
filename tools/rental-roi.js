// rental-roi.js
// REToolForge – Rental ROI Calculator logic

// ---------- Helpers to read inputs safely ----------

function getTextValue(possibleIds) {
  for (const id of possibleIds) {
    const el = document.getElementById(id);
    if (el) return el.value.trim();
  }
  return "";
}

function getNumberValue(possibleIds) {
  const raw = getTextValue(possibleIds);
  const num = parseFloat(raw);
  return isNaN(num) ? 0 : num;
}

function formatMoney(value) {
  const n = isNaN(value) ? 0 : value;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatMoney2(value) {
  const n = isNaN(value) ? 0 : value;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  const n = isNaN(value) ? 0 : value;
  return `${n.toFixed(1)}%`;
}

// ---------- Status chip for small inline messages ----------

function showStatusChip(id, message, variant = "ok") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("status-ok", "status-error", "status-muted");
  el.classList.add(
    variant === "error" ? "status-error" :
    variant === "muted" ? "status-muted" :
    "status-ok"
  );
  el.classList.add("visible");
  // Hide after 3 seconds
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.classList.remove("visible");
  }, 3000);
}

// ---------- Read all inputs from the form ----------

function getInputs() {
  return {
    propertyLabel: getTextValue(["propertyLabel", "propertyNickname", "propertyName"]),
    userEmail: getTextValue(["userEmail", "reportEmail", "email"]),
    purchasePrice: getNumberValue(["purchasePrice"]),
    downPaymentPercent: getNumberValue(["downPaymentPercent", "downPayment"]),
    interestRate: getNumberValue(["interestRate"]),
    loanTermYears: getNumberValue(["loanTermYears", "loanTerm"]),
    monthlyRent: getNumberValue(["monthlyRent"]),
    annualTaxes: getNumberValue(["annualTaxes", "annualPropertyTaxes"]),
    annualInsurance: getNumberValue(["annualInsurance"]),
    monthlyHOA: getNumberValue(["monthlyHOA"]),
    maintenanceVacancyPercent: getNumberValue(["maintenanceVacancy", "maintenancePercent"]),
    otherMonthlyExpenses: getNumberValue(["otherMonthlyExpenses", "otherMonthly"]),
    closingCostsPercent: getNumberValue(["closingCostsPercent"]),
    upfrontRepairs: getNumberValue(["upfrontRepairs"]),
  };
}

// ---------- Core deal math ----------

function computeDeal(inputs) {
  const {
    purchasePrice,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    monthlyRent,
    annualTaxes,
    annualInsurance,
    monthlyHOA,
    maintenanceVacancyPercent,
    otherMonthlyExpenses,
    closingCostsPercent,
    upfrontRepairs,
  } = inputs;

  if (!purchasePrice || !monthlyRent) {
    return null; // not enough data
  }

  // Down payment & loan
  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = Math.max(purchasePrice - downPaymentAmount, 0);

  // Mortgage payment (simple amortizing loan)
  let monthlyMortgage = 0;
  const r = interestRate / 100 / 12;
  const n = loanTermYears * 12;
  if (loanAmount > 0 && r > 0 && n > 0) {
    const factor = Math.pow(1 + r, n);
    monthlyMortgage = loanAmount * (r * factor) / (factor - 1);
  }

  // Income & expenses
  const grossMonthlyIncome = monthlyRent;
  const monthlyTaxes = annualTaxes / 12;
  const monthlyInsurance = annualInsurance / 12;
  const maintVacancyMonthly = monthlyRent * (maintenanceVacancyPercent / 100);

  const totalMonthlyExpenses =
    monthlyMortgage +
    monthlyTaxes +
    monthlyInsurance +
    monthlyHOA +
    maintVacancyMonthly +
    otherMonthlyExpenses;

  const monthlyCashFlow = grossMonthlyIncome - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  // NOI & cap rate
  const annualOperatingExpenses =
    annualTaxes +
    annualInsurance +
    monthlyHOA * 12 +
    maintVacancyMonthly * 12 +
    otherMonthlyExpenses * 12;

  const annualNOI = grossMonthlyIncome * 12 - annualOperatingExpenses;
  const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

  // Cash invested & cash-on-cash
  const closingCostsAmount = purchasePrice * (closingCostsPercent / 100);
  const totalCashInvested =
    downPaymentAmount + closingCostsAmount + upfrontRepairs;

  const cashOnCash =
    totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  // Verdict
  let verdictLabel = "Needs deeper analysis";
  let verdictTone = "caution";

  if (monthlyCashFlow > 0 && cashOnCash >= 12) {
    verdictLabel = "Strong on paper";
    verdictTone = "strong";
  } else if (monthlyCashFlow >= 0 && cashOnCash >= 8) {
    verdictLabel = "Decent, stress-test it";
    verdictTone = "neutral";
  } else if (monthlyCashFlow < 0) {
    verdictLabel = "Negative cash flow";
    verdictTone = "weak";
  }

  return {
    downPaymentAmount,
    loanAmount,
    monthlyMortgage,
    grossMonthlyIncome,
    monthlyTaxes,
    monthlyInsurance,
    monthlyHOA,
    maintVacancyMonthly,
    otherMonthlyExpenses,
    totalMonthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    annualNOI,
    capRate,
    closingCostsAmount,
    totalCashInvested,
    cashOnCash,
    verdictLabel,
    verdictTone,
  };
}

// ---------- Update the UI with result numbers ----------

function updateResultUI(deal) {
  if (!deal) return;

  // These IDs should match your rental-roi.html
  const cashFlowEl = document.getElementById("resultMonthlyCashFlow");
  const cocEl = document.getElementById("resultCashOnCash");
  const capRateEl = document.getElementById("resultCapRate");
  const totalExpEl = document.getElementById("resultTotalExpenses");
  const totalCashInvEl = document.getElementById("resultTotalCashInvested");
  const verdictLabelEl = document.getElementById("dealVerdictLabel");
  const verdictNoteEl = document.getElementById("dealVerdictNote");
  const verdictPillEl = document.getElementById("dealVerdictPill");

  if (cashFlowEl) cashFlowEl.textContent = formatMoney2(deal.monthlyCashFlow);
  if (cocEl) cocEl.textContent = formatPercent(deal.cashOnCash);
  if (capRateEl) capRateEl.textContent = formatPercent(deal.capRate);
  if (totalExpEl) totalExpEl.textContent = formatMoney2(deal.totalMonthlyExpenses);
  if (totalCashInvEl) totalCashInvEl.textContent = formatMoney2(deal.totalCashInvested);

  if (verdictLabelEl) verdictLabelEl.textContent = deal.verdictLabel;

  if (verdictNoteEl) {
    if (deal.verdictTone === "strong") {
      verdictNoteEl.textContent =
        "Shows positive cash flow and double-digit cash-on-cash. Verify rehab, vacancy, market trends, and reserves before moving forward.";
    } else if (deal.verdictTone === "neutral") {
      verdictNoteEl.textContent =
        "Looks workable, but tweak rent, rehab, or expenses and see how sensitive the deal is.";
    } else if (deal.verdictTone === "weak") {
      verdictNoteEl.textContent =
        "Negative cash flow – consider a lower price, better terms, or a different strategy.";
    } else {
      verdictNoteEl.textContent =
        "Review your assumptions carefully and run a few what-if scenarios.";
    }
  }

  if (verdictPillEl) {
    verdictPillEl.classList.remove("pill-strong", "pill-neutral", "pill-weak", "pill-caution");
    const cls =
      deal.verdictTone === "strong" ? "pill-strong" :
      deal.verdictTone === "neutral" ? "pill-neutral" :
      deal.verdictTone === "weak" ? "pill-weak" :
      "pill-caution";
    verdictPillEl.classList.add(cls);
  }
}

// ---------- Build a plain-text deal summary (for copy/email) ----------

function buildDealSummary(inputs, deal, options = {}) {
  const {
    includeBreakdown = true,
    includeVerdictNotes = true,
    includeStrategyTips = true,
  } = options;

  const lines = [];

  const label = inputs.propertyLabel || "Rental property";
  lines.push(`REToolForge Rental ROI Report – ${label}`);
  lines.push("--------------------------------------------------");
  lines.push(`Purchase price: ${formatMoney(inputs.purchasePrice)}`);
  lines.push(`Down payment: ${inputs.downPaymentPercent}% (${formatMoney2(deal.downPaymentAmount)})`);
  lines.push(`Loan term: ${inputs.loanTermYears} years at ${inputs.interestRate}% APR`);
  lines.push("");
  lines.push(`Monthly rent: ${formatMoney2(inputs.monthlyRent)}`);
  lines.push(`Monthly cash flow: ${formatMoney2(deal.monthlyCashFlow)}`);
  lines.push(`Cash-on-cash return: ${formatPercent(deal.cashOnCash)}`);
  lines.push(`Cap rate: ${formatPercent(deal.capRate)}`);
  lines.push(`Total cash invested: ${formatMoney2(deal.totalCashInvested)}`);
  lines.push("");

  if (includeBreakdown) {
    lines.push("Income & expense breakdown (est.):");
    lines.push(`  • Mortgage: ${formatMoney2(deal.monthlyMortgage)}`);
    lines.push(`  • Taxes: ${formatMoney2(deal.monthlyTaxes)}`);
    lines.push(`  • Insurance: ${formatMoney2(deal.monthlyInsurance)}`);
    lines.push(`  • HOA: ${formatMoney2(deal.monthlyHOA)}`);
    lines.push(`  • Maintenance & vacancy: ${formatMoney2(deal.maintVacancyMonthly)}`);
    lines.push(`  • Other expenses: ${formatMoney2(deal.otherMonthlyExpenses)}`);
    lines.push(`  • Total expenses: ${formatMoney2(deal.totalMonthlyExpenses)}`);
    lines.push("");
  }

  if (includeVerdictNotes) {
    lines.push(`Deal verdict: ${deal.verdictLabel}`);
    lines.push("");
  }

  if (includeStrategyTips) {
    lines.push("Strategy notes & ideas:");
    lines.push("  • Compare this deal to at least 2–3 others using the same assumptions.");
    lines.push("  • Stress-test the deal by lowering rent and raising expenses slightly.");
    lines.push("  • Decide whether your priority is cash flow, appreciation, or a mix.");
    lines.push("");
    lines.push("Remember: These numbers are estimates and do not replace advice from a licensed real estate, lending, or tax professional.");
  }

  return lines.join("\n");
}

// ---------- Event wiring ----------

document.addEventListener("DOMContentLoaded", () => {
  const calcBtn = document.getElementById("calculateBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copySummaryBtn");
  const emailBtn = document.getElementById("emailReportBtn");

  if (calcBtn) {
    calcBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const inputs = getInputs();
      const deal = computeDeal(inputs);
      if (!deal) {
        showStatusChip("calcStatus", "Enter at least price & rent.", "error");
        return;
      }
      updateResultUI(deal);
      showStatusChip("calcStatus", "Numbers updated.", "ok");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const form = document.querySelector("form");
      if (form) form.reset();
      showStatusChip("calcStatus", "Inputs reset.", "muted");
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const inputs = getInputs();
      const deal = computeDeal(inputs);
      if (!deal) {
        showStatusChip("copyStatus", "Run the calculator first.", "error");
        return;
      }

      const includeBreakdown =
        document.getElementById("includeBreakdown")?.checked ?? true;
      const includeVerdictNotes =
        document.getElementById("includeVerdictNotes")?.checked ?? true;
      const includeStrategyTips =
        document.getElementById("includeStrategyTips")?.checked ?? true;

      const summary = buildDealSummary(inputs, deal, {
        includeBreakdown,
        includeVerdictNotes,
        includeStrategyTips,
      });

      try {
        await navigator.clipboard.writeText(summary);
        showStatusChip("copyStatus", "Deal summary copied.", "ok");
      } catch (err) {
        console.error("Clipboard error:", err);
        showStatusChip("copyStatus", "Could not copy to clipboard.", "error");
      }
    });
  }

  if (emailBtn) {
    emailBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const inputs = getInputs();
      const deal = computeDeal(inputs);

      if (!deal) {
        showStatusChip("emailStatus", "Run the calculator first.", "error");
        return;
      }

      const email = (inputs.userEmail || "").trim();
      if (!email) {
        showStatusChip("emailStatus", "Enter an email address above.", "error");
        return;
      }

      // Try to subscribe via Vercel backend (Beehiiv)
      try {
        await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        showStatusChip("emailStatus", "Subscribed. Opening email app…", "ok");
      } catch (err) {
        console.error("Subscribe failed:", err);
        showStatusChip(
          "emailStatus",
          "Could not subscribe, but opening email app…",
          "error"
        );
      }

      const includeBreakdown =
        document.getElementById("includeBreakdown")?.checked ?? true;
      const includeVerdictNotes =
        document.getElementById("includeVerdictNotes")?.checked ?? true;
      const includeStrategyTips =
        document.getElementById("includeStrategyTips")?.checked ?? true;

      const summary = buildDealSummary(inputs, deal, {
        includeBreakdown,
        includeVerdictNotes,
        includeStrategyTips,
      });

      const subject = `REToolForge Rental ROI Report – ${
        inputs.propertyLabel || "Property"
      }`;

      const mailtoUrl = `mailto:${encodeURIComponent(
        email
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        summary
      )}`;

      window.location.href = mailtoUrl;
    });
  }
});
