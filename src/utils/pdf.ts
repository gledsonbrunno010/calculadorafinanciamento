
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
    addInfoLine("Total a Pagar:", formatCurrency(data.totalPaid), true);

    drawFooter(1);

    // ===============================
    // PÁGINA 2
    // ===============================
    doc.addPage();
    drawHeader();
    y = 33;

    addSection("3. RESULTADO DA ANÁLISE");
    const deficit = Math.max(0, data.minIncome - data.clientIncome);
    const ajuste = deficit > 0 ? (deficit / data.clientIncome) * 100 : 0;

    addInfoLine("Renda Mínima Necessária:", formatCurrency(data.minIncome), true);
    addInfoLine("Diferença de Renda:", formatCurrency(deficit));
    addInfoLine("Percentual de Ajuste:", `${ajuste.toFixed(2)}%`);

    addSection("4. JUSTIFICATIVA TÉCNICA");
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const justification = data.riskJustification || "Análise baseada nos dados fornecidos.";
    const splitJust = doc.splitTextToSize(justification, pageWidth - (margin * 2));
    doc.text(splitJust, margin, y);
    y += (splitJust.length * 5) + 6; // Multi-cell spacing approx

    addSection("5. CONFORMIDADE REGULATÓRIA");

    const lgpdText = "Em conformidade com a Lei nº 13.709/2018 (LGPD), os dados pessoais foram tratados exclusivamente para análise financeira simulada.";
    const splitLgpd = doc.splitTextToSize(lgpdText, pageWidth - (margin * 2));
    doc.text(splitLgpd, margin, y);
    y += (splitLgpd.length * 5) + 2; // ln(2)

    const bacenText = "Esta simulação segue as diretrizes prudenciais do Banco Central do Brasil, incluindo avaliação de capacidade de pagamento e transparência no cálculo do CET.";
    const splitBacen = doc.splitTextToSize(bacenText, pageWidth - (margin * 2));
    doc.text(splitBacen, margin, y);
    y += (splitBacen.length * 5);

    addSection("6. AVISO LEGAL");
    const avisoText = "Esta simulação não constitui aprovação de crédito. A aprovação depende de análise formal, verificação documental e políticas internas da instituição.";
    const splitAviso = doc.splitTextToSize(avisoText, pageWidth - (margin * 2));
    doc.text(splitAviso, margin, y);

    drawFooter(2);

    const safeName = data.clientName ? data.clientName.replace(/\s+/g, '_').toLowerCase() : 'simulacao';
    doc.save(`${safeName}_relatorio_premium.pdf`);
};
