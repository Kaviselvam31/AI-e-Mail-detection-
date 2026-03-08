
import React, { useState, useEffect, useMemo } from 'react';
import { analyzeEmail } from './services/geminiService';
import { Label, AnalysisResult, EmailData, HistoryItem } from './types';
import ResultDisplay from './components/ResultDisplay';
import AnalyticsDashboard from './components/AnalyticsDashboard';

type SortKey = keyof HistoryItem;
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shield Base */}
    <path 
      d="M50 5 L90 25 V55 C90 75 70 90 50 95 C30 90 10 75 10 55 V25 L50 5Z" 
      fill="#1E3A8A" 
      stroke="#94A3B8" 
      strokeWidth="2"
    />
    {/* Eagle Eye Orbit */}
    <circle cx="50" cy="45" r="22" fill="#334155" />
    <circle cx="50" cy="45" r="18" fill="#94A3B8" />
    {/* Pupil (Eagle Eye) */}
    <circle cx="50" cy="45" r="10" fill="#1E3A8A" />
    {/* Glint/Reflection */}
    <path 
      d="M44 41 Q50 35 56 41" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
    />
    <circle cx="55" cy="43" r="2" fill="white" />
  </svg>
);

const App: React.FC = () => {
  const [emailData, setEmailData] = useState<EmailData>({ sender: '', subject: '', body: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'timestamp', direction: 'desc' });
  const [historyLimit, setHistoryLimit] = useState<number>(50);
  const [bodyFontSize, setBodyFontSize] = useState<number>(14);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('sham_history');
    if (savedHistory) { 
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedLimit = localStorage.getItem('sham_history_limit');
    if (savedLimit) {
      setHistoryLimit(parseInt(savedLimit, 10) || 50);
    }

    const savedFontSize = localStorage.getItem('sham_body_font_size');
    if (savedFontSize) {
      setBodyFontSize(parseInt(savedFontSize, 10) || 14);
    }
  }, []);

  // Save history when it changes
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('sham_history', JSON.stringify(newHistory));
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const newLimit = isNaN(val) ? 1 : Math.max(1, val);
    setHistoryLimit(newLimit);
    localStorage.setItem('sham_history_limit', newLimit.toString());
    
    if (history.length > newLimit) {
      saveHistory(history.slice(0, newLimit));
    }
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const newSize = isNaN(val) ? 12 : Math.min(32, Math.max(10, val));
    setBodyFontSize(newSize);
    localStorage.setItem('sham_body_font_size', newSize.toString());
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailData.body.trim()) {
      setError("Email body is required for analysis.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const analysis = await analyzeEmail(emailData);
      setResult(analysis);

      // Add to history and apply limit
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        sender: emailData.sender || '(Unknown Sender)',
        subject: emailData.subject || '(No Subject)',
        body: emailData.body,
        label: analysis.label,
        timestamp: Date.now(),
        result: analysis,
      };
      saveHistory([newItem, ...history].slice(0, historyLimit));
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEmailData(prev => ({ ...prev, [name]: value }));
  };

  const fillExample = (sender: string, subject: string, body: string) => {
    setEmailData({ sender, subject, body });
    setResult(null);
    setError(null);
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your history?")) {
      saveHistory([]);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const previewHistoryItem = (item: HistoryItem) => {
    setEmailData({ sender: item.sender || '', subject: item.subject, body: item.body || '' });
    if (item.result) {
      setResult(item.result);
    } else {
      setResult(null);
      setError("This history item was created before the preview feature was enabled and doesn't have saved analysis data.");
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sortedHistory = useMemo(() => {
    const sortableHistory = [...history];
    return sortableHistory.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [history, sortConfig]);

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) {
      return (
        <svg className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortConfig.direction === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        )}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-blue-500/30">
      {/* Header with Sham Logo (Deep Blue & Silver) */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-slate-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-800">
                <Logo />
              </div>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-black text-xl tracking-tighter text-white">SHAM</span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">AI Security</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                title="Settings"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shield Active</span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-12">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 bg-slate-900 border border-blue-900/50 p-6 rounded-3xl animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-6">Application Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex-1">
                <label htmlFor="historyLimit" className="block text-xs font-semibold text-slate-400 mb-2">Max History Items</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    id="historyLimitRange"
                    min="1" 
                    max="200" 
                    value={historyLimit} 
                    onChange={handleLimitChange}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="w-12 text-sm font-mono text-center text-slate-300">{historyLimit}</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 italic">
                  Controls how many recent scans are kept in your local activity log.
                </p>
              </div>

              <div className="flex-1">
                <label htmlFor="bodyFontSize" className="block text-xs font-semibold text-slate-400 mb-2">Email Body Font Size (px)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    id="bodyFontSizeRange"
                    min="10" 
                    max="32" 
                    value={bodyFontSize} 
                    onChange={handleFontSizeChange}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="w-12 text-sm font-mono text-center text-slate-300">{bodyFontSize}px</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 italic">
                  Adjust the text size of the input area for better readability of long emails.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Stop Phishing with <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-slate-400">Eagle-Eye</span> Precision
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Sham scans your communications with sophisticated AI to identify malicious intent, tracking silver-standard security markers in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Analysis Form */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-blue-900 via-slate-500 to-blue-800"></div>
            <form onSubmit={handleAnalyze} className="p-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="sender" className="block text-sm font-semibold text-white mb-2">
                      Sender Email
                    </label>
                    <input
                      type="text"
                      id="sender"
                      name="sender"
                      value={emailData.sender}
                      onChange={handleInputChange}
                      placeholder="e.g., security@bank-verify.com"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500 text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-semibold text-white mb-2">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={emailData.subject}
                      onChange={handleInputChange}
                      placeholder="e.g., Security Update: Please Verify Your Access"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500 text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-semibold text-white mb-2">
                    Email Body
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={6}
                    value={emailData.body}
                    onChange={handleInputChange}
                    placeholder="Paste the full content of the email here..."
                    style={{ fontSize: `${bodyFontSize}px` }}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500 font-mono leading-relaxed text-slate-100"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scanning...
                      </>
                    ) : (
                      <>
                        Email Scan
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailData({ subject: '', body: '' })}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 font-bold px-4 py-3 transition-colors group"
                  >
                    <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Quick Examples */}
          <section className="flex flex-wrap gap-3 justify-center mb-4">
            <span className="text-[10px] font-black text-slate-500 self-center mr-2 uppercase tracking-[0.2em]">Scenario Bench:</span>
            <button
              onClick={() => fillExample("no-reply@amazon-gift.co", "Win $500 Gift Card!", "Congratulations! You have been selected to win a free $500 Amazon Gift Card. Click here to claim: bit.ly/scam-link-99. Act fast, offer ends in 2 hours!")}
              className="px-3 py-1.5 bg-slate-900 text-red-400 border border-red-900/50 rounded-full text-xs font-bold hover:bg-red-900/20 transition-all"
            >
              Phishing
            </button>
            <button
              onClick={() => fillExample("john.doe@company.com", "Project Update - Q3 Roadmap", "Hi Team, attached is the latest roadmap for the Q3 feature release. Please review and let me know if you have any feedback by Friday. Best, John.")}
              className="px-3 py-1.5 bg-slate-900 text-blue-400 border border-blue-900/50 rounded-full text-xs font-bold hover:bg-blue-900/20 transition-all"
            >
              Business (HAM)
            </button>
          </section>

          {/* Error Message */}
          {error && (
            <div className="bg-red-950/20 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Result Display */}
          {result && <ResultDisplay result={result} emailData={emailData} />}

          {/* Analytics Dashboard */}
          <AnalyticsDashboard history={history} />

          {/* History Section */}
          {history.length > 0 && (
            <section className="mt-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6" />
                  </svg>
                  Search History
                </h2>
                <button 
                  onClick={clearHistory}
                  className="text-xs font-semibold text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                >
                  Clear History
                </button>
              </div>
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/30 border-b border-slate-800">
                        <th 
                          onClick={() => handleSort('sender')}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            Sender
                            <SortIndicator column="sender" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('subject')}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            Subject
                            <SortIndicator column="subject" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('label')}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            Classification
                            <SortIndicator column="label" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('timestamp')}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            Date
                            <SortIndicator column="timestamp" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sortedHistory.map((item) => (
                        <tr 
                          key={item.id} 
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group/row"
                          onClick={() => previewHistoryItem(item)}
                        >
                          <td className="px-6 py-4">
                            <div className="text-xs font-medium text-slate-400 group-hover/row:text-slate-200 transition-colors truncate max-w-[120px]">
                              {item.sender}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <svg className="w-4 h-4 text-slate-600 group-hover/row:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <div className="text-sm font-medium text-slate-300 group-hover/row:text-white transition-colors line-clamp-1 max-w-xs sm:max-w-md">
                                {item.subject}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              item.label === Label.SPAM 
                                ? 'bg-red-900/30 text-red-400' 
                                : 'bg-green-900/30 text-green-400'
                            }`}>
                              {item.label === Label.SPAM ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              )}
                              {item.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                                {formatTimestamp(item.timestamp)}
                              </div>
                              <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto px-4 mt-16 pt-8 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h4 className="font-bold text-white mb-2">Deep Blue Vigilance</h4>
            <p className="text-sm text-slate-500">Sophisticated AI pattern recognition provides iron-clad defense against phishing attempts.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-2">Privacy Shield</h4>
            <p className="text-sm text-slate-500">Your email contents are analyzed in real-time and never persisted to long-term storage.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-2">Silver-Grade Quality</h4>
            <p className="text-sm text-slate-500">Powered by Gemini 3 Flash for the fastest and most reliable classification available.</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <Logo className="w-8 h-8 opacity-20 grayscale" />
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">
            &copy; {new Date().getFullYear()} SHAM AI SECURITY &bull; GUARDING THE DIGITAL FRONTIER
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
