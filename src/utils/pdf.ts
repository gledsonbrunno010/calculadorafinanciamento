
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

// Helper to load image as Base64 and convert to BLACK AND WHITE (Grayscale)
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

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Convert to Grayscale (Black & White)
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = avg;     // Red
                    data[i + 1] = avg; // Green
                    data[i + 2] = avg; // Blue
                }
                ctx.putImageData(imageData, 0, 0);

                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                // Tainted canvas (CORS error) - return null
                console.warn('Canvas tainted, cannot process image:', url);
                resolve(null);
            }
        };
        img.onerror = () => {
            // Fallback to null (don't show image)
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
    // --- RECOMMENDED BANKS ---
    const pageHeight = doc.internal.pageSize.getHeight();

    // Check if we need a new page before starting the bank section
    // Estimate section height: title (8) + content (50)
    if (y + 60 > pageHeight - margin) {
        doc.addPage();
        y = margin;
    }

    if (data.banks && data.banks.length > 0) {
        addSectionTitle('BANCOS RECOMENDADOS (Taxa Compatível)');

        let bankX = margin;

        for (const bank of data.banks) {
            // Check horizontal space (unlikely to overflow with 3 items, but good practice)
            // Draw bank container
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);

            // Reduced size as requested ("um pouco mais pequena")
            const boxHeight = 35;
            const boxWidth = 45;

            doc.rect(bankX, y, boxWidth, boxHeight, 'FD');

            // Try to load logo
            let logoLoaded = false;
            try {
                if (bank.logoUrl) {
                    const base64 = await loadImage(bank.logoUrl);
                    if (base64) {
                        try {
                            // Smaller Centered Logo
                            const logoW = 30; // Reduced from 40
                            const logoH = 12; // Reduced from 15
                            const logoX = bankX + (boxWidth - logoW) / 2;
                            doc.addImage(base64, 'PNG', logoX, y + 5, logoW, logoH, undefined, 'FAST');
                            logoLoaded = true;
                        } catch (e) { /* ignore */ }
                    }
                }
            } catch (err) { /* ignore */ }

            // Name
            doc.setFontSize(7); // Smaller font
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');

            const nameY = logoLoaded ? y + 22 : y + 15;
            doc.text(bank.name, bankX + boxWidth / 2, nameY, { align: 'center', maxWidth: boxWidth - 4 });

            // Rate Text below
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(100);
            doc.text(`Ref: ${(bank.rate || data.monthlyRate).toFixed(2)}% a.m.`, bankX + boxWidth / 2, y + 30, { align: 'center' });

            bankX += 50; // Reduced spacing
        }
        y += 45;
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
