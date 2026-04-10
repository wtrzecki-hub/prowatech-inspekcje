import { readFileSync } from 'fs';

const FUNC_URL = 'https://lhxhsprqoecepojrxepf.supabase.co/functions/v1/update-turbine-data';

const updates = JSON.parse(readFileSync('./findings_updates.json', 'utf-8'));
console.log(`Total updates: ${updates.length}`);

// Send in batches of 50
const batchSize = 50;
let totalSuccess = 0;
let totalFailed = 0;

for (let i = 0; i < updates.length; i += batchSize) {
  const batch = updates.slice(i, i + batchSize);
  try {
    const resp = await fetch(FUNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    const result = await resp.json();
    totalSuccess += result.success || 0;
    totalFailed += result.failed || 0;
    console.log(`Batch ${Math.floor(i/batchSize)}: ${result.success} ok, ${result.failed} failed`);
    if (result.errors?.length) console.log(`  Errors: ${result.errors.join(', ')}`);
  } catch (e) {
    console.log(`Batch ${Math.floor(i/batchSize)}: ERROR ${e.message}`);
    totalFailed += batch.length;
  }
}

console.log(`\nDone! Success: ${totalSuccess}, Failed: ${totalFailed}`);
