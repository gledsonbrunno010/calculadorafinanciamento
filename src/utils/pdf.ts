
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

    // --- Header ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RELATÓRIO DE SIMULAÇÃO DE FINANCIAMENTO', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Gerado em: ${dateStr}`, pageWidth / 2, 26, { align: 'center' });

    // doc.ln(5) is not standard jsPDF, using y offset
    let y = 35;
    const lineHeight = 7;

    // Helper: Section Title with Gray Background
    const addSectionTitle = (title: string) => {
        // Check for page break
        if (y + 15 > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(230, 230, 230); // Light Gray
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(title.toUpperCase(), margin + 2, y + 5.5);

        y += 12;
    };

    const addLine = (label: string, value: string, valueColor: [number, number, number] = [0, 0, 0]) => {
        if (y + 7 > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        const valueX = 90; // Fixed alignment for values
        doc.text(value, valueX, y);

        doc.setTextColor(0, 0, 0); // Reset
        y += lineHeight;
    };

    // 1️⃣ DADOS DO FINANCIAMENTO
    addSectionTitle('1. DADOS DO FINANCIAMENTO');

    const typeLabel = data.clientType === 'imobiliario' ? 'Financiamento Imobiliário' : 'Financiamento Automotivo';
    addLine('Modalidade:', typeLabel);
    addLine('Valor do Bem:', formatCurrency(data.loanAmount));
    addLine('Valor de Entrada:', formatCurrency(data.availableDownPayment));
    addLine('Valor Financiado:', formatCurrency(data.loanAmount - data.availableDownPayment));
    addLine('Sistema de Amortização:', data.systemOfAmortization);
    addLine('Prazo:', `${data.months} meses`);
    addLine('Taxa de Juros:', `${data.monthlyRate.toFixed(2)}% a.m.`);
    addLine('Valor da Parcela:', formatCurrency(data.monthlyInstallment));
    y += 3;

    // 2️⃣ ANÁLISE DA RENDA ATUAL
    addSectionTitle('2. ANÁLISE DA RENDA ATUAL');

    const maxInstallment = data.clientIncome * 0.30;
    const incomeStatus = data.clientIncome >= data.minIncome ? "Possível Aprovação" : "Renda Insuficiente";
    // Cor do status baseado na lógica original, pode ajustar se quiser
    const statusColor: [number, number, number] = data.clientIncome >= data.minIncome ? [0, 0, 0] : [0, 0, 0];

    addLine('Renda Informada:', formatCurrency(data.clientIncome));
    addLine('Parcela Máxima (30%):', formatCurrency(maxInstallment));
    addLine('Percentual de Comprometimento:', `${data.commitment.toFixed(2)}%`);
    addLine('Status:', incomeStatus, statusColor);
    y += 3;

    // 3️⃣ RENDA MÍNIMA NECESSÁRIA
    addSectionTitle('3. RENDA MÍNIMA NECESSÁRIA');

    const deficit = data.minIncome - data.clientIncome;
    const adjustmentNeeded = deficit > 0 ? (deficit / data.clientIncome) * 100 : 0;

    addLine('Renda Mínima Exigida:', formatCurrency(data.minIncome));
    addLine('Diferença de Renda:', formatCurrency(Math.max(0, deficit)));
    addLine('Percentual de Ajuste:', `${adjustmentNeeded.toFixed(2)}%`);
    y += 3;

    // 4️⃣ CLASSIFICAÇÃO DE RISCO
    addSectionTitle('4. CLASSIFICAÇÃO DE RISCO');

    // Risk Box Logic
    let boxColor: [number, number, number] = [192, 0, 0]; // Red default
    if (data.riskLevel === 'BAIXO') boxColor = [0, 176, 80]; // Green
    else if (data.riskLevel === 'MODERADO') boxColor = [255, 192, 0]; // Yellow

    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // White text
    doc.text(`CLASSIFICAÇÃO DE RISCO: ${data.riskLevel}`, pageWidth / 2, y + 6.5, { align: 'center' });

    y += 15;
    doc.setTextColor(0, 0, 0);

    // Justificativa
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Justificativa Técnica:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    const splitJustification = doc.splitTextToSize(data.riskJustification, pageWidth - (margin * 2));
    doc.text(splitJustification, margin, y);
    y += (splitJustification.length * 5) + 8;

    // --- BANKS SECTION ---
    if (data.banks && data.banks.length > 0) {
        if (y + 40 > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
        }

        addSectionTitle('BANCOS SUGERIDOS (Referência Fev/2026)');

        let bankX = margin;

        // Loop through banks and try to load their images
        for (const bank of data.banks) {

            // Draw Card Background
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(bankX, y, 45, 30, 2, 2, 'FD');

            // Bank Name
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(50);
            doc.text(bank.name, bankX + 22.5, y + 22, { align: 'center', maxWidth: 40 });

            // Interest Rate
            doc.setFontSize(9);
            doc.setTextColor(0, 100, 0); // Dark Green
            doc.text(`${bank.rate.toFixed(2)}% a.m.`, bankX + 22.5, y + 27, { align: 'center' });

            // Logo Loading
            if (bank.logoUrl) {
                try {
                    const logoData = await loadImage(bank.logoUrl);
                    if (logoData) {
                        try {
                            // Center the image horizontally in the box
                            // Box width = 45. Center = 22.5. Image width = 25?
                            const imgWidth = 25;
                            const imgHeight = 10;
                            const xPos = bankX + (45 - imgWidth) / 2;
                            doc.addImage(logoData, 'PNG', xPos, y + 3, imgWidth, imgHeight);
                        } catch (imgErr) {
                            console.warn("Error adding image to PDF:", imgErr);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to load logo for", bank.name);
                }
            }

            bankX += 50;
        }
    }


    // 5️⃣ AVISO LEGAL (Footer)
    addSectionTitle('5. AVISO LEGAL');
    // The addSectionTitle adds 12 to y, so we go back a bit for text to be close or just use flow
    // Layout for Disclaimer
    const disclaimer = "AVISO LEGAL: Esta simulação não constitui aprovação de crédito. A aprovação está sujeita à análise de crédito, verificação documental, score, capacidade de pagamento e políticas internas da instituição financeira.";

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
    doc.text(splitDisclaimer, margin, y);

    // Filename
    const safeName = data.clientName ? data.clientName.replace(/\s+/g, '_').toLowerCase() : 'simulacao';
    doc.save(`${safeName}_analise.pdf`);
};
