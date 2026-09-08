'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface FinderOption { value: string; label: string; count?: number }

/**
 * The two dropdowns from the prototype: where you are, and what you need.
 *
 * Selecting does not navigate — Search does. That keeps one indexable URL per
 * city per category, which is the whole SEO argument, rather than filtering
 * a single page client-side where a search engine sees nothing.
 */
export default function Finder({
  hubs, categories, hub, category,
}: {
  hubs: FinderOption[];
  categories: FinderOption[];
  hub: string;
  category: string;
}) {
  const router = useRouter();
  const [h, setH] = useState(hub);
  const [c, setC] = useState(category);

  return (
    <div className="finder">
      <div className="fg">
        <label htmlFor="selHub">Location</label>
        <select id="selHub" value={h} onChange={(e) => setH(e.target.value)}>
          {hubs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}{o.count ? ` (${o.count})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="fg">
        <label htmlFor="selCat">What I need</label>
        <select id="selCat" value={c} onChange={(e) => setC(e.target.value)}>
          {categories.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <button className="fbtn" onClick={() => router.push(`/${h}/${c}`)}>Search</button>
    </div>
  );
}
