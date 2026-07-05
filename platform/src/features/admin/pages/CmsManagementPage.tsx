import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  buildDefaultCmsConfig,
  getCmsPageLabel,
  listCmsConfig,
  updateCmsConfig,
  type CmsConfig,
  type CmsContentItem,
  type CmsPageContent,
  type CmsPageKey,
  cmsPageKeys,
} from '@/services/api/cms';

const pageOrder: CmsPageKey[] = [...cmsPageKeys];

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(value: string[]): string {
  return value.join('\n');
}

function updatePage(config: CmsConfig, pageKey: CmsPageKey, patch: Partial<CmsPageContent>): CmsConfig {
  return {
    ...config,
    pages: {
      ...config.pages,
      [pageKey]: {
        ...config.pages[pageKey],
        ...patch,
      },
    },
  };
}

function updatePageItem(config: CmsConfig, pageKey: CmsPageKey, index: number, patch: Partial<CmsContentItem>): CmsConfig {
  const items = [...config.pages[pageKey].items];

  items[index] = {
    ...items[index],
    ...patch,
  };

  return updatePage(config, pageKey, { items });
}

function CmsSectionEditor({
  pageKey,
  page,
  onPageChange,
  onItemChange,
}: {
  pageKey: CmsPageKey;
  page: CmsPageContent;
  onPageChange: (patch: Partial<CmsPageContent>) => void;
  onItemChange: (index: number, patch: Partial<CmsContentItem>) => void;
}) {
  return (
    <Card className="interactive-card border border-white/5 bg-white/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-ember/70">{getCmsPageLabel(pageKey)}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{page.title}</h3>
          <p className="mt-2 max-w-3xl text-sm text-mist/70">{page.summary}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-mist/60">
          {page.items.length} items
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Eyebrow</span>
          <input className="input-base" value={page.eyebrow} onChange={(event) => onPageChange({ eyebrow: event.target.value })} />
          <p className="form-hint">Short label shown above the section title.</p>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-mist/70">CTA label</span>
          <input className="input-base" value={page.ctaLabel} onChange={(event) => onPageChange({ ctaLabel: event.target.value })} />
          <p className="form-hint">Button copy shown to readers.</p>
        </label>

        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Title</span>
          <input className="input-base" value={page.title} onChange={(event) => onPageChange({ title: event.target.value })} />
          <p className="form-hint">Use a clear heading for the public page section.</p>
        </label>

        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Summary</span>
          <textarea className="input-base min-h-24" value={page.summary} onChange={(event) => onPageChange({ summary: event.target.value })} />
          <p className="form-hint">This appears as the supporting copy under the title.</p>
        </label>

        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Body</span>
          <textarea className="input-base min-h-28" value={page.body} onChange={(event) => onPageChange({ body: event.target.value })} />
          <p className="form-hint">Long-form explanation displayed in the page content area.</p>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-mist/70">CTA link</span>
          <input className="input-base" value={page.ctaHref} onChange={(event) => onPageChange({ ctaHref: event.target.value })} />
          <p className="form-hint">Internal links keep the router in control.</p>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Highlights</span>
          <textarea
            className="input-base min-h-28"
            value={joinLines(page.highlights)}
            onChange={(event) => onPageChange({ highlights: splitLines(event.target.value) })}
          />
          <p className="form-hint">Use one line per highlight.</p>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Content items</p>
        <div className="grid gap-3 xl:grid-cols-2">
          {page.items.map((item, index) => (
            <div key={`${pageKey}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Item label</span>
                  <input className="input-base" value={item.meta ?? ''} onChange={(event) => onItemChange(index, { meta: event.target.value })} />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Title</span>
                  <input className="input-base" value={item.title} onChange={(event) => onItemChange(index, { title: event.target.value })} />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Body</span>
                  <textarea className="input-base min-h-24" value={item.body} onChange={(event) => onItemChange(index, { body: event.target.value })} />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Link target</span>
                  <input className="input-base" value={item.href ?? ''} onChange={(event) => onItemChange(index, { href: event.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function CmsManagementPage(): JSX.Element {
  const [config, setConfig] = useState<CmsConfig>(buildDefaultCmsConfig());
  const [statusMessage, setStatusMessage] = useState('Loading CMS content...');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastSavedConfig = useRef('');

  useEffect(() => {
    void listCmsConfig()
      .then((nextConfig) => {
        setConfig(nextConfig);
        lastSavedConfig.current = JSON.stringify(nextConfig);
        setIsLoading(false);
        setStatusMessage('CMS content loaded from platform settings.');
      })
      .catch(() => {
        setIsLoading(false);
        setStatusMessage('Using local CMS defaults until settings are available.');
      });
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const snapshot = JSON.stringify(config);
    if (snapshot === lastSavedConfig.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage('Auto-saving CMS content...');
      void updateCmsConfig(config)
        .then(() => {
          lastSavedConfig.current = snapshot;
          setStatusMessage('CMS content auto-saved.');
        })
        .catch(() => setStatusMessage('Unable to auto-save CMS content right now.'));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [config, isLoading]);

  const summary = useMemo(() => {
    const totalItems = Object.values(config.pages).reduce((count, page) => count + page.items.length, 0);
    const totalHighlights = Object.values(config.pages).reduce((count, page) => count + page.highlights.length, 0);
    const missingSiteName = !config.siteName.trim();

    return {
      pages: pageOrder.length,
      totalItems,
      totalHighlights,
      missingSiteName,
    };
  }, [config]);

  const resetDefaults = () => {
    setConfig(buildDefaultCmsConfig());
    setStatusMessage('CMS content reset to defaults.');
  };

  const handleSave = async () => {
    if (summary.missingSiteName) {
      setStatusMessage('Site name is required before saving CMS content.');
      return;
    }

    setIsSaving(true);

    try {
      await updateCmsConfig(config);
      lastSavedConfig.current = JSON.stringify(config);
      setStatusMessage('CMS content saved to platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-transition space-y-8 p-6">
      {isLoading ? (
        <>
          <Card className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-3/5" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </Card>
          <Skeleton className="h-32" />
          <Skeleton className="h-14" />
          <Skeleton className="h-[46rem]" />
        </>
      ) : null}
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,156,76,0.18),transparent_34%),linear-gradient(135deg,rgba(10,12,16,0.97),rgba(20,24,31,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-ember/80">Phase 12 CMS</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Go4Wealth content management</h1>
            <p className="max-w-3xl text-base text-mist/80">
              Edit the homepage, about, FAQ, contact, news, announcements, help center, privacy policy, terms, blog, SEO, meta tags, Open Graph, sitemap, robots, custom URLs, landing pages, advertiser pages, and user guides from one admin workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[32rem] xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Site name</p>
              <p className="mt-2 text-2xl font-semibold text-white">{config.siteName}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Pages</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.pages}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Highlights</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.totalHighlights}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Content items</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.totalItems}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Editing mode</p>
              <p className="mt-2 text-2xl font-semibold text-white">Admin controlled</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Preview</p>
              <Link to="/" className="mt-2 inline-flex text-sm font-medium text-ember hover:underline">
                Open homepage
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-ember/70">Publishing controls</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Editable site-wide content</h2>
            <p className="mt-2 max-w-3xl text-mist/75">
              Each section below persists to platform settings, so administrators can update public-facing copy without a deploy.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={resetDefaults}>
              Reset defaults
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save CMS content'}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-mist/70">{statusMessage}</p>
      </Card>

      <div className="space-y-4">
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Site name</span>
          <input className="input-base max-w-xl" value={config.siteName} onChange={(event) => setConfig((current) => ({ ...current, siteName: event.target.value }))} />
          <p className="form-hint">This name appears in the public app header and page metadata.</p>
          {summary.missingSiteName ? <p className="form-error">Site name is required.</p> : null}
        </label>
      </div>

      <div className="space-y-6">
        {pageOrder.map((pageKey) => (
          <CmsSectionEditor
            key={pageKey}
            pageKey={pageKey}
            page={config.pages[pageKey]}
            onPageChange={(patch) => setConfig((current) => updatePage(current, pageKey, patch))}
            onItemChange={(index, patch) => setConfig((current) => updatePageItem(current, pageKey, index, patch))}
          />
        ))}
      </div>
    </div>
  );
}
