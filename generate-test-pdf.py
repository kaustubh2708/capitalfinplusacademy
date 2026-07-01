#!/usr/bin/env python3
"""
Generate a sample CFA Trading Framework PDF for Capital Finplus Academy.
Output: cfa-framework-sample.pdf (same directory as this script)

Install dependency if needed:
  pip install reportlab --break-system-packages
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable

# ── Palette ──────────────────────────────────────────────
DARK_BG    = colors.HexColor('#0f1117')
GOLD       = colors.HexColor('#F4C20D')
GOLD_DIM   = colors.HexColor('#c49a0a')
WHITE      = colors.white
MUTED      = colors.HexColor('#9ca3af')
SURFACE    = colors.HexColor('#1a1d27')

W, H = A4

# ── Styles ───────────────────────────────────────────────
def make_styles():
    return {
        'cover_title': ParagraphStyle('ct', fontName='Helvetica-Bold', fontSize=36, textColor=GOLD,
                                       leading=44, spaceAfter=12, alignment=1),
        'cover_sub':   ParagraphStyle('cs', fontName='Helvetica', fontSize=14, textColor=MUTED,
                                       leading=20, spaceAfter=8, alignment=1),
        'cover_byline':ParagraphStyle('cb', fontName='Helvetica', fontSize=11, textColor=WHITE,
                                       leading=16, spaceAfter=6, alignment=1),
        'cover_warn':  ParagraphStyle('cw', fontName='Helvetica-Oblique', fontSize=9, textColor=MUTED,
                                       leading=14, alignment=1),
        'h1':  ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, textColor=GOLD,
                               leading=26, spaceAfter=10, spaceBefore=6),
        'h2':  ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=14, textColor=GOLD,
                               leading=20, spaceAfter=6, spaceBefore=14),
        'h3':  ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=11, textColor=WHITE,
                               leading=16, spaceAfter=4, spaceBefore=10),
        'body':ParagraphStyle('body', fontName='Helvetica', fontSize=10, textColor=WHITE,
                               leading=16, spaceAfter=6),
        'muted':ParagraphStyle('muted', fontName='Helvetica', fontSize=9.5, textColor=MUTED,
                                leading=15, spaceAfter=4),
        'bullet':ParagraphStyle('bullet', fontName='Helvetica', fontSize=10, textColor=WHITE,
                                 leading=16, spaceAfter=4, leftIndent=16, bulletIndent=4),
        'small': ParagraphStyle('small', fontName='Helvetica-Oblique', fontSize=8.5, textColor=MUTED,
                                 leading=13, alignment=1),
    }

S = make_styles()

# ── Page template (dark background + footer) ─────────────
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # gold top rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.5)
    canvas.line(2*cm, H - 1.3*cm, W - 2*cm, H - 1.3*cm)
    # footer
    canvas.setFillColor(MUTED)
    canvas.setFont('Helvetica', 7.5)
    canvas.drawString(2*cm, 1.1*cm, 'Capital Finplus Academy  |  For enrolled students only')
    canvas.drawRightString(W - 2*cm, 1.1*cm, f'Page {doc.page}')
    canvas.restoreState()

def on_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # large gold pentagon watermark
    canvas.setStrokeColor(colors.HexColor('#F4C20D22'))
    canvas.setFillColor(colors.HexColor('#F4C20D06'))
    canvas.setLineWidth(2)
    import math
    cx, cy, r = W/2, H/2, 180
    pts = [(cx + r*math.sin(math.radians(72*i - 90)), cy + r*math.cos(math.radians(72*i - 90))) for i in range(5)]
    p = canvas.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]: p.lineTo(*pt)
    p.close()
    canvas.drawPath(p, fill=1, stroke=1)
    canvas.restoreState()

# ── Helpers ───────────────────────────────────────────────
def rule():
    return HRFlowable(width='100%', thickness=0.5, color=GOLD_DIM, spaceAfter=10, spaceBefore=4)

def bullet(text):
    return Paragraph(f'▸  {text}', S['bullet'])

def pb(): return PageBreak()

# ── Content ───────────────────────────────────────────────
def build_story():
    story = []

    # ── COVER ──────────────────────────────────────────────
    story += [
        Spacer(1, 5*cm),
        Paragraph('CFA Trading Framework', S['cover_title']),
        rule(),
        Spacer(1, 0.4*cm),
        Paragraph('Capital Finplus Academy', S['cover_sub']),
        Paragraph('Structured Approach to Indian Markets', S['cover_sub']),
        Spacer(1, 1.5*cm),
        Paragraph('Pravesh Kumar', S['cover_byline']),
        Paragraph('15+ Years in Indian Financial Markets', S['cover_byline']),
        Spacer(1, 6*cm),
        Paragraph('For enrolled students only — not for redistribution', S['cover_warn']),
        pb(),
    ]

    # ── PAGE 2: INTRODUCTION ───────────────────────────────
    story += [
        Paragraph('Introduction', S['h1']),
        rule(),
        Paragraph(
            'Most traders fail not because they lack indicators or strategies, but because they lack structure. '
            'The CFA Trading Framework was built over 15 years of active participation in Indian equity and derivatives markets, '
            'distilling what actually works into a repeatable, disciplined process.',
            S['body']),
        Spacer(1, 0.4*cm),
        Paragraph(
            'This framework is not a "buy here, sell there" signal system. It is a complete methodology for reading the market, '
            'building a structured trade thesis, and executing with defined risk — every single time.',
            S['body']),
        Spacer(1, 0.8*cm),
        Paragraph('Three Core Principles', S['h2']),
        Spacer(1, 0.2*cm),
    ]
    principles = [
        ('Market Structure First', 'Before any indicator or setup, understand what the market is doing structurally. Trend, range, or reversal — the structure defines your bias.'),
        ('Process over Prediction', 'No one predicts the market consistently. What separates profitable traders is a repeatable process that manages outcomes across many trades.'),
        ('Risk Management is Non-Negotiable', 'Protecting capital is the first job of every trade. Entries are secondary to exits. Every trade has a defined invalidation level before it is placed.'),
    ]
    for title, desc in principles:
        story += [
            Paragraph(title, S['h3']),
            Paragraph(desc, S['muted']),
        ]
    story.append(pb())

    # ── PAGES 3-4: ESSENTIALS ─────────────────────────────
    story += [
        Paragraph('Module 1 — ESSENTIALS', S['h1']),
        Paragraph('Understanding What Drives Price', S['cover_sub'].clone('cs2', textColor=MUTED, alignment=0, fontSize=11)),
        rule(),
        Paragraph('What Drives Price Movement', S['h2']),
        Paragraph(
            'Price in any market is driven by supply and demand imbalances. Understanding where buyers and sellers have historically stepped in '
            'gives you a structural edge that no indicator can replicate. The market leaves footprints — your job is to read them.',
            S['body']),
        Spacer(1, 0.4*cm),
        Paragraph('Market Structure Basics', S['h2']),
        Paragraph('Market structure is described by swing highs and swing lows. The four key states:', S['body']),
        bullet('Higher Highs (HH) + Higher Lows (HL) → Uptrend — buyers in control'),
        bullet('Lower Lows (LL) + Lower Highs (LH) → Downtrend — sellers in control'),
        bullet('Equal swing highs and lows → Range / consolidation'),
        bullet('Break of structure (BoS) → Potential trend change — highest probability zone'),
        Spacer(1, 0.6*cm),
        Paragraph('Why a Structured System Beats Discretion', S['h2']),
        Paragraph(
            'Discretionary trading without a system means your psychology is the only filter. Markets are designed to trigger emotional responses — '
            'FOMO at tops, panic at bottoms. A structured system removes emotion from individual decisions by pre-defining every rule.',
            S['body']),
        Spacer(1, 0.4*cm),
        bullet('Consistency comes from repeating the same correct process, not from being right every trade'),
        bullet('Backtesting your system against historical data builds conviction — and reveals its real edge'),
        bullet('A system with a 45% win rate and 2:1 reward-to-risk is vastly more profitable than a 70% win rate with 1:2 RR'),
        pb(),
    ]

    # ── PAGES 5-6: EDGE ───────────────────────────────────
    story += [
        Paragraph('Module 2 — EDGE', S['h1']),
        Paragraph('The CFA Trading System', S['cover_sub'].clone('cs3', textColor=MUTED, alignment=0, fontSize=11)),
        rule(),
        Paragraph('Chart Setup Guide', S['h2']),
        Paragraph('Use a clean chart. The recommended setup for the CFA system:', S['body']),
        bullet('Timeframes: 15-min for execution, 1-hour for context, Daily for bias'),
        bullet('No lagging indicators on the primary chart — price action only'),
        bullet('Horizontal S/R levels from swing highs and lows (daily TF minimum)'),
        bullet('Volume profile on the weekly chart to identify high-value areas'),
        Spacer(1, 0.6*cm),
        Paragraph('Timeframe Alignment', S['h2']),
        Paragraph(
            'The highest-probability setups occur when the trade direction is aligned across all three timeframes. '
            'A bullish structure on the Daily, a pullback on the 1H to a support zone, and a bullish trigger candle on the 15M '
            '— this is the CFA three-timeframe confluence model.',
            S['body']),
        Spacer(1, 0.6*cm),
        Paragraph('Entry / Stop-Loss / Target Methodology', S['h2']),
        bullet('Entry: After a confirmed structural trigger (e.g., engulfing candle above a broken level) on the 15M'),
        bullet('Stop-Loss: Placed below the last swing low (long) or above the last swing high (short), plus a small buffer for spread'),
        bullet('Target: Minimum 1.5× the stop-loss distance; close 50% at 1:1 and trail the rest'),
        Spacer(1, 0.6*cm),
        Paragraph('Backtesting Introduction', S['h2']),
        Paragraph(
            'Before trading any setup live, backtest it manually across at least 50 historical instances. '
            'Log each trade: entry, SL, target, outcome, and why you took it. '
            'This builds both the statistical edge and the pattern recognition that comes with screen time.',
            S['body']),
        pb(),
    ]

    # ── PAGES 7-8: PRECISION ──────────────────────────────
    story += [
        Paragraph('Module 3 — PRECISION', S['h1']),
        Paragraph('Options Premium & Advanced Execution', S['cover_sub'].clone('cs4', textColor=MUTED, alignment=0, fontSize=11)),
        rule(),
        Paragraph('Why Premium Charts Matter for Option Buyers', S['h2']),
        Paragraph(
            'Most option buyers focus only on the underlying\'s chart and ignore the option premium chart. '
            'This is a critical mistake. The premium chart shows you whether you\'re paying fair value or overpaying due to '
            'elevated IV, and it reveals real support/resistance levels specific to the option you\'re buying.',
            S['body']),
        Spacer(1, 0.4*cm),
        bullet('Trade the premium chart, not just the spot chart — structure applies equally'),
        bullet('Buying options when IV Rank > 70 means you\'re overpaying; wait for IV compression'),
        bullet('Premium support/resistance levels tend to hold more cleanly than spot levels for intraday setups'),
        Spacer(1, 0.6*cm),
        Paragraph('Strike Selection', S['h2']),
        Paragraph(
            'Strike selection is determined by three factors: delta, premium level, and market structure. '
            'For directional trades, use ATM or one-strike OTM. For swing trades, go one more strike OTM to manage cost. '
            'Never buy deep OTM options hoping for a moonshot — they require exceptional timing and are statistically unprofitable.',
            S['body']),
        Spacer(1, 0.6*cm),
        Paragraph('Timing with Market Structure', S['h2']),
        bullet('Enter options only after structural confirmation on the underlying — not before'),
        bullet('Avoid entering options within 30 minutes of market open (high volatility, wide spreads)'),
        bullet('Premium expansion typically follows a break of structure — time your entry for the re-test, not the initial break'),
        Spacer(1, 0.6*cm),
        Paragraph('Position Sizing', S['h2']),
        Paragraph(
            'Never risk more than 2% of total trading capital on a single option position. '
            'Calculate position size as: (Capital × 2%) ÷ (Entry Premium × Lot Size). '
            'For most retail traders starting out, one lot with a hard stop on the premium is the correct size.',
            S['body']),
        pb(),
    ]

    # ── PAGE 9: RISK MANAGEMENT ───────────────────────────
    story += [
        Paragraph('Risk Management', S['h1']),
        rule(),
        Paragraph('The 2% Rule', S['h2']),
        Paragraph(
            'Risk no more than 2% of your total trading capital on any single trade. '
            'This ensures that even a streak of 10 consecutive losing trades only draws down your account by ~18%, '
            'leaving you fully capable of recovering without changing position size.',
            S['body']),
        Spacer(1, 0.4*cm),
        Paragraph('Drawdown Limits', S['h2']),
        bullet('Daily loss limit: 3% of total capital. If hit, stop trading for the day — no exceptions'),
        bullet('Weekly drawdown limit: 6%. If hit, reduce position size by 50% for the following week'),
        bullet('Monthly drawdown limit: 10%. If hit, take a full week off and review your trade journal'),
        Spacer(1, 0.6*cm),
        Paragraph('The Trade Journal', S['h2']),
        Paragraph(
            'Every serious trader keeps a journal. Not just trade logs — but observations about your mental state, '
            'why you took each trade, and what you would do differently. '
            'Review your journal every Sunday. Look for patterns in your mistakes, not just your wins.',
            S['body']),
        Spacer(1, 0.6*cm),
        Paragraph('Psychology Checklist', S['h2']),
        bullet('Am I trading within my pre-defined plan, or am I improvising?'),
        bullet('Has this setup appeared in my backtest with positive expectancy?'),
        bullet('Am I risking more because I want to recover recent losses? (Revenge trading — stop immediately)'),
        bullet('Have I slept well, eaten, and am I in a calm mental state?'),
        bullet('Is my stop-loss placed before I enter, with the exact size already calculated?'),
        pb(),
    ]

    # ── PAGE 10: DISCLAIMER ───────────────────────────────
    story += [
        Paragraph('Important Disclaimer', S['h1']),
        rule(),
        Spacer(1, 0.4*cm),
        Paragraph(
            'This document is produced by Capital Finplus Academy solely for educational purposes. '
            'It is intended for enrolled students of the CFA Trading Framework programme and is not for redistribution, resale, or publication.',
            S['body']),
        Spacer(1, 0.5*cm),
        Paragraph(
            'Capital Finplus Academy is an educational institution and is not registered as an investment adviser, '
            'portfolio manager, or stock broker under the Securities and Exchange Board of India (SEBI) Act, 1992. '
            'Nothing in this document constitutes investment advice, a recommendation to buy or sell any security, '
            'or a solicitation of any investment decision.',
            S['body']),
        Spacer(1, 0.5*cm),
        Paragraph(
            'Trading in equities, derivatives, and other financial instruments involves substantial risk of loss and is '
            'not suitable for all investors. Past performance of any system, strategy, or methodology described herein '
            'is not indicative of future results. You may lose some or all of your invested capital.',
            S['body']),
        Spacer(1, 0.5*cm),
        Paragraph(
            'Students are advised to consult a SEBI-registered investment adviser before making any investment decisions. '
            'All examples, trades, and case studies referenced in this framework are for illustration and learning purposes only.',
            S['body']),
        Spacer(1, 1.5*cm),
        Paragraph('© 2026 Capital Finplus Academy. All rights reserved.', S['small']),
        Paragraph('Pravesh Kumar | connect@capitalfinplusadvizors.com | capitalfinplusadvizors.com', S['small']),
    ]

    return story

# ── Build ─────────────────────────────────────────────────
if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'cfa-framework-sample.pdf')
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.2*cm, bottomMargin=2*cm,
    )
    story = build_story()
    doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
    print(f'✅  PDF generated: {out}')
