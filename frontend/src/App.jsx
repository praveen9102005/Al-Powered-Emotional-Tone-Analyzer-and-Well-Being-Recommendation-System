  import React, { useEffect, useState } from 'react';
  import {
    Activity,
    ArrowRight,
    BarChart3,
    Clock3,
    FileUp,
    LayoutDashboard,
    TrendingUp,
    Brain,
    Check,
    CircleHelp,
    FileText,
    Heart,
    History,
    LogOut,
    Search,
    Download,
    UserRound,
    Save,
    Menu,
    MessageSquareText,
    ShieldCheck,
    Sparkles,
    UploadCloud,
    UserPlus,
    X,
  } from 'lucide-react';
  import Papa from 'papaparse';
  import { api } from './api';

  const initialResult = null;

  function App() {
    const [page, setPage] = useState('home');
    const [authMode, setAuthMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [user, setUser] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem('mm_user'));
      } catch {
        return null;
      }
    });

    const [token, setToken] = useState(
      () => localStorage.getItem('mm_token') || ''
    );

    const [text, setText] = useState(
      'I had a challenging morning, but I am proud that I stayed patient and finished my work.'
    );

    const [result, setResult] = useState(initialResult);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [history, setHistory] = useState([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historySentiment, setHistorySentiment] = useState('all');
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profileBusy, setProfileBusy] = useState(false);
    const [batchRows, setBatchRows] = useState([]);
    const [batchResults, setBatchResults] = useState([]);
    const [batchProgress, setBatchProgress] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
      if (token) {
        api('/history', { token }).then(setHistory).catch(() => {});
        api('/auth/me', { token })
          .then((profile) => {
            setProfileName(profile.name || '');
            setProfileEmail(profile.email || '');
            setUser(profile);
            localStorage.setItem('mm_user', JSON.stringify(profile));
          })
          .catch(() => {});
      }
    }, [token]);

    function go(next) {
      setPage(next);
      setMobileOpen(false);
      setError('');
      setNotice('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function submitAuth(e) {
      e.preventDefault();
      setBusy(true);
      setError('');
      setNotice('');

      try {
        const data = await api(
          authMode === 'register'
            ? '/auth/register'
            : '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify(
              authMode === 'register'
                ? { name, email, password }
                : { email, password }
            ),
          }
        );

        setToken(data.access_token);
        setUser(data.user);

        localStorage.setItem('mm_token', data.access_token);
        localStorage.setItem('mm_user', JSON.stringify(data.user));

        setPassword('');
        go('dashboard');

        setNotice(
          `Welcome${
            data.user?.name
              ? `, ${data.user.name.split(' ')[0]}`
              : ''
          }! You are signed in.`
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }

    function signOut() {
      setToken('');
      setUser(null);
      setHistory([]);

      localStorage.removeItem('mm_token');
      localStorage.removeItem('mm_user');

      go('home');
    }

    async function analyze() {
      setError('');
      setNotice('');
      setResult(null);
      setBatchResults([]);

      if (batchRows.length > 0) {
        setBusy(true);
        try {
          const formData = new FormData();
          const csvContent = Papa.unparse({
            fields: ['text'],
            data: batchRows.map((row) => [row.text]),
          });
          formData.append('file', new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), 'moodmentor-upload.csv');
          const data = await api('/analyze/csv', { method: 'POST', token, body: formData });
          setBatchResults(data.results || []);
          setBatchProgress({
            total: data.total_rows ?? (data.results || []).length,
            successful: data.successful ?? 0,
            failed: data.failed ?? 0,
          });
          setNotice(`CSV analysis completed: ${data.successful ?? 0} successful, ${data.failed ?? 0} failed.`);
          if (token) api('/history', { token }).then(setHistory).catch(() => {});
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
        return;
      }

      if (!text.trim()) {
        setError('Please enter some text before analyzing.');
        return;
      }

      if (text.length > 20000) {
        setError('Please keep your text under 20,000 characters.');
        return;
      }

      setBusy(true);

      try {
        const data = await api('/analyze', {
          method: 'POST',
          token,
          body: JSON.stringify({ text, source: 'text' }),
        });

        setResult(data);

        if (token) {
          setHistory((old) =>
            [data, ...old.filter((x) => x.id !== data.id)].slice(0, 50)
          );
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }

    async function handleFile(file) {
      setError('');
      setNotice('');
      setBatchRows([]);
      setBatchResults([]);
      setBatchProgress(null);
      if (!file) return;

      const ext = file.name.split('.').pop().toLowerCase();
      if (!['txt', 'csv'].includes(ext)) {
        setError('Please upload a .txt or .csv file.');
        return;
      }
      if (file.size > 1024 * 1024) {
        setError('Please choose a file smaller than 1 MB.');
        return;
      }

      try {
        const content = await file.text();
        if (ext === 'csv') {
          const parsed = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''),
          });
          const fields = parsed.meta?.fields || [];
          const textHeader = fields.find((field) => field.trim().toLowerCase() === 'text');
          if (!textHeader) {
            setError("Your CSV must contain a column named 'text'. Example: text");
            return;
          }
          const rows = parsed.data.map((row, index) => ({
            rowNumber: index + 2,
            text: String(row[textHeader] ?? '').trim(),
          })).filter((row) => row.text.length > 0);

          if (!rows.length) {
            setError("No non-empty text rows found in the CSV's 'text' column.");
            return;
          }
          if (rows.length > 1000) {
            setError('Please upload a CSV containing no more than 1,000 non-empty text rows.');
            return;
          }
          setBatchRows(rows);
          setText(rows.slice(0, 5).map((row) => row.text).join('\n\n') +
            (rows.length > 5 ? `\n\n…and ${rows.length - 5} more rows.` : ''));
          setResult(null);
          go('analyzer');
          setNotice(`${file.name} loaded: ${rows.length} text rows ready for individual analysis. Select Analyze sentiment to process every row.`);
          return;
        }

        if (!content.trim()) {
          setError('This file appears to be empty. Add text and try again.');
          return;
        }
        setText(content.slice(0, 20000));
        setResult(null);
        setBatchRows([]);
        go('analyzer');
        setNotice(`${file.name} loaded. Review the text, then select Analyze sentiment.`);
      } catch {
        setError('Could not read this file. Please try another .txt or .csv file.');
      }
    }

    async function saveProfile(e) {
      e.preventDefault();
      setError('');
      setNotice('');
      setProfileBusy(true);
      try {
        const updated = await api('/auth/me', {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            name: profileName.trim(),
            email: profileEmail.trim(),
          }),
        });
        setUser(updated);
        setProfileName(updated.name || '');
        setProfileEmail(updated.email || '');
        localStorage.setItem('mm_user', JSON.stringify(updated));
        setNotice('Profile updated successfully.');
      } catch (err) {
        setError(err.message);
      } finally {
        setProfileBusy(false);
      }
    }

    function downloadSingleReport(item = result) {
      if (!item) return;
      const report = [{
        id: item.id ?? '',
        text: item.original_text ?? text,
        sentiment: item.sentiment ?? '',
        positive: item.positive ?? '',
        neutral: item.neutral ?? '',
        negative: item.negative ?? '',
        compound: item.compound ?? '',
        token_count: item.token_count ?? '',
        processed_text: item.processed_text ?? '',
        created_at: item.created_at ?? new Date().toISOString(),
      }];
      const csv = Papa.unparse(report);
      const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'emotisense-analysis-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    }

    const filteredHistory = history.filter((item) => {
      const query = historySearch.trim().toLowerCase();
      const matchesSearch = !query ||
        String(item.original_text || '').toLowerCase().includes(query) ||
        String(item.sentiment || '').toLowerCase().includes(query);
      const matchesSentiment = historySentiment === 'all' || item.sentiment === historySentiment;
      return matchesSearch && matchesSentiment;
    });

    const sentimentColor =
      result?.sentiment === 'positive'
        ? 'green'
        : result?.sentiment === 'negative'
          ? 'rose'
          : 'blue';

    // Resolve the user's display name from the existing login response.
    const displayName =
      user?.name ||
      user?.full_name ||
      user?.fullName ||
      '';

    const dashboardStats = {
      total: history.length,
      positive: history.filter((item) => item.sentiment === 'positive').length,
      neutral: history.filter((item) => item.sentiment === 'neutral').length,
      negative: history.filter((item) => item.sentiment === 'negative').length,
      average: history.length
        ? history.reduce((sum, item) => sum + Number(item.compound || 0), 0) / history.length
        : 0,
    };
    const sentimentTotal = Math.max(dashboardStats.total, 1);

    return (
      <div className="app-shell">
        <header className="topbar">
          <button
            className="brand"
            onClick={() => go('home')}
            aria-label="MoodMentor home"
          >
            <span className="brand-mark">
             <Sparkles size={22} />
            </span>

            <span>
              Emoti<span className="brand-blue">Sense</span>
              <small>EMOTIONAL WELLNESS, WITH INSIGHT</small>
            </span>
          </button>

          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>

          <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
            <button
              onClick={() => go('home')}
              className={page === 'home' ? 'nav-active' : ''}
            >
              Overview
            </button>

            <button
              onClick={() => go('analyzer')}
              className={page === 'analyzer' ? 'nav-active' : ''}
            >
              Text analyzer
            </button>


            {token && (
              <button
                onClick={() => go('history')}
                className={page === 'history' ? 'nav-active' : ''}
              >
                My history
              </button>
            )}

            {user ? (
              <>
                {/* Logged-in user's full name */}
                <button
                  type="button"
                  className={`navbar-user-name ${page === 'dashboard' ? 'nav-active' : ''}`}
                  title={`Open ${displayName || 'your'} dashboard`}
                  onClick={() => go('dashboard')}
                  aria-label={`Open dashboard for ${displayName || 'user'}`}
                >
                  {displayName || 'User'}
                </button>

                <button className="nav-user" onClick={signOut}>
                  <LogOut size={16} />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  className="nav-login"
                  onClick={() => {
                    setAuthMode('login');
                    go('auth');
                  }}
                >

                </button>

                <button
                  className="btn btn-primary nav-cta"
                  onClick={() => {
                    setAuthMode('register');
                    go('auth');
                  }}
                >
                  Get started <ArrowRight size={16} />
                </button>
              </>
            )}
          </nav>
        </header>

        <main>
          {page === 'home' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="pulse-dot" />
                    YOUR SPACE FOR SELF-REFLECTION
                  </div>

                  <h1>
                    Understand the feeling
                    <br />
                    behind your <span className="gradient-text">words.</span>
                  </h1>

                  <p className="hero-lede">
                    A little more clarity starts with a few words.
                    EmotiSense analyzes the emotional tone of your writing
                    and helps you pause, reflect, and understand the sentiment.
                  </p>

                  <div className="hero-actions">
                    <button
                      className="btn btn-primary btn-large"
                      onClick={() => go('analyzer')}
                    >
                      Analyze your text <ArrowRight size={18} />
                    </button>

                    <button
                      className="btn btn-secondary btn-large"
                      onClick={() => {
                        setAuthMode('register');
                        go('auth');
                      }}
                    >
                      <UserPlus size={17} />
                      Create free account
                    </button>
                  </div>

                  <div className="trust-row">
                    <span>
                      <ShieldCheck size={17} />
                      Private by design
                    </span>

                    <span>
                      <Activity size={17} />
                      Evidence-based baseline
                    </span>
                  </div>
                </div>

                <div className="hero-art">
                  <div className="orb orb-one" />
                  <div className="orb orb-two" />

                  <div className="floating-card mini-card">
                    <span className="mini-icon lavender">
                      <Heart size={17} />
                    </span>
                    <span>
                      <b>Take a moment</b>
                      <small>Your feelings deserve attention.</small>
                    </span>
                  </div>

                  <div className="analysis-preview">
                    <div className="preview-top">
                      <div>
                        <span className="preview-kicker">SAMPLE INSIGHT</span>
                        <h3>Today's reflection</h3>
                      </div>

                      <span className="preview-badge">
                        <Sparkles size={14} />
                        AI insight
                      </span>
                    </div>

                    <p className="sample-quote">
                      “I feel hopeful about what comes next, even if today was difficult.”
                    </p>

                    <div className="preview-sentiment">
                      <span className="sentiment-dot" />
                      <b>Positive tone</b>
                      <span className="score-pill">+0.72</span>
                    </div>

                    <div className="meter-row">
                      <span>Positive</span>
                      <div className="meter">
                        <i style={{ width: '72%' }} />
                      </div>
                      <b>72%</b>
                    </div>

                    <div className="meter-row neutral-meter">
                      <span>Neutral</span>
                      <div className="meter">
                        <i style={{ width: '20%' }} />
                      </div>
                      <b>20%</b>
                    </div>

                    <div className="meter-row negative-meter">
                      <span>Negative</span>
                      <div className="meter">
                        <i style={{ width: '8%' }} />
                      </div>
                      <b>8%</b>
                    </div>

                    <div className="preview-foot">
                      <span>
                        <Check size={14} />
                        A moment of awareness
                      </span>
                      <span>Sample data</span>
                    </div>
                  </div>

                  <div className="floating-card bottom-card">
                    <span className="mini-icon mint">
                      <Activity size={17} />
                    </span>
                    <span>
                      <b>Small steps count</b>
                      <small>Make space to check in.</small>
                    </span>
                  </div>
                </div>
              </section>

              <section className="feature-strip">
                <div className="feature">
                  <span className="feature-icon icon-blue">
                    <MessageSquareText />
                  </span>
                  <div>
                    <b>Write naturally</b>
                    <p>Paste a journal entry, message, or reflection.</p>
                  </div>
                </div>

                <div className="feature">
                  <span className="feature-icon icon-purple">
                    <Brain />
                  </span>
                  <div>
                    <b>Explore the tone</b>
                    <p>See positive, neutral, and negative sentiment.</p>
                  </div>
                </div>

                <div className="feature">
                  <span className="feature-icon icon-teal">
                    <Heart />
                  </span>
                  <div>
                    <b>Reflect with care</b>
                    <p>Use insights as a starting point, not a label.</p>
                  </div>
                </div>
              </section>

              <section className="how-section">
                <div className="section-heading">
                  <span className="eyebrow">SIMPLE BY DESIGN</span>
                  <h2>Three steps to a clearer picture</h2>
                  <p>No complicated setup. Just words, context, and a moment to reflect.</p>
                </div>

                <div className="steps-grid">
                  <div className="step-card">
                    <span className="step-number">01</span>
                    <FileText className="step-icon" />
                    <h3>Share your text</h3>
                    <p>Type or upload a .txt or .csv file with the words you want to explore.</p>
                  </div>

                  <div className="step-card">
                    <span className="step-number">02</span>
                    <Activity className="step-icon" />
                    <h3>Analyze the sentiment</h3>
                    <p>Our baseline NLP pipeline preprocesses text and scores its emotional tone.</p>
                  </div>

                  <div className="step-card">
                    <span className="step-number">03</span>
                    <Heart className="step-icon" />
                    <h3>Reflect on the result</h3>
                    <p>Review the sentiment breakdown and use it to support self-awareness.</p>
                  </div>
                </div>
              </section>

              <section className="bottom-cta">
                <div>
                  <span className="eyebrow">START WHERE YOU ARE</span>
                  <h2>Your words are worth understanding.</h2>
                  <p>Take a moment. Write a few lines. See what the baseline analysis finds.</p>
                </div>

                <button
                  className="btn btn-white btn-large"
                  onClick={() => go('analyzer')}
                >
                  Try the analyzer <ArrowRight size={18} />
                </button>
              </section>
            </>
          )}

          {page === 'auth' && (
            <section className="auth-layout">
              <div className="auth-aside">
                <span className="auth-emblem">
                  <Sparkles size={17} />
                </span>
                <span className="eyebrow">WELCOME TO EMOTISENSE </span>
                <h1>A little clarity can change your day.</h1>
                <p>
                  Make room for reflection with a thoughtful, simple view
                  of the emotional tone in your writing.
                </p>

                <div className="auth-benefit">
                  <Check size={17} /> Keep a private analysis history
                </div>
                <div className="auth-benefit">
                  <Check size={17} /> Revisit your text insights
                </div>
                <div className="auth-benefit">
                  <Check size={17} /> Built around your well-being  
                </div>
              </div>

              <div className="auth-panel">
                <div className="auth-tabs">
                  <button
                    className={authMode === 'login' ? 'selected' : ''}
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                  >
                    Log in
                  </button>

                  <button
                    className={authMode === 'register' ? 'selected' : ''}
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                  >
                    Create account
                  </button>
                </div>

                <h2>
                  {authMode === 'login'
                    ? 'Welcome back'
                    : 'Create your account'}
                </h2>

                <p className="muted">
                  {authMode === 'login'
                    ? 'Sign in to continue your reflection.'
                    : 'Start your personal reflection space today.'}
                </p>

                <form onSubmit={submitAuth}>
                  {authMode === 'register' && (
                    <label>
                      Full name
                      <input
                        required
                        minLength="2"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                      />
                    </label>
                  )}

                  <label>
                    Email address
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      required
                      minLength={authMode === 'register' ? 8 : 1}
                      autoComplete={
                        authMode === 'register'
                          ? 'new-password'
                          : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authMode === 'register'
                          ? 'At least 8 characters'
                          : 'Your password'
                      }
                    />

                    {authMode === 'register' && (
                      <small className="field-hint">
                        Use at least 8 characters.
                      </small>
                    )}
                  </label>

                  {error && <div className="alert alert-error">{error}</div>}

                  <button
                    className="btn btn-primary submit-btn"
                    disabled={busy}
                  >
                    {busy
                      ? 'Please wait…'
                      : authMode === 'login'
                        ? 'Log in securely'
                        : 'Create account'}
                    <ArrowRight size={17} />
                  </button>
                </form>

                <div className="auth-note">
                  <ShieldCheck size={16} />
                  Your password is stored as a secure hash.
                </div>
              </div>
            </section>
          )}

          {page === 'dashboard' && token && (
            <section className="dashboard-page">
              <div className="dashboard-welcome">
                <div>
                  <span className="eyebrow">PERSONAL WELLNESS OVERVIEW</span>
                  <h1>Welcome back, {displayName.split(' ')[0] || 'there'} <span className="welcome-spark">✦</span></h1>
                  <p>Your emotional insights, recent activity, and reports — all in one place.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setText(''); setResult(null); setBatchRows([]); go('analyzer'); }}>
                  <Sparkles size={17} /> New analysis
                </button>
              </div>

              <div className="dashboard-quick-grid">
                <button className="dashboard-quick-card" onClick={() => { setText(''); setResult(null); setBatchRows([]); go('analyzer'); }}>
                  <span className="quick-icon quick-purple"><MessageSquareText size={20} /></span>
                  <span><b>Analyze text</b><small>Understand a reflection</small></span><ArrowRight size={17} />
                </button>
                <button className="dashboard-quick-card" onClick={() => go('analyzer')}>
                  <span className="quick-icon quick-blue"><FileUp size={20} /></span>
                  <span><b>Batch analysis</b><small>Upload a CSV dataset</small></span><ArrowRight size={17} />
                </button>
                <button className="dashboard-quick-card" onClick={() => go('history')}>
                  <span className="quick-icon quick-green"><History size={20} /></span>
                  <span><b>View history</b><small>Revisit saved insights</small></span><ArrowRight size={17} />
                </button>
                <button className="dashboard-quick-card" onClick={() => go('profile')}>
                  <span className="quick-icon quick-orange"><UserRound size={20} /></span>
                  <span><b>Account settings</b><small>Manage your details</small></span><ArrowRight size={17} />
                </button>
              </div>

              <div className="dashboard-stat-grid">
                <article className="dashboard-stat-card"><span className="stat-icon stat-indigo"><Activity size={19} /></span><span className="stat-label">Saved analyses</span><strong>{dashboardStats.total}</strong><small>Across your recent history</small></article>
                <article className="dashboard-stat-card"><span className="stat-icon stat-green"><Heart size={19} /></span><span className="stat-label">Positive tone</span><strong>{dashboardStats.positive}</strong><small>{Math.round(dashboardStats.positive / sentimentTotal * 100)}% of saved analyses</small></article>
                <article className="dashboard-stat-card"><span className="stat-icon stat-amber"><Activity size={19} /></span><span className="stat-label">Neutral tone</span><strong>{dashboardStats.neutral}</strong><small>{Math.round(dashboardStats.neutral / sentimentTotal * 100)}% of saved analyses</small></article>
                <article className="dashboard-stat-card"><span className="stat-icon stat-rose"><TrendingUp size={19} /></span><span className="stat-label">Average compound</span><strong>{dashboardStats.total ? `${dashboardStats.average > 0 ? '+' : ''}${dashboardStats.average.toFixed(2)}` : '—'}</strong><small>Range −1.00 to +1.00</small></article>
              </div>

              <div className="dashboard-content-grid">
                <section className="dashboard-card sentiment-overview">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Sentiment overview</h2></div><span className="dashboard-heading-icon"><BarChart3 size={19} /></span></div>
                  <p className="dashboard-muted">A breakdown of sentiment labels in your saved analysis history.</p>
                  {[['Positive', dashboardStats.positive, 'positive'], ['Neutral', dashboardStats.neutral, 'neutral'], ['Negative', dashboardStats.negative, 'negative']].map(([label, value, key]) => (
                    <div className="dashboard-bar-row" key={key}><div><span>{label}</span><b>{value} <small>({Math.round(value / sentimentTotal * 100)}%)</small></b></div><div className="dashboard-bar-track"><i className={`dashboard-bar-fill ${key}`} style={{ width: `${value / sentimentTotal * 100}%` }} /></div></div>
                  ))}
                  {!history.length && <div className="dashboard-empty-note">Your chart will fill in after you sign in and save your first analysis.</div>}
                </section>

                <section className="dashboard-card recent-activity">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">LATEST RECORDS</span><h2>Recent analyses</h2></div><button className="dashboard-text-button" onClick={() => go('history')}>View all <ArrowRight size={14} /></button></div>
                  {history.slice(0, 5).length ? history.slice(0, 5).map((item) => (
                    <button className="dashboard-recent-item" key={item.id} onClick={() => { setResult({ ...item, text: item.original_text }); setText(item.original_text || ''); setBatchRows([]); go('analyzer'); }}>
                      <span className={`recent-sentiment-dot ${item.sentiment}`} />
                      <span className="recent-item-copy"><b>{(item.sentiment || 'neutral').charAt(0).toUpperCase() + (item.sentiment || 'neutral').slice(1)} sentiment</b><small>{(item.original_text || 'No text available').slice(0, 72)}{(item.original_text || '').length > 72 ? '…' : ''}</small><small><Clock3 size={12} /> {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recently'}</small></span>
                      <strong>{Number(item.compound) > 0 ? '+' : ''}{Number(item.compound || 0).toFixed(2)}</strong>
                    </button>
                  )) : <div className="dashboard-empty-state"><span><History size={23} /></span><b>No saved analyses yet</b><p>Start with a short reflection to see your insights here.</p><button className="btn btn-primary" onClick={() => go('analyzer')}>Start analyzing</button></div>}
                </section>
              </div>

              <div className="dashboard-footer-note"><ShieldCheck size={16} /><span>Your insights are personal. Sentiment scores are language estimates, not a diagnosis.</span><button onClick={() => go('profile')}>Manage account</button></div>
            </section>
          )}

          {page === 'analyzer' && (
            <section className="workspace">
              <div className="page-intro">
                <span className="eyebrow"> BASELINE NLP</span>
                <h1>Text sentiment analyzer</h1>
                <p>Bring your words. Get a simple, explainable view of their sentiment.</p>
              </div>

              <div className="workspace-grid">
                <section className="panel input-panel">
                  <div className="panel-title">
                    <span className="panel-icon">
                      <MessageSquareText size={19} />
                    </span>
                    <div>
                      <h2>Your text</h2>
                      <p>Write or paste a reflection below.</p>
                    </div>
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setResult(null);
                      setBatchRows([]);
                      setBatchResults([]);
                      setBatchProgress(null);
                    }}
                    maxLength={20000}
                    placeholder="Write a few sentences about how you're feeling…"
                  />

                  <div className="input-meta">
                    <span>{text.length.toLocaleString()} / 20,000 characters</span>
                    <span>We recommend 1–3 sentences</span>
                  </div>

                  <div className="upload-zone">
                    <UploadCloud size={21} />
                    <div>
                      <b>Prefer to upload a file?</b>
                      <span>TXT or CSV · up to 1 MB</span>
                    </div>

                    <label className="btn btn-secondary file-button">
                      Choose file
                      <input
                        type="file"
                        accept=".txt,.csv,text/plain,text/csv"
                        onChange={(e) => {
                          handleFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {error && <div className="alert alert-error">{error}</div>}
                  {notice && <div className="alert alert-success">{notice}</div>}

                  <button
                    className="btn btn-primary analyze-btn"
                    disabled={busy}
                    onClick={analyze}
                  >
                    {busy ? (
                      <>
                        <span className="spinner" /> Analyzing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} /> Analyze sentiment
                      </>
                    )}
                  </button>

                  <p className="privacy-note">
                    <ShieldCheck size={14} />
                    Please avoid entering passwords or sensitive personal information.
                  </p>
                </section>

                <section className="panel result-panel">
                  <div className="panel-title">
                    <span className="panel-icon purple-panel-icon">
                      <Activity size={19} />
                    </span>
                    <div>
                      <h2>Analysis report</h2>
                      <p>Your baseline sentiment overview.</p>
                    </div>
                  </div>

                  {batchResults.length > 0 ? (
                    <div className="batch-results">
                      <div className="batch-summary">
                        <div><b>{batchProgress?.total ?? batchResults.length}</b><span>Total rows</span></div>
                        <div><b>{batchProgress?.successful ?? 0}</b><span>Successful</span></div>
                        <div><b>{batchProgress?.failed ?? 0}</b><span>Failed</span></div>
                      </div>
                      <p className="batch-hint">Each CSV text row is analyzed independently. IDs are sequential within this uploaded file.</p>
                      <div className="batch-table-wrap">
                        <table className="batch-table">
                          <thead><tr><th>ID</th><th>Text</th><th>Sentiment</th><th>Compound</th><th>Status</th></tr></thead>
                          <tbody>
                            {batchResults.map((item, index) => (
                              <tr key={`${item.row_number ?? index}-${index}`}>
                                <td>{index + 1}</td>
                                <td className="batch-text-cell">{item.text}</td>
                                <td>{item.status === 'success' ? <span className={`batch-sentiment ${item.sentiment}`}>{item.sentiment}</span> : '—'}</td>
                                <td>{item.status === 'success' && typeof item.compound === 'number' ? `${item.compound > 0 ? '+' : ''}${item.compound.toFixed(2)}` : '—'}</td>
                                <td>{item.status === 'success' ? <span className="batch-status success">Analyzed</span> : <span className="batch-status failed">{item.message || 'Failed'}</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button className="btn btn-secondary" onClick={() => {
                        const headers = ['id', 'text', 'sentiment', 'compound', 'status', 'message'];
                        const lines = [headers.join(','), ...batchResults.map((item, index) =>
                          headers.map((key) => JSON.stringify(String(key === 'id' ? index + 1 : key === 'status' ? item.status : (item[key] ?? '')))).join(',')
                        )];
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'moodmentor-analysis-results.csv';
                        link.click();
                        URL.revokeObjectURL(url);
                      }}><FileText size={16} /> Download results CSV</button>
                    </div>
                  ) : result ? (
                    <>
                      <div className={`result-hero ${sentimentColor}`}>
                        <span className="result-label">OVERALL SENTIMENT</span>

                        <div className="result-main">
                          <span className="result-emoji">
                            {result.sentiment === 'positive'
                              ? '☺'
                              : result.sentiment === 'negative'
                                ? '☹'
                                : '◉'}
                          </span>

                          <h3>
                            {result.sentiment.charAt(0).toUpperCase() +
                              result.sentiment.slice(1)}
                          </h3>
                        </div>

                        <p>
                          {result.sentiment === 'positive'
                            ? 'The text leans toward positive language.'
                            : result.sentiment === 'negative'
                              ? 'The text leans toward negative language.'
                              : 'The text reads as relatively neutral in tone.'}
                        </p>
                      </div>

                      <div className="compound-card">
                        <div>
                          <span>Compound score</span>
                          <small>Range: −1.00 to +1.00</small>
                        </div>

                        <strong
                          className={
                            result.compound > 0.05
                              ? 'score-positive'
                              : result.compound < -0.05
                                ? 'score-negative'
                                : 'score-neutral'
                          }
                        >
                          {result.compound > 0 ? '+' : ''}
                          {result.compound.toFixed(2)}
                        </strong>
                      </div>

                      <div className="breakdown">
                        <h3>Sentiment breakdown</h3>

                        {[
                          ['Positive', result.positive, 'positive-bar'],
                          ['Neutral', result.neutral, 'neutral-bar'],
                          ['Negative', result.negative, 'negative-bar'],
                        ].map(([label, value, cls]) => (
                          <div className="breakdown-row" key={label}>
                            <div>
                              <span>{label}</span>
                              <b>{Math.round(value * 100)}%</b>
                            </div>
                            <div className="breakdown-track">
                              <i
                                className={cls}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, value * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="processed-box">
                        <div className="processed-title">
                          <span>Preprocessed text</span>
                          <span className="token-count">
                            {result.token_count} tokens
                          </span>
                        </div>
                        <p>
                          {result.processed_text ||
                            'No remaining tokens after preprocessing.'}
                        </p>
                      </div>

                      <div className="report-foot">
                        <Check size={15} />
                        Analysis saved
                        {token ? ' to your history' : ' for this session'}
                        <span>VADER baseline</span>
                      </div>
                      <button className="btn btn-secondary report-download" onClick={() => downloadSingleReport(result)}>
                        <Download size={16} /> Download analysis report
                      </button>
                    </>
                  ) : (
                    <div className="empty-result">
                      <div className="empty-illustration">
                        <Activity size={32} />
                        <span><Sparkles size={15} /></span>
                      </div>

                      <h3>Your insights will appear here</h3>
                      <p>
                        Enter text or upload a file, then select{' '}
                        <b>Analyze sentiment</b> to see its overall tone,
                        compound score, and preprocessing result.
                      </p>

                      <div className="empty-checks">
                        <span><Check size={15} /> Sentiment label</span>
                        <span><Check size={15} /> Compound score</span>
                        <span><Check size={15} /> Processed text</span>
                      </div>
                    </div>
                  )}

                  <div className="disclaimer">
                    <CircleHelp size={16} />
                    <p>
                      <b>A gentle reminder</b>
                      <br />
                      Sentiment analysis estimates language patterns; it cannot
                      know exactly how you feel and is not a mental-health diagnosis.
                    </p>
                  </div>
                </section>
              </div>
            </section>
          )}

          {page === 'profile' && (
            <section className="history-page profile-page">
              <div className="page-intro">
                <span className="eyebrow">YOUR ACCOUNT</span>
                <h1>My Profile</h1>
                <p>Manage the details connected to your EmotiSense account.</p>
              </div>
              <div className="panel profile-panel">
                <div className="profile-heading">
                  <span className="profile-avatar"><UserRound size={28} /></span>
                  <div><h2>{profileName || displayName || 'Your profile'}</h2><p>Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'EmotiSense member'}</p></div>
                </div>
                <form onSubmit={saveProfile} className="profile-form">
                  <label>Full name
                    <input value={profileName} onChange={(e) => setProfileName(e.target.value)} minLength={2} maxLength={100} required />
                  </label>
                  <label>Email address
                    <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} required />
                  </label>
                  {error && <div className="alert alert-error">{error}</div>}
                  {notice && <div className="alert alert-success">{notice}</div>}
                  <button className="btn btn-primary" type="submit" disabled={profileBusy}>
                    <Save size={16} /> {profileBusy ? 'Saving…' : 'Save changes'}
                  </button>
                </form>
                <p className="privacy-note">Your profile changes are saved to your account when the backend update succeeds.</p>
              </div>
            </section>
          )}

          {page === 'history' && (
            <section className="history-page">
              <div className="page-intro">
                <span className="eyebrow">YOUR REFLECTION SPACE</span>
                <h1>Analysis history</h1>
                <p>Search, filter, reopen and export your recent sentiment analyses.</p>
              </div>

              <div className="history-tools panel">
                <label className="history-search">
                  <Search size={17} />
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search saved text or sentiment..."
                  />
                </label>
                <select value={historySentiment} onChange={(e) => setHistorySentiment(e.target.value)} aria-label="Filter by sentiment">
                  <option value="all">All sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
                <button className="btn btn-secondary" onClick={() => {
                  const rows = filteredHistory.map((item) => ({
                    id: item.id,
                    text: item.original_text || '',
                    sentiment: item.sentiment,
                    positive: item.positive,
                    neutral: item.neutral,
                    negative: item.negative,
                    compound: item.compound,
                    token_count: item.token_count,
                    created_at: item.created_at,
                  }));
                  const csv = Papa.unparse(rows);
                  const url = URL.createObjectURL(new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'emotisense-history.csv';
                  link.click();
                  URL.revokeObjectURL(url);
                }} disabled={!history.length}>
                  <Download size={16} /> Export history
                </button>
              </div>

              {filteredHistory.length ? (
                <div className="history-list">
                  {filteredHistory.map((item) => (
                    <div className="history-item history-item-row" key={item.id}>
                      <button className="history-open" onClick={() => {
                        setResult({ ...item, text: item.original_text });
                        setText(item.original_text || '');
                        setBatchRows([]);
                        go('analyzer');
                      }}>
                        <span className={`history-sentiment ${item.sentiment}`}>
                          {item.sentiment === 'positive' ? '☺' : item.sentiment === 'negative' ? '☹' : '◉'}
                        </span>
                        <span className="history-copy">
                          <b>{(item.sentiment || 'neutral').charAt(0).toUpperCase() + (item.sentiment || 'neutral').slice(1)} sentiment</b>
                          <small>{item.original_text || 'Text not included in this history record'}</small>
                          <small>{item.created_at ? new Date(item.created_at).toLocaleString() : ''} · {item.token_count} tokens</small>
                        </span>
                        <strong>{Number(item.compound) > 0 ? '+' : ''}{Number(item.compound || 0).toFixed(2)}</strong>
                        <ArrowRight size={17} />
                      </button>
                      <button className="history-export" title="Download this report" onClick={() => downloadSingleReport(item)}>
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel history-empty">
                  <span className="empty-icon"><History size={26} /></span>
                  <h2>{history.length ? 'No matching analyses' : 'No saved analyses yet'}</h2>
                  <p>{history.length ? 'Try another search or sentiment filter.' : 'Analyze text while signed in and your results will appear here.'}</p>
                  <button className="btn btn-primary" onClick={() => go('analyzer')}>Analyze text <ArrowRight size={16} /></button>
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="footer">
          <button className="footer-brand" onClick={() => go('home')}>
            <span className="brand-mark small-mark"><Sparkles size={17} /></span>
            Emoti<span className="brand-blue">Sense</span>
          </button>
          <span>Built for self-reflection, not diagnosis.</span>
          <span>EmotiSense · Text ingestion &amp; baseline sentiment</span>
        </footer>
      </div>
    );
  }

  export default App;