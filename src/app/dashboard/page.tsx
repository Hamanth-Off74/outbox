'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import { LogOut, Send, Calendar, Clock, AlertTriangle, ShieldAlert, Search, RefreshCw, Plus, FileText, CheckCircle2, XCircle, Mail, Database, Layers, ExternalLink, Activity } from 'lucide-react';

interface Email {
  id: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED';
  subject: string;
  body: string;
  recipient: string;
  senderId: string;
  scheduledAt: string;
  sentAt?: string | null;
  jobId?: string | null;
  error?: string | null;
  etherealUrl?: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // App states
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [senderId, setSenderId] = useState<string | null>(null);

  // Compose Modal states
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('5');
  const [hourlyLimit, setHourlyLimit] = useState('10');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch or upsert sender on login to get senderId
  useEffect(() => {
    const emailAddress = session?.user?.email;
    if (emailAddress) {
      fetch(`${BACKEND_URL}/api/senders/email/${emailAddress}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.id) {
            setSenderId(data.id);
          }
        })
        .catch((err) => console.error('Failed to sync sender:', err));
    }
  }, [session, BACKEND_URL]);

  // Load emails function
  const fetchEmails = async (search = '') => {
    setIsLoading(true);
    setErrorText(null);
    try {
      let url = `${BACKEND_URL}/api/emails`;
      if (search.trim()) {
        url = `${BACKEND_URL}/api/emails/search?q=${encodeURIComponent(search)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch emails (${res.status}): ${text}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmails(data);
      } else {
        setEmails([]);
      }
    } catch (err: any) {
      let errorMsg = 'An error occurred while loading emails.';
      if (err) {
        if (typeof err === 'string') errorMsg = err;
        else if (err.message && typeof err.message === 'string') errorMsg = err.message;
        else errorMsg = JSON.stringify(err);
      }
      setErrorText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch emails on tab mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchEmails();
    }
  }, [status]);

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    fetchEmails(searchQuery).finally(() => setIsSearching(false));
  };

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const rows = content.split('\n');
        const emailsFromCsv: string[] = [];
        rows.forEach((row) => {
          const columns = row.split(/[,;\t]/);
          columns.forEach((cell) => {
            const clean = cell.trim();
            if (clean.includes('@') && clean.includes('.')) {
              emailsFromCsv.push(clean);
            }
          });
        });

