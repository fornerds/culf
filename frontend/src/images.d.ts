declare module '*.png' {
  const value: string;
  export default value;
}
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.webp';
declare module '*.gif';
declare module '*.svg?react';
declare module '*.svg' {
  const value: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default value;
}
