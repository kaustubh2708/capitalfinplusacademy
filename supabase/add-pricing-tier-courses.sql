-- ============================================================
-- courses: add the 3 new pricing-tier cards (Self-Study, Guided
-- Learning, Mentorship Program) and a `plan_only` flag so they
-- render in the 3-column pricing block above the comparison table
-- instead of the full course grid below it.
--
-- Run once in Supabase's SQL Editor. Safe to re-run (the column add
-- is idempotent; re-running the inserts will create duplicates, so
-- only run the insert block once).
-- ============================================================

alter table public.courses add column if not exists plan_only boolean not null default false;

insert into public.courses (name, subtitle, "desc", level, group_name, features, features_rich, price, price_sub, cta_label, cta_link, is_modal, plan_only, sort_order) values
('Self-Study', 'Independent Learning Track', 'For traders who prefer to learn independently through structured documentation and daily post market analysis. Can upgrade to guided learning and mentorship program anytime.', 'Self-Study', null,
 '["Complete PDF trading framework","Detailed setup documentation","Last 1 month access to backtest documents","Daily Post-Market Analysis","Weekly Setup Performance Review live session","Self-paced implementation support"]'::jsonb,
 '', '₹860', '+ GST · One-time', 'Start Self-Study', 'payment.html?course=4', false, true, 3),

('Guided Learning', 'Live Classes + Backtesting', 'For traders seeking deeper understanding through live classes, recorded sessions, and extensive backtesting. Can upgrade to mentorship program anytime.', 'Guided Learning', null,
 '["PDF framework + Live/Recorded sessions","Video explanations and live sessions","Last 3 months access to backtest documents","3 months of recorded/live backtesting sessions","Daily Post-Market Analysis","Weekly Setup Performance Review live session","Limited one-to-one interaction during sessions","Guided learning implementation support"]'::jsonb,
 $rich$## ESSENTIALS
Build the Right Foundation
Before placing your first trade, understand how markets truly function.
- What drives price movement?
- Why do trends and patterns form?
- Understanding market structure and price behaviour
- Developing the right mindset and approach to trading, and the right way to think
- The importance of a structured trading system
- Need of a trading system and structure-aligned setups
- All about traps and fakeouts
- CFA Trading framework explained
> Outcome: Gain a clear understanding of how markets move and why structure must come before indicators. Essentials includes CFA post-market Daily Analysis as a means to forward test.

## EDGE
Develop a Structured & Repeatable Trading Process
Learn the complete CFA Trading Framework and the logic behind every trade.
- The complete CFA Trading System
- Why the system works across different market conditions
- Chart setup and workspace configuration
- Tools to identify Market Structure and trend identification
- Timeframe selection and alignment
- Entry, Target and Stop Loss methodology
- Detailed backtesting
- Building confidence through data-driven validation
> Outcome: Develop a repeatable framework that helps identify high-probability trading opportunities with predefined risk. EDGE and PRECISION include live market support as and when a setup is formed.

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
> Outcome: Learn to execute trades with greater precision, better timing, and improved risk management using option premium charts.

## Final Promise
Learn the Structure. Develop the Edge. Execute with Precision.
A practical, market-tested framework designed to help traders move from confusion and guesswork to clarity, confidence, and consistency.$rich$,
 '₹6,500', '+ GST · One-time', 'Join Guided Learning', 'payment.html?course=5', false, true, 4),

('Mentorship Program', 'Personalized 1-on-1 Guidance', 'For traders who want personalized guidance, live market thought process, forward testing, and one-on-one mentorship.', 'Mentorship Program', null,
 '["PDF + Live sessions + personal guidance","Personalized implementation support","Complete website access","Up to 6 months of detailed backtesting sessions","Daily Post-Market Analysis","Weekly Setup Performance Review live session","Forward Testing & Live Structure Updates","WhatsApp CFA Inner Circle Community access","Investment Module Access","Dedicated one-to-one mentorship support","Live market thought process"]'::jsonb,
 $rich$## ESSENTIALS
Build the Right Foundation
Before placing your first trade, understand how markets truly function.
- What drives price movement?
- Why do trends and patterns form?
- Understanding market structure and price behaviour
- Developing the right mindset and approach to trading, and the right way to think
- The importance of a structured trading system
- Need of a trading system and structure-aligned setups
- All about traps and fakeouts
- CFA Trading framework explained
> Outcome: Gain a clear understanding of how markets move and why structure must come before indicators. Essentials includes CFA post-market Daily Analysis as a means to forward test.

## EDGE
Develop a Structured & Repeatable Trading Process
Learn the complete CFA Trading Framework and the logic behind every trade.
- The complete CFA Trading System
- Why the system works across different market conditions
- Chart setup and workspace configuration
- Tools to identify Market Structure and trend identification
- Timeframe selection and alignment
- Entry, Target and Stop Loss methodology
- Detailed backtesting
- Building confidence through data-driven validation
> Outcome: Develop a repeatable framework that helps identify high-probability trading opportunities with predefined risk. EDGE and PRECISION include live market support as and when a setup is formed.

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
> Outcome: Learn to execute trades with greater precision, better timing, and improved risk management using option premium charts.

## Final Promise
Learn the Structure. Develop the Edge. Execute with Precision.
A practical, market-tested framework designed to help traders move from confusion and guesswork to clarity, confidence, and consistency.$rich$,
 '₹24,000', '+ GST · One-time', 'Apply for Mentorship', 'payment.html?course=6', false, true, 5);
