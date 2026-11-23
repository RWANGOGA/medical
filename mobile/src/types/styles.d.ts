/**
 * Type declarations for global and CSS-module imports used by the web build.
 * Metro handles the actual bundling; TypeScript only needs to know the shapes.
 */
declare module "*.css";

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
