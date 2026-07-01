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

  window.canAccessPremium = canAccessPremium;
})();
