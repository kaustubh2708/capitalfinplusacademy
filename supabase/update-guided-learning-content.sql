-- ============================================================
-- One-off backfill: the original add-pricing-tier-courses.sql run
-- happened before the ESSENTIALS/EDGE/PRECISION curriculum was added
-- to that file, so the Guided Learning row's features_rich is still
-- empty. This updates just that field in place — safe to run once,
-- and safe to re-run (idempotent, always sets the same content).
-- ============================================================

update public.courses
set features_rich = $rich$## ESSENTIALS
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
A practical, market-tested framework designed to help traders move from confusion and guesswork to clarity, confidence, and consistency.$rich$
where name = 'Guided Learning';
