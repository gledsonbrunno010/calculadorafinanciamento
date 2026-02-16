
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


export const generatePDF = async (data: SimulationData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // --- Helper Functions matching Python Class ---

    const drawHeader = () => {
        // Azul escuro banco digital (15, 23, 42)
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 25, 'F');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('RELATÓRIO DE SIMULAÇÃO DE CRÉDITO', 15, 8 + 6); // +6 approximate baseline adjustment

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        doc.text(`Gerado em ${dateStr}`, 15, 16 + 5);

        doc.setTextColor(0, 0, 0); // Reset
    };

    const drawFooter = (pageNumber: number) => {
        const totalPages = 2; // Fixed as per requirement
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    };

    let y = 35; // Start below header


    const addSection = (title: string) => {
        // Check for page break if needed (though we force 2 pages, safety first)
        if (y + 20 > pageHeight - margin) {
            doc.addPage();
            y = 35; // Reset Y below header
            drawHeader(); // Redraw header on new dynamic page if it ever happens
        }

        y += 5;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 240); // Lighter gray for elegance
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');

        // Left accent bar
        doc.setFillColor(15, 23, 42); // Blue accent
        doc.rect(margin, y, 1.5, 8, 'F');

        doc.setTextColor(30, 30, 30);
        doc.text(title.toUpperCase(), margin + 4, y + 5.5);
        y += 12;
    };

    const addInfoLine = (label: string, value: string, isBoldValue: boolean = false) => {
        const lineHeight = 7;

        // Check page break
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = 35;
            drawHeader();
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80); // Dark Gray for label
        doc.text(label, margin, y);

        // Dotted line leader (Visual guide)
        const labelWidth = doc.getTextWidth(label);
        const valueWidth = doc.getTextWidth(value);
        const startDot = margin + labelWidth + 2;
        const endDot = pageWidth - margin - valueWidth - 2;

        if (endDot > startDot) {
            doc.setDrawColor(200, 200, 200);
            // setLineDash not reliably typed in this setup, using simple logic or manual dots
            // Drawing a simple light line instead of dashed to ensure build success
            doc.line(startDot, y, endDot, y);
        }

        doc.setFont('helvetica', isBoldValue ? 'bold' : 'bold'); // Always slightly bold for data vs label
        doc.setTextColor(0, 0, 0); // Black for value
        doc.text(value, pageWidth - margin, y, { align: 'right' });

        y += lineHeight;
    };

    // ===============================
    // PÁGINA 1
    // ===============================
    drawHeader();

    // 1. DADOS DO CLIENTE
    addSection("1. DADOS DO CLIENTE");
    addInfoLine("Nome Completo:", data.clientName);
    addInfoLine("CPF:", data.clientCpf);
    addInfoLine("Idade:", data.clientAge + " anos");
    addInfoLine("Renda Informada:", formatCurrency(data.clientIncome));

    // 2. DADOS DO FINANCIAMENTO
    y += 4;
    addSection("2. DADOS DO FINANCIAMENTO");

    const typeLabel = data.clientType === 'imobiliario' ? 'Financiamento Imobiliário' : 'Financiamento Automotivo';
    addInfoLine("Modalidade:", typeLabel);
    addInfoLine("Valor do Bem:", formatCurrency(data.loanAmount));
    addInfoLine("Entrada:", formatCurrency(data.availableDownPayment));

    const percEntrada = (data.availableDownPayment / data.loanAmount) * 100;
    addInfoLine("Percentual de Entrada:", `${percEntrada.toFixed(2)}%`);

    const financiado = data.loanAmount - data.availableDownPayment;
    addInfoLine("Capital Financiado:", formatCurrency(financiado));
    addInfoLine("Sistema:", data.systemOfAmortization);
    addInfoLine("Prazo:", `${data.months} meses`);
    addInfoLine("Taxa de Juros:", `${data.monthlyRate.toFixed(2)}% a.m.`);
    addInfoLine("Custo Efetivo Total (CET):", formatCurrency(data.cet));
    addInfoLine("Total a Pagar (Estimado):", formatCurrency(data.totalPaid), true);

    // 3. DETALHAMENTO DAS PARCELAS
    y += 4;
    addSection("3. DETALHAMENTO DAS PARCELAS");

    addInfoLine("Média da Parcela:", formatCurrency(data.monthlyInstallment));
    addInfoLine("1ª Parcela (Estimada):", formatCurrency(data.monthlyInstallment));
    addInfoLine("Última Parcela (Estimada):", formatCurrency(data.monthlyInstallment));

    const parcelaMaxima = data.clientIncome * 0.30;
    addInfoLine("Parcela Máxima Permitida (30%):", formatCurrency(parcelaMaxima));

    // Color logic for commitment
    const commColor = data.commitment > 30 ? [200, 0, 0] : [0, 100, 0];
    // Custom handling for colored value
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const labelComm = "Comprometimento Atual:";
    doc.setTextColor(80, 80, 80);
    doc.text(labelComm, margin, y);

    // Line layout
    const commValText = `${data.commitment.toFixed(2)}%`;
    const w1 = doc.getTextWidth(labelComm);
    const w2 = doc.getTextWidth(commValText);
    const d1 = margin + w1 + 2;
    const d2 = pageWidth - margin - w2 - 2;
    if (d2 > d1) {
        doc.setDrawColor(200, 200, 200);
        doc.line(d1, y, d2, y);
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(commColor[0] as number, commColor[1] as number, commColor[2] as number);
    doc.text(commValText, pageWidth - margin, y, { align: 'right' });
    y += 8;

    drawFooter(1);

    // ===============================
    // PÁGINA 2
    // ===============================
    doc.addPage();
    drawHeader();
    y = 35; // Reset Y

    // 4. RESULTADO DA ANÁLISE
    addSection("4. RESULTADO DA ANÁLISE");
    y += 5;

    // Status Box centered
    const isApproved = data.clientIncome >= data.minIncome && data.riskLevel !== 'ALTO';
    const statusText = isApproved ? "APROVADO" : "REPROVADO";
    const statusColor: [number, number, number] = isApproved ? [22, 163, 74] : [220, 38, 38]; // Tailwind Green-600 / Red-600

    // Draw stylized box
    const boxHeight = 24;
    doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setLineWidth(0.5);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), boxHeight, 2, 2, 'FD');

    // Inner Status Badge
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(margin + 5, y + 5, pageWidth - (margin * 2) - 10, 8, 1, 1, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`STATUS DA ANÁLISE: ${statusText}`, pageWidth / 2, y + 10.5, { align: 'center' });

    // Little summary below status
    y += 18;
    // const deficit = Math.max(0, data.minIncome - data.clientIncome);
    // const ajuste = deficit > 0 ? (deficit / data.clientIncome) * 100 : 0;

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Renda Mínima: ${formatCurrency(data.minIncome)}`, pageWidth / 2, y, { align: 'center' });
    y += 15; // Gap after box

    // Risk Analysis
    let riskColor: [number, number, number] = [100, 100, 100];
    if (data.riskLevel === 'BAIXO') riskColor = [22, 163, 74];
    else if (data.riskLevel === 'MODERADO') riskColor = [234, 179, 8];
    else if (data.riskLevel === 'ALTO') riskColor = [220, 38, 38];

    // Risk Header
    doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`CLASSIFICAÇÃO DE RISCO: ${data.riskLevel}`, margin + 5, y + 5.5);
    y += 12;

    // Justification Content
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const justificationTitle = "Justificativa Técnica:";
    doc.text(justificationTitle, margin, y);
    y += 5;

    const splitJustification = doc.splitTextToSize(data.riskJustification || "Análise baseada nos dados fornecidos.", pageWidth - (margin * 2));
    doc.text(splitJustification, margin, y);
    y += (splitJustification.length * 5) + 8;

    // 5. CONFORMIDADE & LEGAL (Side by side or stacked cleanly)
    addSection("5. CONFORMIDADE E DIRETRIZES");

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    const complianceText = [
        "LGPD (Lei nº 13.709/2018): Dados tratados exclusivamente para simulação financeira, respeitando finalidade e segurança.",
        "",
        "BANCO CENTRAL: Simulação segue diretrizes prudenciais, com transparência no CET e avaliação de capacidade de pagamento."
    ];

    for (const line of complianceText) {
        const splitLine = doc.splitTextToSize(line, pageWidth - (margin * 2));
        doc.text(splitLine, margin, y);
        y += (splitLine.length * 4) + 2;
    }

    // 7. AVISO LEGAL FOOTER
    const footerY = pageHeight - 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const aviso = "AVISO LEGAL: Esta simulação não constitui aprovação de crédito. A concessão está sujeita a análise formal de crédito, revisão documental e política interna.";
    // splitTextToSize returns string[] or string, text() handles string[], align center handles X centering
    const splitAviso = doc.splitTextToSize(aviso, pageWidth - (margin * 2));
    doc.text(splitAviso, pageWidth / 2, footerY + 5, { align: 'center' });

    drawFooter(2);

    const safeName = data.clientName ? data.clientName.replace(/\s+/g, '_').toLowerCase() : 'simulacao';
    doc.save(`${safeName}_relatorio_premium.pdf`);
};
