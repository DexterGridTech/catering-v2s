import {createHash} from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');

function factRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('availability rows required');
  const facts = rows.map(row => {
    const availability = row?.expectedAvailability;
    if (typeof row?.itemCode !== 'string' || !row.itemCode
      || typeof row?.targetPresent !== 'boolean'
      || !availability || typeof availability.applicability !== 'string'
      || !(availability.state === null || typeof availability.state === 'string')
      || !(availability.reason === null || typeof availability.reason === 'string'))
      throw new TypeError('availability fact invalid');
    return Object.freeze({
      itemCode: row.itemCode,
      targetPresent: row.targetPresent,
      expectedAvailability: Object.freeze({
        applicability: availability.applicability,
        state: availability.state,
        reason: availability.reason,
      }),
    });
  });
  if (new Set(facts.map(row => row.itemCode)).size !== facts.length) throw new TypeError('availability codes duplicate');
  return Object.freeze(facts);
}

export function availabilityContractFactsFromPlan(plan) {
  return factRows(plan?.salesMenuAvailability?.items?.map(item => ({
    itemCode: item.code,
    targetPresent: item.expectedTarget !== null,
    expectedAvailability: item.expectedAvailability,
  })));
}

export function availabilityReceiptFacts(receipt) {
  const facts = factRows(receipt);
  if (receipt.some(row => typeof row?.catalogItemRef !== 'string' || !row.catalogItemRef))
    throw new TypeError('availability catalog reference invalid');
  return facts;
}

export function availabilityContractDigest(facts) {
  return digest(JSON.stringify(facts));
}

export function validateAvailabilityReceiptAgainstPlan({plan, receipt}) {
  const expected = availabilityContractFactsFromPlan(plan);
  const actual = availabilityReceiptFacts(receipt);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError('availability receipt differs from plan');
  return Object.freeze({
    itemCount: actual.length,
    contractDigest: availabilityContractDigest(expected),
  });
}
