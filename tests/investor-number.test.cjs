const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/detail-presentation-loader.cjs');

const { formatInvestorNumber, formatInvestorAmount } = loader()('lib/investor-number.ts');

test('rounds displayed units without losing exact large decimal values or original zero', () => {
  assert.equal(formatInvestorNumber('9007199254740993.5', '원'), '9,007,199,254,740,994');
  assert.equal(formatInvestorAmount('-9007199254740993.125', '%'), '−9,007,199,254,740,993.13%');
  assert.equal(formatInvestorAmount('1.235', '배', true), '+1.24배');
  assert.equal(formatInvestorAmount('-0.000', '%p', true), '0%p');
  assert.equal(formatInvestorAmount('10.99999', '배'), '11배');
  assert.equal(formatInvestorAmount(null, '%'), '—');
  assert.equal(formatInvestorAmount(Infinity, '원'), '—');
});

test('displays a significant digit when ordinary precision would hide a nonzero amount', () => {
  assert.equal(formatInvestorAmount('0.0041', '%p', true), '+0.004%p');
  assert.equal(formatInvestorAmount('-0.00299', '%'), '−0.003%');
  assert.equal(formatInvestorAmount('0.041', '원'), '0.04원');
  assert.equal(formatInvestorAmount('-1.95e-10', '배'), '−2e−10배');
  assert.equal(formatInvestorAmount('0.0000009999', '%'), '0.000001%');
});
