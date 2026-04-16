const STORAGE_THEME_KEY = "smart-factory-theme";
const STORAGE_AUTH_KEY = "smart-factory-auth";
const STORAGE_USERS_KEY = "smart-factory-users";

const zeroDashboardData = {
    totalProduction: 0,
    goodProducts: 0,
    defectiveProducts: 0,
    machineFailures: 0,
    energyUsage: 0,
    workingHours: 0
};

const telemetryCards = [
    { key: "totalProduction", title: "Total Production", subtitle: "Units manufactured", variant: "neutral", format: "integer", icon: "OUT" },
    { key: "goodProducts", title: "Good Products", subtitle: "Quality passed", variant: "success", format: "integer", icon: "QLT" },
    { key: "defectiveProducts", title: "Defective", subtitle: "Quality failed", variant: "danger", format: "integer", icon: "DEF" },
    { key: "efficiencyRate", title: "Efficiency Rate", subtitle: "Good vs Total", variant: "accent", format: "percent", icon: "EFF" },
    { key: "defectRate", title: "Defect Rate", subtitle: "Defective vs Total", variant: "warning", format: "percent", icon: "DCT" },
    { key: "workingHours", title: "Working Hours", subtitle: "Operational time", variant: "info", format: "hours", icon: "HRS" },
    { key: "productionPerHour", title: "Production / Hr", subtitle: "Units per hour", variant: "accent", format: "decimal", icon: "PPH" },
    { key: "energyUsage", title: "Energy Usage", subtitle: "Power consumed", variant: "neutral", format: "energy", icon: "NRG" },
    { key: "machineFailures", title: "Machine Failures", subtitle: "Recorded stops", variant: "danger", format: "integer", icon: "FLT" },
    { key: "failureRate", title: "Failure Rate", subtitle: "Failures per hour", variant: "warning", format: "decimal", icon: "FRT" }
];

let currentDashboardData = cloneDashboardData(zeroDashboardData);
let currentMetrics;
let resizeTimer;
let chartResizeObserver;
let productionBreakdownChart;
let qualityRatioChart;
let operationalTrendsChart;
let currentAuth = null;

const analyticsForm = document.getElementById("analyticsForm");
const restoreDefaultsButton = document.getElementById("restoreDefaultsButton");
const inputStatus = document.getElementById("inputStatus");
const telemetryGrid = document.getElementById("telemetryGrid");
const recommendationsList = document.getElementById("recommendationsList");
const chartContainers = document.querySelectorAll("[data-chart-container]");
const themeToggleButtons = document.querySelectorAll(".theme-toggle");
const heroThemeState = document.getElementById("heroThemeState");
const heroAnalyticsState = document.getElementById("heroAnalyticsState");
const heroAccessRole = document.getElementById("heroAccessRole");
const breakdownNote = document.getElementById("breakdownNote");
const authShell = document.getElementById("authShell");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginTabButton = document.getElementById("loginTabButton");
const signupTabButton = document.getElementById("signupTabButton");
const loginPanel = document.getElementById("loginPanel");
const signupPanel = document.getElementById("signupPanel");
const loginStatus = document.getElementById("loginStatus");
const signupStatus = document.getElementById("signupStatus");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const signupNameInput = document.getElementById("signupNameInput");
const signupEmailInput = document.getElementById("signupEmailInput");
const signupPasswordInput = document.getElementById("signupPasswordInput");
const logoutButton = document.getElementById("logoutButton");
const userRoleBadge = document.getElementById("userRoleBadge");
const accessStatus = document.getElementById("accessStatus");

const inputElements = {
    totalProduction: document.getElementById("totalProductionInput"),
    goodProducts: document.getElementById("goodUnitsInput"),
    defectiveProducts: document.getElementById("defectiveUnitsInput"),
    machineFailures: document.getElementById("machineFailuresInput"),
    energyUsage: document.getElementById("energyUsageInput"),
    workingHours: document.getElementById("workingHoursInput")
};

const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDraw(chart, args, options) {
        if (chart.config.type !== "doughnut" || !chart.getDatasetMeta(0)?.data?.length) {
            return;
        }

        const centerPoint = chart.getDatasetMeta(0).data[0];

        if (!centerPoint) {
            return;
        }

        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = options.labelColor;
        ctx.font = options.labelFont;
        ctx.fillText(options.labelText, centerPoint.x, centerPoint.y - 18);
        ctx.fillStyle = options.valueColor;
        ctx.font = options.valueFont;
        ctx.fillText(options.valueText, centerPoint.x, centerPoint.y + 6);
        ctx.fillStyle = options.captionColor;
        ctx.font = options.captionFont;
        ctx.fillText(options.captionText, centerPoint.x, centerPoint.y + 30);
        ctx.restore();
    }
};

Chart.register(centerTextPlugin);

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    initializeTheme();
    configureChartDefaults();
    bindAuthControls();
    bindInputControls();
    bindScrollActions();
    bindChartSizing();
    populateInputs(currentDashboardData);
    renderLegends();
    updateDashboard(currentDashboardData, true);
    restoreAuthState();

    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(scheduleChartRefresh, 140);
    });
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    applyTheme(savedTheme || "dark", true);

    themeToggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
            applyTheme(nextTheme, false);
        });
    });
}

