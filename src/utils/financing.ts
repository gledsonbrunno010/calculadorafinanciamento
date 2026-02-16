
/**
 * Financial Calculation Utilities
 * Enhanced for precision and scoring logic.
 */

// Format currency to BRL
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

// Calculate Age correctly
export const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

// Calculate monthly installment using PMT formula
// Formula: PMT = P * i * (1 + i)^n / ((1 + i)^n - 1)
export const calculateInstallment = (
    loanAmount: number,
    monthlyRate: number, // Taxa mensal já dividida por 100 (ex: 0.015)
    months: number
): number => {
    if (monthlyRate === 0) return loanAmount / months;

    const factor = Math.pow(1 + monthlyRate, months);
    return (loanAmount * monthlyRate * factor) / (factor - 1);
};

// --- NEW ADVANCED SIMULATION LOGIC ---

export interface SimulationResult {
    system: 'SAC' | 'PRICE';
    firstInstallment: number;
    lastInstallment: number;
    averageInstallment: number;
    totalPaid: number;
    totalInterest: number;
    banks: BankRecommendation[]; // Added banks
}

export interface BankRecommendation {
    name: string;
    logoUrl: string;
    rate: number; // Approximate match rate
}

/**
 * Calculates a complete financing schedule (SAC or PRICE) with optional Monetary Correction.
 */
export const calculateDetailedSimulation = (
    loanAmount: number,
    monthlyInterestRate: number,
    months: number,
    system: 'SAC' | 'PRICE',
    monthlyCorrectionRate: number = 0
): SimulationResult => {

    let balance = loanAmount;
    let totalPaid = 0;
    let totalInterest = 0;
    let firstInstallment = 0;
    let lastInstallment = 0;

    // Simulation Loop
    for (let i = 1; i <= months; i++) {
        if (monthlyCorrectionRate > 0) {
            balance = balance * (1 + monthlyCorrectionRate);
        }

        let interest = balance * monthlyInterestRate;
        let amortization = 0;
        let installmentValue = 0;

        if (system === 'SAC') {
            amortization = balance / (months - i + 1);
            installmentValue = amortization + interest;
        } else {
            // simplified PRICE for loop (recalc)
            if (monthlyInterestRate > 0) {
                const factor = Math.pow(1 + monthlyInterestRate, months - i + 1);
                installmentValue = (balance * monthlyInterestRate * factor) / (factor - 1);
            } else {
                installmentValue = balance / (months - i + 1);
            }
            interest = balance * monthlyInterestRate;
            amortization = installmentValue - interest;
        }

        // Floating point precision fix
        if (i === months) {
            if (system === 'SAC') {
                amortization = balance;
                installmentValue = amortization + interest;
            }
            // For PRICE recalculation handles it mostly, but force strict closepout:
            if (Math.abs(balance - amortization) < 1) amortization = balance;
        }

        if (i === 1) firstInstallment = installmentValue;
        if (i === months) lastInstallment = installmentValue;

        totalPaid += installmentValue;
        totalInterest += interest;
        balance -= amortization;
        if (balance < 0) balance = 0;
    }

    // Get Recommended Banks based on rate
    const banks = getRecommendedBanks(monthlyInterestRate * 100);

    return {
        system,
        firstInstallment,
        lastInstallment,
        averageInstallment: totalPaid / months,
        totalPaid,
        totalInterest,
        banks
    };
};

