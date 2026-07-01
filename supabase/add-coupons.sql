-- Coupon / promo code system
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL,
  valid_from     TIMESTAMPTZ DEFAULT now(),
  valid_until    TIMESTAMPTZ,
  max_uses       INT DEFAULT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id  UUID REFERENCES coupons(id),
  email      TEXT NOT NULL,
  course_id  TEXT NOT NULL,
  used_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coupon_id, email)
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read coupons" ON coupons FOR SELECT USING (true);
CREATE POLICY "service role only coupon_uses" ON coupon_uses USING (false);