function applyTheme(theme, skipSave) {
    document.documentElement.dataset.theme = theme;
    heroThemeState.textContent = theme === "light" ? "Light Mode" : "Dark Mode";
    themeToggleButtons.forEach((button) => {
        button.querySelector(".theme-toggle__sun").textContent = theme === "light" ? "Dark Mode" : "Light Mode";
        button.querySelector(".theme-toggle__moon").textContent = theme === "light" ? "Active: Light" : "Active: Dark";
    });

    if (!skipSave) {
        localStorage.setItem(STORAGE_THEME_KEY, theme);
    }

    configureChartDefaults();

    if (currentMetrics) {
        renderLegends();
        buildCharts(currentMetrics);
    }
}

function configureChartDefaults() {
    const tokens = getThemeTokens();
    Chart.defaults.devicePixelRatio = getChartPixelRatio();
    Chart.defaults.font.family = '"Plus Jakarta Sans", sans-serif';
    Chart.defaults.color = tokens.tickColor;
    Chart.defaults.borderColor = tokens.gridColor;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.animation.duration = 1000;
    Chart.defaults.animation.easing = "easeOutQuart";
    Chart.defaults.responsive = false;
    Chart.defaults.maintainAspectRatio = false;
}

function bindAuthControls() {
    loginForm.addEventListener("submit", handleLoginSubmit);
    signupForm.addEventListener("submit", handleSignupSubmit);
    loginTabButton.addEventListener("click", () => setAuthView("login"));
    signupTabButton.addEventListener("click", () => setAuthView("signup"));
    logoutButton.addEventListener("click", handleLogout);
}

function restoreAuthState() {
    const rawAuth = localStorage.getItem(STORAGE_AUTH_KEY);

    if (!rawAuth) {
        setAuthenticatedState(null);
        return;
    }

    try {
        const parsedAuth = JSON.parse(rawAuth);
        const matchingUser = getStoredUsers().find((user) => user.email === parsedAuth.email);
        if (!matchingUser) {
            localStorage.removeItem(STORAGE_AUTH_KEY);
        }
        setAuthenticatedState(matchingUser || null);
    } catch (error) {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        setAuthenticatedState(null);
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();

    const email = loginEmailInput.value.trim().toLowerCase();
    const password = loginPasswordInput.value;

    if (!email || !password) {
        setLoginStatus("Enter both email and password to continue.", "error");
        return;
    }

    const matchedUser = getStoredUsers().find((user) => user.email === email && user.password === password);

    if (!matchedUser) {
        setLoginStatus("Invalid email or password. Check your credentials and try again.", "error");
        return;
    }

    setAuthenticatedState(matchedUser);
    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify({
        email: matchedUser.email
    }));
    setLoginStatus(`Welcome back, ${matchedUser.name}.`, "success");
    loginForm.reset();
}

function handleSignupSubmit(event) {
    event.preventDefault();

    const name = signupNameInput.value.trim();
    const email = signupEmailInput.value.trim().toLowerCase();
    const password = signupPasswordInput.value;
    const validationMessage = validateSignupInput(name, email, password);

    if (validationMessage) {
        setSignupStatus(validationMessage, "error");
        return;
    }

    const users = getStoredUsers();
    const existingUser = users.find((user) => user.email === email);

    if (existingUser) {
        setSignupStatus("An account with this email already exists. Please log in instead.", "error");
        setAuthView("login");
        loginEmailInput.value = email;
        loginEmailInput.focus();
        return;
    }

    users.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
        name,
        email,
        password,
        createdAt: new Date().toISOString()
    });

    saveStoredUsers(users);
    signupForm.reset();
    setSignupStatus("Account created successfully. You can now log in with your credentials.", "success");
    setAuthView("login");
    loginEmailInput.value = email;
    loginPasswordInput.value = "";
    setLoginStatus("Account created. Log in to enter the command center.", "success");
    loginPasswordInput.focus();
}

function handleLogout() {
    currentAuth = null;
    localStorage.removeItem(STORAGE_AUTH_KEY);
    loginForm.reset();
    signupForm.reset();
    currentDashboardData = cloneDashboardData(zeroDashboardData);
    populateInputs(currentDashboardData);
    updateDashboard(currentDashboardData, false);
    setAuthenticatedState(null);
    setInputStatus("All values are currently zero. Enter data to generate telemetry.", "default");
}

function setAuthenticatedState(user) {
    currentAuth = user ? { email: user.email, name: user.name } : null;
    const isAuthenticated = Boolean(currentAuth);

    authShell.hidden = isAuthenticated;
    appShell.hidden = !isAuthenticated;
    document.body.classList.toggle("auth-locked", !isAuthenticated);

    if (!isAuthenticated) {
        userRoleBadge.textContent = "Session: Guest";
        heroAccessRole.textContent = "Guest";
        heroAnalyticsState.textContent = "Awaiting input";
        setAccessStatus("Authentication required before dashboard access.", "default");
        setLoginStatus("Sign in with an existing account to continue.", "default");
        setSignupStatus("Create an account to unlock the dashboard experience.", "default");
        setAuthView("login");
        loginEmailInput.focus();
        return;
    }

    userRoleBadge.textContent = `Session: ${currentAuth.name}`;
    heroAccessRole.textContent = currentAuth.name;
    applyAuthenticationPermissions();

    if (currentMetrics) {
        requestAnimationFrame(() => {
            renderLegends();
            buildCharts(currentMetrics);
        });
    }
}

function applyAuthenticationPermissions() {
    Object.values(inputElements).forEach((input) => {
        input.disabled = false;
    });

    analyticsForm.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
    });

    setAccessStatus("Authenticated session active. Full dashboard controls unlocked.", "success");
}

