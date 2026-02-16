
import { jsPDF } from 'jspdf';
import { formatCurrency } from './financing';
import type { BankRecommendation } from './financing';

interface SimulationData {
    clientName: string;
    clientCpf: string;
    clientAge: string;
    clientIncome: number;
    clientScore: number;
    clientType: 'imobiliario' | 'veiculo';
    loanAmount: number;
    availableDownPayment: number;
    requiredDownPayment: number;
    monthlyInstallment: number;
    totalPaid: number;
    cet: number;
    months: number;
    monthlyRate: number;
    annualRate: number;
    approvalStatus: string;
    // New Fields from ApprovalResult
    riskLevel: string;
    approvalReason: string;
    riskJustification: string;
    minIncome: number;
    commitment: number;
    // Base
    systemOfAmortization: string;
    banks: BankRecommendation[];
}

// Helper to load image as Base64 (Standard)
const loadImage = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }

            ctx.drawImage(img, 0, 0);

            try {
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                console.warn('Canvas tainted:', url);
                resolve(null);
            }
        };
        img.onerror = () => {
            console.warn('Failed to load image:', url);
            resolve(null);
        };
        img.src = url;
    });
};

export const generatePDF = async (data: SimulationData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0); // Black
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Análise de Crédito', pageWidth / 2, 20, { align: 'center' });

    // Header line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, 25, pageWidth - margin, 25);

    // Reset font
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let y = 35;
    const lineHeight = 7;

    // Helper to add sections
    const addSectionTitle = (title: string, iconStr: string = '') => {
        y += 5;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12); // Orange-600
        doc.text(`${iconStr} ${title}`.trim(), margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0); // Black
        doc.setFont('helvetica', 'normal');
    };

    const addLine = (label: string, value: string, valueColor: [number, number, number] = [0, 0, 0]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        const valueX = 95;
        doc.text(value, valueX, y);

        doc.setTextColor(0, 0, 0); // Reset
        y += lineHeight;
    };

    // 1️⃣ DADOS DO FINANCIAMENTO
    addSectionTitle('1. DADOS DA OPERAÇÃO');

    const typeLabel = data.clientType === 'imobiliario' ? 'Crédito Imobiliário' : 'Crédito Veículo';
    addLine('Modalidade:', typeLabel);
    addLine('Valor do Bem:', formatCurrency(data.loanAmount));
    addLine('Valor de Entrada:', formatCurrency(data.availableDownPayment));
    addLine('Valor Financiado:', formatCurrency(data.loanAmount - data.availableDownPayment));
    addLine('Sistema de Amortização:', data.systemOfAmortization);
    addLine('Prazo:', `${data.months} meses`);
    addLine('Taxa de Juros:', `${data.monthlyRate.toFixed(2)}% a.m.`);
    addLine('Valor da Parcela (Inicial):', formatCurrency(data.monthlyInstallment));

    // 2️⃣ ANÁLISE DA RENDA ATUAL
    addSectionTitle('2. ANÁLISE DA RENDA');

    const maxInstallment = data.clientIncome * 0.30;
    const incomeStatus = data.clientIncome >= data.minIncome ? "Possível Aprovação" : "Renda Insuficiente";
    const incomeColor: [number, number, number] = data.clientIncome >= data.minIncome ? [22, 163, 74] : [220, 38, 38];

    addLine('Renda Informada:', formatCurrency(data.clientIncome));
    addLine('Limite de Parcela (30%):', formatCurrency(maxInstallment));
    addLine('Comprometimento Real:', `${data.commitment.toFixed(2)}%`);
    addLine('Status da Renda:', incomeStatus, incomeColor);

    // 3️⃣ RENDA MÍNIMA NECESSÁRIA
    addSectionTitle('3. RENDA MÍNIMA NECESSÁRIA');

    const deficit = data.minIncome - data.clientIncome;
    const adjustmentNeeded = deficit > 0 ? (deficit / data.clientIncome) * 100 : 0;

    addLine('Renda Mínima Exigida:', formatCurrency(data.minIncome));

    if (deficit > 0) {
        addLine('Déficit de Renda:', formatCurrency(deficit), [220, 38, 38]);
        addLine('Ajuste Necessário:', `+${adjustmentNeeded.toFixed(1)}%`, [220, 38, 38]);
    } else {
        addLine('Situação:', 'Renda Compatível', [22, 163, 74]);
    }

    // 4️⃣ CLASSIFICAÇÃO DE RISCO
    addSectionTitle('4. CLASSIFICAÇÃO DE RISCO');

    let riskColor: [number, number, number] = [0, 0, 0];
    if (data.riskLevel === 'BAIXO') riskColor = [22, 163, 74];
    else if (data.riskLevel === 'MODERADO') riskColor = [234, 88, 12];
    else riskColor = [220, 38, 38];

    addLine('Nível de Risco:', data.riskLevel, riskColor);

    // Justificativa Multi-line
    doc.setFont('helvetica', 'bold');
    doc.text('Parecer Técnico:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const splitJustification = doc.splitTextToSize(data.riskJustification, 170);
    doc.text(splitJustification, margin, y);
    y += (splitJustification.length * 5) + 5;


    // --- BANKS SECTION ---
    // Check space
    if (y + 40 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = margin;
    }

    if (data.banks && data.banks.length > 0) {
        addSectionTitle('BANCOS RECOMENDADOS');

        let bankX = margin;
        for (const bank of data.banks) {
            // Draw bank logic similar to before but simpler
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(255, 255, 255);
            doc.rect(bankX, y, 45, 25, 'fd');

            doc.setFontSize(7);
            doc.setTextColor(0);
            doc.text(bank.name, bankX + 22.5, y + 12, { align: 'center', maxWidth: 40 });
            doc.text(`${(bank.rate).toFixed(2)}% a.m.`, bankX + 22.5, y + 18, { align: 'center' });

            // Try load logo logic here if needed (omitted for brevity as logic is same)
            // Re-using the async logo loader logic from previous implementation if available would be best
            // But for this refactor I will assume the visual boxes are enough or I would need to copy the loop logic
            // Let's rely on text for now to ensure robustness unless I copy the loop exactly.
            // I will try to load the logo if provided.
            if (bank.logoUrl) {
                try {
                    // Since we are inside async function, we can await
                    // Ideally we pre-load images but here we just try one by one
                    const logoBase64 = await loadImage(bank.logoUrl);
                    if (logoBase64) {
                        doc.addImage(logoBase64, 'PNG', bankX + 12, y + 2, 20, 8);
                    }
                } catch (e) { }
            }

            bankX += 50;
        }
    }


    // 5️⃣ AVISO LEGAL OBRIGATÓRIO (Footer)
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 25;

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);

    // Draw line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    const disclaimer = "AVISO LEGAL: Esta simulação não constitui aprovação de crédito. A aprovação está sujeita à análise de crédito, verificação documental, score, capacidade de pagamento e políticas internas da instituição financeira. Os valores apresentados são estimativas baseadas nas taxas de mercado atuais.";

    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
    doc.text(splitDisclaimer, pageWidth / 2, footerY, { align: 'center' });

    doc.save(`analise_${data.clientName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};
