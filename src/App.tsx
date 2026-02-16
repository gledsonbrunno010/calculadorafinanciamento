
import { useState, useEffect } from 'react';
import { Calculator, User, TrendingUp, CheckCircle, XCircle, FileText, ArrowUpRight } from 'lucide-react';
import {
  calculateDetailedSimulation,
  calculateCET,
  calculateRequiredDownPayment,
  calculateAnnualRate,
  calculateCreditApproval,
  formatCurrency,
  calculateAge,
} from './utils/financing';
import type { SimulationResult, ApprovalResult } from './utils/financing';
import { generatePDF } from './utils/pdf';
import './index.css';

type FinancingType = 'imobiliario' | 'veiculo';
type AmortizationSystem = 'SAC' | 'PRICE';

function App() {
  // --- Client Details ---
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [income, setIncome] = useState<number | ''>(''); // Allow empty string
  const [score, setScore] = useState<number>(750);
  const [hasDebts, setHasDebts] = useState<boolean>(false);

  // --- Financing Parameters ---
  const [type, setType] = useState<FinancingType>('imobiliario');
  const [system, setSystem] = useState<AmortizationSystem>('SAC');
  const [loanAmount, setLoanAmount] = useState<number | ''>(300000);
  const [downPayment, setDownPayment] = useState<number | ''>(75000);
  const [months, setMonths] = useState<number>(60);
  const [monthlyRate, setMonthlyRate] = useState<number | ''>(1.5);


  // --- Analysis State ---
  const [calculated, setCalculated] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Result State
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [cet, setCet] = useState<number>(0);
  const [requiredDownPayment, setRequiredDownPayment] = useState<number>(0);
  const [annualRate, setAnnualRate] = useState<number>(0);
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null);

  // Formats
  const safeIncome = typeof income === 'number' ? income : 0;
  const annualIncome = safeIncome * 12;

  // Real-time Annual Rate Update
  useEffect(() => {
    const rate = typeof monthlyRate === 'number' ? monthlyRate : 0;
    setAnnualRate(calculateAnnualRate(rate));
  }, [monthlyRate]);

  // Adjust Defaults based on Type Selection
  useEffect(() => {
    if (type === 'imobiliario') {
      // Market Reference Feb/2026: ~12.60% a.a. => ~0.99% a.m.
      setMonthlyRate(0.99);
      if (months < 120) setMonths(360); // Default to longer term
    } else {
      // Market Reference Feb/2026: ~26.2% a.a. => ~1.95% a.m.
      setMonthlyRate(1.95);
      if (months > 96) setMonths(60); // Default to shorter term
    }
  }, [type]);

  // Main Calculation Function (Manual Trigger with Simulation)
  const handleCalculate = () => {
    // 1. Basic Validations
    if (!income || !loanAmount) {
      alert("Preencha renda e valor do bem.");
      return;
    }

    setCalculated(false);
    setIsAnalyzing(true);
    setProgress(0);

    // Simulate Analysis Process (approx 3 seconds)
    const intervalTime = 30;
    const timer = setInterval(() => {
      setProgress(old => {
        if (old >= 100) {
          clearInterval(timer);
          finalizeCalculation();
          return 100;
        }
        // Non-linear progress
        const increment = old < 50 ? 2 : old < 80 ? 1 : 0.5;
        return Math.min(old + increment, 100);
      });
    }, intervalTime);
  };

  const finalizeCalculation = () => {
    try {
      // Safe Casts
      const safeLoanAmount = typeof loanAmount === 'number' ? loanAmount : 0;
      const safeDownPayment = typeof downPayment === 'number' ? downPayment : 0;
      const safeMonthlyRate = typeof monthlyRate === 'number' ? monthlyRate : 0;
      const safeIncome = typeof income === 'number' ? income : 0;

      // 2. Financial Math
      const minDownPayment = calculateRequiredDownPayment(safeLoanAmount, type);
      setRequiredDownPayment(minDownPayment);

      const principal = safeLoanAmount - safeDownPayment;

      // Validation to prevent math errors
      if (principal <= 0) {
        alert("O valor da entrada não pode ser maior ou igual ao valor do bem.");
        setIsAnalyzing(false);
        setCalculated(false);
        return;
      }

      // Run Advanced Simulation
      const simResult = calculateDetailedSimulation(
        principal,
        safeMonthlyRate / 100,
        months,
        system,
        0
      );

      setSimulationResult(simResult);
      setCet(calculateCET(simResult.firstInstallment, months, principal));

      // 3. Approval Logic
      const age = calculateAge(birthDate) || 25; // Default age if not provided

      const approval = calculateCreditApproval({
        income: safeIncome,
        installment: simResult.firstInstallment,
        score,
        hasDebts,
        age,
        type: type,
        months: months,
        monthlyRate: safeMonthlyRate
      });

      setApprovalResult(approval);
      setIsAnalyzing(false);
      setCalculated(true);

    } catch (error) {
      console.error("Erro no cálculo:", error);
      alert("Ocorreu um erro ao realizar a simulação. Verifique os valores inseridos.");
      setIsAnalyzing(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!calculated || !approvalResult || !simulationResult) return;

    try {
      const safeLoanAmount = typeof loanAmount === 'number' ? loanAmount : 0;
      const safeDownPayment = typeof downPayment === 'number' ? downPayment : 0;
      const safeMonthlyRate = typeof monthlyRate === 'number' ? monthlyRate : 0;
      const safeIncome = typeof income === 'number' ? income : 0;

      // Estimate Age
      const age = calculateAge(birthDate);

      await generatePDF({
        clientName: name || 'Não informado',
        clientCpf: cpf || 'Não informado',
        clientAge: `${birthDate} (${age > 0 ? age : '?'} anos)`,
        clientIncome: safeIncome,
        clientScore: score,
        clientType: type,
        loanAmount: safeLoanAmount,
        availableDownPayment: safeDownPayment,
        requiredDownPayment,
        monthlyInstallment: simulationResult.firstInstallment,
        totalPaid: simulationResult.totalPaid,
        systemOfAmortization: system,
        cet,
        months,
        monthlyRate: safeMonthlyRate,
        annualRate,
        approvalStatus: approvalResult.approved ? 'APROVADO' : 'REPROVADO',
        approvalReason: approvalResult.reason,
        riskLevel: approvalResult.riskLevel,
        riskJustification: approvalResult.riskJustification,
        minIncome: approvalResult.minIncome,
        commitment: approvalResult.commitment,
        banks: simulationResult.banks
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF. Tente novamente.");
    }
  };

  return (
    <div className="container-swiss animate-entry">

      {/* LEFT PANEL: INPUTS */}
      <div className="swiss-scroll-area">

        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-sm">
              <Calculator size={20} className="stroke-[1.5]" />
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Analista de Crédito AI</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 leading-tight">
            Análise de Financiamento
          </h1>
        </header>

        <form onSubmit={(e) => e.preventDefault()} className="grid gap-12">

          {/* 1. DADOS PESSOAIS COMPLETO */}
          <section>
            <h3 className="swiss-label text-orange-500 mb-6 flex items-center gap-2 border-b border-orange-100 pb-2">
              <User size={14} /> Perfil do Proponente
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Nome Completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="swiss-input text-lg" placeholder="Nome" />
              </div>
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">CPF</label>
                <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className="swiss-input text-lg" placeholder="000.000.000-00" />
              </div>
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Data de Nascimento</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="swiss-input text-lg" />
              </div>
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Renda Mensal (R$)</label>
                <input
                  type="number"
                  min="0"
                  value={income}
                  onChange={e => setIncome(e.target.value === '' ? '' : Number(e.target.value))}
                  className="swiss-input text-lg font-bold"
                />
                {safeIncome > 0 && (
                  <div className="text-xs text-slate-400 mt-1 font-mono">Anual: {formatCurrency(annualIncome)}</div>
                )}
              </div>
            </div>

            {/* SCORE & DÍVIDAS */}
            <div className="mt-8 bg-slate-50 p-6 rounded border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="swiss-input-group mb-0">
                <label className="swiss-label flex justify-between">
                  Score de Crédito
                  <span className={`font-mono font-bold ${score < 300 ? 'text-red-500' : score < 600 ? 'text-orange-500' : 'text-green-500'}`}>{score}</span>
                </label>
                <input
                  type="range" min="0" max="1000" step="10"
                  value={score} onChange={e => setScore(Number(e.target.value))}
                  className="mt-2 accent-black"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>Ruim (0-300)</span>
                  <span>Médio (301-600)</span>
                  <span>Bom (601-1000)</span>
                </div>
              </div>

              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Possui Dívidas Ativas?</label>
                <div className="flex gap-4 mt-2 h-12">
                  <button
                    type="button"
                    onClick={() => setHasDebts(false)}
                    className={`flex-1 flex items-center justify-center gap-2 border transition-all duration-200 ${!hasDebts
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-105 font-bold'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-300'
                      }`}
                  >
                    {!hasDebts && <CheckCircle size={14} />} Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasDebts(true)}
                    className={`flex-1 flex items-center justify-center gap-2 border transition-all duration-200 ${hasDebts
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-105 font-bold'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-300'
                      }`}
                  >
                    {hasDebts && <XCircle size={14} />} Sim
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. DADOS DO FINANCIAMENTO */}
          <section>
            <h3 className="swiss-label text-orange-500 mb-6 flex items-center gap-2 border-b border-orange-100 pb-2">
              <TrendingUp size={14} /> Dados da Operação
            </h3>

            <div className="flex gap-4 mb-8 h-14">
              <button
                type="button"
                onClick={() => setType('imobiliario')}
                className={`flex-1 border text-sm uppercase tracking-widest transition-all duration-300 font-bold ${type === 'imobiliario'
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20 scale-[1.02]'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                  }`}
              >
                Imobiliário
              </button>
              <button
                type="button"
                onClick={() => setType('veiculo')}
                className={`flex-1 border text-sm uppercase tracking-widest transition-all duration-300 font-bold ${type === 'veiculo'
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20 scale-[1.02]'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                  }`}
              >
                Veículo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Valor do Bem</label>
                <input type="number" min="0" value={loanAmount} onChange={e => setLoanAmount(e.target.value === '' ? '' : Number(e.target.value))} className="swiss-input text-lg" />
              </div>
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Entrada Disponível</label>
                <input type="number" min="0" value={downPayment} onChange={e => setDownPayment(e.target.value === '' ? '' : Number(e.target.value))} className="swiss-input text-lg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-8">
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Prazo</label>
                <select value={months} onChange={e => setMonths(Number(e.target.value))} className="swiss-input text-lg bg-transparent py-2 border-b">
                  {type === 'imobiliario' ? (
                    [60, 120, 180, 240, 300, 360, 420].map(m => (
                      <option key={m} value={m}>{m} meses ({m / 12} anos)</option>
                    ))
                  ) : (
                    [12, 24, 36, 48, 60, 72].map(m => (
                      <option key={m} value={m}>{m} meses ({m / 12} anos)</option>
                    ))
                  )}
                </select>
              </div>

              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Taxa Juros Mensal (%)</label>
                <input type="number" step="0.01" value={monthlyRate} onChange={e => setMonthlyRate(e.target.value === '' ? '' : Number(e.target.value))} className="swiss-input text-lg font-mono text-blue-600" />
                <div className="text-xs text-slate-400 mt-1 font-mono">Ref. Fev/2026</div>
              </div>
            </div>

            {/* SYSTEM SELECTOR */}
            <div className="mt-6">
              <div className="swiss-input-group mb-0">
                <label className="swiss-label">Sistema de Amortização</label>
                <select value={system} onChange={e => setSystem(e.target.value as AmortizationSystem)} className="swiss-input text-lg bg-transparent py-2 border-b">
                  <option value="SAC">SAC (Amortização Constante - Parcelas Decrescentes)</option>
                  <option value="PRICE">PRICE (Parcelas Fixas)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-2">
                  O sistema será aplicado independentemente da modalidade escolhida.
                </p>
              </div>
            </div>

            {/* CALCULAR BUTTON */}
            <button
              onClick={handleCalculate}
              disabled={isAnalyzing}
              className={`w-full py-4 mt-8 font-bold text-lg uppercase tracking-wider transition-all shadow-lg ${isAnalyzing ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-black text-white hover:bg-slate-800'
                }`}
            >
              {isAnalyzing ? 'Analisando Crédito...' : 'Calcular Viabilidade'}
            </button>

          </section>
        </form>
        <div className="h-20"></div> {/* Spacer */}
      </div>

      {/* RIGHT PANEL: RESULTS */}
      <div className="swiss-sticky-panel md:rounded-bl-3xl border-l border-slate-100 relative overflow-hidden">

        {/* Loading State */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-8">
            <div className="w-full max-w-[200px] mb-8 relative">
              <div className="h-1 w-full bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-100 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 text-right font-mono text-orange-500 text-sm">
                {Math.round(progress)}%
              </div>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm font-mono uppercase tracking-widest text-slate-500 animate-pulse">
                {progress < 30 ? 'Conectando ao Bureau...' :
                  progress < 60 ? 'Calculando Risco...' :
                    progress < 90 ? 'Verificando Margem...' : 'Gerando Laudo...'}
              </p>
            </div>
          </div>
        )}

        {!calculated && !isAnalyzing ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 p-12 text-center opacity-50">
            <FileText size={64} strokeWidth={1} className="mb-4" />
            <p className="text-sm uppercase tracking-widest">Aguardando Cálculo</p>
            <p className="text-xs mt-2 text-center">Simulador atualizado com taxas Fev/2026.<br />Preencha os dados à esquerda.</p>
          </div>
        ) : !isAnalyzing && calculated && simulationResult && approvalResult ? (
          <div className="animate-entry h-full flex flex-col justify-between">

            {/* RESULTADO DE APROVAÇÃO */}
            <div className={`p-6 rounded-lg mb-6 border-l-4 ${approvalResult.approved ? (
                approvalResult.riskLevel === 'BAIXO' ? 'bg-green-900/20 border-green-500' : 'bg-orange-900/20 border-orange-500'
              ) : 'bg-red-900/20 border-red-500'
              }`}>
              <h2 className="text-sm font-mono uppercase tracking-widest mb-2 text-slate-400">Status da Análise</h2>
              <div className="flex items-center gap-3 mb-2">
                {approvalResult.approved
                  ? <CheckCircle className={approvalResult.riskLevel === 'BAIXO' ? "text-green-500" : "text-orange-500"} size={32} />
                  : <XCircle className="text-red-500" size={32} />
                }
                <span className="text-2xl font-bold font-display leading-none">
                  {approvalResult.approved ? (approvalResult.riskLevel === 'BAIXO' ? 'PRÉ-APROVADO' : 'APROVADO RESSALVAS') : 'REPROVADO'}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">{approvalResult.reason}</p>
              {approvalResult.riskLevel !== 'BAIXO' && (
                <p className="text-xs text-slate-400 mt-2 font-mono border-t border-slate-600/30 pt-2">
                  Risco: {approvalResult.riskLevel} - {approvalResult.riskJustification}
                </p>
              )}
            </div>

            {/* NUMBERS */}
            <div className="space-y-6 flex-1">

              {/* Detailed Summary Table */}
              <div className="bg-slate-800/50 p-4 rounded-md space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Valor do Bem</span>
                  <span className="text-white font-mono">{formatCurrency(Number(loanAmount))}</span>
                </div>

                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Entrada ({Number(loanAmount) > 0 ? ((Number(downPayment) / Number(loanAmount)) * 100).toFixed(1) : '0.0'}%)</span>
                  <span className="text-green-400 font-mono">{formatCurrency(Number(downPayment))}</span>
                </div>

                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Capital Financiado</span>
                  <span className="text-white font-mono font-bold">{formatCurrency(Number(loanAmount) - Number(downPayment))}</span>
                </div>

                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Sistema</span>
                  <span className="text-white font-mono">{simulationResult.system}</span>
                </div>
              </div>

              <div className="text-right mt-4 space-y-2">
                <div>
                  <span className="block text-xs uppercase text-slate-500">Média da Parcela</span>
                  <div className="font-mono text-4xl font-bold tracking-tighter text-white">
                    {formatCurrency(simulationResult.averageInstallment)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-400 pt-2">
                  <div>
                    <span className="block text-[10px] text-slate-600 uppercase">1ª Parcela</span>
                    <span className="text-orange-300">{formatCurrency(simulationResult.firstInstallment)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-600 uppercase">Última Parcela</span>
                    <span className="text-green-300">{formatCurrency(simulationResult.lastInstallment)}</span>
                  </div>
                </div>

                <div className={`text-xs mt-4 border-t border-slate-800 pt-2 font-bold ${(safeIncome > 0 && (simulationResult.firstInstallment / safeIncome) > 0.30) ? 'text-red-500' : 'text-slate-500'
                  }`}>
                  Comprometimento Inicial: {safeIncome > 0 ? ((simulationResult.firstInstallment / safeIncome) * 100).toFixed(1) : '0.0'}% da renda
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div>Total Pagar: <span className="text-white block font-mono text-base">{formatCurrency(simulationResult.totalPaid)}</span></div>
                <div className="text-right">CET: <span className="text-orange-400 block font-mono text-base">{formatCurrency(cet)}</span></div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-8 pt-4">
              <button
                onClick={handleGeneratePDF}
                className="w-full bg-orange-600 text-white font-bold py-4 rounded hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-orange-500/20"
              >
                <ArrowUpRight size={18} />
                GERAR RELATÓRIO PDF
              </button>
            </div>

          </div>
        ) : null}
      </div>

    </div>
  );
}

export default App;
