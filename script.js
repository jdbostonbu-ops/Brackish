/* ════════════════════════════════════════════════════════════════
   script.js — Brackish (single file)
   ════════════════════════════════════════════════════════════════
   Organized into 4 sections:
     1. TAX DATA      — federal brackets, state brackets, SE tax
     2. MATH          — progressive bracket algorithm + state + SE
     3. RENDERING     — UI helpers and the result receipt
     4. INIT          — form wiring and page-load hooks
   ════════════════════════════════════════════════════════════════ */


/* ════════════════════════════════════════════════════════════════
   1. TAX DATA
   ────────────────────────────────────────────────────────────────
   All bracket data lives at the top so it can be updated yearly
   without touching the calculator logic. Sources:
     - Federal: IRS Publication 17 / Form 1040 instructions
     - State:   each state's department of revenue
   ════════════════════════════════════════════════════════════════ */

const TAX_YEAR = 2025;

/* ── Federal income tax brackets (2025) ──────────────────────────
   Each bracket = { min: lower bound, rate: marginal rate as decimal }
   The "max" of a bracket is implied by the next bracket's "min".
   The top bracket has no max (Infinity).                          */
const FEDERAL_BRACKETS = {
    single: [
        { min: 0,        rate: 0.10 },
        { min: 11925,    rate: 0.12 },
        { min: 48475,    rate: 0.22 },
        { min: 103350,   rate: 0.24 },
        { min: 197300,   rate: 0.32 },
        { min: 250525,   rate: 0.35 },
        { min: 626350,   rate: 0.37 }
    ],
    marriedJointly: [
        { min: 0,        rate: 0.10 },
        { min: 23850,    rate: 0.12 },
        { min: 96950,    rate: 0.22 },
        { min: 206700,   rate: 0.24 },
        { min: 394600,   rate: 0.32 },
        { min: 501050,   rate: 0.35 },
        { min: 751600,   rate: 0.37 }
    ],
    marriedSeparately: [
        { min: 0,        rate: 0.10 },
        { min: 11925,    rate: 0.12 },
        { min: 48475,    rate: 0.22 },
        { min: 103350,   rate: 0.24 },
        { min: 197300,   rate: 0.32 },
        { min: 250525,   rate: 0.35 },
        { min: 375800,   rate: 0.37 }
    ],
    headOfHousehold: [
        { min: 0,        rate: 0.10 },
        { min: 17000,    rate: 0.12 },
        { min: 64850,    rate: 0.22 },
        { min: 103350,   rate: 0.24 },
        { min: 197300,   rate: 0.32 },
        { min: 250500,   rate: 0.35 },
        { min: 626350,   rate: 0.37 }
    ]
};

/* ── Self-employment tax constants (2025) ────────────────────────
   SE tax = 15.3% on net SE earnings, with a wrinkle:
     - Social Security portion (12.4%) capped at $176,100
     - Medicare (2.9%) has no cap
     - Additional 0.9% Medicare surtax over $200K (single)
     - Calculated on 92.35% of net SE earnings, not 100%           */
const SE_TAX = {
    socialSecurityRate: 0.124,
    medicareRate: 0.029,
    additionalMedicareRate: 0.009,
    additionalMedicareThreshold: 200000,
    socialSecurityWageBase: 176100,
    seIncomeMultiplier: 0.9235
};

/* ── State income tax data ───────────────────────────────────────
   Mix of progressive, flat, and no-tax states. Single-filer
   brackets used for simplicity — joint filers may see slightly
   different numbers in real life.                                 */
