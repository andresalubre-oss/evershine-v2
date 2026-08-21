// backend/lib/paymongo.js
//
// Thin wrapper around PayMongo's QR Ph flow. Everything runs server-side
// with the secret key, so the key is never exposed to the frontend.

const PAYMONGO_API = 'https://api.paymongo.com/v1';

function authHeader() {
  return 'Basic ' + Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');
}

async function paymongoRequest(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || 'PayMongo request failed';
    throw new Error(message);
  }
  return data;
}

// amountInCentavos: e.g. ₱250.00 -> 25000
async function createPaymentIntent(amountInCentavos, description) {
  return paymongoRequest(`${PAYMONGO_API}/payment_intents`, 'POST', {
    data: {
      attributes: {
        amount: amountInCentavos,
        currency: 'PHP',
        payment_method_allowed: ['qrph'],
        description,
      },
    },
  });
}

async function createQrPhPaymentMethod(expirySeconds) {
  return paymongoRequest(`${PAYMONGO_API}/payment_methods`, 'POST', {
    data: {
      attributes: {
        type: 'qrph',
        ...(expirySeconds ? { expiry_seconds: expirySeconds } : {}),
      },
    },
  });
}

async function attachPaymentMethod(paymentIntentId, paymentMethodId, clientKey) {
  return paymongoRequest(`${PAYMONGO_API}/payment_intents/${paymentIntentId}/attach`, 'POST', {
    data: {
      attributes: {
        payment_method: paymentMethodId,
        client_key: clientKey,
      },
    },
  });
}

async function getPaymentIntent(paymentIntentId) {
  return paymongoRequest(`${PAYMONGO_API}/payment_intents/${paymentIntentId}`, 'GET');
}

module.exports = {
  createPaymentIntent,
  createQrPhPaymentMethod,
  attachPaymentMethod,
  getPaymentIntent,
};