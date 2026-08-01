export default {
  rules: {
    'color-named': 'never',
    'color-no-hex': true,
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
      'color-mix',
    ],
    'selector-disallowed-list': [/\.ant-[a-zA-Z0-9_-]+/],
  },
};