const STATE_TAX = {
    federalOnly: { name: 'Federal Only (no state)', type: 'none' },

    AK: { name: 'Alaska',        type: 'none' },
    FL: { name: 'Florida',       type: 'none' },
    NV: { name: 'Nevada',        type: 'none' },
    NH: { name: 'New Hampshire', type: 'none', note: 'Taxes interest/dividends only — wage income not taxed.' },
    SD: { name: 'South Dakota',  type: 'none' },
    TN: { name: 'Tennessee',     type: 'none' },
    TX: { name: 'Texas',         type: 'none' },
    WA: { name: 'Washington',    type: 'none' },
    WY: { name: 'Wyoming',       type: 'none' },

    CO: { name: 'Colorado',      type: 'flat', rate: 0.044 },
    IL: { name: 'Illinois',      type: 'flat', rate: 0.0495 },
    IN: { name: 'Indiana',       type: 'flat', rate: 0.0305 },
    KY: { name: 'Kentucky',      type: 'flat', rate: 0.04 },
    MA: { name: 'Massachusetts', type: 'flat', rate: 0.05 },
    MI: { name: 'Michigan',      type: 'flat', rate: 0.0425 },
    NC: { name: 'North Carolina',type: 'flat', rate: 0.0425 },
    PA: { name: 'Pennsylvania',  type: 'flat', rate: 0.0307 },
    UT: { name: 'Utah',          type: 'flat', rate: 0.0455 },
    GA: { name: 'Georgia',       type: 'flat', rate: 0.0539 },

    CA: {
        name: 'California', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.01 },
            { min: 10756,     rate: 0.02 },
            { min: 25499,     rate: 0.04 },
            { min: 40245,     rate: 0.06 },
            { min: 55866,     rate: 0.08 },
            { min: 70606,     rate: 0.093 },
            { min: 360659,    rate: 0.103 },
            { min: 432787,    rate: 0.113 },
            { min: 721314,    rate: 0.123 }
        ]
    },
    NY: {
        name: 'New York', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.04 },
            { min: 8500,      rate: 0.045 },
            { min: 11700,     rate: 0.0525 },
            { min: 13900,     rate: 0.055 },
            { min: 80650,     rate: 0.06 },
            { min: 215400,    rate: 0.0685 },
            { min: 1077550,   rate: 0.0965 },
            { min: 5000000,   rate: 0.103 },
            { min: 25000000,  rate: 0.109 }
        ]
    },
    CT: {
        name: 'Connecticut', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.02 },
            { min: 10000,     rate: 0.045 },
            { min: 50000,     rate: 0.055 },
            { min: 100000,    rate: 0.06 },
            { min: 200000,    rate: 0.065 },
            { min: 250000,    rate: 0.069 },
            { min: 500000,    rate: 0.0699 }
        ]
    },
    RI: {
        name: 'Rhode Island', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.0375 },
            { min: 79900,     rate: 0.0475 },
            { min: 181650,    rate: 0.0599 }
        ]
    },
    NJ: {
        name: 'New Jersey', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.014 },
            { min: 20000,     rate: 0.0175 },
            { min: 35000,     rate: 0.035 },
            { min: 40000,     rate: 0.05525 },
            { min: 75000,     rate: 0.0637 },
            { min: 500000,    rate: 0.0897 },
            { min: 1000000,   rate: 0.1075 }
        ]
    },
    OR: {
        name: 'Oregon', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.0475 },
            { min: 4400,      rate: 0.0675 },
            { min: 11050,     rate: 0.0875 },
            { min: 125000,    rate: 0.099 }
        ]
    },
    MD: {
        name: 'Maryland', type: 'progressive',
        brackets: [
            { min: 0,         rate: 0.02 },
            { min: 1000,      rate: 0.03 },
            { min: 2000,      rate: 0.04 },
            { min: 3000,      rate: 0.0475 },
            { min: 100000,    rate: 0.05 },
            { min: 125000,    rate: 0.0525 },
            { min: 150000,    rate: 0.055 },
            { min: 250000,    rate: 0.0575 }
        ]
    }
};

/* Sorted list of states for the dropdown (Federal Only first) */
const STATE_OPTIONS = Object.keys(STATE_TAX)
    .map(code => ({ code, name: STATE_TAX[code].name, type: STATE_TAX[code].type }))
    .sort((a, b) => {
        if (a.code === 'federalOnly') return -1;
        if (b.code === 'federalOnly') return 1;
        return a.name.localeCompare(b.name);
    });


/* ════════════════════════════════════════════════════════════════
   2. MATH
   ────────────────────────────────────────────────────────────────
   The progressive bracket algorithm — the core of the calculator.
   Each bracket's marginal rate only applies to income that falls
   INSIDE that bracket. Walk every bracket, slice the income, sum.
   ════════════════════════════════════════════════════════════════ */

