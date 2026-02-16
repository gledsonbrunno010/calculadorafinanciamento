
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
        y += 4;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text(title.toUpperCase(), margin + 2, y + 5.5);
        y += 10; // 8 height + 2 spacing
    };

    const addInfoLine = (label: string, value: string) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(label, margin, y);
        doc.text(value, margin + 65, y); // Fixed offset matches 'cell(65...)'
        y += 6;
    };

    // ===============================
    // PÁGINA 1
    // ===============================
    drawHeader();

    // 1. DADOS DO CLIENTE
    addSection("1. DADOS DO CLIENTE");
    addInfoLine("Nome Completo:", data.clientName);
    addInfoLine("CPF:", data.clientCpf);
    // Assuming birthdate/age provided or calculated (using placeholders if missing in SimulationData)
    addInfoLine("Idade:", data.clientAge + " anos");
    addInfoLine("Renda Informada:", formatCurrency(data.clientIncome));
    // addInfoLine("Email:", "email@exemplo.com"); // Not in current interface, skipping or adding placeholder
    // addInfoLine("Telefone:", "(00) 00000-0000");

    // 2. DADOS DO FINANCIAMENTO
    y += 2;
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
    addInfoLine("CET:", formatCurrency(data.cet));
    addInfoLine("Total a Pagar:", formatCurrency(data.totalPaid));

    // 3. DETALHAMENTO DAS PARCELAS
    y += 2;
    addSection("3. DETALHAMENTO DAS PARCELAS");

    addInfoLine("Média da Parcela:", formatCurrency(data.monthlyInstallment)); // Using flat installment as average
    // First/Last installment logic simplified for SAC/Price if available, else showing average
    addInfoLine("1ª Parcela:", formatCurrency(data.monthlyInstallment));
    addInfoLine("Última Parcela:", formatCurrency(data.monthlyInstallment)); // Note: SAC would differ

    const parcelaMaxima = data.clientIncome * 0.30;
    addInfoLine("Parcela Máxima Permitida (30%):", formatCurrency(parcelaMaxima));
    addInfoLine("Comprometimento Atual:", `${data.commitment.toFixed(2)}%`);

    drawFooter(1);

    // ===============================
    // PÁGINA 2
    // ===============================
    doc.addPage();
    drawHeader();
    y = 35; // Reset Y

    // 4. RESULTADO DA ANÁLISE
    addSection("4. RESULTADO DA ANÁLISE");
    y += 2;

    // Status Box
    const isApproved = data.clientIncome >= data.minIncome && data.riskLevel !== 'ALTO'; // Simple logic mirroring python
    const statusText = isApproved ? "APROVADO" : "REPROVADO"; // Or keep ApprovalStatus if compatible
    const statusColor: [number, number, number] = isApproved ? [0, 150, 0] : [200, 0, 0];

    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`STATUS DA ANÁLISE: ${statusText}`, pageWidth / 2, y + 6.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 15;

    const deficit = Math.max(0, data.minIncome - data.clientIncome);
    const ajuste = deficit > 0 ? (deficit / data.clientIncome) * 100 : 0;

    addInfoLine("Renda Mínima Necessária:", formatCurrency(data.minIncome));
    addInfoLine("Diferença de Renda:", formatCurrency(deficit));
    addInfoLine("Percentual de Ajuste:", `${ajuste.toFixed(2)}%`);

    y += 5;

    // Risk Box
    let riskColor: [number, number, number] = [100, 100, 100];
    if (data.riskLevel === 'BAIXO') riskColor = [0, 176, 80];
    else if (data.riskLevel === 'MODERADO') riskColor = [255, 192, 0];
    else if (data.riskLevel === 'ALTO') riskColor = [192, 0, 0];

    doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`CLASSIFICAÇÃO DE RISCO: ${data.riskLevel}`, pageWidth / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Justificativa Técnica:', margin, y);
    y += 5;
    const splitJustification = doc.splitTextToSize(data.riskJustification || "Análise baseada nos dados fornecidos.", pageWidth - (margin * 2));
    doc.text(splitJustification, margin, y);
    y += (splitJustification.length * 5) + 5;

    // 5. CONFORMIDADE - LGPD
    addSection("5. CONFORMIDADE - LGPD");
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const textoLgpd = "Em conformidade com a Lei nº 13.709/2018 (LGPD), os dados pessoais foram tratados com base nos princípios de finalidade, adequação e segurança, sendo utilizados exclusivamente para análise financeira simulada.";
    const splitLgpd = doc.splitTextToSize(textoLgpd, pageWidth - (margin * 2));
    doc.text(splitLgpd, margin, y);
    y += (splitLgpd.length * 5) + 5;

    // 6. DIRETRIZES BANCO CENTRAL
    addSection("6. DIRETRIZES BANCO CENTRAL");
    const textoBacen = "Esta simulação segue as diretrizes prudenciais do Banco Central do Brasil, incluindo avaliação de capacidade de pagamento, transparência no cálculo do Custo Efetivo Total (CET) e boas práticas de crédito responsável.";
    const splitBacen = doc.splitTextToSize(textoBacen, pageWidth - (margin * 2));
    doc.text(splitBacen, margin, y);
    y += (splitBacen.length * 5) + 5;

    // 7. AVISO LEGAL
    addSection("7. AVISO LEGAL");
    const aviso = "Esta simulação não constitui aprovação de crédito. A aprovação está condicionada à análise formal, verificação documental, score, histórico financeiro e políticas internas da instituição.";
    const splitAviso = doc.splitTextToSize(aviso, pageWidth - (margin * 2));
    doc.text(splitAviso, margin, y);

    drawFooter(2);

    // Save
    const safeName = data.clientName ? data.clientName.replace(/\s+/g, '_').toLowerCase() : 'simulacao';
    doc.save(`${safeName}_relatorio_simulacao.pdf`);
};
