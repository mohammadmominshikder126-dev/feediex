import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Headphones,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { BRAND_ASSETS } from '../lib/assets';
import { formatBDT } from '../lib/defaults';
import { submitDeposit } from '../lib/storeService';
import type { AppConfig, Member, PaymentMethod, TabKey } from '../types';
import { QrMatrix } from './QrMatrix';

interface PaymentGatewayCheckoutProps {
  initialMethod: PaymentMethod;
  amount: number;
  config: AppConfig;
  member: Member;
  onBack: () => void;
  onNavigate: (tab: TabKey) => void;
}

interface ChannelTheme {
  id: PaymentMethod;
  titleBn: string;
  subtitleEn: string;
  monogram: string;
  ussd: string;
  cardGradient: string;
  accentText: string;
  activeTabStyle: string;
  badgeBg: string;
  buttonBg: string;
  ringFocus: string;
}

const CHANNEL_THEMES: Record<PaymentMethod, ChannelTheme> = {
  bkash: {
    id: 'bkash',
    titleBn: 'বিকাশ',
    subtitleEn: 'bKash Personal',
    monogram: 'ব',
    ussd: '*247#',
    cardGradient: 'from-[#D11164] via-[#E2136E] to-[#B00C52]',
    accentText: 'text-[#E2136E]',
    activeTabStyle: 'bg-[#E2136E] text-white border-[#E2136E] shadow-sm',
    badgeBg: 'bg-pink-50 text-[#C20E5C] border-pink-200',
    buttonBg: 'bg-[#E2136E] hover:bg-[#C80F60]',
    ringFocus: 'focus:border-[#E2136E]',
  },
  nagad: {
    id: 'nagad',
    titleBn: 'নগদ',
    subtitleEn: 'Nagad Personal',
    monogram: 'ন',
    ussd: '*167#',
    cardGradient: 'from-[#E04D15] via-[#F05A22] to-[#C83F0E]',
    accentText: 'text-[#F05A22]',
    activeTabStyle: 'bg-[#F05A22] text-white border-[#F05A22] shadow-sm',
    badgeBg: 'bg-orange-50 text-[#D44713] border-orange-200',
    buttonBg: 'bg-[#F05A22] hover:bg-[#D94D18]',
    ringFocus: 'focus:border-[#F05A22]',
  },
  rocket: {
    id: 'rocket',
    titleBn: 'রকেট',
    subtitleEn: 'Rocket Personal',
    monogram: 'R',
    ussd: '*322#',
    cardGradient: 'from-[#7A2782] via-[#8C3494] to-[#641F6B]',
    accentText: 'text-[#8C3494]',
    activeTabStyle: 'bg-[#8C3494] text-white border-[#8C3494] shadow-sm',
    badgeBg: 'bg-purple-50 text-[#75267C] border-purple-200',
    buttonBg: 'bg-[#8C3494] hover:bg-[#75287C]',
    ringFocus: 'focus:border-[#8C3494]',
  },
};

function generateInvoiceId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `FDX-PAY-${num}`;
}

