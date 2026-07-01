/* ==============================================
   Capital Finplus Academy — V5 Shared Data Layer
   Single source of truth for site content + admin.
   Persisted to localStorage under CFP_STORAGE_KEY.
   Swap loadData()/saveData() for real API calls once
   Razorpay + Calendly + a backend are wired up.
   ============================================== */

const CFP_STORAGE_KEY = 'cfp_data_v6';

/* Shared line-icon set — same minimal stroke style as the "What We Offer"
   service icons (no fill, currentColor stroke). Used everywhere an emoji
   used to be: Core Beliefs, the 10-point Philosophy grid, blog/backtesting
   thumbnails, and the masterclass widget. Wrap usage in an element whose
   `color` CSS sets the stroke (these all use stroke="currentColor"). */
const CFP_SVG_ICONS = {
  book: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20 15.3 15.3 0 010-20z"/></svg>',
  seedling: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 7 9 4 5 4c0 5 3 8 7 8z"/><path d="M12 12c0-5 3-8 7-8 0 5-3 8-7 8z"/></svg>',
  scale: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7l-3 7a4 4 0 008 0z"/><path d="M19 7l-3 7a4 4 0 008 0z"/><path d="M5 7h14"/><path d="M9 21h6"/></svg>',
  target: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  layers: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  shield: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  message: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
  checksquare: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  radio: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  filetext: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  activity: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  trendingup: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  candlestick: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="21"/><rect x="3" y="8" width="6" height="6"/><line x1="14" y1="2" x2="14" y2="22"/><rect x="11" y="6" width="6" height="10"/></svg>',
  person: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>'
};

/* Bump this any time hero/about/stats/contact/legal copy is shipped in an
   update. On load, if a visitor's cached version is older, those plain-text
   sections are reset to the new defaults (the admin hasn't been handed off
   for live editing yet, so "freshest copy wins" is the right default —
   collections like articles/testimonials still merge by id either way, and
   transactions/submissions are always preserved). */
const CFP_CONTENT_VERSION = 10;

