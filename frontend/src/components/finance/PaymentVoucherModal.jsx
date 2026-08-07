import { Printer, CheckCircle2, Building2, ShieldCheck, ArrowRightLeft } from 'lucide-react';

export default function PaymentVoucherModal({ transaction, onClose }) {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const isIncome = transaction.type === 1 || transaction.type === 'Income';
  const isTransfer = transaction.type === 2 || transaction.type === 'Transfer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Top Action Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 print:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Official Financial Document
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Voucher Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-brand-600 font-extrabold text-xl">
              <Building2 className="w-6 h-6" />
              <span>ORBIT ENTERPRISE</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Financial Management & Control System</p>
          </div>

          <div className="text-right">
            <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              {isIncome ? 'RECEIPT VOUCHER' : (isTransfer ? 'TRANSFER VOUCHER' : 'PAYMENT VOUCHER')}
            </h2>
            <span className="text-xs font-mono font-bold text-slate-600 block mt-1">
              VOUCHER #: {transaction.transactionNumber || `VCH-${transaction.id}`}
            </span>
            <span className="text-xs text-slate-500">
              Date: {new Date(transaction.transactionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Transaction Details Grid */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">
              {isIncome ? 'Received From (Payer)' : 'Paid To (Payee / Beneficiary)'}
            </span>
            <span className="font-bold text-slate-900 text-sm">
              {transaction.payeeOrPayer || 'Internal Organization Account'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Bank Account</span>
            <span className="font-bold text-slate-900 text-sm">
              {transaction.bankAccountName || transaction.toBankAccountName || 'Main Cash Account'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Financial Category</span>
            <span className="font-semibold text-slate-800">
              {transaction.categoryName || 'General Operations'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Reference Number</span>
            <span className="font-mono text-slate-800">
              {transaction.referenceNumber || 'N/A'}
            </span>
          </div>
        </div>

        {/* Description & Line Details */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 text-xs">
          <div className="bg-slate-100 p-3 font-semibold text-slate-700 uppercase tracking-wider">
            Transaction Description / Details
          </div>
          <div className="p-4 text-slate-800 font-medium">
            {transaction.description || 'Disbursement for authorized organization expenses.'}
          </div>
        </div>

        {/* Amount Box */}
        <div className="bg-slate-900 text-white p-5 rounded-xl flex items-center justify-between mb-8 shadow-sm">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Amount Processed
            </span>
            <span className="text-xs text-slate-400">Currency: {transaction.currency || 'USD'}</span>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400 tracking-tight">
              ${transaction.amount ? transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} {transaction.currency}
            </span>
          </div>
        </div>

        {/* Signatures & Approvals Section */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 font-semibold uppercase block mb-8">Prepared / Paid By</span>
            <div className="border-b border-slate-300 pb-1 flex items-center justify-between">
              <span className="font-bold text-slate-800">{transaction.createdByUserName || 'Finance Officer'}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Authorized Finance Representative</span>
          </div>

          <div>
            <span className="text-slate-400 font-semibold uppercase block mb-8">Approved / Signed Off By</span>
            <div className="border-b border-slate-300 pb-1 flex items-center justify-between">
              <span className="font-bold text-slate-800">Manager / Executive Officer</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Management Audit Approval</span>
          </div>
        </div>
      </div>
    </div>
  );
}