function bindInputControls() {
    analyticsForm.addEventListener("submit", handleAnalyticsGenerate);
    restoreDefaultsButton.addEventListener("click", handleRestoreDefaults);
}

function bindScrollActions() {
    document.querySelectorAll("[data-scroll-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = document.querySelector(button.dataset.scrollTarget);

            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
}

function bindChartSizing() {
    if (typeof ResizeObserver === "undefined") {
        return;
    }

    chartResizeObserver = new ResizeObserver(() => {
        scheduleChartRefresh();
    });

    chartContainers.forEach((container) => {
        chartResizeObserver.observe(container);
    });
}

function handleAnalyticsGenerate(event) {
    event.preventDefault();

    if (!currentAuth) {
        setInputStatus("Authentication is required before generating telemetry.", "error");
        return;
    }

    const nextData = readInputData();
    const validationMessage = validateInputData(nextData);

    if (validationMessage) {
        setInputStatus(validationMessage, "error");
        return;
    }

    currentDashboardData = nextData;
    updateDashboard(currentDashboardData, false);
    setInputStatus("Telemetry uplink generated successfully.", "success");
}

function handleRestoreDefaults() {
    if (!currentAuth) {
        setInputStatus("Authentication is required before resetting the dashboard.", "error");
        return;
    }

    currentDashboardData = cloneDashboardData(zeroDashboardData);
    populateInputs(currentDashboardData);
    updateDashboard(currentDashboardData, false);
    setInputStatus("Dashboard values reset to zero.", "success");
}

function updateDashboard(data, isInitialLoad) {
    currentMetrics = buildMetrics(data);
    renderTelemetry(currentMetrics);
    renderRecommendations(currentMetrics);
    renderOverview(currentMetrics);
    buildCharts(currentMetrics);

    if (isInitialLoad) {
        setInputStatus("All values are currently zero. Enter data to generate telemetry.", "default");
    }
}

function populateInputs(data) {
    Object.entries(inputElements).forEach(([key, input]) => {
        input.value = data[key];
    });
}

function readInputData() {
    return {
        totalProduction: Number(inputElements.totalProduction.value),
        goodProducts: Number(inputElements.goodProducts.value),
        defectiveProducts: Number(inputElements.defectiveProducts.value),
        machineFailures: Number(inputElements.machineFailures.value),
        energyUsage: Number(inputElements.energyUsage.value),
        workingHours: Number(inputElements.workingHours.value)
    };
}

function validateInputData(data) {
    if (Object.values(data).some((value) => Number.isNaN(value))) {
        return "Enter valid numeric values in all input fields.";
    }

    if (Object.values(data).some((value) => value < 0)) {
        return "Negative values are not allowed in the analytics inputs.";
    }

    if (data.totalProduction === 0) {
        return "Total Production must be greater than zero to generate telemetry ratios.";
    }

    if (data.workingHours <= 0) {
        return "Working Hours must be greater than zero.";
    }

    if (data.goodProducts + data.defectiveProducts > data.totalProduction) {
        return "Good Products plus Defective Products cannot exceed Total Production.";
    }

    return "";
}

function buildMetrics(data) {
    const operationalTrends = buildOperationalTrends(data);
    const efficiencyRate = data.totalProduction > 0 ? (data.goodProducts / data.totalProduction) * 100 : 0;
    const defectRate = data.totalProduction > 0 ? (data.defectiveProducts / data.totalProduction) * 100 : 0;
    const productionPerHour = data.workingHours > 0 ? data.totalProduction / data.workingHours : 0;
    const failureRate = data.workingHours > 0 ? data.machineFailures / data.workingHours : 0;
    const energyPerUnit = data.totalProduction > 0 ? data.energyUsage / data.totalProduction : 0;
    const peakEnergy = Math.max(...operationalTrends.energy);
    const latestEnergy = operationalTrends.energy.at(-1);
    const peakDrop = peakEnergy > 0 ? ((peakEnergy - latestEnergy) / peakEnergy) * 100 : 0;

    return {
        ...data,
        operationalTrends,
        efficiencyRate: roundToTwo(efficiencyRate),
        defectRate: roundToTwo(defectRate),
        productionPerHour: roundToTwo(productionPerHour),
        failureRate: roundToTwo(failureRate),
        energyPerUnit: roundToTwo(energyPerUnit),
        peakDrop: Math.max(0, roundToTwo(peakDrop))
    };
}

function buildOperationalTrends(data) {
    if (isZeroDashboardState(data)) {
        return {
            labels: ["Period 1", "Period 2", "Period 3", "Current"],
            energy: [0, 0, 0, 0],
            failures: [0, 0, 0, 0],
            workingHours: [0, 0, 0, 0]
        };
    }

    return {
        labels: ["Period 1", "Period 2", "Period 3", "Current"],
        energy: [
            roundToOne(data.energyUsage * 0.82),
            roundToOne(data.energyUsage * 1.08),
            roundToOne(data.energyUsage * 0.94),
            roundToOne(data.energyUsage)
        ],
        failures: [
            clamp(Math.max(data.machineFailures - 1, 0), 0, 12),
            clamp(data.machineFailures + 2, 0, 12),
            clamp(data.machineFailures + 1, 0, 12),
            data.machineFailures
        ],
        workingHours: [
            roundToOne(Math.max(data.workingHours - 1, 0)),
            roundToOne(data.workingHours),
            roundToOne(Math.max(data.workingHours - 0.5, 0)),
            roundToOne(data.workingHours)
        ]
    };
}

function renderTelemetry(metrics) {
    telemetryGrid.innerHTML = telemetryCards.map((card) => `
        <article class="surface-card summary-card summary-card--${card.variant}">
            <div class="summary-card__top">
                <div>
                    <p class="summary-card__label">${card.title}</p>
                    <strong class="summary-card__value" data-metric-key="${card.key}" data-format="${card.format}">0</strong>
                </div>
                <span class="summary-card__icon" aria-hidden="true"><span>${card.icon}</span></span>
            </div>
            <p class="summary-card__meta">${card.subtitle}</p>
            <div class="summary-card__footer">
                <span class="summary-card__delta">${card.subtitle}</span>
                <span class="summary-card__track"><i data-progress-key="${card.key}"></i></span>
            </div>
        </article>
    `).join("");

    telemetryGrid.querySelectorAll("[data-metric-key]").forEach((element) => {
        animateValue(element, metrics[element.dataset.metricKey], element.dataset.format);
    });

    const progressValues = {
        totalProduction: metrics.totalProduction === 0 ? 0 : 100,
        goodProducts: metrics.efficiencyRate,
        defectiveProducts: metrics.defectiveProducts === 0 ? 0 : Math.max(metrics.defectRate, 10),
        efficiencyRate: metrics.efficiencyRate,
        defectRate: metrics.defectiveProducts === 0 ? 0 : clamp(metrics.defectRate * 2, 0, 100),
        workingHours: metrics.workingHours > 0 ? clamp(metrics.workingHours * 10, 0, 100) : 0,
        productionPerHour: metrics.productionPerHour > 0 ? clamp(metrics.productionPerHour, 0, 100) : 0,
        energyUsage: metrics.energyUsage > 0 && metrics.totalProduction > 0 ? clamp((metrics.energyUsage / Math.max(metrics.totalProduction, 1)) * 100, 0, 100) : 0,
        machineFailures: metrics.machineFailures > 0 ? clamp(metrics.machineFailures * 12, 0, 100) : 0,
        failureRate: metrics.failureRate > 0 ? clamp(metrics.failureRate * 40, 0, 100) : 0
    };

    telemetryGrid.querySelectorAll("[data-progress-key]").forEach((element) => {
        const rawValue = progressValues[element.dataset.progressKey];
        const width = rawValue === 0 ? 0 : clamp(rawValue, 10, 100);
        element.style.setProperty("--progress", `${width}%`);
    });
}

function renderRecommendations(metrics) {
    if (isZeroDashboardState(currentDashboardData)) {
        recommendationsList.innerHTML = `
            <article class="recommendations-empty">
                <h3>Waiting For Telemetry Input</h3>
                <p>Generate telemetry to activate intelligent production recommendations for efficiency, quality, maintenance, energy behavior, and operating-hour balance.</p>
            </article>
        `;
        heroAnalyticsState.textContent = "Awaiting input";
        return;
    }

    const recommendations = [];

    if (metrics.efficiencyRate < 75) {
        recommendations.push({
            variant: "warning",
            title: "LOW EFFICIENCY DETECTED",
            message: `Current efficiency is ${formatPercent(metrics.efficiencyRate)}. Consider reviewing production workflows and addressing bottlenecks.`
        });
    }

    if (metrics.defectRate >= 20) {
        recommendations.push({
            variant: "danger",
            title: "QUALITY CONTROL ALERT",
            message: `Defect rate is unusually high at ${formatPercent(metrics.defectRate)}. Immediate inspection of the manufacturing line is recommended.`
        });
    }

    if (metrics.machineFailures >= 3) {
        recommendations.push({
            variant: "warning",
            title: "MACHINE MAINTENANCE NEEDED",
            message: `Failure count reached ${metrics.machineFailures}. Preventive maintenance should be scheduled to reduce downtime.`
        });
    }

    if (metrics.energyPerUnit > 0.5) {
        recommendations.push({
            variant: "warning",
            title: "HIGH ENERGY CONSUMPTION",
            message: "Energy usage per unit is above the expected range. Review equipment efficiency and power usage patterns."
        });
    }

    if (metrics.workingHours > 10) {
        recommendations.push({
            variant: "info",
            title: "EXTENDED OPERATING HOURS",
            message: "Working hours are high. Monitor operator fatigue and equipment load to maintain performance."
        });
    }

    if (metrics.efficiencyRate >= 90 && metrics.defectRate < 10 && metrics.machineFailures === 0) {
        recommendations.push({
            variant: "success",
            title: "OPTIMAL FACTORY PERFORMANCE",
            message: "Production line is running efficiently with strong quality results and stable operations."
        });
    }

    heroAnalyticsState.textContent = recommendations.length > 0 ? `${recommendations.length} smart signals` : "Stable";

    if (!recommendations.length) {
        recommendationsList.innerHTML = `
            <article class="recommendations-empty">
                <h3>No Critical Recommendations</h3>
                <p>Current telemetry is within expected operating thresholds. Continue monitoring for changes in output, quality, machine health, and power consumption.</p>
            </article>
        `;
        return;
    }

    recommendationsList.innerHTML = recommendations.map((item) => `
        <article class="recommendation-card recommendation-card--${item.variant}">
            <span class="recommendation-card__eyebrow">
                <i class="recommendation-card__dot" aria-hidden="true"></i>
                Smart Signal
            </span>
            <h3>${item.title}</h3>
            <p>${item.message}</p>
        </article>
    `).join("");
}

function renderOverview(metrics) {
    const formatter = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });

    document.getElementById("lastUpdated").textContent = formatter.format(new Date());
    breakdownNote.textContent = `Current cycle / ${Math.round(metrics.totalProduction).toLocaleString("en-US")} units`;
    document.getElementById("qualityGoodShare").textContent = formatPercent(metrics.efficiencyRate);
    document.getElementById("qualityDefectShare").textContent = formatPercent(metrics.defectRate);
    document.getElementById("trendInsight").textContent = metrics.totalProduction === 0
        ? "Operational trends are waiting for telemetry input."
        : `${formatPercent(metrics.peakDrop)} below peak energy draw by the current period.`;
}