const CFP_DEFAULT_DATA = {
  _contentVersion: CFP_CONTENT_VERSION,
  hero: {
    line1: 'Master',
    accent: 'Markets.',
    line3: 'Build Real Wealth.',
    sub: 'YOUR TRADING JOURNEY STARTS HERE.<br>No question is too basic. No doubt is too small. <span class="hero-ask-us">Ask us.</span>',
    badge: 'Trusted by 500+ Traders',
    cta1: 'Book a Discovery Call',
    cta2: 'Explore Your Path'
  },
  stats: { students: '500', experience: '15', rating: '4.8' },
  about: {
    heading: 'Building Traders Through<br>Process, Discipline<br>And Market Understanding',
    /* Left column: career background and credentials */
    p1: "With over 15 years of experience in target-based investing in equity markets, the founder has developed a disciplined approach to identifying investment opportunities with managed risk. Over the years, he expanded his expertise into mid-term and short-term trading strategies, with a strong focus on market structure, risk management, and consistency across equity and commodity markets.",
    p2: "He holds a Bachelor's degree in Engineering and a Master's degree in Business Administration (MBA). Having worked with leading multinational organizations such as Cisco and Siemens during the early part of his professional career, he developed a deep appreciation for structured processes, analytical thinking, and disciplined execution — principles that continue to guide his approach to trading and investing.",
    p3: '',
    founderName: 'Pravesh Kumar',
    founderTitle: 'Founder & Head Mentor — CFA',
    /* Right column (founder card): the founding mission, kept distinct from the career bio on the left */
    bio: "\"Driven by a passion for simplifying market concepts and helping traders avoid common pitfalls, I founded CFA Academy — the educational arm of Capital Finplus Advizors. Through practical, experience-driven mentorship, the academy focuses on helping traders understand the why behind every decision, rather than blindly following indicators, tips, or market noise. The goal is simple: help traders and investors develop sustainable habits, independent thinking, and the confidence to navigate markets with consistency.\"",
    credentials: ['CFA Academy', '15+ Years Markets', 'Equity Research', '500+ Students'],
    founderPhoto: 'assets/founder.jpg'
  },
  courses: [
    {
      id: 1, level: 'Free · Beginner', name: 'Essentials', group: 'CFA Intraday Trading',
      subtitle: 'The CFA System — Foundation',
      desc: 'Build the right foundation before your first trade. Understand what drives price movement, why trends form, and how the CFA Trading Framework sets you up for success.',
      features: ['What drives price movement', 'Market structure & price behaviour', 'The right trading mindset', 'Traps, fakeouts & how to avoid them', 'CFA Trading Framework — Introduction'],
      price: 'FREE', priceSub: 'No credit card needed', ctaLabel: 'Get Started Free', ctaLink: 'javascript:void(0)', isModal: true
    },
    {
      id: 2, level: 'Intermediate · Bundle', name: 'Edge + Precision', group: 'CFA Intraday Trading',
      subtitle: 'Two Modules — One Complete Framework',
      desc: 'Master the complete CFA Trading Framework across two power-packed modules. Develop a structured, repeatable trading process and learn to execute with precision.',
      features: ['Complete CFA Trading System', 'Chart setup & workspace configuration', 'Entry, Target & Stop Loss methodology', 'Detailed backtesting & validation', 'Option premium charts mastery', 'Strike price selection & position sizing'],
      featuresRich: `## EDGE
Develop a Structured & Repeatable Trading Process
Learn the complete CFA Trading System and the logic behind every trade.
- The complete CFA Trading System
- Why the system works across different market conditions
- Chart setup and workspace configuration
- Tools to identify Market Structure and trend identification
- Timeframe selection and alignment
- Entry, Target and Stop Loss methodology
- Detailed backtesting
- Building confidence through data-driven validation
> Outcome: Develop a repeatable framework that helps identify high-probability trading opportunities with predefined risk. EDGE and PRECISION includes live market support as and when setup is formed.

## PRECISION
Master Option Buying and Selling Through Premium Charts
Move beyond index charts and learn to trade the instrument that actually determines your profit and loss.
- Understanding option premium behaviour
- Why option premium charts matter more for option buyers
- How to select the right strike price
- Understanding option writers' perspective
- Identifying high-probability entry zones on premium charts
- Timing option buying with market structure
- Position sizing and trade execution
- Building trading discipline and psychology
- Developing consistency in real market conditions
> Outcome: Learn to execute trades with greater precision, better timing, and improved risk management using option premium charts.`,
      price: '₹5,999', priceSub: '+ GST · One-time', ctaLabel: 'Enroll Now', ctaLink: 'payment.html?course=2', isModal: false
    },
    {
      id: 3, level: 'Advanced', name: 'The CFA Academy Framework for Stock Investing',
      subtitle: 'Target-Based Investing Masterclass',
      desc: 'A complete investing framework covering market structure, sector rotation, stock selection, portfolio construction, and investor psychology for sustainable wealth creation.',
      features: ['Market structure & sector rotation', 'Stock selection & screening framework', 'Portfolio construction strategy', 'Investor psychology & discipline', 'Capstone project — Build your own framework'],
      price: '₹4,999', priceSub: '+ GST · One-time', ctaLabel: 'Enroll Now', ctaLink: 'payment.html?course=3', isModal: false
    }
  ],
  testimonials: [
    { id: 2, name: 'Kavya S.', role: 'CA Professional, Mumbai · Equity + Options', rating: 5, quote: "I'd tried 4 other courses before Capital Finplus Academy. This is the first one that felt like being mentored by someone who actually trades. The live sessions changed everything." },
    { id: 3, name: 'Arjun P.', role: 'Business Owner, Hyderabad · Swing Trading', rating: 5, quote: 'The free discovery call gave me more clarity than 6 months of self-study. Booked the course the next day. My swing trades have been far more consistent since.' },
    { id: 4, name: 'Priya T.', role: 'HR Manager, Pune · Equity Markets', rating: 5, quote: 'As a complete beginner I was intimidated. But the curriculum is so well structured — from zero to placing my first live F&O trade in 8 weeks with real confidence.' },
    { id: 5, name: 'Vikas R.', role: 'IT Consultant, Chennai · Crypto + Equity', rating: 5, quote: "The Telegram group and weekly reviews kept me accountable. I've been in markets 3 years but this is the first time I felt like I had a proper system, not just guesses." },
    { id: 6, name: 'Siddharth N.', role: 'Doctor, Delhi NCR · Part-time Trader', rating: 5, quote: 'The 1-on-1 call after I completed the course helped me build a watchlist strategy specific to my schedule. That personalised attention is what sets Capital Finplus apart.' },
    { id: 7, name: 'Aditya R.', role: 'Marketing Manager, Mumbai · Discovery Call', rating: 5, quote: "I already had my own trading strategy before the free discovery call. <span class=\"blur-name\">Pravesh Sir</span> identified that my risk-reward management needed improvement and suggested a simple way to optimize my stop loss while keeping my targets. The biggest difference has been my ability to hold trades with conviction instead of exiting prematurely. Sometimes it's not about finding a new strategy — it's about refining the one you already have." },
    { id: 8, name: 'Neha K.', role: 'Pharmacist, Ahmedabad · Discovery Call', rating: 5, quote: 'I got my strategy reviewed on the free discovery call and realized it could capture points on the index but was not ideal for option buying since it ignored theta decay and premium behaviour. The team introduced me to the CFA trading framework, which aligns far better with market structure for option buyers. I now approach trades with much greater clarity and confidence.' },
    { id: 9, name: 'Rohit D.', role: 'Bank Employee, Pune · Live Intraday Sessions', rating: 5, quote: 'The biggest lesson I learned was that not every market move is meant to be traded. The CFA framework taught me to focus only on my setups. Once I stopped chasing trades and started waiting, my decision-making improved dramatically.' },
    { id: 10, name: 'Arun Thakker', role: 'Operations Manager, Gurugram · 1-on-1 Mentorship', rating: 5, quote: 'Before the mentorship I was constantly switching indicators and strategies. The CFA system showed me how to build a structured trading plan and follow it consistently. Understanding Higher Highs, Higher Lows, and market structure simplified trading far more than any indicator ever did.' },
    { id: 11, name: 'Meera J.', role: 'Architect, Jaipur · 1-on-1 Mentorship', rating: 5, quote: "Started with a discovery call and then opted for mentorship — it was truly one-on-one, all my doubts clarified. Recorded courses can explain setups, but they don't teach you what to think when the market is moving in real time. Learning the right way to think took almost 3 months, and now I wait for the setup and execute with clarity." },
    { id: 12, name: 'Karan B.', role: 'Sales Executive, Indore · 1-on-1 Mentorship', rating: 5, quote: 'Recorded courses had not helped me much earlier — they only provide setups, which are not enough. Having a mentor helped me emphasise patience. The mentorship taught me that waiting for the right setup is often more profitable than taking multiple random trades. Learning to stay away from noise and clutter was a game-changer.' },
    { id: 13, name: 'Tanvi S.', role: 'Graphic Designer, Surat · Live Intraday Sessions', rating: 4, quote: 'The CFA framework helped me understand traps and fakeouts that used to catch me regularly. Instead of reacting to every candle, I learned to focus on structure, confirmations, and probabilities. That shift alone improved my confidence as a trader.' },
    { id: 14, name: 'Abhishek P.', role: 'Civil Engineer, Nagpur · 1-on-1 Mentorship', rating: 4, quote: 'One of the most underrated aspects of the mentorship is the focus on psychology. Seeing similar setups unfold day after day teaches you to trust the process. Over time, it becomes easier to execute without fear, greed, or FOMO.' },
    { id: 15, name: 'Divya M.', role: 'Chartered Accountant, Mumbai · CFA Investment System', rating: 5, quote: 'The CFA Investing Course significantly improved my approach to long-term investing. One of the biggest takeaways was learning how to find the right entry points to build positions with confidence in bluechip companies. The concepts around market cycles and sector rotation helped me understand where institutional money is flowing and select stocks more strategically.' },
    { id: 16, name: 'Yash K.', role: 'Data Analyst, Bangalore · Live Intraday Sessions', rating: 4, quote: 'I am very satisfied with the CFA trading framework and how the setup was explained during the live sessions — practical and easy to understand. One suggestion: a more extensive backtesting review covering at least six months of historical data would further strengthen confidence in the setup across different market conditions.' },
    { id: 17, name: 'Pooja N.', role: 'School Teacher, Lucknow · 1-on-1 Mentorship', rating: 4, quote: 'I used to overtrade because I felt I needed to be in the market all the time. Through mentorship I learned that sometimes the best trade is no trade. Having someone guide you through live market conditions helps develop discipline that is difficult to build alone.' },
    { id: 18, name: 'Imran S.', role: 'Logistics Manager, Hyderabad · Live Intraday Sessions', rating: 4, quote: 'The emphasis on risk-reward completely changed how I approach trading. Earlier I focused only on whether a trade would work. Now I evaluate every opportunity based on risk, reward, and market structure. This simple change brought much-needed consistency to my process.' },
    { id: 19, name: 'Ritika V.', role: 'Interior Designer, Chandigarh · 1-on-1 Mentorship', rating: 5, quote: 'The beauty of the CFA setup lies in its simplicity. Everything starts with market structure and a clear plan. Once the setup forms, the focus shifts to execution rather than prediction. That structured approach removes much of the stress associated with trading.' },
    { id: 20, name: 'Gaurav T.', role: 'Software Developer, Noida · 1-on-1 Mentorship', rating: 5, quote: 'What sets the mentorship apart is learning how to think, not what to think. The discussions around live market scenarios, trade management, patience, and execution helped me develop a trader\'s mindset. The course provides the framework, but the mentorship helps you apply it consistently in real market conditions.' }
  ],
  articles: [
    { id: 1, icon: 'candlestick_chart', color: '#F4C20D', bg: 'linear-gradient(135deg,#2a2008 0%,#4a3508 100%)', category: 'Technical Analysis', cat: 'technical-analysis', access: 'free', title: 'Understanding Market Structure: Why Price Moves the Way It Does', excerpt: 'Before you place a single trade, you need to understand the foundation — how price creates structure, why breakouts happen, and what smart money is doing.', date: 'Jun 5, 2026', readtime: '8 min read', body: `
      <p>Before you place a single trade, you need to understand the single most important question in technical analysis: <strong>why does price move the way it does?</strong> Most retail traders skip straight to indicators and patterns without ever answering this — and it shows in their results.</p>
      <h3>What is Market Structure?</h3>
      <p>Market structure is the sequence of highs and lows that price creates as it moves. An uptrend is a series of higher highs and higher lows. A downtrend is a series of lower highs and lower lows. A ranging market creates roughly equal highs and equal lows. Simple to say — but most traders never actually internalise this before they start trading real money.</p>
      <p>Every chart, on every timeframe, is telling you a structural story. Your first job before any indicator, any news headline, any "tip" from a WhatsApp group, is to read that story honestly.</p>
      <h3>Why Breakouts Happen Where They Do</h3>
      <p>Price gravitates toward areas of liquidity — zones where large amounts of buy or sell orders cluster, usually just beyond an obvious swing high or swing low. This is exactly why breakouts so often happen at those levels. Market makers and institutional desks need to fill very large orders, and the cleanest way to do that is to trigger the stop-losses sitting just past the "obvious" level, generating the liquidity they need to fill their own size.</p>
      <div class="highlight-box">If a level looks "too obvious" to you as a retail trader, it looks exactly as obvious to the algorithms and institutional desks on the other side of your trade — which is precisely why it gets hunted before the real move begins.</div>
      <h3>What Smart Money Is Actually Doing</h3>
      <p>Institutional traders don't chase price. They plan positions around supply and demand zones, then wait patiently for price to come to them. The retail habit of buying breakouts at market price is exactly the liquidity event that institutions rely on to fill their own positions at scale — which is why so many breakout entries immediately reverse.</p>
      <h3>The CFA Framework Application</h3>
      <p>In the CFA Trading System, every trade starts with a market structure assessment — before we ever look at an entry trigger. We map the current structural bias, identify the last significant swing high/low, and confirm we are trading in the direction of the dominant structure (or have a very specific, well-defined reason for fading it). This single habit eliminates the majority of low-quality setups before they ever cost you money.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">Want to go deeper? This concept is a cornerstone of our Intraday Trading Essentials course — available free. Book a Discovery Call to start.</p>
    ` },
    { id: 2, icon: 'shield', color: '#22c55e', bg: 'linear-gradient(135deg,#0a2a1a 0%,#0d4a2a 100%)', category: 'Risk Management', cat: 'risk-management', access: 'free', title: 'The 2% Rule and Why Most Traders Ignore It (Until They Blow Their Account)', excerpt: 'Position sizing is the unsexy secret behind consistent profitability. One bad day should never wipe out a great month.', date: 'May 28, 2026', readtime: '6 min read', body: `
      <p>Ask any consistently profitable trader what the single most important rule in their playbook is, and almost all of them will say some version of: <strong>never risk more than 2% of your capital on any single trade.</strong> It isn't glamorous advice. It also happens to be the difference between traders who are still in the game five years from now and those who aren't.</p>
      <h3>Why 2%?</h3>
      <p>The 2% rule is mathematically protective. If you lose 10 consecutive trades — an unlikely but entirely possible streak — you've only lost about 18.3% of your account, not 20%, because each loss compounds on the remaining (shrinking) capital. From 81.7% of your account, recovery is realistic. This is the difference between a bad month and a blown account.</p>
      <div class="highlight-box">A trader risking 10% per trade who hits five consecutive losses has lost 41% of their account and now needs a 70% return just to break even. The 2% trader in the same scenario has lost under 10% — and needs roughly an 11% return to recover. Same losing streak, completely different outcome.</div>
      <h3>How to Calculate Position Size</h3>
      <p>Position Size = (Account Size × Risk %) ÷ (Entry Price − Stop Loss Price). If your account is ₹5,00,000 and you risk 2%, that's ₹10,000 of risk capital. If your entry is ₹500 and your stop is ₹490, your risk per share is ₹10. Position size = ₹10,000 ÷ ₹10 = 1,000 shares. Every trade, every time — no exceptions, no "just this once."</p>
      <h3>Why Traders Ignore It Anyway</h3>
      <p>FOMO. When a setup "feels" perfect, traders double or triple their normal size — and this is exactly the moment the market tends to punish hardest, because conviction and position sizing should never be correlated. The CFA Risk Framework removes the emotional decision entirely: position size is calculated mechanically before entry, and it never changes based on how confident you feel.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">We cover position sizing in granular detail in the Edge + Precision Bundle. Book a Discovery Call to find the right course for your level.</p>
    ` },
    { id: 3, icon: 'psychology', color: '#e879f9', bg: 'linear-gradient(135deg,#2a0f18 0%,#4a1c30 100%)', category: 'Psychology', cat: 'psychology', access: 'free', title: 'Revenge Trading: The Emotional Trap That Destroys Accounts and How to Escape It', excerpt: 'Every trader faces losing streaks. The difference between those who survive and those who blow up is entirely psychological.', date: 'May 21, 2026', readtime: '7 min read', body: `
      <p>Every trader, no matter how skilled, faces losing streaks. What separates the traders who survive long enough to become consistently profitable from the ones who blow up their accounts isn't skill — it's almost entirely psychological.</p>
      <h3>The Cycle</h3>
      <p>A loss triggers an immediate, almost involuntary urge to "win it back" — right now, in the very next trade. This leads to oversized positions taken without a real setup, entered purely on emotion. When that trade also loses (which it usually does, because it was never a real trade to begin with), the cycle accelerates: bigger size, less planning, faster decisions, more losses.</p>
      <div class="highlight-box">Kahneman and Tversky's research on loss aversion shows the pain of a loss is felt roughly 2.5x more intensely than the pleasure of an equivalent gain. This asymmetry is precisely what drives revenge trading — your brain isn't malfunctioning, it's doing exactly what evolution built it to do. It just happens to be terrible for trading.</p>
      <h3>Recognising It in Real Time</h3>
      <p>The tells are consistent: trading size that doesn't match your plan, entering without a clear invalidation level, a racing pulse, the thought "I just need this one to work." If you notice even one of these after a loss, you are no longer trading a strategy — you're trading an emotion.</p>
      <h3>Breaking the Cycle</h3>
      <p>The CFA Framework enforces a mandatory cool-down after any loss exceeding your daily risk limit — no exceptions, no "I'll just watch the screen." Concretely: define your maximum daily loss before the session starts (e.g. 4% of capital), and if you hit it, you are done trading for the day, full stop. This single rule, enforced without negotiation, prevents the vast majority of catastrophic single-day losses we see in retail accounts.</p>
      <h3>Building Your Own Circuit Breaker</h3>
      <p>Write your daily loss limit down before the market opens. Tell a trading partner or mentor what it is. The goal isn't to eliminate emotion — that's impossible — it's to build a system that takes the decision out of your hands at the exact moment you're least equipped to make it well.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">Our Trading Psychology module walks through the full daily routine professional traders use to manage this. Book a Discovery Call to learn more.</p>
    ` },
    { id: 4, icon: 'description', color: '#38bdf8', bg: 'linear-gradient(135deg,#0a1a2e 0%,#102a50 100%)', category: 'F&O Basics', cat: 'fo-basics', access: 'free', title: "Call vs. Put: A Beginner's Guide to Options Without the Confusion", excerpt: 'Options intimidate most beginners because they are taught wrong. This strips away the jargon and gives you a practical mental model.', date: 'May 14, 2026', readtime: '6 min read', body: `
      <p>Options intimidate most beginners because they are taught backwards — starting with Greeks and payoff diagrams before anyone explains the simple idea underneath all of it. Let's fix that.</p>
      <h3>The Simple Version</h3>
      <p>A <strong>Call option</strong> gives you the right (not the obligation) to buy an asset at a fixed price — the strike price — before a set expiry date. You buy a Call when you expect the price to go up. A <strong>Put option</strong> gives you the right to sell at a fixed price — you buy a Put when you expect the price to go down.</p>
      <p>That's genuinely the whole concept. Everything else — Delta, Theta, Vega, implied volatility — describes <em>how the price of that right changes</em>, not what the right itself means.</p>
      <h3>Why Options Cost Money: Premium</h3>
      <p>The price you pay for an option is called the premium, and it has two components: intrinsic value (how far "in the money" the option already is) and time value (how much time remains for the bet to play out, plus how volatile the market currently is). This is why two options on the same stock at different expiries cost different amounts even with an identical strike price.</p>
      <h3>Premium Decay — The Silent Killer</h3>
      <p>Time is always working against option buyers. Every single day that passes, an option loses a little value purely from time passing — even if the underlying price doesn't move at all. This is called Theta decay, and it accelerates sharply in the final week before expiry. This is the single biggest reason most retail option <em>buyers</em> lose money over time, even when they're directionally right — they're often right too slowly.</p>
      <div class="highlight-box">A useful beginner mental model: buying options is like buying a lottery ticket with a built-in countdown timer. Being directionally correct isn't enough — you need to be correct within the time the option gives you, by enough magnitude to overcome the premium you paid.</div>
      <h3>Where Most Beginners Go Wrong</h3>
      <p>New traders buy far out-of-the-money options because they're cheap, not because they make statistical sense. A ₹5 option "feels" like a small bet, but it usually has a very low probability of ever becoming profitable before expiry. Understanding strike selection relative to your actual market view — not your account size — is the first real skill in options trading.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">We build the complete options foundation — strike selection, premium behaviour, and the Greeks — inside the Edge + Precision Bundle.</p>
    ` },
    { id: 5, icon: 'auto_graph', color: '#FFD24D', bg: 'linear-gradient(135deg,#2e2208 0%,#56400a 100%)', category: 'Options Strategy', cat: 'options-strategy', access: 'premium', title: 'CFA Option Premium Charts: Reading Volatility Before It Explodes', excerpt: 'This deep-dive covers the exact option premium chart setups we use to identify volatility expansion before it happens. Includes annotated real trade examples from live market sessions over the past quarter, with entry, target, and stop-loss marked on each chart.', date: 'May 7, 2026', readtime: '10 min read', body: `
      <h3>Why Premium Charts, Not Just Price Charts</h3>
      <p>Most traders only ever look at the price chart of the underlying. Professional option sellers also chart the <em>premium itself</em> — because premium behaves differently from price, especially around implied volatility (IV) expansion and contraction. Reading these patterns early is how we position ahead of major moves rather than reacting after they happen.</p>
      <h3>The Pre-Expansion Signature</h3>
      <p>Before a volatility expansion, premium on at-the-money options typically compresses into an unusually tight range relative to its own 20-session average — even while the underlying appears to be moving normally. This compression is the option market quietly pricing in complacency, and it is one of the most reliable early-warning signs we track.</p>
      <h3>Trade Setup: The Compression Break</h3>
      <p><strong>Trigger:</strong> ATM premium compresses to &lt;60% of its 20-session average for 3+ consecutive sessions, then closes above the upper compression band on rising volume.<br/>
      <strong>Entry:</strong> Long straddle or strangle, sized to 1.5% portfolio risk.<br/>
      <strong>Stop-Loss:</strong> Time-based — exit if no expansion within 4 sessions.<br/>
      <strong>Target:</strong> Scale out as IV rank crosses above 65, fully exit above 80.</p>
      <h3>Real Trade Example — BANKNIFTY, April 2026</h3>
      <p>ATM straddle premium compressed to 54% of its average for 4 sessions heading into an RBI policy week. We entered the straddle on the breakout session at a combined premium of ₹612. IV rank expanded from 38 to 71 within 3 sessions as the policy surprised markets, and the position was scaled out in two tranches for a combined 64% gain on premium.</p>
      <h3>Risk Notes</h3>
      <p>This strategy has a defined, time-boxed risk (the premium paid) but a non-trivial base rate of false signals — expect roughly 4 in 10 setups to expire near worthless. Sizing discipline matters more here than in almost any other strategy we teach, precisely because the win rate is lower even though the payoff skew is favourable.</p>
    ` },
    { id: 6, icon: 'trending_up', color: '#fbbf24', bg: 'linear-gradient(135deg,#261c06 0%,#46320c 100%)', category: 'Portfolio Building', cat: 'portfolio', access: 'premium', title: 'Building a Target-Based Equity Portfolio: Sector Rotation & Stock Selection', excerpt: 'A comprehensive walkthrough of the CFA Academy target-based investing framework. Covers sector rotation signals, stock screening criteria, position sizing across a multi-stock portfolio, and capital allocation rules.', date: 'Apr 30, 2026', readtime: '11 min read', body: `
      <h3>Sector Rotation: The Macro Layer</h3>
      <p>Capital flows between sectors in fairly predictable cycles tied to interest rate direction, earnings momentum, and the broader economic cycle. Before screening individual stocks, the CFA Academy framework starts by identifying which 2–3 sectors are receiving net institutional inflows — buying the right stock in the wrong sector is fighting the tide.</p>
      <h3>The Stock Screening Criteria</h3>
      <p>Within a favoured sector, we screen for: relative strength versus the sector index over the past 3 months, earnings growth acceleration (not just positive growth — accelerating growth), and a clean technical structure with no major overhead supply zones within 15% of current price. Stocks that pass all three move to the watchlist; very few do, by design.</p>
      <div class="highlight-box">A common mistake: buying a fundamentally "cheap" stock in a sector receiving net institutional outflows. Cheap stocks in unloved sectors can stay cheap for years — value without a catalyst is not a thesis, it's a hope.</div>
      <h3>Position Sizing Across a Multi-Stock Portfolio</h3>
      <p>No single position should exceed 8–10% of total portfolio value at cost, and no single sector should exceed 30%, regardless of conviction. This isn't a lack of confidence — it's an acknowledgment that even well-researched theses are wrong often enough that concentration risk has to be managed structurally, not just intellectually.</p>
      <h3>Capital Allocation Rules</h3>
      <p>We allocate in tranches — an initial 50% position on the original thesis, with the remaining 50% added only if the thesis is confirmed by subsequent price action and at least one earnings cycle. This avoids the common error of being "all in" on day one of a multi-month thesis.</p>
      <h3>Rebalancing Discipline</h3>
      <p>Portfolios are reviewed monthly, not daily. Positions that breach the sector rotation signal (the sector falls out of favour for two consecutive months) are trimmed regardless of the individual stock's chart — because the macro tailwind that justified the position in the first place is no longer there.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">This is the complete framework taught in The CFA Academy Framework for Stock Investing — join the waitlist from the Courses section.</p>
    ` },
    { id: 7, featured: true, icon: 'description', color: '#22c55e', bg: 'linear-gradient(135deg,#0a2a1a 0%,#0d4a2a 100%)', category: 'Trading Psychology', cat: 'psychology', access: 'free', title: "The Trader's Guide to Doing Everything Wrong First & 6 Steps to Recover", excerpt: "The market does not care about your predictions. The sooner a trader accepts this, the sooner he can stop trying to predict the market and start learning how to work with it.", date: 'Jun 18, 2026', readtime: '9 min read', body: `
      <p>Let's begin with some bad news. The market does not care about your predictions. It does not know your target, it does not respect your confidence, or feel sorry for your stop loss. The sooner a trader accepts this reality, the sooner he can stop trying to predict the market and start learning how to work with it.</p>
      <p>Successful intraday trading is surprisingly boring. No secret indicators. No magic candles. No WhatsApp groups with "sure-shot calls." No uncle whose friend's neighbour made ₹50,000 in a day. Instead, it is a structured process followed repeatedly with discipline and consistency. Let's see how.</p>
      <h3>1. Have a Time-Tested Trading Setup</h3>
      <p>Most traders start with a setup they found on YouTube at 2 AM. The thumbnail promised: "95% Accuracy | Nifty Jackpot | Watch Before It Gets Deleted." Three days later, the account is deleted instead.</p>
      <p>A profitable trader needs a setup that has been tested across different market conditions — trending markets, sideways markets, volatile markets, and days when the market seems personally offended by your existence. Borrow a setup or build a setup, but you should have a working setup.</p>
      <h3>2. Build Conviction Through Backtesting</h3>
      <p>Most traders trust a strategy after one winning trade. Professional traders trust a strategy after hundreds of trades. There is a slight difference. Backtesting tells you how often it wins, how often it loses, what drawdowns to expect, and whether you should trust it or quietly uninstall it.</p>
      <div class="highlight-box">Confidence can come from profits later, but it should come from your backtest data now.</div>
      <h3>3. Wait for Your Setup and Follow Your Plan</h3>
      <p>This is where trading becomes difficult — not because the market is complicated, but because human beings are. The market may offer 100 opportunities in a day. Unfortunately, your setup may only appear once. The average trader takes 7 random trades, misses the actual setup, then complains that the strategy doesn't work.</p>
      <p>A successful trader learns a valuable skill: doing absolutely nothing until the setup appears. Patience in trading feels unproductive. Ironically, it is often the most productive thing you can do.</p>
      <h3>4. Maintain Risk-Reward Discipline</h3>
      <p>Every trader loves targets. Very few love stop losses. Unfortunately, the market requires both. Even the best setup will fail occasionally — the difference between successful and unsuccessful traders is not the number of winning trades, it is how they handle losing trades.</p>
      <p>A good trader asks: How much am I risking? What is my potential reward? Is this trade worth taking? A bad trader asks: "Bhai, target kya hai?" One trader survives. The other becomes content for social media.</p>
      <h3>5. Develop Trading Psychology</h3>
      <p>At some point, every trader discovers that the biggest problem is not the market. It is the person staring back from the screen. Fear. Greed. FOMO. Revenge trading. Overconfidence. These emotions can destroy months of progress in a single afternoon.</p>
      <p>Trading psychology is learning when to hold, when to exit, when to stay out, and most importantly, when to stop looking at someone else's P&amp;L screenshots. The market rewards discipline far more than intelligence.</p>
      <h3>6. Know When to Stop</h3>
      <p>One of the most underrated skills in trading is knowing when the day is over. Your setup appeared. You took the trade. You followed the plan. You booked the profit or accepted the loss. Congratulations. Go outside. Touch grass. Call it a day.</p>
      <p>Most traders continue trading because they believe the next trade will make the day better. Usually, it makes the broker richer. Overtrading has destroyed more accounts than bad setups ever have.</p>
      <h3>The Final Truth</h3>
      <p>Most traders spend years searching for the perfect strategy. The irony? The strategy is rarely the problem. The real challenge is trusting the setup, waiting patiently, managing risk, following the plan, and repeating the process every day.</p>
      <div class="highlight-box">Consistency in trading is not built by finding a magical indicator. It is built by doing ordinary things extraordinarily well, day after day, while resisting the constant urge to do something stupid. And if that sounds boring... congratulations. You're finally starting to understand what successful trading looks like.</div>
      <h3>Why Mentorship Matters</h3>
      <p>Understanding a trading setup is only the beginning. The real challenge lies in implementing it consistently in live market conditions. This is where most beginners struggle — overwhelmed by market noise, conflicting opinions, and emotional decision-making.</p>
      <p>A recorded course can teach concepts. A mentor helps you apply them. Through CFA's One-on-One Mentorship Program, traders learn how to implement the CFA framework in live markets while understanding the thought process behind every decision: what to focus on during live market hours, how to filter noise and distractions, how to evaluate trade opportunities, when to enter, hold, exit, or stay out, and how to think like a disciplined trader.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">Because successful trading is not just about knowing a setup. It is about knowing how to execute it consistently when real money and real emotions are involved. Book a Discovery Call to learn more.</p>
    ` },
    { id: 8, featured: true, icon: 'psychology', color: '#f472b6', bg: 'linear-gradient(135deg,#2a0f20 0%,#4a1838 100%)', category: 'Trader Mindset', cat: 'psychology', access: 'free', title: 'The Trader’s Journey: Indicators, Hope & Heartbreak', excerpt: "Almost everyone, at some point, thinks: ‘How difficult can it be? Buy low, sell high.’ The market has a wonderful way of introducing itself.", date: 'Jun 11, 2026', readtime: '7 min read', body: `
      <p>Trading is a fascinating business. It has the unique ability to attract anybody and everybody on the planet, even people who have never looked at a chart in their lives. Almost everyone, at some point, thinks: "How difficult can it be? Buy low, sell high. Simple." The market, however, has a wonderful way of introducing itself.</p>
      <p>A typical trader begins his journey with complete confidence and absolutely no idea what he is doing. He opens a trading account, watches a few YouTube videos, learns two candle patterns, discovers leverage, and is now convinced that financial freedom is just three trades away.</p>
      <p>Terms like market structure, risk management, patience, discipline, position sizing, and risk-reward ratio belong to a distant galaxy. The only strategy at this stage is hope.</p>
      <h3>Reality Arrives</h3>
      <p>A few weeks later, the trader discovers that the market is strangely unwilling to cooperate with his plans. His account begins to shrink at a speed that would impress even the best fund managers. After several losses, he concludes that the problem is not him — it's the market, or his strategy. And thus begins the legendary quest for the Holy Grail.</p>
      <p>He spends countless hours searching for "100% accurate strategy," "secret institutional setup," "never-fail indicator," and "Bank Nifty jackpot strategy." Soon he has collected more indicators than there are stocks in the market. His charts start resembling a Christmas tree.</p>
      <p>He tries one strategy on Monday, another on Wednesday, and a completely different one by Friday. If a strategy produces a losing trade, it is immediately declared useless and replaced by a newer, shinier strategy from the internet.</p>
      <h3>The Expert at Everything Except Profit</h3>
      <p>Months pass. The trader becomes an expert at downloading indicators, watching videos, joining Telegram groups, changing chart colours, and taking screenshots — which he also loves sharing with peers who barely understand them, because he himself doesn't either. Making money, unfortunately, remains optional.</p>
      <p>Eventually, frustration takes over. The account balance is damaged, confidence is lower than the stop loss he forgot to place, and he decides to quit trading "forever." "Forever," in trading language, usually means two to four weeks.</p>
      <div class="highlight-box">Fresh capital arrives. Motivation returns. The trader is back. This time it will be different. It isn't. The cycle repeats itself, often faster than before.</div>
      <h3>Breaking the Carousel</h3>
      <p>Random trading leads to losses. Losses lead to strategy hunting. Strategy hunting leads to confusion. Confusion leads to overtrading. Overtrading leads to losses. Losses lead to quitting. Quitting leads to a fresh deposit. And around and around the carousel goes — until the trader discovers a few truths that only successful traders understand: consistency does not come from finding a magical strategy. It comes from having a structured approach, understanding market behaviour, managing risk, developing patience, and executing the same proven process repeatedly till boredom.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">The irony is that most traders spend years searching for a secret setup, only to discover that the real secret was never the setup — it was the discipline to follow one.</p>
    ` },
    { id: 9, featured: true, icon: 'auto_graph', color: '#facc15', bg: 'linear-gradient(135deg,#2a1f08 0%,#4a3510 100%)', category: 'Risk Management', cat: 'risk-management', access: 'free', title: 'Holy Grails, Telegram Groups & Other Expensive Trading Hobbies', excerpt: 'Contrary to popular belief, making money in the stock market is actually quite difficult. Losing money, however, is a highly accessible skill — here are 10+ ways traders practice it.', date: 'Jun 4, 2026', readtime: '11 min read', body: `
      <p>Contrary to popular belief, making money in the stock market is actually quite difficult. Losing money, however, is a highly accessible skill. Acquiring this skill takes no time, as it's prebuilt into the normal human brain.</p>
      <p>In fact, the stock market offers such a wide variety of money-losing opportunities that it deserves recognition as one of the most inclusive industries on the planet. Engineers lose money. Doctors lose money. Businessmen lose money. Students lose money. The market believes in equality.</p>
      <p>Let's explore some of the most popular and expensive trading hobbies practiced by retail traders worldwide.</p>
      <h3>Hobby #1: Random Trading</h3>
      <p>Every trader begins here. No setup. No plan. No analysis. Just vibes. "Mujhe lag raha hai upar jayega, sure-shot." This single sentence has probably destroyed more trading accounts than all bear markets combined. The trade is entered. The market immediately falls. The trader develops a second opinion: "Mujhe lag raha hai neeche jayega." Unfortunately, both opinions are usually wrong.</p>
      <h3>Hobby #2: The Holy Grail Hunt</h3>
      <p>After losing money randomly, the trader reaches a powerful conclusion: "The problem is not me. The problem is my strategy." Thus begins the search for the Holy Grail — videos titled "99% Accuracy Strategy," "Secret Institutional Setup," "Bank Nifty Jackpot Formula." By month's end he has acquired 17 indicators, 9 strategies, 4 courses, and 0 consistency. His chart now resembles a NASA control panel.</p>
      <h3>Hobby #3: Telegram Group Collection</h3>
      <p>At some point every trader joins a Telegram group. Then another. Soon he's in "Bank Nifty Kings," "Option Millionaires," "Sure Shot Intraday Calls," and "Premium Diamond Elite VIP Group" — half of which are copying signals from the other half. He now receives 15 buy calls, 12 sell calls, 7 breakout alerts, and 4 urgent messages, all at once. Market confusion reaches professional levels.</p>
      <h3>Hobby #4: Chart Decoration</h3>
      <p>Some traders analyze charts. Others decorate them — trend lines, channels, support, resistance, moving averages, VWAP, Supertrend, pivot points, Fibonacci, Gann, Elliott Wave, astrology. Eventually the actual candles become invisible. The chart looks less like a trading screen and more like a civil engineering project.</p>
      <h3>Hobby #5: Strategy Hopping</h3>
      <p>The average retail trader gives a strategy approximately 2.5 losing trades before declaring it useless. Monday: Price Action. Wednesday: SMC. Friday: ICT. Next Monday: Option Selling. One month later: "Nothing works in the market." The strategy never got a chance — the trader changed systems more often than mobile wallpapers.</p>
      <h3>Hobby #6: Averaging Down</h3>
      <p>This hobby deserves special recognition. The market moves against the trader. A logical person would exit. The trader buys more. The market falls again. He buys even more, then proudly announces: "My average price is much better." The market disagrees and keeps falling. He discovers that averaging is not a strategy — it's simply a faster way to quit trading and become a long-term investor.</p>
      <h3>Hobby #7: Revenge Trading</h3>
      <p>The trader takes a loss. This is acceptable. Then he takes it personally. Now it is war. He doubles position size, removes the stop loss, ignores risk management, forgets every rule. Three hours later the market has won the war and captured additional capital, often more than 20x his daily risk limit.</p>
      <h3>Hobby #8: Overtrading</h3>
      <p>The market opens at 9:15. The trader takes a trade. Then another. Then a "small recovery trade." Then a "high conviction trade." Then a "last trade." Then a "real last trade." Then a "final final trade." By 3:30 PM he has executed more trades than some professionals take in a month. Broker happy. Trader exhausted.</p>
      <h3>Hobby #9: Unrealistic Expectations</h3>
      <p>The trader starts with ₹20,000. His goal: ₹5 crore in 18 months. Anything less is disappointing. Every trade must be life-changing. Every week must be profitable. Reality eventually arrives carrying a very large stick.</p>
      <h3>Hobby #10: Ignoring Risk-Reward</h3>
      <p>Many traders spend hours finding entries and approximately 4 seconds planning exits. Entry: highly researched. Stop loss: "let's see." Target: "moon." This generally produces predictable outcomes.</p>
      <div class="highlight-box">The most expensive hobby of all isn't random trading, Telegram groups, overtrading, or even revenge trading. It's believing that consistency can be achieved without process. Most traders spend years searching for better indicators, better strategies, better calls, better groups. Very few spend time developing patience, discipline, risk management, market understanding, and consistent execution. Ironically, those are the things that actually matter.</div>
      <h3>Final Thoughts</h3>
      <p>The market offers more than 10,000 ways to lose money. Fortunately, making money requires far fewer things: one proven setup, one structured process, one risk management framework, one disciplined mindset, and enough patience to avoid every "sure-shot" opportunity that appears on Telegram.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">Because in trading, the goal is not to find the Holy Grail. The goal is to stop behaving like you're searching for one.</p>
    ` }
  ],
  /* Daily chart-trend / backtesting posts — separate from the Blog.
     Free for their first 30 days (_useTimeWindow), then roll to premium. */
  backtests: [
    { id: 1, icon: 'candlestick_chart', color: '#F4C20D', bg: 'linear-gradient(135deg,#2a2008 0%,#4a3508 100%)', instrument: 'NIFTY 50', timeframe: '15 min', result: 'Win', date: 'Jun 23, 2026', readtime: '4 min read', title: 'NIFTY 50 — Breakout Retest at 24,650 Support', excerpt: 'A clean breakout-and-retest setup on the 15-min chart, with entry triggered on the retest candle and a 1:2.4 risk-reward outcome.', body: `
      <p><strong>Setup:</strong> NIFTY broke above the 24,650 resistance zone on rising volume, then pulled back to retest the level as support before continuing higher.</p>
      <p><strong>Entry:</strong> 24,668 on the retest confirmation candle &nbsp;|&nbsp; <strong>Stop-Loss:</strong> 24,590 &nbsp;|&nbsp; <strong>Target:</strong> 24,855</p>
      <p><strong>Result:</strong> Target hit within 2 hours. Risk-reward achieved: 1:2.4.</p>
      <p style="color:rgba(255,224,102,0.9);font-style:italic;margin-top:1.5rem;">Logged here as part of our daily backtesting log — not investment advice, for educational reference only.</p>
    ` },
    { id: 2, icon: 'shield', color: '#22c55e', bg: 'linear-gradient(135deg,#0a2a1a 0%,#0d4a2a 100%)', instrument: 'BANK NIFTY', timeframe: '5 min', result: 'Loss', date: 'Jun 22, 2026', readtime: '3 min read', title: 'BANK NIFTY — Failed Range Breakout, Stop Honoured', excerpt: 'A range breakout that reversed quickly. A reminder that even valid setups fail — the value is in the process, not any single trade.', body: `
      <p><strong>Setup:</strong> BANK NIFTY attempted to break above a 3-day consolidation range on the 5-min chart.</p>
      <p><strong>Entry:</strong> 52,410 &nbsp;|&nbsp; <strong>Stop-Loss:</strong> 52,310 &nbsp;|&nbsp; <strong>Result:</strong> Stop hit. -1R.</p>
      <p>No change in process despite the loss — the setup met every criterion in the framework going in. This is logged exactly as it happened, including losses, because a backtesting log only has value if it's honest.</p>
    ` },
    { id: 3, icon: 'trending_up', color: '#fbbf24', bg: 'linear-gradient(135deg,#261c06 0%,#46320c 100%)', instrument: 'RELIANCE', timeframe: 'Daily', result: 'Win', date: 'Jun 20, 2026', readtime: '4 min read', title: 'RELIANCE — Daily Chart Higher-Low Continuation', excerpt: 'A textbook higher-low entry within an established uptrend, taken on the daily chart with a multi-day target.', body: `
      <p><strong>Setup:</strong> RELIANCE formed a clean higher-low on the daily chart after a 5% pullback within an existing uptrend.</p>
      <p><strong>Entry:</strong> ₹2,945 &nbsp;|&nbsp; <strong>Stop-Loss:</strong> ₹2,890 &nbsp;|&nbsp; <strong>Target:</strong> ₹3,060</p>
      <p><strong>Result:</strong> Target hit on day 4. Risk-reward achieved: 1:2.1.</p>
    ` },
    { id: 4, icon: 'auto_graph', color: '#38bdf8', bg: 'linear-gradient(135deg,#0a1a2e 0%,#102a50 100%)', instrument: 'NIFTY 50', timeframe: '1 hour', result: 'Win', date: 'May 10, 2026', readtime: '4 min read', title: 'NIFTY 50 — Hourly Trendline Bounce Into Resistance', excerpt: 'An older archived setup — now beyond the 30-day free window. Unlock with any course purchase to view the full breakdown.', body: `
      <p><strong>Setup:</strong> NIFTY respected a rising hourly trendline for the third consecutive touch, with confluence from the 50-period EMA.</p>
      <p><strong>Entry:</strong> 23,980 &nbsp;|&nbsp; <strong>Stop-Loss:</strong> 23,905 &nbsp;|&nbsp; <strong>Target:</strong> 24,150</p>
      <p><strong>Result:</strong> Target hit. Risk-reward achieved: 1:2.3.</p>
    ` }
  ],
  contact: {
    email: 'connect@capitalfinplusadvizors.com',
    whatsapp: '+91 93503 31521',
    telegram: '@capitalfinplusadvizors',
    telegramUrl: 'https://t.me/capitalfinplusadvizors',
    instagram: '@capital_finplus_academy',
    instagramUrl: 'https://www.instagram.com/capital_finplus_academy?utm_source=qr',
    youtube: '@capitalfinplusadvizors',
    youtubeUrl: 'https://youtube.com/@capitalfinplusadvizors?si=Yo1yx_mgLksfNjYD',
    twitter: '@capitalfinplus_in',
    twitterUrl: '',
    calendlyUrl: 'https://calendly.com/connect-capitalfinplusadvizors/discovery-call-30-mins',
    razorpayKeyId: ''
  },
  legal: {
    disclaimer: 'Capital Finplus Academy is an educational platform. Trading in securities involves risk of loss. All course content is for educational purposes only and does not constitute investment advice. Please consult a SEBI-registered advisor before making investment decisions. Past performance is not indicative of future results.'
  },
  /* ── SAMPLE DATA — replace with live Razorpay / form-backend feed once wired ── */
  transactions: [
    { id: 1, paymentId: 'pay_OqSample0001', orderId: 'order_OqSample0001', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98765 12340', course: 'The CFA Trading System: Edge + Precision', amount: 24999, status: 'captured', method: 'UPI', date: '2026-06-20 14:32' },
    { id: 2, paymentId: 'pay_OqSample0002', orderId: 'order_OqSample0002', name: 'Kavya Subramaniam', email: 'kavya.s@example.com', phone: '+91 98220 44211', course: 'The CFA Trading System: Edge + Precision', amount: 24999, status: 'captured', method: 'Card', date: '2026-06-19 09:15' },
    { id: 3, paymentId: 'pay_OqSample0003', orderId: 'order_OqSample0003', name: 'Arjun Patel', email: 'arjun.patel@example.com', phone: '+91 90123 88761', course: 'The CFA Trading System: Edge + Precision', amount: 24999, status: 'failed', method: 'Net Banking', date: '2026-06-18 19:48' },
    { id: 4, paymentId: 'pay_OqSample0004', orderId: 'order_OqSample0004', name: 'Priya Tiwari', email: 'priya.t@example.com', phone: '+91 99887 65432', course: 'The CFA Trading System: Edge + Precision', amount: 24999, status: 'refunded', method: 'UPI', date: '2026-06-15 11:02' }
  ],
  submissions: [
    { id: 1, type: 'booking', name: 'Vikas Rao', email: 'vikas.rao@example.com', phone: '+91 98765 99001', experience: 'Some Experience (1–2 yrs)', message: 'Want to understand if F&O suits my schedule as a part-time trader.', date: '2026-06-21 18:20' },
    { id: 2, type: 'contact', name: 'Siddharth Nair', email: 'sid.nair@example.com', phone: '+91 90909 11223', experience: '', message: 'Do you offer EMI options for the bundle course?', date: '2026-06-21 10:05' },
    { id: 3, type: 'booking', name: 'Anjali Mehta', email: 'anjali.m@example.com', phone: '+91 91234 56780', experience: 'Complete Beginner', message: 'Total beginner, want to know where to start.', date: '2026-06-20 08:44' }
  ]
};

/* Merge a saved array with the shipped defaults by id: keeps any admin edits
   to existing items, but appends newly-shipped default items (e.g. new blog
   posts pushed in an update) that aren't in the saved array yet. Without this,
   a plain top-level Object.assign would let an old cached "articles" array
   permanently hide every article added in a later release. */
function cfpMergeById(savedArr, defaultArr) {
  if (!Array.isArray(savedArr)) return JSON.parse(JSON.stringify(defaultArr));
  const savedIds = new Set(savedArr.map(x => x.id));
  const missingDefaults = defaultArr.filter(d => !savedIds.has(d.id));
  return savedArr.concat(JSON.parse(JSON.stringify(missingDefaults)));
}

function cfpLoadData() {
  try {
    const raw = localStorage.getItem(CFP_STORAGE_KEY);
    if (!raw) {
      const d = JSON.parse(JSON.stringify(CFP_DEFAULT_DATA));
      (d.backtests || []).forEach(b => { b._useTimeWindow = true; });
      return d;
    }
    const parsed = JSON.parse(raw);
    const defaults = JSON.parse(JSON.stringify(CFP_DEFAULT_DATA));
    const isStale = (parsed._contentVersion || 0) < CFP_CONTENT_VERSION;
    // shallow-merge top level so new default keys (e.g. newly added panels) survive old saved data
    const merged = Object.assign({}, defaults, parsed);
    // collection fields get merged by id instead of wholesale-replaced
    merged.articles = cfpMergeById(parsed.articles, defaults.articles);
    merged.testimonials = cfpMergeById(parsed.testimonials, defaults.testimonials);
    merged.courses = cfpMergeById(parsed.courses, defaults.courses);
    merged.backtests = cfpMergeById(parsed.backtests, defaults.backtests);
    // plain-text content sections: reset to the freshest shipped copy if the
    // visitor's cache predates this content version
    if (isStale) {
      merged.hero = defaults.hero;
      merged.about = defaults.about;
      merged.stats = defaults.stats;
      merged.contact = defaults.contact;
      merged.legal = defaults.legal;
      // courses/testimonials are still code-managed (no real admin edits
      // yet), so a shipped content fix should always win on a stale cache
      merged.courses = JSON.parse(JSON.stringify(defaults.courses));
      merged.testimonials = JSON.parse(JSON.stringify(defaults.testimonials));
    }
    merged._contentVersion = CFP_CONTENT_VERSION;
    (merged.backtests || []).forEach(b => { b._useTimeWindow = true; });
    return merged;
  } catch (e) {
    console.warn('cfpLoadData failed, falling back to defaults', e);
    const d = JSON.parse(JSON.stringify(CFP_DEFAULT_DATA));
    (d.backtests || []).forEach(b => { b._useTimeWindow = true; });
    return d;
  }
}

function cfpSaveData(data) {
  localStorage.setItem(CFP_STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(CFP_STORAGE_KEY + '_updated', new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
}

/* Record a new Razorpay-style transaction (call this from the real payment handler once Razorpay is live) */
function cfpRecordTransaction(tx) {
  const data = cfpLoadData();
  data.transactions = data.transactions || [];
  data.transactions.unshift(Object.assign({ id: Date.now(), date: new Date().toLocaleString('en-IN') }, tx));
  cfpSaveData(data);
}

/* Record a new form submission (booking modal / contact form) */
function cfpRecordSubmission(sub) {
  const data = cfpLoadData();
  data.submissions = data.submissions || [];
  data.submissions.unshift(Object.assign({ id: Date.now(), date: new Date().toLocaleString('en-IN') }, sub));
  cfpSaveData(data);
}

/* Content access: articles use their explicit `access` field ('free' or 'premium').
   Backtests use a 30-day rolling window — free for first 30 days, then premium. */
const CFP_FREE_WINDOW_DAYS = 30;

function cfpEffectiveAccess(item) {
  if (!item) return 'premium';
  if (item.access === 'premium') return 'premium';
  if (item._useTimeWindow) {
    const parsed = new Date(item.date);
    if (isNaN(parsed.getTime())) return item.access || 'free';
    const ageDays = (Date.now() - parsed.getTime()) / 86400000;
    return ageDays <= CFP_FREE_WINDOW_DAYS ? 'free' : 'premium';
  }
  return item.access || 'free';
}

/* ==============================================
   SUPABASE ROW <-> LOCAL-SHAPE MAPPERS
   Shared by the admin dashboard (read + write) and the public site
   (read-only) so the two never drift apart. Supabase ids are uuid
   strings; cfpTempId() marks a row that hasn't been saved yet.
   ============================================== */
function cfpIsUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function cfpTempId() { return 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2); }

function cfpToISODate(displayDate) {
  const d = new Date(displayDate);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
function cfpFromISODate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function cfpSlugify(s) {
  return (s || '').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function cfpCourseToRow(c, index) {
  return {
    name: c.name, subtitle: c.subtitle, desc: c.desc, level: c.level,
    group_name: c.group || null,
    features: c.features || [],
    features_rich: c.featuresRich || '',
    price: c.price || '',
    price_sub: c.priceSub || '',
    cta_label: c.ctaLabel || '',
    cta_link: c.ctaLink || '',
    is_modal: !!c.isModal,
    sort_order: index
  };
}
function cfpRowToCourse(r) {
  return {
    id: r.id, name: r.name, subtitle: r.subtitle, desc: r.desc, level: r.level,
    group: r.group_name || '', features: r.features || [], featuresRich: r.features_rich || '',
    price: r.price || '', priceSub: r.price_sub || '', ctaLabel: r.cta_label || '', ctaLink: r.cta_link || '',
    isModal: !!r.is_modal
  };
}

function cfpTestimonialToRow(t, index) {
  return { name: t.name, role: t.role, rating: t.rating, quote: t.quote, sort_order: index, is_published: true };
}
function cfpRowToTestimonial(r) {
  return { id: r.id, name: r.name, role: r.role, rating: r.rating, quote: r.quote };
}

function cfpArticleToRow(a) {
  return {
    title: a.title, excerpt: a.excerpt, body: a.body, category: a.category,
    cat: a.cat || cfpSlugify(a.category),
    access: a.access, date: cfpToISODate(a.date), icon: a.icon, color: a.color, bg: a.bg,
    featured: !!a.featured, readtime: a.readtime || ''
  };
}
function cfpRowToArticle(r) {
  return {
    id: r.id, title: r.title, excerpt: r.excerpt, body: r.body, category: r.category,
    cat: r.cat || '', access: r.access, date: cfpFromISODate(r.date), icon: r.icon, color: r.color, bg: r.bg,
    featured: !!r.featured, readtime: r.readtime || ''
  };
}

function cfpBacktestToRow(b) {
  /* Backtests don't have an admin-set access field — the public site
     always derives effective access from the 30-day rolling window
     (see cfpEffectiveAccess above), so this always writes 'free'.
     chart_image is a public Supabase Storage URL (see admin/script.js's
     upload to the backtest-charts bucket) — null when no chart was
     uploaded, in which case the public site falls back to the icon. */
  return {
    title: b.title, excerpt: b.excerpt, body: b.body, instrument: b.instrument, timeframe: b.timeframe,
    result: b.result || null, access: 'free',
    date: cfpToISODate(b.date), icon: b.icon, color: b.color, bg: b.bg, readtime: b.readtime || '',
    chart_image: b.chartImage || null
  };
}
function cfpRowToBacktest(r) {
  return {
    id: r.id, title: r.title, excerpt: r.excerpt, body: r.body, instrument: r.instrument, timeframe: r.timeframe,
    result: r.result || '', date: cfpFromISODate(r.date), icon: r.icon, color: r.color, bg: r.bg, readtime: r.readtime || '',
    chartImage: r.chart_image || ''
  };
}

/* ==============================================
   PUBLIC SITE DATA LOADER (Supabase-backed)
   Same shape as cfpLoadData(), but reads from Supabase instead of
   localStorage, so admin edits show up live on the public site.
   Falls back to CFP_DEFAULT_DATA piece-by-piece (per section, and
   entirely if Supabase isn't configured or unreachable) so the site
   never breaks while Supabase is being set up.
   ============================================== */
async function cfpLoadPublicData() {
  const defaults = CFP_DEFAULT_DATA;
  if (typeof window.cfpSupabase === 'undefined') {
    const d = JSON.parse(JSON.stringify(defaults));
    (d.backtests || []).forEach(b => { b._useTimeWindow = true; });
    return d;
  }

  try {
    const [siteRes, coursesRes, testRes, artRes, btRes] = await Promise.all([
      window.cfpSupabase.from('site_content').select('key, value'),
      window.cfpSupabase.from('courses').select('*').order('sort_order', { ascending: true }),
      window.cfpSupabase.from('testimonials').select('*').eq('is_published', true).order('sort_order', { ascending: true }),
      window.cfpSupabase.from('articles').select('*').order('date', { ascending: false }),
      window.cfpSupabase.from('backtests').select('*').order('date', { ascending: false })
    ]);

    const siteMap = {};
    (siteRes.data || []).forEach(r => { siteMap[r.key] = r.value; });

    const courses = (coursesRes.data && coursesRes.data.length) ? coursesRes.data.map(cfpRowToCourse) : defaults.courses;
    const testimonials = (testRes.data && testRes.data.length) ? testRes.data.map(cfpRowToTestimonial) : defaults.testimonials;
    const articles = (artRes.data && artRes.data.length) ? artRes.data.map(cfpRowToArticle) : defaults.articles;
    const backtests = (btRes.data && btRes.data.length)
      ? btRes.data.map(r => Object.assign(cfpRowToBacktest(r), { _useTimeWindow: true }))
      : JSON.parse(JSON.stringify(defaults.backtests)).map(b => Object.assign(b, { _useTimeWindow: true }));

    return {
      hero: siteMap.hero || defaults.hero,
      about: siteMap.about || defaults.about,
      stats: siteMap.stats || defaults.stats,
      contact: siteMap.contact || defaults.contact,
      legal: siteMap.legal || defaults.legal,
      courses, testimonials, articles, backtests
    };
  } catch (e) {
    console.warn('cfpLoadPublicData failed, falling back to defaults', e);
    const d = JSON.parse(JSON.stringify(defaults));
    (d.backtests || []).forEach(b => { b._useTimeWindow = true; });
    return d;
  }
}
