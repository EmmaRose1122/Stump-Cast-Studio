import { useTranslation } from 'react-i18next';

/**
 * Pro Look 2 is its own design set (K01–K25) and its own page — the 34 original Pro Looks and the
 * Graphics gallery are untouched. The designs render from `public/pro-look-2/index.html`, which is
 * the operator's broadcast mockup with the CDN Tailwind build and Google Fonts swapped for the
 * bundled copies, so an offline OBS machine shows the same pixels.
 *
 * `?demo=1` on the admin URL pins the page to the reference demo score for design comparison.
 */
export const ProLook2Page = () => {
  const { t } = useTranslation();
  const src = `./pro-look-2/index.html${window.location.search.includes('demo') ? '?demo=1' : ''}`;

  return (
    <div className="w-full">
      <h1 className="mb-1 font-heading text-2xl font-bold">{t('pages.proLook2.title')}</h1>
      <p className="mb-4 text-sm text-muted">{t('pages.proLook2.hint')}</p>
      <iframe
        data-testid="pro-look-2-frame"
        title="Pro Look 2 designs"
        src={src}
        // The page scales a 1280x720 stage, so it needs the full width it can get.
        className="h-[calc(100vh-260px)] min-h-[680px] w-full rounded-2xl border border-blue-100 bg-[#070b14]"
      />
    </div>
  );
};