function calculateProgressiveTax(income, brackets) {
    let totalTax = 0;
    const layers = [];

    for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        const nextBracket = brackets[i + 1];

        // Top of this bracket = next bracket's min, or Infinity if none
        const bracketMax = nextBracket ? nextBracket.min : Infinity;

        // If income hasn't reached this bracket, stop walking
        if (income <= bracket.min) break;

        // The slice of income that falls inside this bracket
        const incomeInBracket = Math.min(income, bracketMax) - bracket.min;
        const taxInBracket = incomeInBracket * bracket.rate;

        totalTax += taxInBracket;

        layers.push({
            min: bracket.min,
            max: Math.min(income, bracketMax),
            rate: bracket.rate,
            incomeInBracket: incomeInBracket,
            taxInBracket: taxInBracket
        });

        // If income tops out within this bracket, we're done
        if (income <= bracketMax) break;
    }

    return { totalTax, layers };
}

function calculateStateTax(income, stateCode) {
    const state = STATE_TAX[stateCode];
    if (!state || state.type === 'none') {
        return { totalTax: 0, layers: [], type: 'none', stateName: state ? state.name : '' };
    }
    if (state.type === 'flat') {
        return {
            totalTax: income * state.rate,
            layers: [{ min: 0, max: income, rate: state.rate, incomeInBracket: income, taxInBracket: income * state.rate }],
            type: 'flat',
            stateName: state.name,
            flatRate: state.rate
        };
    }
    // Progressive — reuse the federal algorithm
    const result = calculateProgressiveTax(income, state.brackets);
    return { ...result, type: 'progressive', stateName: state.name };
}

function calculateSETax(netSEIncome) {
    const seBase = netSEIncome * SE_TAX.seIncomeMultiplier;

    // Social Security portion is capped at the wage base
    const ssTaxableBase = Math.min(seBase, SE_TAX.socialSecurityWageBase);
    const ssTax = ssTaxableBase * SE_TAX.socialSecurityRate;

    // Medicare has no cap
    const medicareTax = seBase * SE_TAX.medicareRate;

    // Additional Medicare on income above the threshold
    let additionalMedicare = 0;
    if (seBase > SE_TAX.additionalMedicareThreshold) {
        additionalMedicare = (seBase - SE_TAX.additionalMedicareThreshold) * SE_TAX.additionalMedicareRate;
    }

    return {
        totalTax: ssTax + medicareTax + additionalMedicare,
        ssTax,
        medicareTax,
        additionalMedicare,
        seBase
    };
}


/* ════════════════════════════════════════════════════════════════
   3. RENDERING
   ────────────────────────────────────────────────────────────────
   Formatting helpers, dropdown population, and the main results
   renderer that produces the receipt-style breakdown.
   ════════════════════════════════════════════════════════════════ */

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtMoneyExact = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => (n * 100).toFixed(2).replace(/\.?0+$/, '') + '%';

/* ── escapeHTML: defense-in-depth against XSS ────────────────────
   Even though all values flowing into our templates are currently
   numbers or known-safe strings (state names from our own data),
   we run any string that ORIGINATES from user input through this
   helper before embedding it in HTML. This protects against future
   code changes accidentally introducing free-text user input.   */
function escapeHTML(value) {
    if (typeof value !== 'string') return String(value);
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PERIODS = {
    weekly:   { label: 'per week',    divisor: 52 },
    biweekly: { label: 'per 2 weeks', divisor: 26 },
    monthly:  { label: 'per month',   divisor: 12 },
    quarterly:{ label: 'per quarter', divisor: 4  }
};

let selectedStates = ['federalOnly'];

function populateStateDropdown(selectEl) {
    selectEl.innerHTML = '';
    STATE_OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        selectEl.appendChild(o);
    });
}

function renderStateRows() {
    const container = document.getElementById('stateRows');
    if (!container) return;
    container.innerHTML = '';
    selectedStates.forEach((code, idx) => {
        const row = document.createElement('div');
        row.className = 'state-row reveal';
        row.innerHTML = `
            <label class="field-label" for="state-${idx}">State ${idx + 1}</label>
            <div class="state-row-controls">
                <select id="state-${idx}" class="select" data-idx="${idx}"></select>
                ${idx > 0 ? `<button type="button" class="btn-remove" data-idx="${idx}" aria-label="Remove state">×</button>` : ''}
            </div>
        `;
        container.appendChild(row);
        const sel = row.querySelector('select');
        populateStateDropdown(sel);
        sel.value = code;
        sel.addEventListener('change', (e) => {
            selectedStates[idx] = e.target.value;
        });
        const removeBtn = row.querySelector('.btn-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                selectedStates.splice(idx, 1);
                renderStateRows();
            });
        }
    });

    const addBtn = document.getElementById('addStateBtn');
    if (addBtn) addBtn.style.display = selectedStates.length < 5 ? '' : 'none';
}

