import { SitemapScreen } from './sitemap';

/**
 * Stands in for a screen until the unit that builds it lands — so the frame can reach every page
 * the sitemap gives this app. It draws no control of its own.
 */
export function PendingScreen({ screen }: { screen: SitemapScreen }) {
  return (
    <section className="pending">
      <h1>{screen.label}</h1>
      <p>หน้านี้ยังไม่พร้อมใช้งาน</p>
    </section>
  );
}
