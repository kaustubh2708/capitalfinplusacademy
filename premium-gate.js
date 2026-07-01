/* ==============================================
   Capital Finplus Academy — premium-gate.js
   Determines whether a user has unlocked premium
   blog/backtesting content — true if they have at
   least one active course enrollment. Depends on
   window.cfpSupabase (see supabase-client.js).
   ============================================== */
(function () {
  async function canAccessPremium(userId) {
    if (!userId || !window.cfpSupabase) return false;
    const { count, error } = await window.cfpSupabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) {
      console.error('canAccessPremium query failed', error);
      return false;
    }
    return (count || 0) > 0;
  }

  /* Tiered backtest access, per the comparison table on index.html —
     blog access stays all-or-nothing (canAccessPremium above); only
     backtesting.js uses this. Priority if a user has multiple active
     enrollments: Mentorship > CFA Framework > Guided Learning >
     Self-Study (highest tier wins). Returns:
       - null   -> no extra restriction (Mentorship/CFA Framework tier,
                   OR no active enrollment at all — in the latter case
                   canAccessPremium() already gates the content, so this
                   value is moot)
       - Date   -> only backtests dated on/after this cutoff are unlocked
                   for an otherwise-premium item (free items are still
                   governed separately by cfpEffectiveAccess) */
  const CFP_TIER_PRIORITY = [
    { name: 'Mentorship Program', days: null },
    { name: 'The CFA Academy Framework for Stock Investing', days: null },
    { name: 'Guided Learning', days: 90 },
    { name: 'Self-Study', days: 30 }
  ];

  async function getBacktestCutoffDate(userId) {
    if (!userId || !window.cfpSupabase) return null;
    const { data, error } = await window.cfpSupabase
      .from('enrollments')
      .select('status, courses(name)')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) {
      console.error('getBacktestCutoffDate query failed', error);
      return null;
    }
    const enrolledNames = (data || []).map(r => (r.courses && r.courses.name) || '').filter(Boolean);
    const tier = CFP_TIER_PRIORITY.find(t => enrolledNames.includes(t.name));
    if (!tier || tier.days === null) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tier.days);
    return cutoff;
  }

  window.canAccessPremium = canAccessPremium;
  window.getBacktestCutoffDate = getBacktestCutoffDate;
})();
