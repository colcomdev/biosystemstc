/**
 * IT Administration & Role-Based Access Control Portal
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * 
 * Allows super user "IT Admin" to:
 * - Create new users with assigned emails and roles
 * - Issue temporary passwords and trigger email notifications
 * - Configure permissions and MFA requirements
 * - Audit live "IT Admin Activities" security log
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Shield,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  UserCheck,
  RefreshCw,
  Lock,
  Eye,
  Check,
  Fingerprint,
} from 'lucide-react';
import { User, ITActivityLog, Role } from '../../types';
import { apiUrl } from '../../lib/api';

interface ITAdminManagementViewProps {
  currentUser: User;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'VIEW_LOGS', label: 'View Gate Audit Logs' },
  { id: 'EXPORT_AUDIT_PDF', label: 'Export PDF Reports & CSV' },
  { id: 'MANAGE_USERS', label: 'User & IT Admin Rights' },
  { id: 'EDIT_QUESTIONS', label: 'Edit Dynamic Form Questions' },
  { id: 'SYSTEM_SETTINGS', label: 'Configure System Settings' },
  { id: 'OVERRIDE_BIOSECURITY', label: 'Biosecurity Incident Override' },
];

export const ITAdminManagementView: React.FC<ITAdminManagementViewProps> = ({ currentUser }) => {
  const isItAdmin = currentUser.role === 'IT_ADMIN';

  const [users, setUsers] = useState<User[]>([]);
  const [itLogs, setItLogs] = useState<ITActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'activities'>('users');

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('SECURITY_MANAGER');
  const [newGate, setNewGate] = useState('MAIN_BIOSECURITY_GATE_01');
  const [newMfa, setNewMfa] = useState(false);
  const [newPermissions, setNewPermissions] = useState<string[]>(['VIEW_LOGS', 'EXPORT_AUDIT_PDF']);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [createSuccessData, setCreateSuccessData] = useState<{
    user: User;
    defaultPassword: string;
    message: string;
  } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalData, setResetModalData] = useState<{
    user: User;
    tempPassword?: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchITLogs();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/users'));
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchITLogs = async () => {
    try {
      const res = await fetch(apiUrl('/api/it-audit-logs'));
      if (res.ok) {
        setItLogs(await res.json());
      }
    } catch (err) {
      console.error('Error fetching IT logs:', err);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    setCreateError(null);

    try {
      const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          fullName: newFullName,
          email: newEmail,
          role: newRole,
          gateAssigned: newGate,
          mfaEnabled: newMfa,
          permissions: newPermissions,
          actorUsername: currentUser.username,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCreateSuccessData({
          user: data.user,
          defaultPassword: data.defaultPassword,
          message: data.message,
        });
        fetchUsers();
        fetchITLogs();
        // Reset inputs
        setNewUsername('');
        setNewFullName('');
        setNewEmail('');
      } else {
        setCreateError(data.error || 'Failed to create user account.');
      }
    } catch {
      setCreateError('Network error while creating user account.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    try {
      const res = await fetch(apiUrl(`/api/users/${targetUser.id}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorUsername: currentUser.username }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetModalData({
          user: targetUser,
          tempPassword: data.newTempPassword,
        });
        fetchITLogs();
      }
    } catch (err) {
      console.error('Password reset error:', err);
    }
  };

  const togglePermission = (permId: string) => {
    if (newPermissions.includes(permId)) {
      setNewPermissions(newPermissions.filter((p) => p !== permId));
    } else {
      setNewPermissions([...newPermissions, permId]);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const filteredLogs = itLogs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.actorUsername.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Super User Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shrink-0 shadow">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                IT Administration &amp; Access Rights Control
              </h2>
              {isItAdmin ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  SUPER USER ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  SECURITY VIEW (READ ONLY)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Super user IT Admin handles user rights, issues initial credentials, and audits all administrative activities. Security Managers can view logs.
            </p>
          </div>
        </div>

        {isItAdmin && (
          <button
            type="button"
            onClick={() => {
              setCreateSuccessData(null);
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            + Create New User &amp; Issue Credentials
          </button>
        )}
      </div>

      {/* Tabs Switcher: Users vs IT Activities */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            System User Accounts ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('activities')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'activities'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            IT Admin Activities ({itLogs.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users or audit logs..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <button
            type="button"
            onClick={() => {
              fetchUsers();
              fetchITLogs();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Refresh IT State"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* VIEW 1: SYSTEM USERS TABLE */}
      {activeSubTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">User &amp; Full Name</th>
                  <th className="p-3">Assigned Email</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">MFA Status</th>
                  <th className="p-3">Assigned Gate</th>
                  <th className="p-3">Permissions</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/50 transition">
                    <td className="p-3">
                      <div className="font-bold text-white">{u.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-400">@{u.username}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-cyan-300">
                      {u.email}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          u.role === 'IT_ADMIN'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : u.role === 'SECURITY_MANAGER'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : u.role === 'BIOSECURITY_OFFICER'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : u.role === 'GATE_OPERATOR'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.mfaEnabled ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Disabled</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {u.gateAssigned || 'ALL_GATES'}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(u.permissions || []).slice(0, 3).map((p, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-1.5 py-0.2 bg-slate-950 border border-slate-800 rounded text-slate-300"
                          >
                            {p}
                          </span>
                        ))}
                        {(u.permissions || []).length > 3 && (
                          <span className="text-[9px] text-slate-500">
                            +{(u.permissions || []).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {isItAdmin && (
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1 border border-slate-700"
                          title="Reset temporary password & notify via email"
                        >
                          <KeyRound className="w-3 h-3 text-amber-400" />
                          Reset Password
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: IT ADMIN ACTIVITIES AUDIT LOG */}
      {activeSubTab === 'activities' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              IT System &amp; Administrative Activities Log
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Immutable Security Event Stream
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Event Details</th>
                  <th className="p-3">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition">
                    <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-300 whitespace-nowrap">
                      @{log.actorUsername}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-950 border border-slate-800 text-amber-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 max-w-md text-slate-200">
                      {log.details}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-cyan-300 whitespace-nowrap">
                      {log.targetUser || 'SYSTEM'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER & PROVISION CREDENTIALS */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Create User &amp; Assign IT Rights
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {createSuccessData ? (
                <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>User Created Successfully!</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    User <span className="font-bold text-white">{createSuccessData.user.fullName}</span> has been provisioned with role <span className="font-mono text-cyan-300">{createSuccessData.user.role}</span>.
                  </p>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono space-y-1">
                    <div className="text-slate-400 text-[10px]">Assigned Username:</div>
                    <div className="text-white font-bold">{createSuccessData.user.username}</div>
                    <div className="text-slate-400 text-[10px] pt-1">Default Temporary Password:</div>
                    <div className="text-amber-400 text-sm font-bold tracking-wider">{createSuccessData.defaultPassword}</div>
                    <div className="text-slate-400 text-[10px] pt-1">Assigned Email:</div>
                    <div className="text-cyan-300">{createSuccessData.user.email}</div>
                  </div>
                  <p className="text-[11px] text-emerald-200">
                    A confirmation email was dispatched. The user must sign in and change their temporary password upon first login.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreateSuccessData(null);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateUserSubmit} className="space-y-3">
                  {createError && (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="e.g. Tendai Chikore"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Username <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="e.g. tchikore"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Assigned Role <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as Role)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500"
                      >
                        <option value="SECURITY_MANAGER">Security Manager</option>
                        <option value="BIOSECURITY_OFFICER">Biosecurity Officer</option>
                        <option value="GATE_OPERATOR">Gate Operator</option>
                        <option value="AUDITOR">Auditor</option>
                        <option value="IT_ADMIN">IT Admin (Super User)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      User Email (Confirmation &amp; Credentials Dispatch) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. mcharumbira@colcom.co.zw"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Assigned Biosecurity Facility / Gate
                    </label>
                    <input
                      type="text"
                      value={newGate}
                      onChange={(e) => setNewGate(e.target.value)}
                      placeholder="MAIN_BIOSECURITY_GATE_01"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="newMfa"
                      checked={newMfa}
                      onChange={(e) => setNewMfa(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="newMfa" className="text-slate-300 font-medium">
                      Require Two-Factor Email MFA for this account
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      Assigned Security Permissions:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={newPermissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="rounded border-slate-700 text-indigo-600"
                          />
                          <span className="text-[11px] text-slate-300">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isSubmittingUser}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow"
                    >
                      {isSubmittingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Create User &amp; Dispatch Credentials Email
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD NOTICE */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <KeyRound className="w-5 h-5" />
              <span>Temporary Password Issued</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Temporary credentials have been generated for user <span className="font-bold text-white">{resetModalData.user.fullName}</span> and dispatched to <span className="font-mono text-cyan-300">{resetModalData.user.email}</span>:
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-center">
              <span className="text-[10px] text-slate-500 block uppercase">New Temporary Password</span>
              <span className="text-lg font-bold text-amber-400 tracking-wider">
                {resetModalData.tempPassword}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              User will be forced to change this password on their next sign in attempt.
            </p>
            <button
              type="button"
              onClick={() => setResetModalData(null)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
            >
              Acknowledge &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
