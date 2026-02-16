
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
    monthlyInstallment: number; // Agora representa a Primeira Parcela apenas
    totalPaid: number;
    cet: number;
    months: number;
    monthlyRate: number; // Percentage
    annualRate: number; // Percentage
    approvalStatus: string;
    riskLevel: string;
    approvalReason: string;
    systemOfAmortization: string;
    banks: BankRecommendation[]; // NEW
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
    const lineHeight = 8;

    // Helper to add sections
    const addSectionTitle = (title: string, iconStr: string = '') => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12); // Orange-600
        doc.text(`${iconStr} ${title}`.trim(), margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0); // Black
        doc.setFont('helvetica', 'normal');
    };

    const addLine = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        const valueX = 90;
        doc.text(value, valueX, y);
        y += lineHeight;
    };

    // --- Client Details ---
    addSectionTitle('DADOS DO PROPONENTE');

    // Grid-like layout for client details
    addLine('Nome:', data.clientName);
    addLine('CPF:', data.clientCpf);
    addLine('Nascimento / Idade:', data.clientAge);
    addLine('Score de Crédito:', `${data.clientScore} / 1000`);
    addLine('Renda Comprovada:', formatCurrency(data.clientIncome));

    y += 4;

    // --- Financing Details ---
    addSectionTitle('DETALHES DA OPERAÇÃO');
    const typeLabel = data.clientType === 'imobiliario' ? 'Crédito Imobiliário' : 'Crédito Veículo';

    addLine('Modalidade:', typeLabel);
    addLine('Sistema de Amortização:', data.systemOfAmortization);
    addLine('Valor do Bem:', formatCurrency(data.loanAmount));
    addLine('Entrada Ofertada:', formatCurrency(data.availableDownPayment));
    addLine('Entrada Mínima:', formatCurrency(data.requiredDownPayment));

    if (data.availableDownPayment < data.requiredDownPayment) {
        const warningY = y - lineHeight;
        doc.setTextColor(220, 38, 38); // Red
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('(INSUFICIENTE)', 150, warningY);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
    }

    addLine('Prazo:', `${data.months} meses`);
    addLine('Taxa de Juros:', `${data.monthlyRate.toFixed(2)}% a.m. / ${data.annualRate.toFixed(2)}% a.a.`);

    y += 8;

    // --- RESULT BOX (COMPACT) ---
    doc.setFontSize(10);
    const reasonText = `Parecer: ${data.approvalReason}`;

    doc.setFont('helvetica', 'normal');
    const splitReason = doc.splitTextToSize(reasonText, 170);
    // Reduced padding and height calculation
    const boxHeight = 25 + (splitReason.length * 5);

    // Define Color based on status
    let boxColor = [240, 253, 244]; // Green-50
    let borderColor = [22, 163, 74]; // Green-600
    if (data.approvalStatus === 'REPROVADO') {
        boxColor = [254, 242, 242]; // Red-50
        borderColor = [220, 38, 38]; // Red-600
    } else if (data.riskLevel === 'MÉDIO') {
        boxColor = [255, 251, 235]; // Amber-50
        borderColor = [217, 119, 6]; // Amber-600
    }

    // Draw Box
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.rect(15, y, 180, boxHeight, 'FD');

    // Box Content
    const contentStartY = y + 8;

    // Status Header inside box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.text(data.approvalStatus, 20, contentStartY);

    // Score & Risk Label
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Score: ${data.clientScore}`, 145, contentStartY); // Score Display

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Risco: ${data.riskLevel}`, 145, contentStartY + 4);

    // Divider inside box
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.1);
    doc.line(20, contentStartY + 3, 185, contentStartY + 3);

    // Reason Text (Smaller)
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(splitReason, 20, contentStartY + 9);

    y += boxHeight + 8; // Reduced spacing after box

    // --- FINANCIAL SUMMARY ---
    addSectionTitle('PROJEÇÃO DE PAGAMENTO');

    addLine('Primeira Parcela:', formatCurrency(data.monthlyInstallment));
    addLine('Média da Parcela:', formatCurrency(data.totalPaid / data.months)); // Média simples
    addLine('Total a Pagar:', formatCurrency(data.totalPaid));
    addLine('Custo Efetivo Total (CET):', formatCurrency(data.cet));

    y += 4; // Minimal spacing before banks

    // --- RECOMMENDED BANKS ---
    // Here we list the banks and try to show their logos
    // --- RECOMMENDED BANKS ---
    const pageHeight = doc.internal.pageSize.getHeight();

    // Only skip page if REALLY needed. We want this on the first page.
    if (y + 40 > pageHeight - 15) {
        doc.addPage();
        y = margin;
    }

    if (data.banks && data.banks.length > 0) {
        addSectionTitle('BANCOS RECOMENDADOS');

        let bankX = margin;

        for (const bank of data.banks) {
            // Check horizontal space
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(255, 255, 255); // White background for logos

            // Compact Box
            const boxHeight = 28;
            const boxWidth = 45;

            doc.rect(bankX, y, boxWidth, boxHeight, 'FD');

            // Try to load logo
            let logoLoaded = false;
            try {
                if (bank.logoUrl) {
                    const base64 = await loadImage(bank.logoUrl);
                    if (base64) {
                        try {
                            // Logo Sizing
                            const logoW = 25;
                            const logoH = 10;
                            const logoX = bankX + (boxWidth - logoW) / 2;
                            // Add image with explicit alias to avoid cache collisions
                            doc.addImage(base64, 'PNG', logoX, y + 4, logoW, logoH, undefined, 'FAST');
                            logoLoaded = true;
                        } catch (e) { /* ignore */ }
                    }
                }
            } catch (err) { /* ignore */ }

            // Name
            doc.setFontSize(6);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');

            const nameY = logoLoaded ? y + 18 : y + 12;
            doc.text(bank.name, bankX + boxWidth / 2, nameY, { align: 'center', maxWidth: boxWidth - 2 });

            // Rate Text below
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(100);
            doc.text(`${(bank.rate || data.monthlyRate).toFixed(2)}% a.m.`, bankX + boxWidth / 2, y + 24, { align: 'center' });

            bankX += 48;
        }
        y += 35;
    }

    // Footer Logic with Page Check
    // If footer doesn't fit, new page
    if (y + 15 > pageHeight - margin) {
        doc.addPage();
        y = margin + 10;
    }

    // Position Footer at bottom (or at y if new page)
    const footerY = pageHeight - 15;

    // We want footer at the bottom of the CURRENT page if it fits, or bottom of NEW page.
    // Actually standard reports put footer at bottom of every page, but here we just stamp the end.
    // Let's just put it at bottom of the last page used.

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text('Aprovação sujeita a análise definitiva de documentos e política de crédito vigente.', pageWidth / 2, footerY + 5, { align: 'center' });

    doc.save(`analise_${data.clientName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};
