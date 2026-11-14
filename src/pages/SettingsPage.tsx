import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user, refreshSession, addToast } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'bn'>(
    user?.preferredLanguage || 'en'
  );
  const [prefs, setPrefs] = useState({
    inAppDeadlines: true,
    inAppVerifications: true,
    inAppApplications: true,
    inAppSecurity: true,
    deadlineDaysBefore: 14,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ preferences: typeof prefs }>('/api/notifications/preferences')
      .then((res) => setPrefs(res.preferences))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        apiRequest('/api/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ fullName, preferredLanguage }),
        }),
        apiRequest('/api/notifications/preferences', {
          method: 'PUT',
          body: JSON.stringify(prefs),
        }),
      ]);
      await refreshSession();
      addToast({ type: 'success', title: 'Preferences updated' });
    } catch (err) {
      addToast({ type: 'error', title: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-wider text-[#5E6B5B] uppercase dark:text-[#C5F36A]">
          Workspace Preferences
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#101713] dark:text-[#F7F7F0]">
          Account &amp; Notification Preferences
        </h1>
        <p className="mt-1 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
          Manage your display name, AI assistant language, and in-app deadline reminder window.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#141B17]"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#101713] dark:text-[#F7F7F0]">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm text-[#101713] focus:border-[#101713] focus:outline-none dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#101713] dark:text-[#F7F7F0]">
              AI Language
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'bn')}
              className="mt-1 h-10 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm text-[#101713] dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0]"
            >
              <option value="en">English</option>
              <option value="bn">Bengali (বাংলা)</option>
            </select>
          </div>
        </div>

        <div className="border-t border-[#E4E8E0] pt-5 dark:border-[#232D27]">
          <h2 className="font-display text-sm font-bold text-[#101713] dark:text-[#F7F7F0]">
            In-App Notification Alerts
          </h2>
          <p className="mt-0.5 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
            In-app alerts are active immediately. External email/push channels are disabled unless an SMTP/push provider is configured.
          </p>

          <div className="mt-4 space-y-3 text-sm">
            {[
              { key: 'inAppDeadlines', label: 'Upcoming application deadline alerts' },
              { key: 'inAppVerifications', label: 'Verification audit completion alerts' },
              { key: 'inAppApplications', label: 'Application stage change logs' },
              { key: 'inAppSecurity', label: 'Account security notifications' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={prefs[item.key as keyof typeof prefs] as boolean}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [item.key]: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-[#E4E8E0]"
                />
                <span className="text-[#101713] dark:text-[#E4E8E0]">{item.label}</span>
              </label>
            ))}

            <div className="pt-2">
              <label className="block text-xs font-semibold text-[#101713] dark:text-[#F7F7F0]">
                Remind me this many days before deadlines
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={prefs.deadlineDaysBefore}
                onChange={(e) =>
                  setPrefs({ ...prefs, deadlineDaysBefore: Number(e.target.value) || 14 })
                }
                className="mt-1 h-9 w-28 rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 font-mono text-sm text-[#101713] dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0]"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#101713] px-5 py-2.5 text-sm font-semibold text-[#C5F36A] hover:bg-[#1D2520] disabled:opacity-50 dark:bg-[#C5F36A] dark:text-[#101713]"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </div>
  );
}
