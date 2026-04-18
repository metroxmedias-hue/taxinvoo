export function hasAccess(plan, feature) {
  const access = {
    starter: [
      "basic_invoice",
      "client_management"
    ],
    growth: [
      "basic_invoice",
      "client_management",
      "unlimited_invoice",
      "reports",
      "reminders"
    ],
    pro: [
      "basic_invoice",
      "client_management",
      "unlimited_invoice",
      "reports",
      "reminders",
      "analytics",
      "multi_user"
    ]
  };

  return access[plan]?.includes(feature);
}