// Start of Bank Logic
const ALL_BANKS = [
    { name: 'Caixa Econômica Federal', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Caixa_Econ%C3%B4mica_Federal_logo.svg/500px-Caixa_Econ%C3%B4mica_Federal_logo.svg.png', minRate: 0.70, maxRate: 1.40 },
    { name: 'Banco do Brasil', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Banco_do_Brasil_logo.svg/500px-Banco_do_Brasil_logo.svg.png', minRate: 0.80, maxRate: 1.50 },
    { name: 'BRB Banco de Brasília', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/BRB_Banco_de_Bras%C3%ADlia_logo.svg/500px-BRB_Banco_de_Bras%C3%ADlia_logo.svg.png', minRate: 0.75, maxRate: 1.45 },
    { name: 'Santander', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/500px-Banco_Santander_Logotipo.svg.png', minRate: 1.00, maxRate: 1.80 },
    { name: 'Itaú', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Ita%C3%BA_Unibanco_logo.svg/500px-Ita%C3%BA_Unibanco_logo.svg.png', minRate: 1.05, maxRate: 1.85 },
    { name: 'Bradesco', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Bradesco_logo.svg/500px-Bradesco_logo.svg.png', minRate: 1.02, maxRate: 1.82 },
];

export const getRecommendedBanks = (rate: number): BankRecommendation[] => {
    // Filter banks that cover this rate
    // We relax the filtering to ensure we always show something relevant

    // 1. Try strict range match
    let candidates = ALL_BANKS.filter(b => rate >= b.minRate && rate <= (b.maxRate + 0.5));

    // 2. Fallback logic ensuring we respect the user's intent: "always that the rate is average... add the logo"
    // If no candidates, or just to boost variety, add based on low/high logic
    if (candidates.length < 3) {
        if (rate > 1.4) {
            // High rates -> Private banks
            const privateBanks = ALL_BANKS.filter(b => ['Santander', 'Itaú', 'Bradesco'].includes(b.name));
            candidates = [...new Set([...candidates, ...privateBanks])];
        } else {
            // Low rates -> Public/Regional banks
            const publicBanks = ALL_BANKS.filter(b => ['Caixa Econômica Federal', 'Banco do Brasil', 'BRB Banco de Brasília'].includes(b.name));
            candidates = [...new Set([...candidates, ...publicBanks])];
        }
    }

    // Return top 3 unique banks
    return candidates.slice(0, 3).map(b => ({
        name: b.name,
        logoUrl: b.logo,
        rate: rate // Display the user's rate as reference
    }));
};


export const calculateTotalPaid = (
    monthlyInstallment: number,
    months: number
): number => {
    return monthlyInstallment * months;
};

// Calculate Total Effective Cost (CET)
export const calculateCET = (
    monthlyInstallment: number,
    months: number,
    loanAmount: number
): number => {
    return (monthlyInstallment * months) - loanAmount;
};

// Calculate required down payment based on type
export const calculateRequiredDownPayment = (fullValue: number, type: 'imobiliario' | 'veiculo'): number => {
    // Imobiliário costuma exigir 20%, Veículos 30% em simulações conservadoras
    const percentage = type === 'imobiliario' ? 0.20 : 0.30;
    return fullValue * percentage;
};

// Convert monthly rate to annual rate
export const calculateAnnualRate = (monthlyRatePercentage: number): number => {
    return (Math.pow(1 + monthlyRatePercentage / 100, 12) - 1) * 100;
};

// Scoring Logic
export interface CreditScoreInput {
    income: number;
    installment: number; // Uses first installment for conservative analysis
    score: number; // 0-1000
    hasDebts: boolean; // Dívidas ativas
    age: number;
}

export const calculateCreditApproval = (input: CreditScoreInput): { approved: boolean; reason: string; riskLevel: string } => {
    const commitment = (input.installment / input.income) * 100;

    if (input.hasDebts) {
        return { approved: false, reason: 'Reprovado: Possui dívidas ativas registradas.', riskLevel: 'CRÍTICO' };
    }

    if (input.score < 300) {
        return { approved: false, reason: 'Reprovado: Score de crédito muito baixo (Risco Elevado).', riskLevel: 'ALTO' };
    }

    if (commitment > 30) {
        return {
            approved: false,
            reason: `Reprovado: Comprometimento de renda (${commitment.toFixed(1)}%) excede o limite de 30%.`,
            riskLevel: 'ALTO'
        };
    }

    if (input.score < 600) {
        return {
            approved: true,
            reason: 'Aprovado com Restrições: Score médio exige entrada maior ou fidador.',
            riskLevel: 'MÉDIO'
        };
    }

    return { approved: true, reason: 'Aprovado: Perfil de crédito sólido.', riskLevel: 'BAIXO' };
};
