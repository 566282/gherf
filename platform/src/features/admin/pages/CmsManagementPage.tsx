import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CmsCustomPage, CmsCustomPageBlock, CmsHomeContent, CmsPricingTableBlock } from '@/types';
import {
  buildDefaultCmsConfig,
  getCmsPageLabel,
  listCmsRevisions,
  listCmsOperationalSnapshot,
  publishCmsConfig,
  rollbackCmsRevision,
  scheduleCmsPublish,
  updateCmsConfig,
  type CmsConfig,
  type CmsContentItem,
  type CmsPageContent,
  type CmsPageKey,
  type CmsPublicationStatus,
  type CmsRevision,
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

function fieldLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function updateNestedValue<T>(source: T, path: Array<string | number>, value: unknown): T {
  const clone = structuredClone(source);
  let target: unknown = clone;
  path.slice(0, -1).forEach((part) => { target = (target as Record<string | number, unknown>)[part]; });
  (target as Record<string | number, unknown>)[path[path.length - 1]] = value;
  return clone;
}

function HomeContentFields({ value, path = [], onChange }: { value: unknown; path?: Array<string | number>; onChange: (path: Array<string | number>, value: unknown) => void }): JSX.Element {
  if (typeof value === 'string') {
    const key = String(path[path.length - 1]);
    return <label className="grid gap-2"><span className="text-xs uppercase tracking-[0.16em] text-mist/55">{fieldLabel(key)}</span><textarea className="input-base min-h-20" value={value} onChange={(event) => onChange(path, event.target.value)} /></label>;
  }
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === 'string')) {
      return <label className="grid gap-2"><span className="text-xs uppercase tracking-[0.16em] text-mist/55">{fieldLabel(String(path[path.length - 1]))}</span><textarea className="input-base min-h-28" value={(value as string[]).join('\n')} onChange={(event) => onChange(path, event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean))} /><span className="form-hint">One entry per line.</span></label>;
    }
    return <div className="grid gap-3 xl:grid-cols-2">{value.map((entry, index) => <div key={index} className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="mb-3 text-xs uppercase tracking-[0.18em] text-mist/50">Item {index + 1}</p><HomeContentFields value={entry} path={[...path, index]} onChange={onChange} /></div>)}</div>;
  }
  const objectEntries = Object.entries(value as Record<string, unknown>).filter(([key]) => !(path.length === 0 && key === 'pricing'));
  return <div className="grid gap-3 xl:grid-cols-2">{objectEntries.map(([key, entry]) => <div key={key} className={typeof entry === 'object' ? 'xl:col-span-2' : ''}>{typeof entry === 'object' ? <p className="mb-3 text-sm font-medium text-mint/75">{fieldLabel(key)}</p> : null}<HomeContentFields value={entry} path={[...path, key]} onChange={onChange} /></div>)}</div>;
}

function HomeContentEditor({ content, onChange }: { content: CmsHomeContent; onChange: (content: CmsHomeContent) => void }): JSX.Element {
  return (
    <div className="mt-6 rounded-2xl border border-ember/20 bg-ember/5 p-5">
      <p className="text-sm uppercase tracking-[0.24em] text-ember/80">Homepage extended content</p>
      <p className="mt-2 mb-3 text-sm text-mist/65">Navigation, metrics, sections, testimonials, FAQs, pricing, and footer content.</p>
      <p className="mb-5 text-xs uppercase tracking-[0.18em] text-mist/45">Pricing tables on custom pages stay independent; this one controls the homepage only.</p>
      <HomeContentFields value={content} onChange={(path, value) => onChange(updateNestedValue(content, path, value))} />
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-mint/70">Homepage pricing table</p>
            <p className="mt-1 text-sm text-mist/65">Edit the pricing table shown on the homepage hero/content area.</p>
          </div>
        </div>
        <PricingTableEditor
          value={content.pricing}
          onChange={(pricing) => onChange({ ...content, pricing })}
        />
      </div>
    </div>
  );
}

