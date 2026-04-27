'use client';

import type { AdPreviewsResponse } from '@/lib/types';

type Props = {
  previews: AdPreviewsResponse;
  onClose: () => void;
};

const FORMAT_LABELS: Record<string, string> = {
  MOBILE_FEED_STANDARD: 'Mobile Feed',
  MARKETPLACE_MOBILE: 'Marketplace',
  RIGHT_COLUMN_STANDARD: 'Right Column',
  FACEBOOK_STORY_MOBILE: 'Story',
  INSTANT_ARTICLE_STANDARD: 'Instant Article',
};

export default function AdPreviewsModal({ previews, onClose }: Props) {
  const adIds = Object.keys(previews);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-800">
            Facebook Ad Previews ({adIds.length} ad{adIds.length === 1 ? '' : 's'})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-5">
          {adIds.map((adId) => (
            <div key={adId} className="rounded-md border border-zinc-200 p-4">
              <p className="mb-3 text-xs text-zinc-500">
                Ad ID: <code className="rounded bg-zinc-100 px-1">{adId}</code>
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {previews[adId].map((p, idx) => (
                  <div
                    key={`${adId}-${p.ad_format}-${idx}`}
                    className="overflow-hidden rounded-md border border-zinc-200"
                  >
                    <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700">
                      {FORMAT_LABELS[p.ad_format] ?? p.ad_format}
                    </div>
                    <div className="bg-white p-2">
                      {p.error ? (
                        <p className="text-xs text-red-600">{p.error}</p>
                      ) : p.preview?.body ? (
                        <div
                          // The preview is HTML/iframe markup from Meta
                          dangerouslySetInnerHTML={{ __html: p.preview.body }}
                          className="text-xs"
                        />
                      ) : (
                        <p className="text-xs text-zinc-400">No preview</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
