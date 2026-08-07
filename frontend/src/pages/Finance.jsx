import { useState } from 'react';
import FinancialOverview from '../components/finance/FinancialOverview';
import CategoriesManagement from '../components/finance/CategoriesManagement';
import DonorsContributions from '../components/finance/DonorsContributions';
import BankAccounts from '../components/finance/BankAccounts';
import Budgets from '../components/finance/Budgets';
import Expenses from '../components/finance/Expenses';
import Compliance from '../components/finance/Compliance';
import { 
  DollarSign, Layers, HeartHandshake, CreditCard, PieChart, 
  Receipt, ShieldCheck
} from 'lucide-react';

export default function Finance() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview & Ledger', icon: DollarSign },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'donors', label: 'Donors & Income', icon: HeartHandshake },
    { id: 'banks', label: 'Bank Accounts', icon: CreditCard },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Management Suite</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enterprise financial control: Central Ledger, Categories, Budgets, Expenses, and Compliance.
            </p>
          </div>
        </div>

        {/* 7-Tab Navigation Bar */}
        <div className="mt-6 flex gap-2 border-b border-slate-200 overflow-x-auto pb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition shrink-0 ${
                  isActive
                    ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content Container */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'overview' && <FinancialOverview />}
        {activeTab === 'categories' && <CategoriesManagement />}
        {activeTab === 'donors' && <DonorsContributions />}
        {activeTab === 'banks' && <BankAccounts />}
        {activeTab === 'budgets' && <Budgets />}
        {activeTab === 'expenses' && <Expenses />}
        {activeTab === 'compliance' && <Compliance />}
      </div>
    </div>
  );
}