function renderLegends() {
    const colors = getThemeTokens();

    renderLegend("breakdownLegend", [
        { label: "Total", color: `linear-gradient(135deg, ${colors.neutralLight}, ${colors.neutralDark})` },
        { label: "Good", color: `linear-gradient(135deg, ${colors.accentLight}, ${colors.accentDark})` },
        { label: "Defective", color: `linear-gradient(135deg, ${colors.dangerLight}, ${colors.dangerDark})` }
    ]);

    renderLegend("qualityLegend", [
        { label: "Good Products", color: `linear-gradient(135deg, ${colors.accentLight}, ${colors.accentDark})` },
        { label: "Defective Products", color: `linear-gradient(135deg, ${colors.dangerLight}, ${colors.dangerDark})` }
    ]);

    renderLegend("trendsLegend", [
        { label: "Energy Use", color: colors.accentBase },
        { label: "Failures", color: colors.dangerBase },
        { label: "Working Hours", color: colors.warningBase }
    ]);
}

function renderLegend(containerId, items) {
    const container = document.getElementById(containerId);

    container.innerHTML = items.map((item) => `
        <span class="legend__item">
            <span class="legend__swatch" style="background: ${item.color}; color: ${normalizeLegendColor(item.color)};"></span>
            <span>${item.label}</span>
        </span>
    `).join("");
}