function runCalculation(e) {
    if (e) e.preventDefault();

    const income = parseFloat(document.getElementById('income').value);
    const filingStatus = document.getElementById('filingStatus').value;
    const isSelfEmployed = document.getElementById('selfEmployed').checked;
    const period = document.getElementById('period').value;

    if (!income || income <= 0) {
        showError('Please enter your annual income.');
        return;
    }
    if (income > 100000000) {
        showError('Income too large for this estimator.');
        return;
    }

    const federal = calculateProgressiveTax(income, FEDERAL_BRACKETS[filingStatus]);
    const stateResults = selectedStates.map(code => calculateStateTax(income, code));
    const seResult = isSelfEmployed ? calculateSETax(income) : null;

    const annualFederalTax = federal.totalTax;
    const annualStateTax = stateResults.reduce((sum, s) => sum + s.totalTax, 0);
    const annualSETax = seResult ? seResult.totalTax : 0;
    const annualTotal = annualFederalTax + annualStateTax + annualSETax;

    const divisor = PERIODS[period].divisor;
    const perPeriod = annualTotal / divisor;
    const periodLabel = PERIODS[period].label;

    renderResults({
        income, filingStatus, isSelfEmployed, period, periodLabel, perPeriod,
        annualTotal, annualFederalTax, annualStateTax, annualSETax,
        federal, stateResults, seResult
    });
}

