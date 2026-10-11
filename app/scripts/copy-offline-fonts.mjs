import { copyFileSync, mkdirSync } from "node:fs";

// The two fonts of public/offline.html, at addresses that stay the same.
// The app's own stylesheet (app/assets/css/typography.css) gets its fonts
// through the build, under names that change with every version of a file,
// and the offline page, which is not built, can't know those. Run this from
// app/ after an update of the font packages: node scripts/copy-offline-fonts.mjs
const OFFLINE_FONTS = [
  ["bitter", "bitter-latin-700-normal.woff2"],
  ["nunito-sans", "nunito-sans-latin-400-normal.woff2"],
];

mkdirSync("public/fonts", { recursive: true });
for (const [fontPackage, file] of OFFLINE_FONTS) {
  copyFileSync(
    `node_modules/@fontsource/${fontPackage}/files/${file}`,
    `public/fonts/${file}`,
  );
}
console.log("Copied the offline page's fonts to public/fonts/");