function buildCharts(metrics) {
    if (!productionBreakdownChart) {
        productionBreakdownChart = buildProductionBreakdownChart(metrics);
    } else {
        updateProductionBreakdownChart(productionBreakdownChart, metrics);
    }

    if (!qualityRatioChart) {
        qualityRatioChart = buildQualityRatioChart(metrics);
    } else {
        updateQualityRatioChart(qualityRatioChart, metrics);
    }

    if (!operationalTrendsChart) {
        operationalTrendsChart = buildOperationalTrendsChart(metrics);
    } else {
        updateOperationalTrendsChart(operationalTrendsChart, metrics);
    }
}

function buildProductionBreakdownChart(metrics) {
    const canvas = document.getElementById("productionBreakdownChart");
    const prepared = prepareCanvas(canvas);
    const chart = new Chart(prepared.context, {
        type: "bar",
        data: {
            labels: ["Total", "Good", "Defective"],
            datasets: [{
                data: [metrics.totalProduction, metrics.goodProducts, metrics.defectiveProducts],
                backgroundColor: buildBreakdownGradients(prepared.context),
                borderColor: getThemeTokens().breakdownBorders,
                borderWidth: 1.5,
                borderRadius: 18,
                borderSkipped: false,
                categoryPercentage: 0.72,
                barPercentage: 0.92,
                maxBarThickness: 84
            }]
        },
        options: buildBreakdownOptions(prepared.pixelRatio)
    });

    chart.resize(prepared.width, prepared.height);
    return chart;
}

function updateProductionBreakdownChart(chart, metrics) {
    const prepared = syncChartCanvas(chart);
    chart.data.datasets[0].data = [metrics.totalProduction, metrics.goodProducts, metrics.defectiveProducts];
    chart.data.datasets[0].backgroundColor = buildBreakdownGradients(prepared.context);
    chart.data.datasets[0].borderColor = getThemeTokens().breakdownBorders;
    chart.options = buildBreakdownOptions(prepared.pixelRatio);
    chart.update();
}

function buildQualityRatioChart(metrics) {
    const canvas = document.getElementById("qualityRatioChart");
    const prepared = prepareCanvas(canvas);
    const chart = new Chart(prepared.context, {
        type: "doughnut",
        data: {
            labels: ["Good Products", "Defective Products"],
            datasets: [{
                data: [metrics.goodProducts, metrics.defectiveProducts],
                backgroundColor: buildQualityGradients(prepared.context),
                borderColor: getThemeTokens().surfaceEdge,
                borderWidth: 6,
                spacing: 4,
                hoverOffset: 10
            }]
        },
        options: buildQualityOptions(metrics, prepared.pixelRatio)
    });

    chart.resize(prepared.width, prepared.height);
    return chart;
}

function updateQualityRatioChart(chart, metrics) {
    const prepared = syncChartCanvas(chart);
    chart.data.datasets[0].data = [metrics.goodProducts, metrics.defectiveProducts];
    chart.data.datasets[0].backgroundColor = buildQualityGradients(prepared.context);
    chart.data.datasets[0].borderColor = getThemeTokens().surfaceEdge;
    chart.options = buildQualityOptions(metrics, prepared.pixelRatio);
    chart.update();
}

function buildOperationalTrendsChart(metrics) {
    const canvas = document.getElementById("operationalTrendsChart");
    const prepared = prepareCanvas(canvas);
    const chart = new Chart(prepared.context, {
        type: "line",
        data: {
            labels: metrics.operationalTrends.labels,
            datasets: buildTrendDatasets(prepared.context, metrics)
        },
        options: buildTrendOptions(metrics, prepared.pixelRatio)
    });

    chart.resize(prepared.width, prepared.height);
    return chart;
}

