// CSS/SCSS module declarations
declare module "*.module.scss" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css?inline" {
  const content: string;
  export default content;
}

declare module "*.scss?inline" {
  const content: string;
  export default content;
}
