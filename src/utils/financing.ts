
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
// Start of Bank Logic
const ALL_BANKS = [
    {
        name: 'Caixa Econômica Federal',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Caixa_Econ%C3%B4mica_Federal_logo.svg/800px-Caixa_Econ%C3%B4mica_Federal_logo.svg.png',
        minRate: 0.60,
        maxRate: 1.10,
        type: 'public'
    },
    {
        name: 'Banco do Brasil',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/fa/Banco_do_Brasil_logo.svg/800px-Banco_do_Brasil_logo.svg.png',
        minRate: 0.75,
        maxRate: 1.25,
        type: 'public'
    },
    {
        name: 'Bradesco',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Banco_Bradesco_logo_%28horizontal%29.svg/800px-Banco_Bradesco_logo_%28horizontal%29.svg.png',
        minRate: 0.90,
        maxRate: 1.45,
        type: 'private'
    },
    {
        name: 'Itaú',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Ita%C3%BA_logo.svg/800px-Ita%C3%BA_logo.svg.png',
        minRate: 0.95,
        maxRate: 1.55,
        type: 'private'
    },
    {
        name: 'Santander',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/800px-Banco_Santander_Logotipo.svg.png',
        minRate: 0.98,
        maxRate: 1.60,
        type: 'private'
    }
];

export const getRecommendedBanks = (rate: number): BankRecommendation[] => {
    // 1. Find banks where the user's rate falls within their range
    let candidates = ALL_BANKS.filter(b => rate >= b.minRate && rate <= (b.maxRate + 0.2));

    // 2. If fewer than 3, add banks based on proximity
    if (candidates.length < 3) {
        const others = ALL_BANKS.filter(b => !candidates.includes(b));
        // Sort by how close the rate is to their range
        others.sort((a, b) => {
            const distA = Math.min(Math.abs(rate - a.minRate), Math.abs(rate - a.maxRate));
            const distB = Math.min(Math.abs(rate - b.minRate), Math.abs(rate - b.maxRate));
            return distA - distB;
        });
        candidates = [...candidates, ...others];
    }

    // Return top 3 unique banks
    return candidates.slice(0, 3).map(b => ({
        name: b.name,
        logoUrl: b.logo,
        rate: Math.max(b.minRate, Math.min(b.maxRate, rate)) // Display user rate constrained to bank limits
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
    type: 'imobiliario' | 'veiculo';
    months: number;
    monthlyRate: number;
}

export interface ApprovalResult {
    approved: boolean;
    reason: string;
    riskLevel: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRÍTICO';
    riskJustification: string;
    minIncome: number;
    commitment: number;
}

export const calculateMinimumIncome = (installment: number): number => {
    return installment / 0.30;
};

export const calculateCreditApproval = (input: CreditScoreInput): ApprovalResult => {
    const commitment = (input.installment / input.income) * 100;
    const minIncome = calculateMinimumIncome(input.installment);

    // Initial Output Structure
    const result: ApprovalResult = {
        approved: false,
        reason: '',
        riskLevel: 'ALTO', // Default conservative
        riskJustification: '',
        minIncome: minIncome,
        commitment: commitment
    };

    // 1. Critical Stoppers
    if (input.hasDebts) {
        result.approved = false;
        result.riskLevel = 'CRÍTICO';
        result.reason = 'Reprovado: Possui dívidas ativas registradas no mercado.';
        result.riskJustification = 'Presença de restrições cadastrais impede a concessão de novo crédito.';
        return result;
    }

    if (input.score < 300) {
        result.approved = false;
        result.riskLevel = 'CRÍTICO';
        result.reason = 'Reprovado: Score de crédito insuficiente para análise.';
        result.riskJustification = 'Histórico de crédito recente ou volume de consultas impactam negativamente o risco.';
        return result;
    }

    // 2. Income Check (Absolute Rule)
    if (input.income < minIncome) {
        result.approved = false;
        result.riskLevel = 'ALTO';
        result.reason = 'Renda insuficiente para possível aprovação.';
        const deficit = minIncome - input.income;
        result.riskJustification = `A renda atual apresenta um déficit de ${formatCurrency(deficit)} para suportar a parcela com segurança dentro do limite de 30%.`;
        return result;
    }

    // 3. Sophisticated Risk Classification
    // Base params per type
    const isImob = input.type === 'imobiliario';
    const marketRateAvg = isImob ? 1.0 : 2.0;
    const highTermThreshold = isImob ? 360 : 60;

    // Rules
    const isLowCommitment = commitment <= 25;
    const isModerateCommitment = commitment > 25 && commitment <= 30;

    // Risk Level Determination
    if (isLowCommitment && input.months <= highTermThreshold && input.monthlyRate <= (marketRateAvg * 1.2)) {
        result.riskLevel = 'BAIXO';
    } else if (isModerateCommitment || input.months > highTermThreshold || input.monthlyRate > (marketRateAvg * 1.2)) {
        result.riskLevel = 'MODERADO';
    }

    // High Risk overrides
    // "Comprometimento muito próximo de 30% + Prazo Máximo + Juros Elevados"
    // Or just being close to the limit with other factors
    if (commitment > 29 || (commitment > 28 && input.months >= highTermThreshold)) {
        result.riskLevel = 'ALTO';
    }

    // 4. Approval Decision based on Score vs Risk
    // Lower scores require Lower Risk for approval
    if (input.score >= 700) {
        result.approved = true;
        result.reason = 'Possível aprovação sujeita à análise de crédito.';
    } else if (input.score >= 500) {
        if (result.riskLevel === 'BAIXO' || result.riskLevel === 'MODERADO') {
            result.approved = true;
            result.reason = 'Possível aprovação com restrições de taxa ou prazo.';
        } else {
            result.approved = false;
            result.reason = 'Risco elevado para o perfil de score atual.';
        }
    } else {
        // Score < 500
        if (result.riskLevel === 'BAIXO') {
            result.approved = true;
            result.reason = 'Análise manual requerida devido ao score.';
        } else {
            result.approved = false;
            result.reason = 'Score incompatível com o nível de risco da operação.';
        }
    }

    // Justification Text Generation
    const riskText = result.riskLevel === 'BAIXO' ? 'Baixo Risco' : result.riskLevel === 'MODERADO' ? 'Risco Moderado' : 'Risco Elevado';

    let justification = `Classificação: ${riskText}. Comprometimento de renda em ${commitment.toFixed(2)}%. `;

    if (result.riskLevel === 'BAIXO') {
        justification += 'Cenário favorável com folga orçamentária.';
    } else if (result.riskLevel === 'MODERADO') {
        justification += `Atenção ao prazo de ${input.months} meses e taxa de juros aplicada.`;
    } else {
        justification += 'Capacidade de pagamento no limite prudencial recomendado.';
    }

    result.riskJustification = justification;

    return result;
};