function updateOperationalTrendsChart(chart, metrics) {
    const prepared = syncChartCanvas(chart);
    chart.data.labels = metrics.operationalTrends.labels;
    chart.data.datasets = buildTrendDatasets(prepared.context, metrics);
    chart.options = buildTrendOptions(metrics, prepared.pixelRatio);
    chart.update();
}

function buildBreakdownOptions(pixelRatio) {
    const colors = getThemeTokens();

    return {
        responsive: false,
        maintainAspectRatio: false,
        devicePixelRatio: pixelRatio,
        normalized: true,
        animation: {
            duration: 1200,
            easing: "easeOutQuart"
        },
        layout: {
            padding: { top: 18, right: 18, bottom: 8, left: 8 }
        },
        plugins: {
            tooltip: buildTooltipTheme()
        },
        scales: {
            x: {
                alignToPixels: true,
                title: {
                    display: true,
                    text: "Production States",
                    color: colors.labelColor,
                    padding: { top: 16 },
                    font: { family: "IBM Plex Mono", size: 12, weight: "600" }
                },
                ticks: {
                    color: colors.axisStrong,
                    font: { size: 12.5, weight: "700" },
                    padding: 10
                },
                grid: { display: false, drawBorder: false },
                border: { display: false }
            },
            y: {
                alignToPixels: true,
                beginAtZero: true,
                suggestedMax: 1350,
                title: {
                    display: true,
                    text: "Units Processed",
                    color: colors.labelColor,
                    padding: { bottom: 8 },
                    font: { family: "IBM Plex Mono", size: 12, weight: "600" }
                },
                ticks: {
                    color: colors.tickColor,
                    font: { size: 11.5, weight: "600" },
                    padding: 12,
                    stepSize: 250
                },
                grid: {
                    lineWidth: 1,
                    color: colors.gridColor,
                    drawTicks: false
                },
                border: { display: false }
            }
        }
    };
}

function buildQualityOptions(metrics, pixelRatio) {
    const colors = getThemeTokens();

    return {
        responsive: false,
        maintainAspectRatio: false,
        devicePixelRatio: pixelRatio,
        normalized: true,
        cutout: "72%",
        radius: "96%",
        layout: {
            padding: 20
        },
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1300,
            easing: "easeOutCubic"
        },
        plugins: {
            tooltip: buildTooltipTheme(),
            centerTextPlugin: {
                labelText: "QUALITY",
                valueText: formatPercent(metrics.efficiencyRate),
                captionText: "Good yield",
                labelColor: colors.labelColor,
                valueColor: colors.titleColor,
                captionColor: colors.tickColor,
                labelFont: '600 12px "IBM Plex Mono"',
                valueFont: '700 34px "Plus Jakarta Sans"',
                captionFont: '500 12px "Plus Jakarta Sans"'
            }
        }
    };
}

function buildTrendOptions(metrics, pixelRatio) {
    const colors = getThemeTokens();
    const energyAxis = getEnergyAxisBounds(metrics);

    return {
        responsive: false,
        maintainAspectRatio: false,
        devicePixelRatio: pixelRatio,
        normalized: true,
        interaction: {
            mode: "index",
            intersect: false
        },
        animation: {
            duration: 1300,
            easing: "easeOutQuart"
        },
        layout: {
            padding: { top: 18, right: 12, bottom: 8, left: 8 }
        },
        elements: {
            line: {
                borderCapStyle: "round",
                borderJoinStyle: "round"
            },
            point: {
                hitRadius: 14,
                hoverBorderWidth: 2
            }
        },
        plugins: {
            tooltip: buildTooltipTheme()
        },
        scales: {
            x: {
                alignToPixels: true,
                ticks: {
                    color: colors.axisStrong,
                    padding: 10,
                    font: { size: 12.5, weight: "700" }
                },
                grid: { display: false, drawBorder: false },
                border: { display: false }
            },
            yEnergy: {
                alignToPixels: true,
                position: "left",
                beginAtZero: false,
                min: energyAxis.min,
                max: energyAxis.max,
                title: {
                    display: true,
                    text: "Energy (kWh)",
                    color: colors.labelColor,
                    padding: { bottom: 10 },
                    font: { family: "IBM Plex Mono", size: 12, weight: "600" }
                },
                ticks: {
                    color: colors.tickColor,
                    padding: 12,
                    font: { size: 11.5, weight: "600" }
                },
                grid: {
                    lineWidth: 1,
                    color: colors.gridColor,
                    drawTicks: false
                },
                border: { display: false }
            },
            yOps: {
                alignToPixels: true,
                position: "right",
                beginAtZero: true,
                min: 0,
                max: getOpsAxisMax(metrics),
                title: {
                    display: true,
                    text: "Failures / Hours",
                    color: colors.labelColor,
                    padding: { bottom: 10 },
                    font: { family: "IBM Plex Mono", size: 12, weight: "600" }
                },
                ticks: {
                    color: colors.tickColor,
                    padding: 12,
                    stepSize: 2,
                    font: { size: 11.5, weight: "600" }
                },
                grid: {
                    drawOnChartArea: false,
                    drawTicks: false
                },
                border: { display: false }
            }
        }
    };
}

