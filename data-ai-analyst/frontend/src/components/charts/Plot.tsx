'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PlotParams } from 'react-plotly.js';

// Plotly is browser-only — disable SSR.
const Plot = dynamic<PlotParams>(() => import('react-plotly.js'), { ssr: false });

export default Plot as unknown as ComponentType<PlotParams>;
