import React, { useState, useEffect } from 'react';
import {
  Cloud,
  UploadCloud,
  DownloadCloud,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  HardDriveDownload,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logout,
  findDriveDatabaseFile,
  createDriveDatabaseFile,
  updateDriveDatabaseFile,
  downloadDriveDatabaseFile,
  deleteDriveDatabaseFile,
  DriveDatabaseFileInfo,
} from '../utils/googleDriveSync';
import {
  DRIVE_DATABASE_FILENAME,
  DriveDatabasePayload,
  SyncedDictionaryEntry,
  buildDriveDatabasePayload,
  mergeDictionaryEntries,
} from '../utils/localWordDatabase';
import { UiLang, formatBilingual } from '../data/listeningAndDictionaryData';
import { VocabItem } from '../data/jlptCurriculum';
import { SrsCardState } from '../utils/srsEngine';

interface GoogleDriveDbPanelProps {
  uiLang: UiLang;
  dictionaryEntries: SyncedDictionaryEntry[];
  customVocab: VocabItem[];
  srsMap: Record<string, SrsCardState>;
  xp: number;
  dailyTarget: number;
  quizzesCompleted: number;
  onRestoreFromDrive: (payload: DriveDatabasePayload) => void;
  onClose: () => void;
}

type ConfirmActionType = 'overwrite' | 'delete' | null;