function buildTrendDatasets(context, metrics) {
    const colors = getThemeTokens();

    return [
        {
            label: "Energy Use",
            data: metrics.operationalTrends.energy,
            borderColor: colors.accentBase,
            backgroundColor: createAreaGradient(context, colors.accentAreaTop, colors.accentAreaBottom),
            fill: true,
            tension: 0.42,
            borderWidth: 3.2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: colors.pointLight,
            pointHoverBorderColor: colors.accentBase,
            pointHoverBorderWidth: 2,
            yAxisID: "yEnergy"
        },
        {
            label: "Failures",
            data: metrics.operationalTrends.failures,
            borderColor: colors.dangerBase,
            backgroundColor: createAreaGradient(context, colors.dangerAreaTop, colors.dangerAreaBottom),
            fill: false,
            tension: 0.38,
            borderWidth: 2.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.dangerBase,
            pointBorderColor: colors.pointLight,
            pointBorderWidth: 2,
            yAxisID: "yOps"
        },
        {
            label: "Working Hours",
            data: metrics.operationalTrends.workingHours,
            borderColor: colors.warningBase,
            backgroundColor: createAreaGradient(context, colors.warningAreaTop, colors.warningAreaBottom),
            fill: false,
            tension: 0.38,
            borderWidth: 2.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointStyle: "rectRot",
            pointBackgroundColor: colors.warningBase,
            pointBorderColor: colors.pointWarm,
            pointBorderWidth: 2,
            yAxisID: "yOps"
        }
    ];
}

function buildBreakdownGradients(context) {
    const colors = getThemeTokens();
    return [
        createVerticalGradient(context, colors.neutralLight, colors.neutralDark),
        createVerticalGradient(context, colors.accentLight, colors.accentDark),
        createVerticalGradient(context, colors.dangerLight, colors.dangerDark)
    ];
}

function buildQualityGradients(context) {
    const colors = getThemeTokens();
    return [
        createVerticalGradient(context, colors.accentLight, colors.accentDark),
        createVerticalGradient(context, colors.dangerLight, colors.dangerDark)
    ];
}

function buildTooltipTheme() {
    const colors = getThemeTokens();

    return {
        backgroundColor: colors.tooltipBackground,
        titleColor: colors.titleColor,
        bodyColor: colors.bodyColor,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        cornerRadius: 18,
        displayColors: true,
        boxWidth: 11,
        boxHeight: 11,
        boxPadding: 6,
        usePointStyle: true,
        titleFont: { size: 14, weight: "700" },
        bodyFont: { size: 12.5, weight: "600" }
    };
}

function prepareCanvas(canvas) {
    const wrapper = canvas.parentElement;
    const styles = window.getComputedStyle(wrapper);
    const width = Math.max(Math.floor(wrapper.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)), 280);
    const height = Math.max(Math.floor(wrapper.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)), 240);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width;
    canvas.height = height;

    return {
        context: canvas.getContext("2d", { alpha: true }),
        width,
        height,
        pixelRatio: getChartPixelRatio()
    };
}

function syncChartCanvas(chart) {
    const prepared = prepareCanvas(chart.canvas);
    chart.options.devicePixelRatio = prepared.pixelRatio;
    chart.resize(prepared.width, prepared.height);
    return prepared;
}

function scheduleChartRefresh() {
    if (currentMetrics) {
        buildCharts(currentMetrics);
    }
}

