const fs = require('fs');

const isTSTerser = fs.existsSync(require.resolve('tsterser'));
let TSTerser;
if (isTSTerser) {
  TSTerser = require('tsterser');
} else {
  TSTerser = require('terser');
}
const { minify: tsterserMinify } = TSTerser;

const buildTSTerserOptions = ({
  ecma,
  warnings,
  parse = {},
  compress = {},
  mangle,
  module,
  output,
  toplevel,
  nameCache,
  ie8,
  /* eslint-disable camelcase */
  keep_classnames,
  keep_fnames,
  /* eslint-enable camelcase */
  safari10,
} = {}) => ({
  parse: { ...parse },
  compress: typeof compress === 'boolean' ? compress : { ...compress },
  // eslint-disable-next-line no-nested-ternary
  mangle:
    mangle == null
      ? true
      : typeof mangle === 'boolean'
      ? mangle
      : { ...mangle },
  output: {
    beautify: false,
    ...output,
  },
  // Ignoring sourceMap from options
  sourceMap: null,
  ecma,
  keep_classnames,
  keep_fnames,
  ie8,
  module,
  nameCache,
  safari10,
  toplevel,
  warnings,
});

function isObject(value) {
  const type = typeof value;

  return value != null && (type === 'object' || type === 'function');
}

const buildComments = (options, tsterserOptions, extractedComments) => {
  const condition = {};
  const commentsOpts = tsterserOptions.output.comments;
  const { extractComments } = options;

  condition.preserve =
    typeof commentsOpts !== 'undefined' ? commentsOpts : false;

  if (typeof extractComments === 'boolean' && extractComments) {
    condition.extract = 'some';
  } else if (
    typeof extractComments === 'string' ||
    extractComments instanceof RegExp
  ) {
    condition.extract = extractComments;
  } else if (typeof extractComments === 'function') {
    condition.extract = extractComments;
  } else if (isObject(extractComments)) {
    condition.extract =
      typeof extractComments.condition === 'boolean' &&
      extractComments.condition
        ? 'some'
        : typeof extractComments.condition !== 'undefined'
        ? extractComments.condition
        : 'some';
  } else {
    // No extract
    // Preserve using "commentsOpts" or "some"
    condition.preserve =
      typeof commentsOpts !== 'undefined' ? commentsOpts : 'some';
    condition.extract = false;
  }

  // Ensure that both conditions are functions
  ['preserve', 'extract'].forEach((key) => {
    let regexStr;
    let regex;

    switch (typeof condition[key]) {
      case 'boolean':
        condition[key] = condition[key] ? () => true : () => false;

        break;
      case 'function':
        break;
      case 'string':
        if (condition[key] === 'all') {
          condition[key] = () => true;

          break;
        }

        if (condition[key] === 'some') {
          condition[key] = (astNode, comment) => {
            return (
              (comment.type === 'comment2' || comment.type === 'comment1') &&
              /@preserve|@lic|@cc_on|^\**!/i.test(comment.value)
            );
          };

          break;
        }

        regexStr = condition[key];

        condition[key] = (astNode, comment) => {
          return new RegExp(regexStr).test(comment.value);
        };

        break;
      default:
        regex = condition[key];

        condition[key] = (astNode, comment) => regex.test(comment.value);
    }
  });

  // Redefine the comments function to extract and preserve
  // comments according to the two conditions
  return (astNode, comment) => {
    if (condition.extract(astNode, comment)) {
      const commentText =
        comment.type === 'comment2'
          ? `/*${comment.value}*/`
          : `//${comment.value}`;

      // Don't include duplicate comments
      if (!extractedComments.includes(commentText)) {
        extractedComments.push(commentText);
      }
    }

    return condition.preserve(astNode, comment);
  };
};

const minify = (options) => {
  const { file, input, inputSourceMap, minify: minifyFn } = options;

  if (minifyFn) {
    return minifyFn({ [file]: input }, inputSourceMap);
  }

  // Copy tsterser options
  const tsterserOptions = buildTSTerserOptions(options.tsterserOptions);

  // Let tsterser generate a SourceMap
  if (inputSourceMap) {
    tsterserOptions.sourceMap = { asObject: true };
  }

  const extractedComments = [];

  tsterserOptions.output.comments = buildComments(
    options,
    tsterserOptions,
    extractedComments
  );

  const { error, map, code, warnings } = tsterserMinify(
    { [file]: input },
    tsterserOptions
  );

  return { error, map, code, warnings, extractedComments };
};

function transform(options) {
  // 'use strict' => this === undefined (Clean Scope)
  // Safer for possible security issues, albeit not critical at all here
  // eslint-disable-next-line no-new-func, no-param-reassign
  options = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    `'use strict'\nreturn ${options}`
  )(exports, require, module, __filename, __dirname);

  const result = minify(options);

  if (result.error) {
    throw result.error;
  } else {
    return result;
  }
}

module.exports.minify = minify;
module.exports.transform = transform;
