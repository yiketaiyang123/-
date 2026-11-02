import assert from 'node:assert';
import { difficultyTarget, successLevel, runCheck, metaNarrative, attrValue } from '../src/checks.js';

assert.equal(difficultyTarget(60, '常规'), 60);
assert.equal(difficultyTarget(60, '困难'), 30);
assert.equal(difficultyTarget(60, '极难'), 12);

assert.equal(successLevel(5, 60), '大成功');
assert.equal(successLevel(12, 60), '极难成功');
assert.equal(successLevel(30, 60), '困难成功');
assert.equal(successLevel(60, 60), '普通成功');
assert.equal(successLevel(61, 60), '失败');
assert.equal(successLevel(96, 40), '大失败');
assert.equal(successLevel(100, 60), '大失败');

assert.equal(attrValue({ 幸运: 70, 魅力: 50 }, ['幸运', '魅力']), 60);

const abs = runCheck({ 力量: 60 }, ['力量'], '绝对失败');
assert.equal(abs.roll, null);
assert.equal(abs.success, false);
assert.match(metaNarrative(['力量'], abs), /绝对失败/);

const r = runCheck({ 感知: 52 }, ['感知'], '常规');
assert.ok(r.roll >= 1 && r.roll <= 100);
assert.equal(r.target, 52);
assert.match(metaNarrative(['感知'], r), /发起了【感知】检定，1d100=/);

console.log('core checks OK');