export const GoogleDriveDbPanel: React.FC<GoogleDriveDbPanelProps> = ({
  uiLang,
  dictionaryEntries,
  customVocab,
  srsMap,
  xp,
  dailyTarget,
  quizzesCompleted,
  onRestoreFromDrive,
  onClose,
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [driveFile, setDriveFile] = useState<DriveDatabaseFileInfo | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      async (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setNeedsAuth(false);
        await checkExistingDriveFile(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const checkExistingDriveFile = async (activeToken?: string | null) => {
    const t = activeToken || (await getAccessToken());
    if (!t) {
      setNeedsAuth(true);
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const found = await findDriveDatabaseFile(t);
      setDriveFile(found);
    } catch (err: any) {
      setErrorMessage(err?.message || '查詢 Google Drive 檔案時發生錯誤');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        await checkExistingDriveFile(result.accessToken);
        setStatusMessage(
          formatBilingual(
            '已成功連結 Google Drive！你可以隨時備份或還原你嘅學習資料庫。',
            'Google ドライブとの連携が完了しました！',
            uiLang
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Google 登入失敗或已取消，請再試一次。'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setDriveFile(null);
    setNeedsAuth(true);
    setStatusMessage(null);
  };

  const getCurrentPayload = (): DriveDatabasePayload =>
    buildDriveDatabasePayload({
      dictionaryEntries,
      customVocab,
      srsMap,
      xp,
      dailyTarget,
      quizzesCompleted,
    });

  const handleRequestBackup = async () => {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }
    // If file already exists in Google Drive, require explicit confirmation before overwriting
    if (driveFile) {
      setConfirmAction('overwrite');
      return;
    }
    await executeCreateNewDriveFile(activeToken);
  };

  const executeCreateNewDriveFile = async (activeToken: string) => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const payload = getCurrentPayload();
      const created = await createDriveDatabaseFile(activeToken, payload);
      setDriveFile(created);
      setStatusMessage(
        formatBilingual(
          `成功建立並備份資料庫到 Google Drive（檔案：${DRIVE_DATABASE_FILENAME}，共 ${dictionaryEntries.length} 詞條、${Object.keys(srsMap).length} 張 SRS 記憶卡）！`,
          `Google ドライブに「${DRIVE_DATABASE_FILENAME}」を新規作成・保存しました！`,
          uiLang
        )
      );
    } catch (err: any) {
      setErrorMessage(err?.message || '儲存至 Google Drive 失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const executeConfirmedOverwrite = async () => {
    setConfirmAction(null);
    const activeToken = token || (await getAccessToken());
    if (!activeToken || !driveFile) {
      setNeedsAuth(true);
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const payload = getCurrentPayload();
      const updated = await updateDriveDatabaseFile(
        activeToken,
        driveFile.id,
        payload
      );
      setDriveFile(updated);
      setStatusMessage(
        formatBilingual(
          `已成功更新 Google Drive 上嘅資料庫檔案「${DRIVE_DATABASE_FILENAME}」！`,
          `Google ドライブの「${DRIVE_DATABASE_FILENAME}」を最新データで更新しました！`,
          uiLang
        )
      );
    } catch (err: any) {
      setErrorMessage(err?.message || '更新 Google Drive 檔案失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }
    if (!driveFile) {
      setErrorMessage('Google Drive 上尚未搵到備份檔案，請先點擊「儲存備份到 Google Drive」。');
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const downloaded = await downloadDriveDatabaseFile(
        activeToken,
        driveFile.id
      );
      const mergedEntries = mergeDictionaryEntries(
        dictionaryEntries,
        downloaded.dictionaryEntries
      );
      onRestoreFromDrive({
        ...downloaded,
        dictionaryEntries: mergedEntries,
      });
      setStatusMessage(
        formatBilingual(
          `已成功從 Google Drive 載入並合併資料庫（共 ${mergedEntries.length} 詞條）！`,
          `Google ドライブからデータベースを復元・統合しました（全 ${mergedEntries.length} 語）！`,
          uiLang
        )
      );
    } catch (err: any) {
      setErrorMessage(err?.message || '從 Google Drive 讀取資料庫失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const executeConfirmedDelete = async () => {
    setConfirmAction(null);
    const activeToken = token || (await getAccessToken());
    if (!activeToken || !driveFile) {
      setNeedsAuth(true);
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await deleteDriveDatabaseFile(activeToken, driveFile.id);
      setDriveFile(null);
      setStatusMessage(
        formatBilingual(
          `已從 Google Drive 刪除備份檔案「${DRIVE_DATABASE_FILENAME}」。`,
          `Google ドライブから「${DRIVE_DATABASE_FILENAME}」を削除しました。`,
          uiLang
        )
      );
    } catch (err: any) {
      setErrorMessage(err?.message || '刪除 Google Drive 檔案失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportLocalJson = () => {
    const payload = getCurrentPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = DRIVE_DATABASE_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="google-drive-modal"
      className="mt-4 pt-4 border-t border-slate-200 bg-sky-50/40 rounded-xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#0284C7] text-white flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {formatBilingual(
                'Google Drive 雲端資料庫同步中心',
                'Google ドライブ DB クラウド同期センター',
                uiLang
              )}
            </h3>
            <p className="text-xs text-slate-600">
              {formatBilingual(
                `將你嘅辭典詞庫 (${dictionaryEntries.length}詞)、自訂生字 (${customVocab.length}詞) 與 SRS 學習進度 (${Object.keys(srsMap).length}張) 儲存至你個人嘅 Google Drive (${DRIVE_DATABASE_FILENAME})`,
                `辞書データ (${dictionaryEntries.length}語)・単語帳・SRS進捗を個人の Google ドライブ (${DRIVE_DATABASE_FILENAME}) に保存・復元`,
                uiLang
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="export-local-db-json-btn"
            onClick={handleExportLocalJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>{formatBilingual('下載 JSON 備份', 'JSON出力', uiLang)}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉 Google Drive 面板"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{formatBilingual('收起', '閉じる', uiLang)}</span>
          </button>
        </div>
      </div>

      {/* Authentication / Action Body */}
      {needsAuth || !token ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900">
              {formatBilingual(
                '連結你嘅 Google 帳戶以啟用 Google Drive 自動備份',
                'Google アカウントでログインして Google ドライブ保存を有効化',
                uiLang
              )}
            </div>
            <p className="text-xs text-slate-500">
              {formatBilingual(
                '系統只會存取由本應用程式建立嘅專屬資料庫檔案 (kotonoha_dojo_database.json)，保障私隱安全。',
                'このアプリが作成する専用データベースファイル (kotonoha_dojo_database.json) のみにアクセスします。',
                uiLang
              )}
            </p>
          </div>

          {/* Official "Sign in with Google" Material Button */}
          <button
            type="button"
            data-testid="google-signin-btn"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button shrink-0"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
              </span>
              <span style={{ display: 'none' }}>Sign in with Google</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                ● 已連結 Google Drive
              </span>
              <span className="font-semibold text-slate-800">
                {user?.displayName || user?.email || 'Google User'}
              </span>
              {driveFile ? (
                <span className="text-slate-500 font-mono-num">
                  ｜ 雲端檔案：{driveFile.name}
                  {driveFile.modifiedTime
                    ? ` (更新於 ${new Date(driveFile.modifiedTime).toLocaleString('zh-HK')})`
                    : ''}
                </span>
              ) : (
                <span className="text-amber-700">
                  ｜ 尚未喺 Google Drive 建立 {DRIVE_DATABASE_FILENAME}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => checkExistingDriveFile(token)}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                <span>檢查雲端狀態</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-600 bg-slate-100 rounded-md cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span>登出</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="drive-backup-btn"
              onClick={handleRequestBackup}
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>
                {driveFile
                  ? formatBilingual(
                      '更新並覆寫 Google Drive 資料庫',
                      'Google ドライブのDBを上書き保存',
                      uiLang
                    )
                  : formatBilingual(
                      '建立並儲存資料庫到 Google Drive',
                      'Google ドライブにDBを新規保存',
                      uiLang
                    )}
              </span>
            </button>

            <button
              type="button"
              data-testid="drive-restore-btn"
              onClick={handleRestoreFromDrive}
              disabled={isBusy || !driveFile}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>
                {formatBilingual(
                  '從 Google Drive 載入並還原資料庫',
                  'Google ドライブからDBを復元',
                  uiLang
                )}
              </span>
            </button>

            {driveFile && (
              <button
                type="button"
                data-testid="drive-delete-btn"
                onClick={() => setConfirmAction('delete')}
                disabled={isBusy}
                className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {formatBilingual('刪除雲端備份檔', 'クラウドファイル削除', uiLang)}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Explicit User Confirmation Dialog for Overwriting or Deleting Google Drive Files */}
      {confirmAction && (
        <div
          data-testid="drive-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Google Drive 操作確認"
          className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-950 text-sm">
                {confirmAction === 'overwrite'
                  ? `確認覆寫更新 Google Drive 檔案「${DRIVE_DATABASE_FILENAME}」？`
                  : `確認從 Google Drive 永久刪除檔案「${DRIVE_DATABASE_FILENAME}」？`}
              </div>
              <p className="text-amber-900">
                {confirmAction === 'overwrite'
                  ? `此操作會以目前本地最新嘅 ${dictionaryEntries.length} 個辭典詞條、${customVocab.length} 個自訂生字同埋 ${Object.keys(srsMap).length} 張 SRS 學習紀錄，更新你 Google Drive 入面嘅「${DRIVE_DATABASE_FILENAME}」。`
                  : `此操作會從你嘅 Google Drive 刪除「${DRIVE_DATABASE_FILENAME}」備份檔案（你瀏覽器本地嘅學習資料唔會受影響）。`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="drive-confirm-cancel-btn"
              onClick={() => setConfirmAction(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              取消 (Cancel)
            </button>
            <button
              type="button"
              data-testid="drive-confirm-proceed-btn"
              onClick={
                confirmAction === 'overwrite'
                  ? executeConfirmedOverwrite
                  : executeConfirmedDelete
              }
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer ${
                confirmAction === 'overwrite'
                  ? 'bg-[#0284C7] hover:bg-sky-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {confirmAction === 'overwrite'
                ? '確認更新 (Confirm Update)'
                : '確認刪除 (Confirm Delete)'}
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          data-testid="drive-status-msg"
          className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          data-testid="drive-error-msg"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