function createVerticalGradient(context, startColor, endColor) {
    const gradient = context.createLinearGradient(0, 0, 0, context.canvas.height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
}

function createAreaGradient(context, startColor, endColor) {
    const gradient = context.createLinearGradient(0, 0, 0, context.canvas.height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
}

function animateValue(element, target, format) {
    const duration = 900;
    const startTime = performance.now();

    function frame(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = target * eased;
        element.textContent = formatMetric(currentValue, format, progress < 1);

        if (progress < 1) {
            requestAnimationFrame(frame);
            return;
        }

        element.textContent = formatMetric(target, format, false);
    }

    requestAnimationFrame(frame);
}

function formatMetric(value, format, isAnimating) {
    if (format === "percent") {
        return `${Number(value).toFixed(2)}%`;
    }

    if (format === "decimal") {
        return Number(value).toFixed(2);
    }

    if (format === "hours") {
        return `${Number(value).toFixed(2)} h`;
    }

    if (format === "energy") {
        return `${Number(value).toFixed(2)} kWh`;
    }

    return Math.round(isAnimating ? value : Number(value)).toLocaleString("en-US");
}

function formatPercent(value) {
    return `${Number(value).toFixed(2)}%`;
}

function setInputStatus(message, state) {
    inputStatus.textContent = message;
    inputStatus.classList.remove("panel__note--error", "panel__note--success");

    if (state === "error") {
        inputStatus.classList.add("panel__note--error");
    } else if (state === "success") {
        inputStatus.classList.add("panel__note--success");
    }
}

function setAccessStatus(message, state) {
    accessStatus.textContent = message;
    accessStatus.classList.remove("panel__note--success", "panel__note--error");

    if (state === "success") {
        accessStatus.classList.add("panel__note--success");
    } else if (state === "error") {
        accessStatus.classList.add("panel__note--error");
    }
}

function setLoginStatus(message, state) {
    loginStatus.textContent = message;
    loginStatus.classList.remove("auth-status--error", "auth-status--success");

    if (state === "error") {
        loginStatus.classList.add("auth-status--error");
    } else if (state === "success") {
        loginStatus.classList.add("auth-status--success");
    }
}

function setSignupStatus(message, state) {
    signupStatus.textContent = message;
    signupStatus.classList.remove("auth-status--error", "auth-status--success");

    if (state === "error") {
        signupStatus.classList.add("auth-status--error");
    } else if (state === "success") {
        signupStatus.classList.add("auth-status--success");
    }
}

function setAuthView(view) {
    const isLoginView = view === "login";

    loginPanel.hidden = !isLoginView;
    signupPanel.hidden = isLoginView;
    loginPanel.classList.toggle("auth-panel--active", isLoginView);
    signupPanel.classList.toggle("auth-panel--active", !isLoginView);
    loginTabButton.classList.toggle("auth-tab--active", isLoginView);
    signupTabButton.classList.toggle("auth-tab--active", !isLoginView);
    loginTabButton.setAttribute("aria-selected", String(isLoginView));
    signupTabButton.setAttribute("aria-selected", String(!isLoginView));
}

function getStoredUsers() {
    const rawUsers = localStorage.getItem(STORAGE_USERS_KEY);

    if (!rawUsers) {
        return [];
    }

    try {
        const parsedUsers = JSON.parse(rawUsers);
        return Array.isArray(parsedUsers) ? parsedUsers : [];
    } catch (error) {
        return [];
    }
}

function saveStoredUsers(users) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function validateSignupInput(name, email, password) {
    if (!name || !email || !password) {
        return "Complete all sign up fields before creating an account.";
    }

    if (name.length < 2) {
        return "Name must contain at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Enter a valid email address.";
    }

    if (password.length < 6) {
        return "Password must be at least 6 characters long.";
    }

    return "";
}

function getOpsAxisMax(metrics) {
    const maxFailure = Math.max(...metrics.operationalTrends.failures, 0);
    const maxHours = Math.max(...metrics.operationalTrends.workingHours, 0);
    return Math.max(10, Math.ceil(Math.max(maxFailure, maxHours) + 1));
}

function getEnergyAxisBounds(metrics) {
    const maxEnergy = Math.max(...metrics.operationalTrends.energy, 0);

    if (maxEnergy === 0) {
        return { min: 0, max: 100 };
    }

    return { min: 0, max: Math.ceil(maxEnergy * 1.2) };
}

function getChartPixelRatio() {
    return clamp(window.devicePixelRatio || 1, 1, 2.5);
}

function getThemeTokens() {
    const styles = getComputedStyle(document.documentElement);

    return {
        accentBase: styles.getPropertyValue("--accent").trim(),
        accentDark: styles.getPropertyValue("--accent-strong").trim(),
        accentLight: styles.getPropertyValue("--accent").trim(),
        accentAreaTop: toAlpha(styles.getPropertyValue("--accent").trim(), 0.28),
        accentAreaBottom: toAlpha(styles.getPropertyValue("--accent").trim(), 0.02),
        dangerBase: styles.getPropertyValue("--danger").trim(),
        dangerDark: styles.getPropertyValue("--danger").trim(),
        dangerLight: lightenHex(styles.getPropertyValue("--danger").trim(), 0.18),
        dangerAreaTop: toAlpha(styles.getPropertyValue("--danger").trim(), 0.16),
        dangerAreaBottom: toAlpha(styles.getPropertyValue("--danger").trim(), 0.01),
        warningBase: styles.getPropertyValue("--warning").trim(),
        warningAreaTop: toAlpha(styles.getPropertyValue("--warning").trim(), 0.18),
        warningAreaBottom: toAlpha(styles.getPropertyValue("--warning").trim(), 0.02),
        neutralLight: lightenHex(styles.getPropertyValue("--neutral").trim(), 0.16),
        neutralDark: styles.getPropertyValue("--neutral").trim(),
        breakdownBorders: [
            lightenHex(styles.getPropertyValue("--neutral").trim(), 0.12),
            lightenHex(styles.getPropertyValue("--accent").trim(), 0.08),
            lightenHex(styles.getPropertyValue("--danger").trim(), 0.08)
        ],
        labelColor: styles.getPropertyValue("--text-muted").trim(),
        tickColor: styles.getPropertyValue("--text-soft").trim(),
        axisStrong: styles.getPropertyValue("--text").trim(),
        titleColor: styles.getPropertyValue("--text").trim(),
        bodyColor: styles.getPropertyValue("--text-soft").trim(),
        gridColor: styles.getPropertyValue("--grid").trim(),
        surfaceEdge: document.documentElement.dataset.theme === "light" ? "rgba(255,255,255,0.96)" : "rgba(6,17,31,0.92)",
        tooltipBackground: document.documentElement.dataset.theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(4,12,24,0.98)",
        tooltipBorder: styles.getPropertyValue("--border-strong").trim(),
        pointLight: document.documentElement.dataset.theme === "light" ? "#ffffff" : "#f2fffe",
        pointWarm: document.documentElement.dataset.theme === "light" ? "#fffdf5" : "#fff5d8"
    };
}

function normalizeLegendColor(color) {
    return color.startsWith("linear-gradient") ? getThemeTokens().accentBase : color;
}

function lightenHex(value, amount) {
    if (!value.startsWith("#")) {
        return value;
    }

    const hex = value.replace("#", "");
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const next = [r, g, b].map((channel) => Math.round(channel + (255 - channel) * amount));
    return `rgb(${next[0]}, ${next[1]}, ${next[2]})`;
}

function toAlpha(value, alpha) {
    if (value.startsWith("#")) {
        const hex = value.replace("#", "");
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (value.startsWith("rgb(")) {
        return value.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
    }

    return value;
}

function cloneDashboardData(data) {
    return { ...data };
}

function isZeroDashboardState(data) {
    return Object.values(data).every((value) => value === 0);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundToOne(value) {
    return Math.round(value * 10) / 10;
}

function roundToTwo(value) {
    return Math.round(value * 100) / 100;
}
