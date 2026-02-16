
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

// Helper to load image as Base64 to verify it works or fail gracefully
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
                // Tainted canvas
                resolve(null);
            }
        };
        img.onerror = () => {
            // Fallback to null (don't show image)
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

    // --- RESULT BOX ---
    // Prepare texts to calculate height
    doc.setFontSize(11);
    const reasonText = `Parecer: ${data.approvalReason}`;

    doc.setFont('helvetica', 'normal');
    const splitReason = doc.splitTextToSize(reasonText, 170);
    const boxHeight = 40 + (splitReason.length * 6);

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
    const contentStartY = y + 10;

    // Status Header inside box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.text(data.approvalStatus, 20, contentStartY);

    // Risk Label
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Nível de Risco: ${data.riskLevel}`, 120, contentStartY);

    // Divider inside box
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.1);
    doc.line(20, contentStartY + 5, 185, contentStartY + 5);

    // Reason Text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(splitReason, 20, contentStartY + 12);

    y += boxHeight + 10;

    // --- FINANCIAL SUMMARY ---
    addSectionTitle('PROJEÇÃO DE PAGAMENTO');

    addLine('Primeira Parcela:', formatCurrency(data.monthlyInstallment));
    addLine('Média da Parcela:', formatCurrency(data.totalPaid / data.months)); // Média simples
    addLine('Total a Pagar:', formatCurrency(data.totalPaid));
    addLine('Custo Efetivo Total (CET):', formatCurrency(data.cet));

    y += 8;

    // --- RECOMMENDED BANKS ---
    // Here we list the banks and try to show their logos
    if (data.banks && data.banks.length > 0) {
        addSectionTitle('BANCOS RECOMENDADOS (Taxa Compatível)');

        let bankX = margin;

        for (const bank of data.banks) {
            // Draw bank container
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.rect(bankX, y, 50, 25, 'FD');

            // Try to load logo
            try {
                // If logoUrl is available, render
                if (bank.logoUrl) {
                    const base64 = await loadImage(bank.logoUrl);
                    if (base64) {
                        try {
                            doc.addImage(base64, 'PNG', bankX + 5, y + 5, 40, 15, undefined, 'FAST');
                        } catch (e) {
                            // Fail silently
                        }
                    } else {
                        // Fallback Text if image fails
                        doc.setFontSize(8);
                        doc.setTextColor(0);
                        doc.text(bank.name, bankX + 25, y + 12, { align: 'center', maxWidth: 40 });
                    }
                }
            } catch (err) {
                // Fallback Text
                doc.setFontSize(8);
                doc.setTextColor(0);
                doc.text(bank.name, bankX + 25, y + 12, { align: 'center', maxWidth: 40 });
            }

            // Rate Text below
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Ref: ${(bank.rate || data.monthlyRate).toFixed(2)}% a.m.`, bankX + 25, y + 22, { align: 'center' });

            bankX += 55;
        }
        y += 35;
    }


    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text('Aprovação sujeita a análise definitiva de documentos e política de crédito vigente.', pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`analise_${data.clientName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};
