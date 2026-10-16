  import React, { useEffect, useState } from 'react';
  import {
    Activity,
    ArrowRight,
    Brain,
    Check,
    CircleHelp,
    FileText,
    Heart,
    History,
    LogOut,
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
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
      if (token) {
        api('/history', { token })
          .then(setHistory)
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
        go('analyzer');

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
        let extracted = content;

        if (ext === 'csv') {
          const parsed = Papa.parse(content, {
            skipEmptyLines: true,
          });

          extracted = parsed.data
            .map((row) => Array.isArray(row) ? row[0] : row)
            .filter(Boolean)
            .join('\n');
        }

        if (!extracted.trim()) {
          setError('This file appears to be empty. Add text and try again.');
          return;
        }

        setText(extracted.slice(0, 20000));
        setResult(null);
        go('analyzer');
        setNotice(
          `${file.name} loaded. Review the text, then select Analyze sentiment.`
        );
      } catch {
        setError('Could not read this file. Please try another .txt or .csv file.');
      }
    }

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
      user?.full_name ||
      '';

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
                <span
                  className="navbar-user-name"
                  title={displayName}
                >
                  {displayName || 'User'}
                </span>

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
                  <Brain size={32} />
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

                  {result ? (
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

          {page === 'history' && (
            <section className="history-page">
              <div className="page-intro">
                <span className="eyebrow">YOUR REFLECTION SPACE</span>
                <h1>Analysis history</h1>
                <p>Revisit your recent sentiment analyses.</p>
              </div>

              {history.length ? (
                <div className="history-list">
                  {history.map((item) => (
                    <button
                      className="history-item"
                      key={item.id}
                      onClick={() => {
                        setResult(item);
                        setText('');
                        go('analyzer');
                      }}
                    >
                      <span className={`history-sentiment ${item.sentiment}`}>
                        {item.sentiment === 'positive'
                          ? '☺'
                          : item.sentiment === 'negative'
                            ? '☹'
                            : '◉'}
                      </span>

                      <span className="history-copy">
                        <b>
                          {item.sentiment[0].toUpperCase() +
                            item.sentiment.slice(1)}{' '}
                          sentiment
                        </b>
                        <small>
                          {new Date(item.created_at).toLocaleString()} ·{' '}
                          {item.token_count} tokens
                        </small>
                      </span>

                      <strong>
                        {item.compound > 0 ? '+' : ''}
                        {item.compound.toFixed(2)}
                      </strong>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="panel history-empty">
                  <span className="empty-icon"><History size={26} /></span>
                  <h2>No saved analyses yet</h2>
                  <p>
                    Once you analyze text while signed in, your results will
                    appear here.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => go('analyzer')}
                  >
                    Analyze text <ArrowRight size={16} />
                  </button>
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