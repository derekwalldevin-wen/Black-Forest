/* ============================================================
 * contracts.js — 妖契
 *
 * 阶段二。遗物是「声明式 mods 的被动加值」，妖契要回答的是另一个问题：
 * 「一个妖契能否改变卡牌价值与出牌决策」。
 * 所以妖契不碰生命/格挡这类基础数值，只挂在**出牌行为**上——
 * 你为了触发它，会改变先打哪张牌、什么时候打。
 *
 * 与遗物并存而不是取代：遗物给数值，妖契给决策。两套系统在同一条
 * relicMods()/contractMods() 聚合路径上，CombatScene 每回合取一次。
 *
 * 所有数值都是候选值，未定版。后续调整只需改这里，
 * 战斗层读的是 mods，不硬编码任何数字。
 * ========================================================== */

const CONTRACT_DEFS = {
  /* ---------- 哥特半程 ---------- */
  huodou: {
    id: 'huodou', name: '祸斗契', color: 0xd97a2b, shape: 'flame',
    realm: 'gothic', tier: 1,
    text: '每回合打出的第一张攻击牌或符箓牌，使敌人获得 2 层灼烧。',
    // contractBurnLimit  = 每回合最多触发几次
    // contractBurnPerTurn = 每次给几层灼烧
    mods: { contractBurnLimit: 1, contractBurnPerTurn: 2 },
    ascend: 'huodou_yu'
  },

  /* ---------- 山海半程（升契产物，不直接掉落） ---------- */
  huodou_yu: {
    id: 'huodou_yu', name: '祸斗·墟契', color: 0xe8a03c, shape: 'flame',
    realm: 'shanhai', tier: 2,
    text: '每回合打出的前两张攻击牌或符箓牌，各使敌人获得 3 层灼烧。',
    mods: { contractBurnLimit: 2, contractBurnPerTurn: 3 },
    ascend: null
  }
};

const DEFAULT_CONTRACT = 'huodou';

function contractDef(id) {
  return CONTRACT_DEFS[id] || null;
}

/** 妖契能不能挂到这张牌上。
 *  只认 attack 与 talisman：这两类才有「打出去 = 造成伤害」这个动作，
 *  挂到格挡/抽牌类上会让玩家为了触发它去打无意义的牌。 */
function cardTriggersContract(cardDef) {
  if (!cardDef) return false;
  return cardDef.type === 'attack' || cardDef.type === 'talisman';
}

/** 本回合还能触发几次妖契。CombatScene 每张牌结算前调用，
 *  返回 0 就说明这条妖契已经用完，本回合不会再触发。 */
function contractBurnCharges(mods) {
  if (!mods) return 0;
  const limit = mods.contractBurnLimit || 0;
  if (limit <= 0) return 0;
  return Math.max(0, limit - (mods.__contractBurnUsed || 0));
}

/** 消耗一次触发机会，返回本次施加的灼烧层数（0 = 本回合不再触发）。 */
function spendContractBurn(mods) {
  if (!mods) return 0;
  const limit = mods.contractBurnLimit || 0;
  if (limit <= 0) return 0;
  const used = mods.__contractBurnUsed || 0;
  if (used >= limit) return 0;
  mods.__contractBurnUsed = used + 1;
  return mods.contractBurnPerTurn || 0;
}

/** 回合开始：触发计数清零。和共鸣一样是「本回合内」的计数。 */
function resetContractBurn(mods) {
  if (mods) mods.__contractBurnUsed = 0;
}
