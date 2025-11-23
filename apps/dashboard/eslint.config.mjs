import { nextjsConfig } from "@repo/eslint-config/nextjs";

export default [
  ...nextjsConfig,
  {
    rules: {
      "import/order": "off",
    },
  },
];
