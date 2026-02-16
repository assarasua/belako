export type LoyaltyState = {
  attendance: number;
  spendUsd: number;
};

export type TierResult = {
  tier: 1 | 2 | 3;
  unlocked: boolean;
  reason: string;
};

export function evaluateTiers(state: LoyaltyState): TierResult[] {
  return [
    {
      tier: 1,
      unlocked: state.attendance >= 3,
      reason: `Attendance ${state.attendance}/3`
    },
    {
      tier: 2,
      unlocked: state.attendance >= 10 && state.spendUsd >= 50,
      reason: `Attendance ${state.attendance}/10, Spend $${state.spendUsd}/$50`
    },
    {
      tier: 3,
      unlocked: state.attendance >= 20 && state.spendUsd >= 150,
      reason: `Attendance ${state.attendance}/20, Spend $${state.spendUsd}/$150`
    }
  ];
}
