/**
 * Stylelint rules that `npm run build` fixes in the compiled CSS.
 *
 * Sass decides these details of its output, so they cannot be satisfied from
 * the SCSS sources: it chooses the blank lines, strips the quotes from
 * attribute selectors (`[type='text']` → `[type=text]`), and prints static
 * colors in legacy notation (`rgb(0 0 0 / 15%)` → `rgba(0, 0, 0, 0.15)`).
 */

const SASS_OUTPUT_RULES = new Set([
	"selector-attribute-quotes",
	"color-function-notation",
	"color-function-alias-notation",
	"alpha-value-notation",
]);

export function isBuildFixedRule(rule) {
	return /-empty-line-before$/.test(rule) || SASS_OUTPUT_RULES.has(rule);
}
