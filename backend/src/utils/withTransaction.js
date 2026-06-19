import mongoose from 'mongoose';

// Remembers whether the connected MongoDB supports multi-document transactions
// so we only probe once.
let transactionsSupported = null;

function isUnsupported(err) {
  const message = err?.message || '';
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set|Transactions are not supported|replica set member or mongos/i.test(
      message
    )
  );
}

// Runs `fn` inside a transaction when the deployment supports it (a replica set
// or mongos), giving truly atomic multi-document commits. On a standalone
// MongoDB it transparently falls back to running `fn` without a session — the
// caller is responsible for its own compensation in that mode. `fn` receives the
// session (or null) to pass into each query.
export async function withTransaction(fn) {
  if (transactionsSupported === false) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    if (transactionsSupported === null && isUnsupported(err)) {
      transactionsSupported = false;
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