export const PaymentGatewayCheckout: React.FC<PaymentGatewayCheckoutProps> = ({
  initialMethod,
  amount,
  config,
  member,
  onBack,
  onNavigate,
}) => {
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [trxId, setTrxId] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [copiedField, setCopiedField] = useState<'number' | 'amount' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<{
    invoiceId: string;
    trxId: string;
    method: PaymentMethod;
    targetNumber: string;
    amount: number;
    submittedAt: string;
  } | null>(null);

  const invoiceId = useMemo(() => generateInvoiceId(), []);
  const theme = CHANNEL_THEMES[method];
  const targetNumber =
    config.rechargeNumbers[method] ||
    (method === 'bkash' ? '01813623507' : method === 'nagad' ? '01923948150' : '01768066566');

  useEffect(() => {
    if (receipt || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [receipt, secondsLeft]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const isExpired = secondsLeft === 0 && !receipt;

  const handleCopy = async (value: string, field: 'number' | 'amount') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      setCopiedField(null);
    }
  };

  const handleRenewSession = () => {
    setSecondsLeft(600);
    setErrorMsg('');
  };

  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanTrx = trxId.trim().toUpperCase();
    if (cleanTrx.length < 4) {
      setErrorMsg('অনুগ্রহ করে সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন।');
      return;
    }

    if (isExpired) {
      setErrorMsg('গেটওয়ে সেশনের সময় শেষ হয়েছে। অনুগ্রহ করে সেশন রিনিউ করুন।');
      return;
    }

    setSubmitting(true);
    try {
      await submitDeposit(member.phone, amount, method, cleanTrx);
      setReceipt({
        invoiceId,
        trxId: cleanTrx,
        method,
        targetNumber,
        amount,
        submittedAt: new Date().toLocaleTimeString('bn-BD', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'পেমেন্ট ভেরিফিকেশন জমা ব্যর্থ হয়েছে।'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    const receiptTheme = CHANNEL_THEMES[receipt.method];
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-emerald-700 text-white px-6 py-7 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white/15 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold">পেমেন্ট ভেরিফিকেশন জমা হয়েছে</h2>
          <p className="text-xs text-emerald-100">
            FeedexPay নিরাপদ গেটওয়ে · যাচাই প্রক্রিয়াধীন
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center pb-4 border-b border-slate-100">
            <p className="text-xs text-slate-500">জমাকৃত পরিমাণ</p>
            <p className="text-3xl font-bold font-mono-num text-slate-950 mt-1">
              {formatBDT(receipt.amount)}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">ইনভয়েস আইডি</span>
              <span className="font-mono-num font-bold text-slate-900">
                {receipt.invoiceId}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">পেমেন্ট মাধ্যম</span>
              <span className={`font-bold ${receiptTheme.accentText}`}>
                {receiptTheme.titleBn} ({receiptTheme.subtitleEn})
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">প্রাপক নম্বর</span>
              <span className="font-mono-num font-bold text-slate-900">
                {receipt.targetNumber}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">ট্রানজেকশন আইডি (TrxID)</span>
              <span className="font-mono-num font-bold text-slate-900">
                {receipt.trxId}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">বর্তমান অবস্থা</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
                <Clock className="w-4 h-4" /> অপেক্ষমাণ (যাচাই চলছে)
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
            আপনার ট্রানজেকশন আইডি যাচাই করার সাথে সাথে ব্যালেন্স আপনার অ্যাকাউন্টে
            স্বয়ংক্রিয়ভাবে যোগ হয়ে যাবে। কোনো সহায়তার জন্য সাপোর্ট সেন্টারে যোগাযোগ করুন।
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[48px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm cursor-pointer"
            >
              ডিপোজিট পেজে ফিরুন
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="min-h-[48px] rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-sm cursor-pointer"
            >
              হোম পেজে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Trusted Gateway Top Bar */}
      <div className="bg-slate-950 text-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            aria-label="গেটওয়ে বাতিল করুন"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={BRAND_ASSETS.logo}
            alt="FeedexPay লোগো"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-white/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                FeedexPay গেটওয়ে
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" /> ভেরিফায়েড
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono-num">
              ইনভয়েস: {invoiceId} · ২৫৬-বিট এসএসএল সুরক্ষিত
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 text-right">
            <p className="text-[11px] text-slate-300">সেশনের সময় বাকি</p>
            <p
              className={`font-mono-num font-bold text-sm ${
                secondsLeft < 60 ? 'text-amber-300' : 'text-white'
              }`}
            >
              {mins}:{secs}
            </p>
          </div>
        </div>
      </div>

      {/* Merchant Amount & Order Strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">মার্চেন্ট অ্যাকাউন্ট</p>
          <p className="text-sm font-bold text-slate-900">
            FeedexDigital Official ·{' '}
            <span className="font-mono-num text-slate-600">{member.phone}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">পরিশোধযোগ্য মোট পরিমাণ</p>
            <p className="text-2xl font-bold font-mono-num text-purple-950">
              {formatBDT(amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(String(amount), 'amount')}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedField === 'amount' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> কপি
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> পরিমাণ
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Gateway Workspace */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Payment Channel Switcher (GoPay / PhonePe Style Brand Selector) */}
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2.5">
            পেমেন্ট ওয়ালেট নির্বাচন করুন
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {(['bkash', 'nagad', 'rocket'] as PaymentMethod[]).map((m) => {
              const t = CHANNEL_THEMES[m];
              const isSelected = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    setErrorMsg('');
                  }}
                  className={`min-h-[52px] px-2.5 py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isSelected
                      ? t.activeTabStyle
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {t.monogram}
                  </span>
                  <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
                    {t.titleBn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Branded Send Money Card & TrxID Verification */}
          <div className="lg:col-span-7 space-y-5">
            {/* Official Branded Send-Money Instruction Card */}
            <div
              className={`rounded-2xl bg-gradient-to-br ${theme.cardGradient} text-white p-5 space-y-4 shadow-md`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-sm">
                    {theme.monogram}
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      {theme.titleBn} ({theme.subtitleEn})
                    </p>
                    <p className="text-xs text-white/85">
                      অফিসিয়াল সেন্ড মানি (Send Money) গেটওয়ে
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono-num font-bold bg-black/20 px-2.5 py-1 rounded-lg">
                  {theme.ussd}
                </span>
              </div>

              <div className="rounded-xl bg-black/20 backdrop-blur-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-white/80">
                    এই নম্বরে টাকা পাঠান (Send Money করুন)
                  </p>
                  <p className="text-2xl font-bold font-mono-num tracking-wider mt-0.5">
                    {targetNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(targetNumber, 'number')}
                  className="min-h-[44px] px-4 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedField === 'number' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" /> কপি হয়েছে
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> নম্বর কপি করুন
                    </>
                  )}
                </button>
              </div>

              {/* Clean Numbered Steps */}
              <ol className="space-y-2 text-xs text-white/95 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold bg-white/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    ০১
                  </span>
                  <span>
                    আপনার {theme.titleBn} অ্যাপ খুলুন অথবা ফোনে{' '}
                    <strong className="font-mono-num">{theme.ussd}</strong> ডায়াল করুন।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold bg-white/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    ০২
                  </span>
                  <span>
                    <strong>Send Money (সেন্ড মানি)</strong> অপশনে গিয়ে{' '}
                    <strong className="font-mono-num">{targetNumber}</strong> নম্বরে ঠিক{' '}
                    <strong className="font-mono-num">{formatBDT(amount)}</strong>{' '}
                    পাঠান।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold bg-white/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    ০৩
                  </span>
                  <span>
                    সফল লেনদেনের পর প্রাপ্ত <strong>Transaction ID (TrxID)</strong> নিচে
                    দিয়ে ভেরিফাই করুন।
                  </span>
                </li>
              </ol>
            </div>

            {isExpired && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-3">
                <div className="text-xs text-amber-900">
                  <p className="font-bold">গেটওয়ে সেশনের সময় শেষ হয়েছে</p>
                  <p>সাবমিট করার আগে অনুগ্রহ করে সেশনটি রিনিউ করুন।</p>
                </div>
                <button
                  type="button"
                  onClick={handleRenewSession}
                  className="min-h-[44px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> রিনিউ করুন
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TrxID Verification Form */}
            <form onSubmit={handleVerifyPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  ট্রানজেকশন আইডি (Transaction ID / TrxID) দিন
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="যেমন: BKA89X72LM বা 7N8X9P2Q"
                    className={`w-full min-h-[50px] px-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white ${theme.ringFocus} focus:outline-none text-sm font-mono-num uppercase text-slate-900`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  টাকা পাঠানোর কনফার্মেশন এসএমএস বা অ্যাপের স্টেটমেন্ট থেকে TrxID কপি
                  করে দিন।
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || isExpired || config.depositsEnabled === false}
                className={`w-full min-h-[52px] rounded-xl ${theme.buttonBg} text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-55 cursor-pointer shadow-sm`}
              >
                <Lock className="w-4 h-4" />
                {submitting
                  ? 'ভেরিফিকেশন জমা হচ্ছে...'
                  : 'পেমেন্ট ভেরিফাই ও সম্পন্ন করুন'}
              </button>
            </form>
          </div>

          {/* Right Column: Gateway Summary, Invoice QR & Trust Protection */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4">
              <h2 className="font-bold text-sm text-slate-900">
                অর্ডার ও পেমেন্ট সারসংক্ষেপ
              </h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ইনভয়েস নম্বর</span>
                  <span className="font-mono-num font-bold text-slate-800">
                    {invoiceId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">চ্যানেল</span>
                  <span className="font-bold text-slate-900">
                    {theme.titleBn} ({theme.subtitleEn})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">প্রাপক নম্বর</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {targetNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">গেটওয়ে ফি</span>
                  <span className="font-mono-num font-bold text-emerald-700">
                    ৳ ০ (ফ্রি)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-800">মোট পরিশোধযোগ্য</span>
                  <span className="font-mono-num font-bold text-purple-950">
                    {formatBDT(amount)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center gap-4">
                <QrMatrix
                  value={`FEEDEXPAY:${invoiceId}:${method.toUpperCase()}:${targetNumber}:${amount}`}
                  size={84}
                />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-slate-900">ভেরিফায়েড চেকআউট</p>
                  <p className="text-slate-500 leading-relaxed">
                    প্রতিটি লেনদেন এনক্রিপ্টেড ইনভয়েসের মাধ্যমে সংরক্ষিত থাকে।
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Smartphone className="w-4 h-4 text-purple-800" />
                তাৎক্ষণিক সহায়তা প্রয়োজন?
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                পেমেন্ট সম্পন্ন হওয়ার পর কোনো সমস্যা হলে ইনভয়েস আইডি সহ আমাদের অফিসিয়াল
                সাপোর্ট সেন্টারে মেসেজ করুন।
              </p>
              <a
                href={config.supportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Headphones className="w-4 h-4" />
                সাপোর্ট সেন্টারে যোগাযোগ করুন
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Trust Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>FeedexPay নিরাপদ পেমেন্ট প্রসেসর · সম্পূর্ণ এনক্রিপ্টেড</span>
        <span>বিকাশ · নগদ · রকেট অনুমোদিত পেমেন্ট গেটওয়ে</span>
      </div>
    </div>
  );
};
