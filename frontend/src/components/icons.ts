import { h, type FunctionalComponent } from 'vue';

interface IconProps {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  class?: string;
}

const createIcon = (name: string, content: any[]): FunctionalComponent<IconProps> => {
  return (props) => {
    const size = props.size || 24;
    const color = props.color || 'currentColor';
    const strokeWidth = props.strokeWidth || 2;

    return h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: `lucide lucide-${name} ${props.class || ''}`
    }, content.map(child => h(child.tag, child.attrs)));
  };
};

export const Copy = createIcon('copy', [
  { tag: 'rect', attrs: { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' } },
  { tag: 'path', attrs: { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' } }
]);

export const Check = createIcon('check', [
  { tag: 'path', attrs: { d: 'M20 6 9 17l-5-5' } }
]);

export const Plus = createIcon('plus', [
  { tag: 'path', attrs: { d: 'M5 12h14' } },
  { tag: 'path', attrs: { d: 'M12 5v14' } }
]);

export const RefreshCw = createIcon('refresh-cw', [
  { tag: 'path', attrs: { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' } },
  { tag: 'path', attrs: { d: 'M21 3v5h-5' } },
  { tag: 'path', attrs: { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' } },
  { tag: 'path', attrs: { d: 'M8 16H3v5' } }
]);

export const Users = createIcon('users', [
  { tag: 'path', attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
  { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
  { tag: 'path', attrs: { d: 'M22 21v-2a4 4 0 0 0-3-3.87' } },
  { tag: 'path', attrs: { d: 'M16 3.13a4 4 0 0 1 0 7.75' } }
]);

export const ArrowRight = createIcon('arrow-right', [
  { tag: 'path', attrs: { d: 'M5 12h14' } },
  { tag: 'path', attrs: { d: 'm12 5 7 7-7 7' } }
]);

export const Play = createIcon('play', [
  { tag: 'polygon', attrs: { points: '5 3 19 12 5 21 5 3', fill: 'currentColor', stroke: 'none' } } // Filled play icon
]);
