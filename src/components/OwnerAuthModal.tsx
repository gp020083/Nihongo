import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  X,
  UserCheck,
} from 'lucide-react';
import { verifyOwnerGoogleAccount } from '../utils/srsEngine';
import { googleSignIn, logout } from '../utils/googleDriveSync';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';

export interface OwnerAuthSession {
  email: string;
  displayName: string;
  photoURL?: string;
  verifiedAt: string;
  authMethod: 'google-oauth-popup' | 'owner-quick-pass';
}

interface OwnerAuthModalProps {
  uiLang: UiLang;
  ownerSession: OwnerAuthSession | null;
  isGateLocked: boolean;
  showModal: boolean;
  onUpdateSession: (session: OwnerAuthSession | null) => void;
  onToggleGateLock: (locked: boolean) => void;
  onCloseModal: () => void;
}

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  uiLang,
  ownerSession,
  isGateLocked,
  showModal,
  onUpdateSession,
  onToggleGateLock,
  onCloseModal,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [testEmailInput, setTestEmailInput] = useState<string>('');

  const isAuthorized = Boolean(
    ownerSession && verifyOwnerGoogleAccount(ownerSession.email).allowed
  );

  // Render when either the modal is open OR the full-screen gate lock is active and user is not yet signed in
  const isBlockingGate = isGateLocked && !isAuthorized;
  if (!showModal && !isBlockingGate) {
    return null;
  }

  const handleGooglePopupLogin = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const result = await googleSignIn();
      if (result?.user) {
        const check = verifyOwnerGoogleAccount(result.user.email);
        if (!check.allowed) {
          await logout();
          onUpdateSession(null);
          setErrorMsg(check.reasonHk);
          return;
        }
        const nextSession: OwnerAuthSession = {
          email: check.normalizedEmail,
          displayName: result.user.displayName || 'Kotonoha Owner',
          photoURL: result.user.photoURL || undefined,
          verifiedAt: new Date().toLocaleTimeString(),
          authMethod: 'google-oauth-popup',
        };
        onUpdateSession(nextSession);
        setStatusMsg(check.reasonHk);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message?.includes('popup')
          ? '瀏覽器攔截咗 Google 登入彈出視窗。請允許彈出視窗，或者用下面嘅 Email 核驗方式。'
          : err?.message || 'Google 登入失敗或已取消。'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleVerifyEmailAccess = (emailToVerify: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    const check = verifyOwnerGoogleAccount(emailToVerify);
    if (!check.allowed) {
      onUpdateSession(null);
      setErrorMsg(check.reasonHk);
      return;
    }
    const nextSession: OwnerAuthSession = {
      email: check.normalizedEmail,
      displayName: 'Ben (道場擁有者)',
      verifiedAt: new Date().toLocaleTimeString(),
      authMethod: 'owner-quick-pass',
    };
    onUpdateSession(nextSession);
    setStatusMsg(check.reasonHk);
  };

  const handleSignOutAndLock = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    onUpdateSession(null);
    setStatusMsg(null);
    setErrorMsg(null);
  };

  return (
    <div
      data-testid="owner-auth-gate-modal"
      role="dialog"
      aria-modal="true"
      aria-label="擁有者專屬 Google 帳號登入與門禁設定"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-white border-2 border-sky-300 rounded-2xl p-6 shadow-xl space-y-5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#0284C7] text-white text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {formatBilingual(
                  '擁有者登入',
                  'オーナーログイン',
                  uiLang
                )}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {isBlockingGate
                ? '道場已鎖定，請以擁有者帳號登入'
                : '擁有者登入與門禁設定'}
            </h2>
            <p
              data-testid="allowed-owner-email-badge"
              className="text-xs text-slate-600 leading-relaxed"
            >
              只限已設定嘅擁有者 Google 帳號使用，其他帳號會被拒絕。
            </p>
          </div>

          {!isBlockingGate && (
            <button
              type="button"
              data-testid="close-owner-auth-modal-btn"
              onClick={onCloseModal}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="關閉登入視窗"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Current Authentication Status */}
        {isAuthorized && ownerSession ? (
          <div
            data-testid="owner-authenticated-card"
            className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>已驗證擁有者身份</span>
                    <span className="px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-mono-num text-[11px]">
                      {ownerSession.verifiedAt}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {ownerSession.displayName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="owner-logout-btn"
                onClick={handleSignOutAndLock}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>登出帳號</span>
              </button>
            </div>

            {!isBlockingGate && (
              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-2">
                <span className="text-xs text-emerald-800">
                  已登入，可以使用全部功能。
                </span>
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  進入道場
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Official Google Sign-In Popup Button */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">
                方式一：Google 登入
              </div>
              <button
                type="button"
                data-testid="google-popup-signin-btn"
                disabled={isSigningIn}
                onClick={handleGooglePopupLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isSigningIn
                    ? '正在連接 Google…'
                    : '使用 Google 帳號登入'}
                </span>
              </button>
            </div>

            {/* Direct Owner Email Verification (Works inside preview iframes without popup blocker) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-800">
                方式二：輸入擁有者 Email 核驗，適用於彈出視窗被攔截嘅情況
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  data-testid="owner-email-verify-input"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="輸入 Google Email"
                  autoComplete="email"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono-num text-slate-900 focus:outline-none focus:border-[#0284C7]"
                />
                <button
                  type="button"
                  data-testid="owner-email-verify-submit-btn"
                  onClick={() => handleVerifyEmailAccess(testEmailInput)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  核驗並進入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error / Rejection Alert */}
        {errorMsg && (
          <div
            data-testid="owner-auth-error-banner"
            className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-900"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">登入失敗</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Success Notice */}
        {statusMsg && !errorMsg && (
          <div
            data-testid="owner-auth-success-banner"
            className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-900 font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Private Gate Lock Switch */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {isGateLocked ? (
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>強制門禁鎖定</span>
            </div>
            <p className="text-[11px] text-slate-500">
              開啟後，未以擁有者帳號登入時會鎖定全站畫面。
            </p>
          </div>

          <button
            type="button"
            data-testid="toggle-strict-gate-lock-btn"
            onClick={() => onToggleGateLock(!isGateLocked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              isGateLocked
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            {isGateLocked ? '門禁已開啟，點擊關閉' : '開啟門禁鎖定'}
          </button>
        </div>
      </div>
    </div>
  );
};
