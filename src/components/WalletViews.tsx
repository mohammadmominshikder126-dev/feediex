import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BRAND_ASSETS } from '../lib/assets';
import { METHOD_LABELS, formatBDT } from '../lib/defaults';
import { submitWithdrawal } from '../lib/storeService';
import type {
  AppConfig,
  Deposit,
  Member,
  PaymentMethod,
  TabKey,
  Withdrawal,
} from '../types';
import { PaymentGatewayCheckout } from './PaymentGatewayCheckout';

interface WalletViewsProps {
  mode: 'recharge' | 'withdraw';
  config: AppConfig;
  member: Member;
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  onNavigate: (tab: TabKey) => void;
}

const PRESET_AMOUNTS = [300, 500, 1000, 2500, 5000, 10000];

const STATUS_LABEL: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'অপেক্ষমাণ',
  approved: 'অনুমোদিত',
  rejected: 'বাতিল',
};

export const WalletViews: React.FC<WalletViewsProps> = ({
  mode,
  config,
  member,
  deposits,
  withdrawals,
  onNavigate,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [amount, setAmount] = useState(
    mode === 'recharge' ? String(config.minDeposit) : String(config.minWithdraw)
  );
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [withdrawPass, setWithdrawPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleOpenGateway = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (config.depositsEnabled === false) {
      setMsg({
        type: 'err',
        text: 'এডমিন কর্তৃক ডিপোজিট সেবা সাময়িকভাবে বন্ধ রাখা হয়েছে।',
      });
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < config.minDeposit) {
      setMsg({
        type: 'err',
        text: `সর্বনিম্ন ডিপোজিটের পরিমাণ ${formatBDT(config.minDeposit)}।`,
      });
      return;
    }
    setGatewayOpen(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      await submitWithdrawal(member.phone, Number(amount), withdrawPass);
      setWithdrawPass('');
      setMsg({
        type: 'ok',
        text: 'আপনার উত্তোলন আবেদন জমা হয়েছে! যাচাই শেষে পেমেন্ট সম্পন্ন হবে।',
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'উত্তোলন আবেদন ব্যর্থ হয়েছে।',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'recharge' && gatewayOpen) {
    return (
      <PaymentGatewayCheckout
        initialMethod={method}
        amount={Number(amount)}
        config={config}
        member={member}
        onBack={() => setGatewayOpen(false)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Subpage Header with Feedex Logo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
            aria-label="ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={BRAND_ASSETS.logo}
            alt="Feedex লোগো"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-lg object-cover border border-slate-200"
          />
          <div>
            <h1 className="font-bold text-base text-slate-900">
              {mode === 'recharge'
                ? 'ডিপোজিট / রিচার্জ (FeedexPay গেটওয়ে)'
                : 'টাকা উত্তোলন'}
            </h1>
            <p className="text-xs text-slate-500">
              বর্তমান ব্যালেন্স:{' '}
              <span className="font-mono-num font-bold text-purple-900">
                {formatBDT(member.balance)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-medium ${
            msg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {mode === 'recharge' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleOpenGateway}
            className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm"
          >
            {config.depositsEnabled === false && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                এডমিন কর্তৃক ডিপোজিট সেবা সাময়িকভাবে বন্ধ রাখা হয়েছে।
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-slate-800 mb-2.5">
                ১. পেমেন্ট গেটওয়ে চ্যানেল নির্বাচন করুন
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {(['bkash', 'nagad', 'rocket'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`min-h-[52px] px-2 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                      method === m
                        ? m === 'bkash'
                          ? 'bg-[#E2136E] text-white border-[#E2136E] shadow-sm'
                          : m === 'nagad'
                          ? 'bg-[#F05A22] text-white border-[#F05A22] shadow-sm'
                          : 'bg-[#8C3494] text-white border-[#8C3494] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{METHOD_LABELS[m]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800 mb-2">
                ২. রিচার্জের পরিমাণ নির্বাচন করুন (সর্বনিম্ন {formatBDT(config.minDeposit)})
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(String(val))}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold font-mono-num transition-colors cursor-pointer ${
                      Number(amount) === val
                        ? 'bg-purple-900 text-white border-purple-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {formatBDT(val)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={config.minDeposit}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="টাকার পরিমাণ লিখুন"
                className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-purple-700 focus:outline-none text-sm font-mono-num"
              />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  নিরাপদ পেমেন্ট গেটওয়ে · বিকাশ, নগদ ও রকেট সক্রিয়
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={config.depositsEnabled === false}
              className="w-full min-h-[50px] rounded-xl bg-purple-950 hover:bg-purple-900 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
            >
              <span>পেমেন্ট গেটওয়েতে প্রবেশ করুন ({formatBDT(Number(amount || 0))})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Deposit History (Live onSnapshot) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-sm text-slate-900 mb-3">
              আপনার ডিপোজিট ইতিহাস (লাইভ আপডেট)
            </h2>
            {deposits.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                এখনো কোনো ডিপোজিট করা হয়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deposits.map((d) => (
                  <div
                    key={d.id}
                    className="py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">
                        {METHOD_LABELS[d.method]} ·{' '}
                        <span className="font-mono-num">{d.trxId}</span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        নম্বর: <span className="font-mono-num">{d.targetNumber}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono-num text-sm text-slate-900">
                        {formatBDT(d.amount)}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold mt-0.5 ${
                          d.status === 'approved'
                            ? 'text-emerald-700'
                            : d.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {d.status === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : d.status === 'rejected' ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {STATUS_LABEL[d.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            {config.withdrawalsEnabled === false && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                এডমিন কর্তৃক উত্তোলন সেবা সাময়িকভাবে বন্ধ রাখা হয়েছে।
              </div>
            )}
            {config.requireDepositForWithdraw !== false && member.totalRecharge <= 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold">উত্তোলন সুবিধা এখনো সক্রিয় হয়নি</p>
                  <p className="text-xs mt-1">
                    ডিপোজিট ছাড়া কোনো টাকা উত্তোলন করা যাবে না। প্রথমে বিকাশ, নগদ বা
                    রকেট দিয়ে কমপক্ষে একবার রিচার্জ করুন।
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('recharge')}
                    className="mt-2.5 px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    এখনই ডিপোজিট করুন
                  </button>
                </div>
              </div>
            )}

            {!member.walletMethod || !member.walletNumber ? (
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-sm space-y-2.5">
                <p className="font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> আপনার পেমেন্ট ওয়ালেট যুক্ত নেই
                </p>
                <p className="text-xs text-purple-800">
                  উত্তোলনের জন্য আপনার বিকাশ, নগদ বা রকেট নম্বর সেট করুন।
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('wallet_settings')}
                  className="min-h-[42px] px-4 rounded-xl bg-purple-900 text-white text-xs font-semibold cursor-pointer"
                >
                  ওয়ালেট যুক্ত করুন
                </button>
              </div>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">সংযুক্ত উত্তোলন মাধ্যম</p>
                    <p className="font-bold text-sm text-slate-900">
                      {METHOD_LABELS[member.walletMethod]} ·{' '}
                      <span className="font-mono-num">{member.walletNumber}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('wallet_settings')}
                    className="text-xs font-semibold text-purple-900 hover:underline cursor-pointer"
                  >
                    পরিবর্তন
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">
                    উত্তোলনের পরিমাণ (সর্বনিম্ন {formatBDT(config.minWithdraw)})
                  </label>
                  <input
                    type="number"
                    min={config.minWithdraw}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-purple-700 focus:outline-none text-sm font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">
                    উত্তোলন / লগইন পাসওয়ার্ড
                  </label>
                  <input
                    type="password"
                    required
                    value={withdrawPass}
                    onChange={(e) => setWithdrawPass(e.target.value)}
                    placeholder="আপনার পাসওয়ার্ড দিন"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-purple-700 focus:outline-none text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    config.withdrawalsEnabled === false ||
                    (config.requireDepositForWithdraw !== false && member.totalRecharge <= 0)
                  }
                  className="w-full min-h-[48px] rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'প্রক্রিয়াধীন...' : 'উত্তোলন আবেদন করুন'}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-sm text-slate-900 mb-3">
              উত্তোলন ইতিহাস (লাইভ আপডেট)
            </h2>
            {withdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                এখনো কোনো উত্তোলন আবেদন করা হয়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">
                        {METHOD_LABELS[w.method]}
                      </p>
                      <p className="text-slate-500 font-mono-num mt-0.5">
                        {w.walletNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono-num text-sm text-slate-900">
                        {formatBDT(w.amount)}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold mt-0.5 ${
                          w.status === 'approved'
                            ? 'text-emerald-700'
                            : w.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {STATUS_LABEL[w.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
