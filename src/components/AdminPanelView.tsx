import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  KeyRound,
  Lock,
  LogOut,
  MinusCircle,
  Package,
  Plus,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BRAND_ASSETS } from '../lib/assets';
import { METHOD_LABELS, formatBDT } from '../lib/defaults';
import {
  adminAdjustBalance,
  adminApproveDeposit,
  adminApproveWithdrawal,
  adminAssignPlanToMember,
  adminRejectDeposit,
  adminRejectWithdrawal,
  adminSaveAppConfig,
  adminSetInvestmentStatus,
  adminToggleMemberBlock,
  adminUpdateMemberDetails,
  subscribeAllDeposits,
  subscribeAllInvestments,
  subscribeAllMembers,
  subscribeAllTransactions,
  subscribeAllWithdrawals,
  updateAdminCredentials,
  verifyAdminLogin,
} from '../lib/storeService';
import type {
  AppConfig,
  Deposit,
  Investment,
  Member,
  PaymentMethod,
  PlanItem,
  Transaction,
  Withdrawal,
} from '../types';

interface AdminPanelViewProps {
  config: AppConfig;
  onExitAdmin: () => void;
}

type AdminTab =
  | 'members'
  | 'deposits'
  | 'withdrawals'
  | 'settings'
  | 'plans'
  | 'security';

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  config,
  onExitAdmin,
}) => {
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('fdx_admin_secure_auth') === '1';
    } catch {
      return false;
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberPhone, setSelectedMemberPhone] = useState<string | null>(
    null
  );

  // Member A-to-Z edit states
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [editTotalRecharge, setEditTotalRecharge] = useState('');
  const [editTotalEarned, setEditTotalEarned] = useState('');
  const [editWalletMethod, setEditWalletMethod] = useState<'' | PaymentMethod>('');
  const [editWalletNumber, setEditWalletNumber] = useState('');
  const [resetLoginPass, setResetLoginPass] = useState('');
  const [resetWithdrawPass, setResetWithdrawPass] = useState('');
  const [assignPlanId, setAssignPlanId] = useState(
    config.plans[0]?.id || 'vip-1'
  );

  // Global config & plans editor states
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [draftPlans, setDraftPlans] = useState<PlanItem[]>(config.plans);

  // Admin credentials editor
  const [curAdminPass, setCurAdminPass] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('feedexadmin');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');

  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraftConfig(config);
    setDraftPlans(config.plans);
  }, [config]);

  useEffect(() => {
    if (!authed) return;
    const unsubM = subscribeAllMembers(setMembers);
    const unsubD = subscribeAllDeposits(setDeposits);
    const unsubW = subscribeAllWithdrawals(setWithdrawals);
    const unsubI = subscribeAllInvestments(setInvestments);
    const unsubT = subscribeAllTransactions(setTransactions);
    return () => {
      unsubM();
      unsubD();
      unsubW();
      unsubI();
      unsubT();
    };
  }, [authed]);

  const selectedMember = useMemo(
    () => members.find((m) => m.phone === selectedMemberPhone) || null,
    [members, selectedMemberPhone]
  );

  useEffect(() => {
    if (selectedMember) {
      setEditTotalRecharge(String(selectedMember.totalRecharge));
      setEditTotalEarned(String(selectedMember.totalEarned));
      setEditWalletMethod(selectedMember.walletMethod);
      setEditWalletNumber(selectedMember.walletNumber);
      setResetLoginPass('');
      setResetWithdrawPass('');
    }
  }, [selectedMember?.phone, selectedMember?.totalRecharge, selectedMember?.totalEarned, selectedMember?.walletMethod, selectedMember?.walletNumber]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockoutUntil) {
      const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setLoginError(`নিরাপত্তার কারণে লগইন সাময়িকভাবে লক আছে। ${secs} সেকেন্ড পর চেষ্টা করুন।`);
      return;
    }
    setLoginError('');
    setLoggingIn(true);
    try {
      const ok = await verifyAdminLogin(username, password, securityPin);
      if (!ok) {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        if (nextFails >= 5) {
          setLockoutUntil(Date.now() + 60_000);
          setFailedAttempts(0);
          setLoginError('৫ বার ভুল তথ্যের কারণে ৬০ সেকেন্ডের জন্য লগইন লক করা হয়েছে।');
        } else {
          setLoginError(
            `ইউজারনেম, পাসওয়ার্ড বা সিকিউরিটি পিন সঠিক নয়। (বাকি চেষ্টা: ${5 - nextFails} বার)`
          );
        }
      } else {
        setFailedAttempts(0);
        sessionStorage.setItem('fdx_admin_secure_auth', '1');
        setAuthed(true);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'লগইন ব্যর্থ হয়েছে।');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem('fdx_admin_secure_auth');
    setAuthed(false);
    setUsername('');
    setPassword('');
    setSecurityPin('');
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.phone.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.referralCode.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const selectedFamily = useMemo(() => {
    if (!selectedMember) return null;
    const l1 = members.filter((m) => m.uplinePhones?.[0] === selectedMember.phone);
    const l2 = members.filter((m) => m.uplinePhones?.[1] === selectedMember.phone);
    const l3 = members.filter((m) => m.uplinePhones?.[2] === selectedMember.phone);
    return { l1, l2, l3 };
  }, [members, selectedMember]);

  const selectedMemberInvestments = useMemo(
    () => investments.filter((i) => i.memberPhone === selectedMember?.phone),
    [investments, selectedMember?.phone]
  );

  const selectedMemberTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.memberPhone === selectedMember?.phone)
        .slice(0, 15),
    [transactions, selectedMember?.phone]
  );

  const pendingDepositsCount = deposits.filter((d) => d.status === 'pending').length;
  const pendingWithdrawalsCount = withdrawals.filter(
    (w) => w.status === 'pending'
  ).length;
  const totalApprovedDepositAmount = deposits
    .filter((d) => d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0);

  const handleAdjust = async (sign: 1 | -1) => {
    if (!selectedMember) return;
    const val = Math.abs(Number(adjustAmount));
    if (!val || Number.isNaN(val)) {
      setStatusMsg({ type: 'err', text: 'সঠিক টাকার পরিমাণ লিখুন।' });
      return;
    }
    try {
      await adminAdjustBalance(selectedMember.phone, sign * val, adjustNote);
      setAdjustAmount('');
      setAdjustNote('');
      setStatusMsg({
        type: 'ok',
        text: `${selectedMember.phone} অ্যাকাউন্টে ${formatBDT(val)} ${
          sign > 0 ? 'যোগ' : 'কর্তন'
        } করা হয়েছে। ইউজার অ্যাকাউন্টে সাথে সাথেই আপডেট হয়ে গেছে।`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'ব্যর্থ হয়েছে।',
      });
    }
  };

  const handleSaveMemberAtoZ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setStatusMsg(null);
    try {
      await adminUpdateMemberDetails(selectedMember.phone, {
        totalRecharge: Number(editTotalRecharge),
        totalEarned: Number(editTotalEarned),
        walletMethod: editWalletMethod,
        walletNumber: editWalletNumber,
        newLoginPassword: resetLoginPass || undefined,
        newWithdrawPassword: resetWithdrawPass || undefined,
      });
      setResetLoginPass('');
      setResetWithdrawPass('');
      setStatusMsg({
        type: 'ok',
        text: `${selectedMember.phone} সদস্যের সকল তথ্য সফলভাবে আপডেট হয়েছে এবং ইউজার অ্যাকাউন্টে তাৎক্ষণিকভাবে সিঙ্ক হয়েছে।`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'আপডেট ব্যর্থ হয়েছে।',
      });
    }
  };

  const handleAssignPlan = async () => {
    if (!selectedMember) return;
    try {
      await adminAssignPlanToMember(selectedMember.phone, assignPlanId);
      setStatusMsg({
        type: 'ok',
        text: `${selectedMember.phone} সদস্যের অ্যাকাউন্টে নতুন প্ল্যান সক্রিয় করা হয়েছে!`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'প্ল্যান যুক্ত ব্যর্থ হয়েছে।',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await adminSaveAppConfig({
        ...draftConfig,
        plans: draftPlans,
      });
      setStatusMsg({
        type: 'ok',
        text: 'সকল সেটিংস, রিচার্জ নম্বর, লিংক এবং ইউজার প্যানেল কন্ট্রোল সাথে সাথেই সব সদস্যের কাছে আপডেট হয়েছে!',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।',
      });
    }
  };

  const handleAddNewPlan = () => {
    const newPlan: PlanItem = {
      id: `plan-${Date.now()}`,
      name: 'নতুন ভিআইপি প্ল্যান',
      category: 'daily',
      price: 1500,
      dailyIncome: 150,
      cycleDays: 30,
      totalReturn: 4500,
      imageKey: 'vip_express',
      badge: 'নতুন',
    };
    setDraftPlans((prev) => [...prev, newPlan]);
  };

  const handleDeletePlan = (idx: number) => {
    if (draftPlans.length <= 1) {
      setStatusMsg({ type: 'err', text: 'কমপক্ষে ১টি প্ল্যান রাখতে হবে।' });
      return;
    }
    setDraftPlans((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePlans = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const normalized = draftPlans.map((p) => ({
        ...p,
        price: Number(p.price),
        dailyIncome: Number(p.dailyIncome),
        cycleDays: Number(p.cycleDays),
        totalReturn: Number(p.dailyIncome) * Number(p.cycleDays),
      }));
      await adminSaveAppConfig({
        ...draftConfig,
        plans: normalized,
      });
      setStatusMsg({
        type: 'ok',
        text: 'সকল প্ল্যান আপডেট হয়েছে এবং ইউজার হোম পেজে তাৎক্ষণিকভাবে প্রদর্শিত হচ্ছে!',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'আপডেট ব্যর্থ হয়েছে।',
      });
    }
  };

  const handleUpdateAdminCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await updateAdminCredentials(
        curAdminPass,
        newAdminUser,
        newAdminPass,
        newAdminPin
      );
      setCurAdminPass('');
      setNewAdminPass('');
      setNewAdminPin('');
      setStatusMsg({
        type: 'ok',
        text: 'এডমিন ইউজারনেম, পাসওয়ার্ড ও সিকিউরিটি পিন সফলভাবে পরিবর্তন হয়েছে।',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'পরিবর্তন ব্যর্থ হয়েছে।',
      });
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_ASSETS.logo}
                alt="Feedex লোগো"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl border border-slate-200 object-cover"
              />
              <div>
                <h1 className="font-bold text-lg text-slate-900">
                  গোপন এডমিন প্যানেল
                </h1>
                <p className="text-xs text-slate-500">
                  ৩-স্তরের নিরাপত্তা যাচাইকরণ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs font-semibold text-purple-900 hover:underline cursor-pointer"
            >
              মূল সাইট
            </button>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                এডমিন ইউজারনেম
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ইউজারনেম লিখুন"
                className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                এডমিন পাসওয়ার্ড
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                গোপন সিকিউরিটি পিন (Security PIN)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="৬ সংখ্যার সিকিউরিটি পিন"
                  className="w-full min-h-[46px] pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full min-h-[48px] rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {loggingIn ? 'নিরাপত্তা যাচাই হচ্ছে...' : 'নিরাপদ লগইন করুন'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-30 bg-purple-950 text-white border-b border-purple-900 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src={BRAND_ASSETS.logo}
              alt="Feedex লোগো"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg bg-white p-0.5 object-cover"
            />
            <div>
              <h1 className="font-display font-bold text-base leading-tight">
                FeedexDigital Admin Control
              </h1>
              <p className="text-[11px] text-orange-300">
                সম্পূর্ণ A-to-Z রিয়েল-টাইম কন্ট্রোল প্যানেল
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              ইউজার সাইট
            </button>
            <button
              type="button"
              onClick={handleLogoutAdmin}
              className="min-h-[40px] px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Live KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">মোট নিবন্ধিত সদস্য</p>
            <p className="text-2xl font-bold font-mono-num text-purple-950 mt-1">
              {members.length} জন
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">অপেক্ষমাণ ডিপোজিট</p>
            <p className="text-2xl font-bold font-mono-num text-orange-600 mt-1">
              {pendingDepositsCount} টি
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">অপেক্ষমাণ উত্তোলন</p>
            <p className="text-2xl font-bold font-mono-num text-amber-600 mt-1">
              {pendingWithdrawalsCount} টি
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">মোট অনুমোদিত ডিপোজিট</p>
            <p className="text-2xl font-bold font-mono-num text-emerald-700 mt-1">
              {formatBDT(totalApprovedDepositAmount)}
            </p>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          {[
            { id: 'members' as const, label: 'সদস্য A-to-Z কন্ট্রোল', icon: Users },
            {
              id: 'deposits' as const,
              label: `ডিপোজিট (${pendingDepositsCount})`,
              icon: Wallet,
            },
            {
              id: 'withdrawals' as const,
              label: `উত্তোলন (${pendingWithdrawalsCount})`,
              icon: Wallet,
            },
            {
              id: 'settings' as const,
              label: 'রিচার্জ নম্বর, লিংক ও সিস্টেম',
              icon: Settings,
            },
            { id: 'plans' as const, label: 'প্ল্যান ম্যানেজমেন্ট', icon: Package },
            { id: 'security' as const, label: 'এডমিন নিরাপত্তা', icon: KeyRound },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setStatusMsg(null);
                }}
                className={`min-h-[42px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  tab === item.id
                    ? 'bg-purple-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {statusMsg && (
          <div
            className={`p-3.5 rounded-xl border text-sm font-medium ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* TAB 1: MEMBERS A-TO-Z CONTROL */}
        {tab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="অ্যাকাউন্ট নম্বর, আইডি বা কোড দিয়ে খুঁজুন..."
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>

              <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    কোনো সদস্য পাওয়া যায়নি।
                  </p>
                ) : (
                  filteredMembers.map((m) => (
                    <button
                      key={m.phone}
                      type="button"
                      onClick={() => setSelectedMemberPhone(m.phone)}
                      className={`w-full py-3 px-3 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        selectedMemberPhone === m.phone
                          ? 'bg-purple-50 border border-purple-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-bold font-mono-num text-sm text-slate-900">
                          {m.phone}{' '}
                          {m.blocked && (
                            <span className="text-xs text-red-600">(লকড)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-num">
                          ID: {m.id} · কোড: {m.referralCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono-num text-sm text-purple-900">
                          {formatBDT(m.balance)}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono-num">
                          রিচার্জ: {formatBDT(m.totalRecharge)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected Member Full A-to-Z Panel */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              {!selectedMember ? (
                <p className="text-sm text-slate-500 py-16 text-center">
                  বাম তালিকা থেকে যেকোনো সদস্য খুঁজুন এবং নির্বাচন করুন—তাহলেই তার
                  ব্যালেন্স বাড়ানো/কমানো, অ্যাকাউন্ট লক/আনলক, পাসওয়ার্ড রিসেট,
                  প্ল্যান অ্যাসাইন ও ফ্যামিলি ট্রি নিয়ন্ত্রণ করতে পারবেন।
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-bold font-mono-num text-lg text-slate-900">
                        {selectedMember.phone}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono-num">
                        ID: {selectedMember.id} · রেফার কোড:{' '}
                        {selectedMember.referralCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminToggleMemberBlock(
                          selectedMember.phone,
                          !selectedMember.blocked
                        );
                        setStatusMsg({
                          type: 'ok',
                          text: selectedMember.blocked
                            ? `${selectedMember.phone} অ্যাকাউন্ট আনলক করা হয়েছে।`
                            : `${selectedMember.phone} অ্যাকাউন্ট লক করা হয়েছে। ইউজার তাৎক্ষণিকভাবে লগআউট হয়ে যাবে।`,
                        });
                      }}
                      className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        selectedMember.blocked
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {selectedMember.blocked ? (
                        <>
                          <Unlock className="w-4 h-4" /> অ্যাকাউন্ট আনলক করুন
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" /> অ্যাকাউন্ট লক করুন
                        </>
                      )}
                    </button>
                  </div>

                  {/* Live Balance Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-xl text-xs">
                    <div>
                      <p className="text-slate-500">ব্যালেন্স</p>
                      <p className="font-bold font-mono-num text-sm text-purple-900">
                        {formatBDT(selectedMember.balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">মোট রিচার্জ</p>
                      <p className="font-bold font-mono-num text-sm">
                        {formatBDT(selectedMember.totalRecharge)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">মোট উত্তোলন</p>
                      <p className="font-bold font-mono-num text-sm">
                        {formatBDT(selectedMember.totalWithdraw)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">মোট আয়</p>
                      <p className="font-bold font-mono-num text-sm text-emerald-700">
                        {formatBDT(selectedMember.totalEarned)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Balance + / - */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-slate-800">
                      দ্রুত ব্যালেন্স যোগ বা কর্তন করুন
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="number"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="টাকার পরিমাণ (যেমন: 500)"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                      />
                      <input
                        type="text"
                        value={adjustNote}
                        onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="কারণ / নোট (ঐচ্ছিক)"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleAdjust(1)}
                        className="min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" /> ব্যালেন্স বাড়ান (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjust(-1)}
                        className="min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MinusCircle className="w-4 h-4" /> ব্যালেন্স কমান (-)
                      </button>
                    </div>
                  </div>

                  {/* Full A-to-Z Member Field Editor */}
                  <form
                    onSubmit={handleSaveMemberAtoZ}
                    className="p-4 rounded-xl border border-slate-200 space-y-3"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      সদস্যের পূর্ণাঙ্গ তথ্য ও পাসওয়ার্ড নিয়ন্ত্রণ
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          মোট রিচার্জ (৳)
                        </label>
                        <input
                          type="number"
                          value={editTotalRecharge}
                          onChange={(e) => setEditTotalRecharge(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          মোট আয় (৳)
                        </label>
                        <input
                          type="number"
                          value={editTotalEarned}
                          onChange={(e) => setEditTotalEarned(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          ওয়ালেট মাধ্যম
                        </label>
                        <select
                          value={editWalletMethod}
                          onChange={(e) =>
                            setEditWalletMethod(e.target.value as '' | PaymentMethod)
                          }
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                        >
                          <option value="">সেট করা নেই</option>
                          <option value="bkash">বিকাশ (bKash)</option>
                          <option value="nagad">নগদ (Nagad)</option>
                          <option value="rocket">রকেট (Rocket)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          ওয়ালেট নম্বর
                        </label>
                        <input
                          type="text"
                          value={editWalletNumber}
                          onChange={(e) => setEditWalletNumber(e.target.value)}
                          placeholder="017XXXXXXXX"
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          নতুন লগইন পাসওয়ার্ড (রিসেট)
                        </label>
                        <input
                          type="text"
                          value={resetLoginPass}
                          onChange={(e) => setResetLoginPass(e.target.value)}
                          placeholder="কমপক্ষে ৬ অক্ষর"
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          নতুন উত্তোলন পাসওয়ার্ড (রিসেট)
                        </label>
                        <input
                          type="text"
                          value={resetWithdrawPass}
                          onChange={(e) => setResetWithdrawPass(e.target.value)}
                          placeholder="কমপক্ষে ৪ অক্ষর"
                          className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[42px] rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold cursor-pointer"
                    >
                      সদস্যের তথ্য সংরক্ষণ করুন
                    </button>
                  </form>

                  {/* Assign Plan Directly & View Member Plans */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-slate-800">
                      সদস্যকে সরাসরি প্ল্যান যুক্ত / নিয়ন্ত্রণ করুন
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={assignPlanId}
                        onChange={(e) => setAssignPlanId(e.target.value)}
                        className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      >
                        {config.plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatBDT(p.price)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAssignPlan}
                        className="min-h-[40px] px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        প্ল্যান সক্রিয় করুন
                      </button>
                    </div>
                    {selectedMemberInvestments.length > 0 && (
                      <div className="divide-y divide-slate-100 text-xs">
                        {selectedMemberInvestments.map((inv) => (
                          <div
                            key={inv.id}
                            className="py-2 flex items-center justify-between gap-2"
                          >
                            <span>
                              {inv.planName} ({inv.daysClaimed}/{inv.cycleDays} দিন)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                adminSetInvestmentStatus(
                                  inv.id,
                                  inv.status === 'active' ? 'completed' : 'active'
                                )
                              }
                              className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                                inv.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {inv.status === 'active' ? 'চলমান (বন্ধ করুন)' : 'সম্পন্ন (চালু করুন)'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3-Level Family Tree & Recent Transactions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <GitBranch className="w-4 h-4 text-purple-800" /> ফ্যামিলি
                        ট্রি
                      </p>
                      <p>
                        আপলাইন:{' '}
                        <span className="font-mono-num font-semibold">
                          {selectedMember.uplinePhones?.length
                            ? selectedMember.uplinePhones.join(' → ')
                            : 'সরাসরি'}
                        </span>
                      </p>
                      <p>
                        ১ম লেভেল: <strong>{selectedFamily?.l1.length || 0}</strong> ·
                        ২য়: <strong>{selectedFamily?.l2.length || 0}</strong> · ৩য়:{' '}
                        <strong>{selectedFamily?.l3.length || 0}</strong>
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <p className="font-bold text-slate-800">
                        সাম্প্রতিক লেনদেন ({selectedMemberTransactions.length})
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {selectedMemberTransactions.map((t) => (
                          <div key={t.id} className="flex justify-between gap-2">
                            <span className="truncate">{t.description}</span>
                            <span className="font-mono-num font-bold shrink-0">
                              {formatBDT(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEPOSITS */}
        {tab === 'deposits' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-base text-slate-900 mb-4">
              সকল ডিপোজিট অনুরোধ (বিকাশ / নগদ / রকেট)
            </h2>
            {deposits.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                কোনো ডিপোজিট পাওয়া যায়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deposits.map((d) => (
                  <div
                    key={d.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 text-xs sm:text-sm">
                      <p className="font-bold font-mono-num text-slate-900">
                        {d.memberPhone} · {METHOD_LABELS[d.method]} ·{' '}
                        {formatBDT(d.amount)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-num">
                        TrxID: {d.trxId} · প্রেরিত নম্বর: {d.targetNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => adminApproveDeposit(d.id)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> অনুমোদন
                          </button>
                          <button
                            type="button"
                            onClick={() => adminRejectDeposit(d.id)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> বাতিল
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-bold ${
                            d.status === 'approved'
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {d.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WITHDRAWALS */}
        {tab === 'withdrawals' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-base text-slate-900 mb-4">
              সকল উত্তোলন আবেদন
            </h2>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                কোনো উত্তোলন আবেদন পাওয়া যায়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 text-xs sm:text-sm">
                      <p className="font-bold font-mono-num text-slate-900">
                        {w.memberPhone} · {METHOD_LABELS[w.method]} ·{' '}
                        {formatBDT(w.amount)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-num">
                        পেমেন্ট নম্বর: {w.walletNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {w.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => adminApproveWithdrawal(w.id)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> পেমেন্ট সম্পন্ন
                          </button>
                          <button
                            type="button"
                            onClick={() => adminRejectWithdrawal(w.id)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> বাতিল ও ফেরত
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-bold ${
                            w.status === 'approved'
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {w.status === 'approved' ? 'সম্পন্ন' : 'বাতিল'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RECHARGE NUMBERS, TELEGRAM, SUPPORT & USER PANEL TOGGLES */}
        {tab === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm"
          >
            <div>
              <h2 className="font-bold text-base text-slate-900">
                রিচার্জ নম্বর, লিংক ও ইউজার প্যানেল সম্পূর্ণ নিয়ন্ত্রণ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এখানে যেকোনো কিছু পরিবর্তন করে সেভ করলে সাথে সাথেই সব সদস্যের
                অ্যাকাউন্টে ও ইউজার প্যানেলে আপডেট হয়ে যাবে।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1">
                  বিকাশ (bKash) সেন্ড মানি নম্বর
                </label>
                <input
                  type="text"
                  required
                  value={draftConfig.rechargeNumbers.bkash}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      rechargeNumbers: {
                        ...draftConfig.rechargeNumbers,
                        bkash: e.target.value,
                      },
                    })
                  }
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-orange-700 mb-1">
                  নগদ (Nagad) সেন্ড মানি নম্বর
                </label>
                <input
                  type="text"
                  required
                  value={draftConfig.rechargeNumbers.nagad}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      rechargeNumbers: {
                        ...draftConfig.rechargeNumbers,
                        nagad: e.target.value,
                      },
                    })
                  }
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-800 mb-1">
                  রকেট (Rocket) সেন্ড মানি নম্বর
                </label>
                <input
                  type="text"
                  required
                  value={draftConfig.rechargeNumbers.rocket}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      rechargeNumbers: {
                        ...draftConfig.rechargeNumbers,
                        rocket: e.target.value,
                      },
                    })
                  }
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  টেলিগ্রাম গ্রুপ / চ্যানেল লিংক
                </label>
                <input
                  type="url"
                  required
                  value={draftConfig.telegramLink}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      telegramLink: e.target.value,
                    })
                  }
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সাপোর্ট সেন্টার লিংক
                </label>
                <input
                  type="url"
                  required
                  value={draftConfig.supportLink}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      supportLink: e.target.value,
                    })
                  }
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                হোম পেজ লাইভ নোটিশ ব্যানার (ফাঁকা রাখলে দেখাবে না)
              </label>
              <input
                type="text"
                value={draftConfig.globalNotice || ''}
                onChange={(e) =>
                  setDraftConfig({
                    ...draftConfig,
                    globalNotice: e.target.value,
                  })
                }
                placeholder="যেমন: আজকে সকল উত্তোলন ৩০ মিনিটের মধ্যে সম্পন্ন হবে!"
                className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              />
            </div>

            {/* Feature Toggle Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold">
              {[
                { key: 'depositsEnabled' as const, label: 'ডিপোজিট চালু রাখুন' },
                { key: 'withdrawalsEnabled' as const, label: 'উত্তোলন চালু রাখুন' },
                { key: 'registrationsEnabled' as const, label: 'নতুন নিবন্ধন চালু রাখুন' },
                { key: 'luckySpinEnabled' as const, label: 'লাকি স্পিন চালু রাখুন' },
                { key: 'requireDepositForPlan' as const, label: 'প্ল্যান কিনতে ডিপোজিট বাধ্যতামূলক' },
                { key: 'requireDepositForWithdraw' as const, label: 'উত্তোলনে ডিপোজিট বাধ্যতামূলক' },
                { key: 'maintenanceMode' as const, label: 'মেইনটেন্যান্স মোড (সাইট সাময়িক বন্ধ)' },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center justify-between gap-2 bg-white p-3 rounded-lg border border-slate-200 cursor-pointer"
                >
                  <span>{toggle.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draftConfig[toggle.key])}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        [toggle.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-purple-900"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ১ম লেভেল (%)
                </label>
                <input
                  type="number"
                  value={draftConfig.referralRates.level1}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      referralRates: {
                        ...draftConfig.referralRates,
                        level1: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ২য় লেভেল (%)
                </label>
                <input
                  type="number"
                  value={draftConfig.referralRates.level2}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      referralRates: {
                        ...draftConfig.referralRates,
                        level2: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ৩য় লেভেল (%)
                </label>
                <input
                  type="number"
                  value={draftConfig.referralRates.level3}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      referralRates: {
                        ...draftConfig.referralRates,
                        level3: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নিবন্ধন বোনাস
                </label>
                <input
                  type="number"
                  value={draftConfig.signupBonus}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      signupBonus: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  টেলিগ্রাম বোনাস
                </label>
                <input
                  type="number"
                  value={draftConfig.telegramBonus}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      telegramBonus: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সর্বনিম্ন ডিপোজিট
                </label>
                <input
                  type="number"
                  value={draftConfig.minDeposit}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      minDeposit: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সর্বনিম্ন উত্তোলন
                </label>
                <input
                  type="number"
                  value={draftConfig.minWithdraw}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      minWithdraw: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
                />
              </div>
            </div>

            <button
              type="submit"
              className="min-h-[48px] px-6 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-sm font-bold cursor-pointer"
            >
              সব সেটিংস সংরক্ষণ ও লাইভ সিঙ্ক করুন
            </button>
          </form>
        )}

        {/* TAB 5: PLANS EDITOR */}
        {tab === 'plans' && (
          <form
            onSubmit={handleSavePlans}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-base text-slate-900">
                সকল প্ল্যানের মূল্য, আয়, যোগ ও বাতিল নিয়ন্ত্রণ
              </h2>
              <button
                type="button"
                onClick={handleAddNewPlan}
                className="min-h-[40px] px-3.5 rounded-xl bg-purple-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> নতুন প্ল্যান যোগ করুন
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {draftPlans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) => {
                        const next = [...draftPlans];
                        next[idx] = { ...plan, name: e.target.value };
                        setDraftPlans(next);
                      }}
                      className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(idx)}
                      aria-label="প্ল্যান মুছুন"
                      className="w-10 h-10 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        ধরন
                      </label>
                      <select
                        value={plan.category}
                        onChange={(e) => {
                          const next = [...draftPlans];
                          next[idx] = {
                            ...plan,
                            category: e.target.value as 'daily' | 'welfare',
                          };
                          setDraftPlans(next);
                        }}
                        className="w-full min-h-[40px] px-2 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <option value="daily">দৈনিক আয়</option>
                        <option value="welfare">কল্যাণ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        দাম (৳)
                      </label>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => {
                          const next = [...draftPlans];
                          next[idx] = { ...plan, price: Number(e.target.value) };
                          setDraftPlans(next);
                        }}
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 bg-white text-sm font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        দৈনিক আয়
                      </label>
                      <input
                        type="number"
                        value={plan.dailyIncome}
                        onChange={(e) => {
                          const next = [...draftPlans];
                          next[idx] = {
                            ...plan,
                            dailyIncome: Number(e.target.value),
                          };
                          setDraftPlans(next);
                        }}
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 bg-white text-sm font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        চক্র (দিন)
                      </label>
                      <input
                        type="number"
                        value={plan.cycleDays}
                        onChange={(e) => {
                          const next = [...draftPlans];
                          next[idx] = {
                            ...plan,
                            cycleDays: Number(e.target.value),
                          };
                          setDraftPlans(next);
                        }}
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 bg-white text-sm font-mono-num"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="min-h-[48px] px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold cursor-pointer"
            >
              প্ল্যান পরিবর্তন সংরক্ষণ করুন
            </button>
          </form>
        )}

        {/* TAB 6: ADMIN SECURITY */}
        {tab === 'security' && (
          <form
            onSubmit={handleUpdateAdminCreds}
            className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md space-y-4 shadow-sm"
          >
            <h2 className="font-bold text-base text-slate-900">
              এডমিন লগইন ও সিকিউরিটি পিন পরিবর্তন
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বর্তমান এডমিন পাসওয়ার্ড
              </label>
              <input
                type="password"
                required
                value={curAdminPass}
                onChange={(e) => setCurAdminPass(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                নতুন ইউজারনেম
              </label>
              <input
                type="text"
                required
                value={newAdminUser}
                onChange={(e) => setNewAdminUser(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                নতুন পাসওয়ার্ড
              </label>
              <input
                type="password"
                required
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                নতুন সিকিউরিটি পিন (PIN)
              </label>
              <input
                type="password"
                required
                value={newAdminPin}
                onChange={(e) => setNewAdminPin(e.target.value)}
                placeholder="কমপক্ষে ৪ সংখ্যা"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-sm font-bold cursor-pointer"
            >
              নিরাপত্তা তথ্য আপডেট করুন
            </button>
          </form>
        )}
      </main>
    </div>
  );
};