function createCustomPageDraft(existingSlugs: string[] = []): CmsCustomPage {
  const baseSlug = 'custom-page';
  let index = 1;
  let slug = baseSlug;
  while (existingSlugs.includes(slug)) {
    index += 1;
    slug = `${baseSlug}-${index}`;
  }

  return {
    slug,
    eyebrow: 'Custom page',
    title: 'New custom page',
    summary: 'Add a short summary for the public page.',
    body: 'Write the main page copy here.',
    ctaLabel: 'Learn more',
    ctaHref: '/',
    highlights: ['Add a clear highlight', 'Keep the page focused'],
    blocks: [],
    items: [
      {
        title: 'Section title',
        body: 'Section body text.',
        meta: 'Overview',
      },
    ],
  };
}

function createPricingTableBlock(): CmsCustomPageBlock {
  return {
    id: crypto.randomUUID(),
    type: 'pricingTable',
    content: structuredClone(buildDefaultCmsConfig().pages.home.homeContent!.pricing),
  };
}

function duplicatePricingTableBlock(block: CmsCustomPageBlock): CmsCustomPageBlock {
  return {
    id: crypto.randomUUID(),
    type: block.type,
    content: structuredClone(block.content),
  };
}

function PricingTableEditor({ value, onChange }: { value: CmsPricingTableBlock; onChange: (value: CmsPricingTableBlock) => void }): JSX.Element {
  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Badge</span>
          <input className="input-base" value={value.badge} onChange={(event) => onChange({ ...value, badge: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Title</span>
          <input className="input-base" value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Description</span>
          <textarea className="input-base min-h-24" value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
        </label>
      </div>

      <div className="space-y-3">
        {value.tiers.map((tier, index) => (
          <div key={`${tier.name}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Tier {index + 1}</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">Name</span>
                <input
                  className="input-base"
                  value={tier.name}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'name'], event.target.value))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">Price</span>
                <input
                  className="input-base"
                  value={tier.price}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'price'], event.target.value))}
                />
              </label>
              <label className="grid gap-2 xl:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">Description</span>
                <textarea
                  className="input-base min-h-24"
                  value={tier.description}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'description'], event.target.value))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">CTA label</span>
                <input
                  className="input-base"
                  value={tier.ctaLabel}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'ctaLabel'], event.target.value))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">CTA href</span>
                <input
                  className="input-base"
                  value={tier.ctaHref}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'ctaHref'], event.target.value))}
                />
              </label>
              <label className="grid gap-2 xl:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-mist/55">Features</span>
                <textarea
                  className="input-base min-h-24"
                  value={joinLines(tier.features)}
                  onChange={(event) => onChange(updateNestedValue(value, ['tiers', index, 'features'], splitLines(event.target.value)))}
                />
                <span className="form-hint">One feature per line.</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomPageBlocksEditor({
  blocks,
  onBlocksChange,
}: {
  blocks: CmsCustomPageBlock[];
  onBlocksChange: (blocks: CmsCustomPageBlock[]) => void;
}): JSX.Element {
  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) {
      return;
    }

    const nextBlocks = [...blocks];
    const [block] = nextBlocks.splice(index, 1);
    nextBlocks.splice(nextIndex, 0, block);
    onBlocksChange(nextBlocks);
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Page blocks</p>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5 disabled:opacity-50"
          onClick={() => onBlocksChange([...blocks, createPricingTableBlock()])}
        >
          Add pricing table
        </button>
      </div>

      {blocks.length === 0 ? <p className="text-sm text-mist/60">No blocks yet. Add the pricing table to place it on this page.</p> : null}

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-mist/50">{block.type === 'pricingTable' ? 'Pricing table' : block.type}</p>
              <p className="mt-1 text-sm text-mist/65">This pricing table instance has its own copy of the content.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5 disabled:opacity-50"
                onClick={() => moveBlock(index, -1)}
                disabled={index === 0}
              >
                Move up
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5 disabled:opacity-50"
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
              >
                Move down
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5"
                onClick={() => onBlocksChange([...blocks.slice(0, index + 1), duplicatePricingTableBlock(block), ...blocks.slice(index + 1)])}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5"
                onClick={() => onBlocksChange(blocks.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </button>
            </div>
          </div>
          {block.type === 'pricingTable' ? (
            <div className="mt-4">
              <PricingTableEditor
                value={block.content}
                onChange={(content) => onBlocksChange(blocks.map((current, currentIndex) => (currentIndex === index ? { ...current, content } : current)))}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CustomPageEditor({
  page,
  onBlocksChange,
  onChange,
  onRemove,
}: {
  page: CmsCustomPage;
  onBlocksChange: (blocks: CmsCustomPageBlock[]) => void;
  onChange: (patch: Partial<CmsCustomPage>) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <Card className="border border-white/10 bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-ember/70">Custom page</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{page.title || 'Untitled page'}</h3>
        </div>
        <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mist/80 hover:bg-white/5" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Slug</span>
          <input className="input-base" value={page.slug} onChange={(event) => onChange({ slug: normalizeSlug(event.target.value) || 'custom-page' })} />
          <p className="form-hint">Public route uses `/pages/{page.slug || 'custom-page'}`.</p>
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">Eyebrow</span>
          <input className="input-base" value={page.eyebrow} onChange={(event) => onChange({ eyebrow: event.target.value })} />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Title</span>
          <input className="input-base" value={page.title} onChange={(event) => onChange({ title: event.target.value })} />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Summary</span>
          <textarea className="input-base min-h-24" value={page.summary} onChange={(event) => onChange({ summary: event.target.value })} />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Body</span>
          <textarea className="input-base min-h-28" value={page.body} onChange={(event) => onChange({ body: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">CTA label</span>
          <input className="input-base" value={page.ctaLabel} onChange={(event) => onChange({ ctaLabel: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-mist/70">CTA href</span>
          <input className="input-base" value={page.ctaHref} onChange={(event) => onChange({ ctaHref: event.target.value })} />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm text-mist/70">Highlights</span>
          <textarea className="input-base min-h-24" value={joinLines(page.highlights)} onChange={(event) => onChange({ highlights: splitLines(event.target.value) })} />
          <span className="form-hint">One highlight per line.</span>
        </label>
      </div>

      <CustomPageBlocksEditor
        blocks={page.blocks}
        onBlocksChange={onBlocksChange}
      />

      <div className="mt-5 space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Content items</p>
        <div className="grid gap-3 xl:grid-cols-2">
          {page.items.map((item, index) => (
            <div key={`${page.slug}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Item label</span>
                  <input className="input-base" value={item.meta ?? ''} onChange={(event) => onChange({ items: updateNestedValue(page.items, [index, 'meta'], event.target.value) })} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Title</span>
                  <input className="input-base" value={item.title} onChange={(event) => onChange({ items: updateNestedValue(page.items, [index, 'title'], event.target.value) })} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Body</span>
                  <textarea className="input-base min-h-24" value={item.body} onChange={(event) => onChange({ items: updateNestedValue(page.items, [index, 'body'], event.target.value) })} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-mist/50">Link target</span>
                  <input className="input-base" value={item.href ?? ''} onChange={(event) => onChange({ items: updateNestedValue(page.items, [index, 'href'], event.target.value) })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function CustomPagesEditor({
  pages,
  onChange,
}: {
  pages: CmsCustomPage[];
  onChange: (pages: CmsCustomPage[]) => void;
}): JSX.Element {
  const existingSlugs = pages.map((page) => page.slug);

  const updatePage = (index: number, patch: Partial<CmsCustomPage>) => {
    const nextPages = [...pages];
    nextPages[index] = { ...nextPages[index], ...patch };
    onChange(nextPages);
  };

  const updatePageItem = (index: number, itemIndex: number, patch: Partial<CmsContentItem>) => {
    const nextPages = [...pages];
    const items = [...nextPages[index].items];
    items[itemIndex] = { ...items[itemIndex], ...patch };
    nextPages[index] = { ...nextPages[index], items };
    onChange(nextPages);
  };

  return (
    <Card className="border border-white/10 bg-white/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-ember/70">Custom pages</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Create new public pages</h2>
          <p className="mt-2 max-w-3xl text-sm text-mist/70">These pages are stored in Supabase and can be routed at `/pages/:slug`.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-ember px-4 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(201,130,78,0.2)]"
          onClick={() => onChange([...pages, createCustomPageDraft(existingSlugs)])}
        >
          Add page
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {pages.length === 0 ? <p className="text-sm text-mist/60">No custom pages yet. Add one to start publishing routes from the CMS.</p> : null}
        {pages.map((page, index) => (
          <CustomPageEditor
            key={page.slug || index}
            page={page}
            onBlocksChange={(blocks) => updatePage(index, { blocks })}
            onChange={(patch) => updatePage(index, patch)}
            onRemove={() => onChange(pages.filter((_, pageIndex) => pageIndex !== index))}
          />
        ))}
      </div>
    </Card>
  );
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
  onHomeContentChange,
}: {
  pageKey: CmsPageKey;
  page: CmsPageContent;
  onPageChange: (patch: Partial<CmsPageContent>) => void;
  onItemChange: (index: number, patch: Partial<CmsContentItem>) => void;
  onHomeContentChange: (content: CmsHomeContent) => void;
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

      {pageKey === 'home' && page.homeContent ? <HomeContentEditor content={page.homeContent} onChange={onHomeContentChange} /> : null}
    </Card>
  );
}

export function CmsManagementPage(): JSX.Element {
  const [config, setConfig] = useState<CmsConfig>(buildDefaultCmsConfig());
  const [documentStates, setDocumentStates] = useState<Record<CmsPageKey, { status: CmsPublicationStatus; version: number; scheduledPublishAt: string | null }>>({});
  const [statusMessage, setStatusMessage] = useState('Loading CMS content...');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [revisionPage, setRevisionPage] = useState<CmsPageKey>('home');
  const [revisions, setRevisions] = useState<CmsRevision[]>([]);
  const lastSavedConfig = useRef('');

  useEffect(() => {
    void listCmsOperationalSnapshot()
      .then((snapshot) => {
        setConfig(snapshot.config);
        setDocumentStates(snapshot.documents);
        lastSavedConfig.current = JSON.stringify(snapshot.config);
        setIsLoading(false);
        setStatusMessage('CMS content loaded from Supabase-backed storage.');
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

  useEffect(() => {
    if (isLoading) return;
    void listCmsRevisions(revisionPage).then(setRevisions).catch(() => setRevisions([]));
  }, [isLoading, revisionPage]);

  const summary = useMemo(() => {
    const totalItems = Object.values(config.pages).reduce((count, page) => count + page.items.length, 0);
    const totalHighlights = Object.values(config.pages).reduce((count, page) => count + page.highlights.length, 0);
    const missingSiteName = !config.siteName.trim();
    const customPages = config.customPages.length;

    return {
      pages: pageOrder.length,
      totalItems,
      totalHighlights,
      missingSiteName,
      customPages,
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
      setStatusMessage('CMS draft saved to Supabase-backed storage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (summary.missingSiteName) {
      setStatusMessage('Site name is required before publishing CMS content.');
      return;
    }

    setIsPublishing(true);
    try {
      await updateCmsConfig(config);
      await publishCmsConfig(config);
      setDocumentStates((current) => Object.fromEntries(pageOrder.map((pageKey) => [pageKey, { ...current[pageKey], status: 'published', version: (current[pageKey]?.version ?? 0) + 1, scheduledPublishAt: null }])) as typeof current);
      lastSavedConfig.current = JSON.stringify(config);
      setStatusMessage('CMS content published and publicly available.');
    } catch {
      setStatusMessage('Unable to publish CMS content right now.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledPublishAt) {
      setStatusMessage('Choose a future publication time first.');
      return;
    }

    setIsPublishing(true);
    try {
      const isoTime = new Date(scheduledPublishAt).toISOString();
      await updateCmsConfig(config);
      await scheduleCmsPublish(config, isoTime);
      setDocumentStates((current) => Object.fromEntries(pageOrder.map((pageKey) => [pageKey, { ...current[pageKey], status: 'scheduled', version: (current[pageKey]?.version ?? 0) + 1, scheduledPublishAt: isoTime }])) as typeof current);
      setStatusMessage(`CMS content scheduled for ${new Date(isoTime).toLocaleString()}.`);
    } catch {
      setStatusMessage('Unable to schedule CMS content right now.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRollback = async (revisionId: string) => {
    try {
      const content = await rollbackCmsRevision(revisionPage, revisionId);
      setConfig((current) => updatePage(current, revisionPage, content));
      setStatusMessage(`Revision restored as a new draft for ${getCmsPageLabel(revisionPage)}.`);
      setRevisions(await listCmsRevisions(revisionPage));
    } catch {
      setStatusMessage('Unable to restore that CMS revision right now.');
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
              <p className="text-sm text-mist/60">Custom pages</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.customPages}</p>
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
              Each section below persists to Supabase-backed CMS storage, so administrators can update public-facing copy without a deploy.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={resetDefaults}>
              Reset defaults
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save CMS content'}
            </Button>
            <Button onClick={() => void handlePublish()} disabled={isPublishing}>
              {isPublishing ? 'Publishing...' : 'Publish now'}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-mist/70">{statusMessage}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-mist/60">Schedule publication</span>
            <input className="input-base" type="datetime-local" value={scheduledPublishAt} onChange={(event) => setScheduledPublishAt(event.target.value)} />
          </label>
          <Button variant="ghost" onClick={() => void handleSchedule()} disabled={isPublishing || !scheduledPublishAt}>
            Schedule release
          </Button>
          <p className="max-w-xl text-xs text-mist/60">Scheduling records the intended release and revision. The trusted <code>publish_scheduled_cms_documents</code> worker hook promotes it when the time arrives.</p>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-ember/70">Revision history</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Traceable content changes</h2>
            <p className="mt-2 text-sm text-mist/70">Restore a recorded publication or scheduled revision as a new draft before releasing it again.</p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-mist/60">Page</span>
            <select className="input-base" value={revisionPage} onChange={(event) => setRevisionPage(event.target.value as CmsPageKey)}>
              {pageOrder.map((pageKey) => <option key={pageKey} value={pageKey}>{getCmsPageLabel(pageKey)}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 space-y-2">
          {revisions.length === 0 ? <p className="text-sm text-mist/60">No revisions recorded for this page yet.</p> : null}
          {revisions.map((revision) => (
            <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="text-sm font-medium text-white">Version {revision.version} · {revision.status}</p>
                <p className="text-xs text-mist/60">{revision.changeSummary || 'Content change'} · {new Date(revision.createdAt).toLocaleString()}</p>
              </div>
              <Button variant="ghost" onClick={() => void handleRollback(revision.id)}>Restore as draft</Button>
            </div>
          ))}
        </div>
      </Card>

    <div className="space-y-4">
      <label className="grid gap-2">
        <span className="text-sm text-mist/70">Site name</span>
        <input className="input-base max-w-xl" value={config.siteName} onChange={(event) => setConfig((current) => ({ ...current, siteName: event.target.value }))} />
          <p className="form-hint">This name appears in the public app header and page metadata.</p>
          {summary.missingSiteName ? <p className="form-error">Site name is required.</p> : null}
        </label>
      </div>

      <CustomPagesEditor
        pages={config.customPages}
        onChange={(customPages) => setConfig((current) => ({ ...current, customPages }))}
      />

      <div className="space-y-6">
        {pageOrder.map((pageKey) => (
          <div key={pageKey} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 px-1 text-xs uppercase tracking-[0.18em] text-mist/60">
              <span>{getCmsPageLabel(pageKey)}</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{documentStates[pageKey]?.status ?? 'draft'}</span>
              <span>v{documentStates[pageKey]?.version ?? 0}</span>
              {documentStates[pageKey]?.scheduledPublishAt ? <span>scheduled {new Date(documentStates[pageKey].scheduledPublishAt as string).toLocaleString()}</span> : null}
            </div>
            <CmsSectionEditor
              pageKey={pageKey}
              page={config.pages[pageKey]}
              onPageChange={(patch) => setConfig((current) => updatePage(current, pageKey, patch))}
              onItemChange={(index, patch) => setConfig((current) => updatePageItem(current, pageKey, index, patch))}
              onHomeContentChange={(homeContent) => setConfig((current) => updatePage(current, pageKey, { homeContent }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
