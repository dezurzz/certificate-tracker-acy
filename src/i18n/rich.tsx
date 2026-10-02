import React from 'react';
import type { TFunction } from './LanguageContext';

/**
 * Like t(), but placeholders can be React nodes (e.g. a bold name):
 *   rich(t, 'Halo {name}!', { name: <b>Budi</b> })
 */
export function rich(t: TFunction, key: string, nodes: Record<string, React.ReactNode>) {
  const parts = t(key).split(/(\{\w+\})/);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        return m && m[1] in nodes ? <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment> : part;
      })}
    </>
  );
}
