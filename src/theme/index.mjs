// index.mjs - template modules, rendered in this order (sitemap last: it lists ctx.pages). A module whose file does
// not exist yet is skipped with a warning, so lanes can build before the others have written theirs.
export const MODULES = ['home', 'shop', 'services', 'learn', 'pages', 'sitemap'];
