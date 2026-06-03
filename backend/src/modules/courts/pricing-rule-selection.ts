type PricingRuleCandidate = {
  applicableDay: number | null;
  effectiveFrom: Date | null;
  endTime: string;
  priorityGroupId: string | null;
  priorityOrder?: number | null;
  startTime: string;
};

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getSpecificityScore(rule: PricingRuleCandidate, userPriorityGroupId: string | null, weekday: number) {
  return {
    order: rule.priorityOrder ?? Number.MAX_SAFE_INTEGER,
    priority: rule.priorityGroupId !== null && rule.priorityGroupId === userPriorityGroupId ? 2 : 1,
    day: rule.applicableDay === weekday ? 1 : 0,
    span: minutesFromTime(rule.endTime) - minutesFromTime(rule.startTime),
    effectiveFrom: rule.effectiveFrom?.getTime() ?? 0,
    start: minutesFromTime(rule.startTime)
  };
}

export function selectMostSpecificPricingRule<T extends PricingRuleCandidate>(
  rules: T[],
  input: { userPriorityGroupId: string | null; weekday: number }
): T | undefined {
  return [...rules].sort((left, right) => {
    const leftScore = getSpecificityScore(left, input.userPriorityGroupId, input.weekday);
    const rightScore = getSpecificityScore(right, input.userPriorityGroupId, input.weekday);

    if (leftScore.order !== rightScore.order) {
      return leftScore.order - rightScore.order;
    }

    if (leftScore.priority !== rightScore.priority) {
      return rightScore.priority - leftScore.priority;
    }

    if (leftScore.day !== rightScore.day) {
      return rightScore.day - leftScore.day;
    }

    if (leftScore.span !== rightScore.span) {
      return leftScore.span - rightScore.span;
    }

    if (leftScore.effectiveFrom !== rightScore.effectiveFrom) {
      return rightScore.effectiveFrom - leftScore.effectiveFrom;
    }

    return leftScore.start - rightScore.start;
  })[0];
}
