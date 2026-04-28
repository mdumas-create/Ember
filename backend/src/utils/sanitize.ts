import xss from 'xss';

const options = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
} as any;

export const sanitizeText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return xss(value, options);
};