function renderResults(r) {
    const out = document.getElementById('results');

    const fedLayersHTML = r.federal.layers.map(layer => `
        <div class="layer">
            <div class="layer-range">${fmtMoney(layer.min)}–${fmtMoney(layer.max)}</div>
            <div class="layer-rate">× ${fmtPct(layer.rate)}</div>
            <div class="layer-amount">${fmtMoney(layer.incomeInBracket)}</div>
            <div class="layer-tax">= ${fmtMoneyExact(layer.taxInBracket)}</div>
        </div>
    `).join('');

    const statesHTML = r.stateResults.map((s) => {
        // Escape state name even though our data is hardcoded — defense in depth
        const safeName = escapeHTML(s.stateName || 'No state');
        if (s.type === 'none') {
            return `
                <div class="state-result">
                    <h4 class="state-result-name">${safeName}</h4>
                    <p class="state-result-meta">No state income tax on wages.</p>
                    <div class="state-result-total">$0</div>
                </div>`;
        }
        if (s.type === 'flat') {
            return `
                <div class="state-result">
                    <h4 class="state-result-name">${safeName}</h4>
                    <p class="state-result-meta">Flat rate of ${fmtPct(s.flatRate)}</p>
                    <div class="layer">
                        <div class="layer-range">All income</div>
                        <div class="layer-rate">× ${fmtPct(s.flatRate)}</div>
                        <div class="layer-amount">${fmtMoney(r.income)}</div>
                        <div class="layer-tax">= ${fmtMoneyExact(s.totalTax)}</div>
                    </div>
                    <div class="state-result-total">${fmtMoneyExact(s.totalTax)}/yr</div>
                </div>`;
        }
        const layersHTML = s.layers.map(l => `
            <div class="layer">
                <div class="layer-range">${fmtMoney(l.min)}–${fmtMoney(l.max)}</div>
                <div class="layer-rate">× ${fmtPct(l.rate)}</div>
                <div class="layer-amount">${fmtMoney(l.incomeInBracket)}</div>
                <div class="layer-tax">= ${fmtMoneyExact(l.taxInBracket)}</div>
            </div>
        `).join('');
        return `
            <div class="state-result">
                <h4 class="state-result-name">${safeName}</h4>
                <p class="state-result-meta">Progressive brackets</p>
                ${layersHTML}
                <div class="state-result-total">${fmtMoneyExact(s.totalTax)}/yr</div>
            </div>`;
    }).join('');

    const seHTML = r.seResult ? `
        <section class="result-block">
            <h3 class="result-block-title">Self-Employment Tax</h3>
            <p class="result-block-desc">
                The 15.3% on net SE earnings most entrepreneurs forget.
                Calculated on ${fmtPct(SE_TAX.seIncomeMultiplier)} of net SE income.
            </p>
            <div class="layer">
                <div class="layer-range">Social Security (12.4%, capped)</div>
                <div class="layer-rate"></div>
                <div class="layer-amount"></div>
                <div class="layer-tax">${fmtMoneyExact(r.seResult.ssTax)}</div>
            </div>
            <div class="layer">
                <div class="layer-range">Medicare (2.9%, uncapped)</div>
                <div class="layer-rate"></div>
                <div class="layer-amount"></div>
                <div class="layer-tax">${fmtMoneyExact(r.seResult.medicareTax)}</div>
            </div>
            ${r.seResult.additionalMedicare > 0 ? `
                <div class="layer">
                    <div class="layer-range">Additional Medicare (0.9% over $200K)</div>
                    <div class="layer-rate"></div>
                    <div class="layer-amount"></div>
                    <div class="layer-tax">${fmtMoneyExact(r.seResult.additionalMedicare)}</div>
                </div>
            ` : ''}
            <div class="result-block-total">SE total: ${fmtMoneyExact(r.seResult.totalTax)}/yr</div>
        </section>
    ` : '';

    out.innerHTML = `
        <div class="results-headline reveal">
            <p class="results-eyebrow">Set aside</p>
            <p class="results-amount">${fmtMoneyExact(r.perPeriod)}</p>
            <p class="results-period">${r.periodLabel}</p>
            <p class="results-annual">Annual total: ${fmtMoneyExact(r.annualTotal)}</p>
        </div>

        <div class="results-summary reveal">
            <div class="summary-card">
                <p class="summary-label">Federal income tax</p>
                <p class="summary-value">${fmtMoneyExact(r.annualFederalTax)}</p>
            </div>
            <div class="summary-card">
                <p class="summary-label">State income tax</p>
                <p class="summary-value">${fmtMoneyExact(r.annualStateTax)}</p>
            </div>
            ${r.isSelfEmployed ? `
                <div class="summary-card summary-card-accent">
                    <p class="summary-label">Self-employment tax</p>
                    <p class="summary-value">${fmtMoneyExact(r.annualSETax)}</p>
                </div>
            ` : ''}
        </div>

        <details class="receipt reveal">
            <summary class="receipt-summary">See the math, layer by layer ↓</summary>
            <div class="receipt-body">
                <section class="result-block">
                    <h3 class="result-block-title">Federal Income Tax</h3>
                    <p class="result-block-desc">Progressive brackets — each layer's rate applies only to the income within it.</p>
                    ${fedLayersHTML}
                    <div class="result-block-total">Federal total: ${fmtMoneyExact(r.annualFederalTax)}/yr</div>
                </section>

                ${r.stateResults.some(s => s.type !== 'none') ? `
                    <section class="result-block">
                        <h3 class="result-block-title">State Income Tax</h3>
                        ${statesHTML}
                    </section>
                ` : ''}

                ${seHTML}
            </div>
        </details>

        <div class="results-disclaimer reveal">
            <p>
                <strong>This is the raw bracket math</strong> based on the income you entered. It does not include
                the standard deduction, itemized deductions, business write-offs, retirement contributions,
                tax credits, or any other adjustments. <strong>Always consult a licensed CPA or tax professional</strong>
                for your specific situation.
            </p>
        </div>
    `;

    setTimeout(() => {
        out.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    }, 50);

    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(msg) {
    const out = document.getElementById('results');
    // Use textContent for the message itself (defense-in-depth — never
    // embed string content in innerHTML if it could ever come from user input)
    out.innerHTML = '<div class="error-banner"></div>';
    out.querySelector('.error-banner').textContent = msg;
}


/* ════════════════════════════════════════════════════════════════
   4. INIT
   ────────────────────────────────────────────────────────────────
   Scroll-reveal observer, animated number counters, and form
   wiring — all set up after the DOM is ready.
   ════════════════════════════════════════════════════════════════ */

function setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out-cubic — fast at first, slows toward the target
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        el.textContent = (el.dataset.prefix || '') + current.toLocaleString('en-US') + (el.dataset.suffix || '');
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function setupCounters() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-counter]').forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
    renderStateRows();

    document.getElementById('calcForm').addEventListener('submit', runCalculation);

    document.getElementById('addStateBtn').addEventListener('click', () => {
        if (selectedStates.length >= 5) return;
        selectedStates.push('federalOnly');
        renderStateRows();
    });

    document.querySelectorAll('[data-scroll-to]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.scrollTo);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    setupScrollReveal();
    setupCounters();
});