        if (emailsFromCsv.length > 0) {
          const combined = Array.from(new Set([...parsedRecipients, ...emailsFromCsv]));
          setRecipientInput(combined.join(', '));
        }
      }
    };
    reader.readAsText(file);
  };

  // Parse recipient CSV list client-side
  useEffect(() => {
    const list = recipientInput
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@') && e.includes('.'));
    setParsedRecipients(list);
  }, [recipientInput]);

  // Submit Schedule Batch
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId) {
      alert('Sender ID not loaded yet. Please wait a moment.');
      return;
    }
    if (parsedRecipients.length === 0) {
      alert('Please enter at least one valid recipient email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledDate = startTime ? new Date(startTime) : new Date(Date.now() + 5000);
      const payload = {
        subject,
        body,
        recipients: parsedRecipients,
        senderId,
        scheduledAt: scheduledDate.toISOString(),
        delayBetweenEmailsMs: parseInt(delaySeconds, 10) * 1000,
        hourlyLimit: parseInt(hourlyLimit, 10),
      };

      const res = await fetch(`${BACKEND_URL}/api/emails/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to schedule emails.');
      }

      // Reset form
      setSubject('');
      setBody('');
      setRecipientInput('');
      setIsComposeOpen(false);
      fetchEmails();
    } catch (err: any) {
      alert(`Error scheduling emails: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connect Slack Action
  const handleConnectSlack = () => {
    if (!senderId) return;
    window.location.href = `${BACKEND_URL}/api/auth/slack/connect?tenantId=${senderId}`;
  };

  // Filtered lists for tabs
  const scheduledEmails = emails.filter((e) => e.status === 'SCHEDULED');
  const sentEmails = emails.filter((e) => e.status === 'SENT' || e.status === 'FAILED');

  // Stats calculation
  const totalScheduledCount = scheduledEmails.length;
  const totalSentCount = emails.filter((e) => e.status === 'SENT').length;
  const totalFailedCount = emails.filter((e) => e.status === 'FAILED').length;

  // Table Columns Setup
  const columns = [
    {
      key: 'recipient',
      label: 'Recipient',
      render: (val: string) => (
        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-indigo-500" />
          {val}
        </span>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (val: string) => <span className="text-slate-700 font-medium truncate max-w-xs">{val}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val: string, row: Email) => {
        if (val === 'SENT') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Sent
            </span>
          );
        } else if (val === 'FAILED') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20" title={row.error || 'Job failed'}>
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              Failed
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Scheduled
            </span>
          );
        }
      },
    },
    {
      key: 'scheduledAt',
      label: 'Scheduled Time',
      render: (val: string) => <span className="text-xs text-slate-600 font-medium">{new Date(val).toLocaleString()}</span>,
    },
    {
      key: 'sentAt',
      label: 'Processed Time',
      render: (val: any) => <span className="text-xs text-slate-600">{val ? new Date(val).toLocaleString() : '-'}</span>,
    },
    {
      key: 'jobId',
      label: 'BullMQ Job ID',
      render: (val: any) => <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px] block">{val || '-'}</span>,
    },
    {
      key: 'etherealUrl',
      label: 'Ethereal Mail Preview',
      render: (val: any) =>
        val ? (
          <a
            href={val}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
          >
            <span>View Preview</span>
            <ExternalLink className="w-3 h-3 text-indigo-500" />
          </a>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        ),
    },
  ];

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-600/30">
                <Send className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox Outbox</span>
              
              <span className="hidden sm:inline-flex items-center gap-1.5 ml-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Systems Online
              </span>
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 border-r border-slate-800 pr-4">
                {session?.user?.image ? (
                  <img
                    className="h-9 w-9 rounded-full border border-slate-700"
                    src={session.user.image}
                    alt={session.user.name || 'User Avatar'}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/30">
                    {session?.user?.name?.[0] || session?.user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-slate-100">{session?.user?.name || 'User Account'}</p>
                  <p className="text-xs text-slate-400">{session?.user?.email}</p>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="inline-flex items-center text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Banner Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />

          <div className="space-y-1 z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]} 👋
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Schedule bulk email campaigns with atomic concurrency rate limiting, BullMQ queue dispatching, and Slack limit warnings.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 z-10">
            <Button variant="outline" onClick={handleConnectSlack} className="flex items-center gap-2 bg-[#4A154B] text-white border-transparent hover:bg-[#3D113E] shadow-lg shadow-[#4A154B]/20">
              {/* Slack SVG Icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042zM8.823 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.522v2.52h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.52-2.522V8.824a2.528 2.528 0 0 1 2.52-2.52h5.043zm10.135 3.78a2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.78a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm-2.52 10.135a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.52zm0-1.262a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52h-5.043z" />
              </svg>
              Connect Slack Alerts
            </Button>
            <Button onClick={() => setIsComposeOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30">
              <Plus className="w-4 h-4" />
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Scheduled Queue</p>
              <p className="text-2xl font-bold text-white">{totalScheduledCount}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Sent Emails</p>
              <p className="text-2xl font-bold text-white">{totalSentCount}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Failed / Retrying</p>
              <p className="text-2xl font-bold text-white">{totalFailedCount}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Worker Concurrency</p>
              <p className="text-2xl font-bold text-white">5 Threads</p>
            </div>
          </div>

        </div>

        {/* Dashboard Controls (Tabs + Search) */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-lg">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800 sm:border-b-0 space-x-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`pb-2 sm:pb-0 px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Scheduled Emails
              <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'scheduled' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {scheduledEmails.length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('sent')}
              className={`pb-2 sm:pb-0 px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Sent & Processed
              <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'sent' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Fuzzy search subject/body/status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={isSearching} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                fetchEmails('');
              }}
              title="Refresh Queue"
              className="p-2 border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </form>

        </div>

        {/* Content Table Container */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto" />
              <p className="text-sm text-slate-400">Loading campaign queue records...</p>
            </div>
          ) : errorText ? (
            <div className="py-12 px-6 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-400">{errorText}</p>
              <Button onClick={() => fetchEmails()} variant="secondary">
                Retry Connection
              </Button>
            </div>
          ) : (
            <Table
              columns={columns}
              data={activeTab === 'scheduled' ? scheduledEmails : sentEmails}
            />
          )}
        </div>

      </main>

      {/* Compose Email Modal */}
      <Modal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        title="Schedule Bulk Email Campaign"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Special Invitation for Outbox Preview"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recipients (Comma-separated or CSV Upload)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                <FileText className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              required
              rows={3}
              placeholder="alex@domain.com, sarah@domain.com, john@domain.com"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
            />
            {parsedRecipients.length > 0 && (
              <p className="mt-1 text-xs text-indigo-400 font-medium">
                ✓ {parsedRecipients.length} valid recipient(s) parsed
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Body (HTML / Text)
            </label>
            <textarea
              required
              rows={4}
              placeholder="Type your campaign message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Delay (Seconds)
              </label>
              <input
                type="number"
                min="0"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Hourly Limit
              </label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsComposeOpen(false)}
              className="border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Schedule Campaign
                </>
              )}
            </Button>
          </div>

        </form>
      </Modal>

    </div>
  );
}
