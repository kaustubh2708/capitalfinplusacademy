/* ==============================================
   Vercel Serverless Function — POST /api/create-order
   Creates a Razorpay order server-side so the Key Secret
   never touches the browser. Requires these env vars to be
   set in the Vercel project (Settings -> Environment Variables):
     RAZORPAY_KEY_ID
     RAZORPAY_KEY_SECRET
   ============================================== */

const Razorpay = require('razorpay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay keys are not configured on the server yet.' });
  }

  const { amount, courseId, courseName, name, email, phone, user_id } = req.body || {};

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'A valid amount (in paise) is required.' });
  }
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }

  try {
    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    /* user_id rides along in Razorpay's own order notes so verify-payment
       can fetch it straight from Razorpay (trusted, since it was set here
       server-side) instead of trusting whatever the client claims at
       verification time. Optional — guest checkout (no logged-in user)
       still works, it just won't produce an enrollment row. */
    const order = await razorpay.orders.create({
      amount, // paise — e.g. 599900 for ₹5,999
      currency: 'INR',
      receipt: 'cfa_' + Date.now(),
      notes: { courseId: String(courseId || ''), courseName: courseName || '', name, email, phone, user_id: user_id || '' }
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID // public key id — safe to send to the browser
    });
  } catch (err) {
    console.error('create-order failed', err);
    return res.status(500).json({ error: 'Could not create Razorpay order.' });
  }
};
