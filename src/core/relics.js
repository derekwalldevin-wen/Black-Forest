/* ============================================================
 * relics.js — 遗物（《杀戮尖塔》深度系统 /《月圆之夜》轻量获得感）
 *
 * 遗物用「声明式 mods」而非回调，方便 UI 直接显示、方便聚合计算。
 * CombatScene 每回合开始时调用 RUN.relicMods() 拿一份总量表。
 * ========================================================== */

const RELIC_DEFS = {
  wolf_totem: {
    id: 'wolf_totem', name: '狼牙图腾', color: 0xa63d40, shape: 'fang',
    text: '每场战斗开始时，获得 1 点力量。',
    mods: { startStrength: 1 }
  },
  iron_ring: {
    id: 'iron_ring', name: '铁誓指环', color: 0x8a92a8, shape: 'ring',
    text: '每场战斗开始时，获得 6 点格挡。',
    mods: { startBlock: 6 }
  },
  moon_lens: {
    id: 'moon_lens', name: '月透镜', color: 0x9db8d9, shape: 'lens',
    text: '每场战斗开始时，多抽 1 张牌。',
    mods: { bonusDraw: 1 }
  },
  blood_stone: {
    id: 'blood_stone', name: '血石', color: 0xc23b4a, shape: 'gem',
    text: '每次击杀敌人，回复 5 点生命。',
    mods: { killHeal: 5 }
  },
  thorn_charm: {
    id: 'thorn_charm', name: '荆棘护符', color: 0x7a8f5a, shape: 'thorns',
    text: '每回合开始时，获得 2 点格挡。',
    mods: { turnStartBlock: 2 },
    shape: 'thorns'
  },
  marrow_vial: {
    id: 'marrow_vial', name: '骨髓药瓶', color: 0x6b9b5a, shape: 'vial',
    text: '每场战斗开始时，回复 10% 生命上限。',
    mods: { combatHealPct: 0.10 }
  },
  whetstone: {
    id: 'whetstone', name: '磨刃石', color: 0xc8a86a, shape: 'coin',
    text: '每回合打出的第一张攻击牌，额外造成 3 点伤害。',
    mods: { firstAttackBonus: 3 }
  },
  hunter_charm: {
    id: 'hunter_charm', name: '猎人护符', color: 0x7a6a8f, shape: 'horn',
    text: '战斗胜利后，额外获得 15 金币。',
    mods: { goldBonus: 15 }
  },
  bone_totem: {
    id: 'bone_totem', name: '骸骨图腾', color: 0xe0d5b8, shape: 'skull',
    text: '最大生命 +12。',
    mods: { maxHpBonus: 12 }
  },

  /* ======================================================
   * 东方篇遗物 —— 挂在「灵韵 / 共鸣」这条新资源线上。
   *
   * 这不是补数量。符箓牌有 13 张，但原先 9 件遗物没有一件碰灵韵，
   * 纯符箓构筑等于主动放弃遗物系统——那是个构筑深度的洞。
   * 下面 5 件把新资源线接进 StS 那套「声明式 mods」框架，
   * 玩家在第四章之后能拿到真正针对符箓的强力件。
   * ====================================================== */
  bronze_mask: {
    id: 'bronze_mask', name: '青铜面具', color: 0x5c4a30, shape: 'ring',
    realm: 'shanhai', rarity: 'common',
    text: '每场战斗开始时，获得 2 点灵韵。',
    mods: { startSpirit: 2 }
  },
  cinnabar_seal: {
    id: 'cinnabar_seal', name: '朱砂印', color: 0x8a2b28, shape: 'blood',
    realm: 'shanhai', rarity: 'common',
    text: '符箓牌造成的伤害 +3。',
    mods: { talismanBonus: 3 }
  },
  thunder_bi: {
    id: 'thunder_bi', name: '雷纹璧', color: 0xc9a13f, shape: 'thunder',
    realm: 'shanhai', rarity: 'rare',
    text: '每回合开始时，共鸣 +1。（第一张符箓就享受减免）',
    mods: { resonanceStart: 1 }
  },
  unquenched_ember: {
    id: 'unquenched_ember', name: '不灭火种', color: 0xd97a2b, shape: 'flame',
    realm: 'shanhai', rarity: 'rare',
    text: '免疫灼烧。每回合开始时，失去 2 点生命。',
    mods: { burnImmune: 1, selfIgnite: 2 }
  },
  bone_urn: {
    id: 'bone_urn', name: '骨瓮', color: 0xe0d5b8, shape: 'bone',
    realm: 'shanhai', rarity: 'rare',
    text: '每场战斗开始时，本场灵韵上限 +1。',
    mods: { spiritMaxPerFight: 1 }
  }
};

/* 遗物掉落池：稀有度简单分层就够了。
 * 两个世界各一套——东方篇不给哥特遗物，反之亦然，
 * 否则玩家在墟里捡到「磨刃石」会发现自己完全用不上。 */
const RELIC_POOL_COMMON  = ['iron_ring', 'thorn_charm', 'marrow_vial', 'whetstone'];
const RELIC_POOL_RARE    = ['wolf_totem', 'moon_lens', 'blood_stone', 'hunter_charm', 'bone_totem'];
const RELIC_POOL_SHANHAI_COMMON = ['bronze_mask', 'cinnabar_seal'];
const RELIC_POOL_SHANHAI_RARE   = ['thunder_bi', 'unquenched_ember', 'bone_urn'];

function getRelic(id) { return RELIC_DEFS[id]; }

function rollRelic(realm) {
  const r = realm || (typeof RUN !== 'undefined' ? RUN.realm() : 'gothic');
  const owned = RUN.relics;
  const pick = (arr) => arr.filter(id => owned.indexOf(id) < 0);
  const isShan = r === 'shanhai';
  let c = pick(isShan ? RELIC_POOL_SHANHAI_COMMON : RELIC_POOL_COMMON);
  let r2 = pick(isShan ? RELIC_POOL_SHANHAI_RARE : RELIC_POOL_RARE);
  // 稀有度加权：25% 出稀有
  if (r2.length && Math.random() < 0.25) return r2[Math.floor(Math.random() * r2.length)];
  if (c.length) return c[Math.floor(Math.random() * c.length)];
  if (r2.length) return r2[Math.floor(Math.random() * r2.length)];
  // 本世界的池子空了：退回另一个世界，宁可给一件次优的也别卡住奖励流程
  const c2 = pick(isShan ? RELIC_POOL_COMMON : RELIC_POOL_SHANHAI_COMMON);
  const r3 = pick(isShan ? RELIC_POOL_RARE : RELIC_POOL_SHANHAI_RARE);
  if (c2.length) return c2[Math.floor(Math.random() * c2.length)];
  if (r3.length) return r3[Math.floor(Math.random() * r3.length)];
  return null;
}
