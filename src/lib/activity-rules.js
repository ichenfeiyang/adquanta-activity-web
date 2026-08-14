export const ACTIVITY_RULE_SECTIONS = [
  {
    id: "about",
    icon: "icons/sparkle.svg",
    titleKey: "rules.sections.about.title",
    paragraphKeys: ["rules.sections.about.body"],
  },
  {
    id: "coins",
    icon: "icons/gold_coin.svg",
    titleKey: "rules.sections.coins.title",
    paragraphKeys: ["rules.sections.coins.body"],
    noteKey: "rules.sections.coins.note",
  },
  {
    id: "checkin",
    icon: "icons/calendar_today.svg",
    titleKey: "rules.sections.checkin.title",
    paragraphKeys: [
      "rules.sections.checkin.body",
      "rules.sections.checkin.chest",
    ],
  },
  {
    id: "spin",
    icon: "icons/spin_s_80.svg",
    titleKey: "rules.sections.spin.title",
    paragraphKeys: ["rules.sections.spin.body"],
  },
  {
    id: "coinRain",
    icon: "icons/gold-coin-white.svg",
    titleKey: "rules.sections.coinRain.title",
    paragraphKeys: ["rules.sections.coinRain.body"],
    accent: true,
  },
  {
    id: "rewards",
    icon: "icons/card_giftcard.svg",
    titleKey: "rules.sections.rewards.title",
    paragraphKeys: [
      "rules.sections.rewards.body",
      "rules.sections.rewards.supported",
    ],
    noteKey: "rules.sections.rewards.rateNote",
  },
  {
    id: "topup",
    icon: "icons/phone_iphone.svg",
    titleKey: "rules.sections.topup.title",
    paragraphKeys: ["rules.sections.topup.intro"],
    stepKeys: [
      "rules.sections.topup.step1",
      "rules.sections.topup.step2",
      "rules.sections.topup.step3",
      "rules.sections.topup.step4",
    ],
    noteKey: "rules.sections.topup.unsupported",
  },
  {
    id: "giftCards",
    icon: "icons/card_giftcard.svg",
    titleKey: "rules.sections.giftCards.title",
    paragraphKeys: ["rules.sections.giftCards.intro"],
    stepKeys: [
      "rules.sections.giftCards.step1",
      "rules.sections.giftCards.step2",
      "rules.sections.giftCards.step3",
      "rules.sections.giftCards.step4",
    ],
  },
  {
    id: "recent",
    icon: "icons/verified.svg",
    titleKey: "rules.sections.recent.title",
    paragraphKeys: ["rules.sections.recent.body"],
  },
  {
    id: "feedback",
    icon: "icons/person.svg",
    titleKey: "rules.sections.feedback.title",
    paragraphKeys: ["rules.sections.feedback.body"],
  },
];

export const ACTIVITY_RULE_FAQS = Array.from({ length: 12 }, (_, index) => ({
  id: `faq${index + 1}`,
  questionKey: `rules.faq.items.${index + 1}.question`,
  answerKey: `rules.faq.items.${index + 1}.answer`,
  actionKey: index === 11 ? "feedback.hideAction" : undefined,
  requiresRewardsCenterHide: index === 11,
}));

export function getVisibleActivityRuleFaqs(rewardsCenterHideAvailable) {
  return ACTIVITY_RULE_FAQS.filter(
    (faq) => !faq.requiresRewardsCenterHide || rewardsCenterHideAvailable === true,
  );
}

export function getActivityRuleLocaleKeys() {
  const sectionKeys = ACTIVITY_RULE_SECTIONS.flatMap((section) => [
    section.titleKey,
    ...(section.paragraphKeys || []),
    ...(section.stepKeys || []),
    ...(section.noteKey ? [section.noteKey] : []),
  ]);
  const faqKeys = ACTIVITY_RULE_FAQS.flatMap((item) => [item.questionKey, item.answerKey]);

  return [
    "rules.entry",
    "rules.ariaLabel",
    "rules.eyebrow",
    "rules.title",
    "rules.subtitle",
    "rules.quickNav",
    "rules.sectionLabel",
    "rules.stepLabel",
    "rules.noteLabel",
    "rules.faq.title",
    "rules.faq.subtitle",
    "rules.done",
    ...sectionKeys,
    ...faqKeys,
  ];
}
