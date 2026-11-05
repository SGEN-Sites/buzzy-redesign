// _demo.mjs - FOUNDATION's lane-private components gallery (/_demo/). Built only with MODULES_EXTRA=_demo (never in
// MODULES, never in dist/). Every visible word is BUZZY's own (site.json / ia.json) or a neutral component label.
import { page, crumbsHtml, icon, hoursHtml, deliveryHoursHtml, specTable, serviceCards } from './shell.mjs';
import { esc, linkAttrs, gimg, demoForm, menu } from './util.mjs';

export async function render(ctx) {
  const s = ctx.site;
  const cats = ((ctx.ia.nav || []).find((n) => n.href === '/products/') || {}).children || [];
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Components', href: '/_demo/' }];
  const steps = (s.delivery.steps || []).map(([title, text], i) => `<li class="step" data-reveal style="--i:${i}"><span class="step__num">${String(i + 1).padStart(2, '0')}</span><h3 class="step__title">${esc(title.replace(/^\d+\.\s*/, ''))}</h3><p class="step__text">${esc(text)}</p></li>`).join('');
  const main = `
<section class="page-hero">
<div class="band__clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'band__bg', eager: true })}</div>
<div class="wrap page-hero__inner">
<div class="page-hero__text">
${crumbsHtml(crumbs)}
<p class="kicker">${esc(s.kicker)}</p>
<h1 class="display">Highly Curated <em class="accent">cannabis</em> in Brooklyn</h1>
<p class="lede">${esc(s.pickup.line)}</p>
<div class="btn-row"><a class="btn"${linkAttrs(menu(ctx))}>Shop Now${icon('arrow')}</a><a class="btn btn--ghost"${linkAttrs('/visit-us/')}>Visit BUZZY</a></div>
</div>
<div class="page-hero__art"><figure class="frame frame--float" data-depth="0.08">${gimg('g-vitrine', { alt: '', cls: 'frame__img' })}</figure></div>
</div>
</section>
<section class="band band--paper">
<div class="wrap">
<p class="kicker">Buttons + tags</p>
<h2 class="display">Delivering to <em class="accent">neighbors</em></h2>
<div class="btn-row" style="margin-top:24px"><a class="btn" href="#">Shop Now</a><a class="btn btn--signal" href="#">${esc(s.delivery.cta)}</a><a class="btn btn--ghost" href="#">Visit Us</a><a class="btn btn--sm" href="#">Small</a><a class="link-arrow" href="#">Delivery details${icon('arrow')}</a></div>
<div class="btn-row" style="margin-top:18px"><span class="tag">SKU / FLOWER</span><span class="tag tag--signal">ZONE 11201</span><span class="tag tag--ink">N° 04</span><a class="chip" href="#">Cobble Hill</a><button class="chip chip--signal" type="button">Gowanus</button></div>
</div>
</section>
<section class="band band--sky">
<div class="band__clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'band__bg' })}</div>
<div class="wrap">${serviceCards(ctx)}</div>
</section>
<section class="band band--fog band--grid">
<div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px">
<div><p class="kicker">Spec table</p>${specTable(s.delivery.facts)}</div>
<div><p class="kicker">Hours</p>${hoursHtml(ctx)}<p class="kicker" style="margin-top:24px">Delivery hours</p>${deliveryHoursHtml(ctx)}</div>
<div class="glass glass--lift" data-spot style="padding:24px"><p class="kicker">Glass</p><p>${esc(s.delivery.lede)}</p></div>
</div>
</section>
<section class="band band--paper"><div class="wrap"><ol class="steps">${steps}</ol></div></section>
<div class="ticker" data-marquee><ul class="ticker__list"><li class="ticker__item">HIGHLY CURATED</li><li class="ticker__item">${esc(s.topbarLine.split('|')[0].trim())}</li><li class="ticker__item">${esc((s.topbarLine.split('|')[1] || '').trim())}</li></ul></div>
<section class="band band--paper">
<div class="wrap" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px">
${cats.slice(0, 4).map((c, i) => `<a class="tile" data-reveal style="--i:${i}"${linkAttrs(c.href)}><span class="tile__media">${gimg(c.gimg, { alt: '' })}</span><span class="tile__title">${esc(c.label)}</span><span class="tile__cta">Click here${icon('arrow')}</span></a>`).join('')}
</div>
</section>
<section class="band band--night band--grid">
<div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;align-items:start">
<div><p class="kicker">${esc(s.rewards.kicker)}</p><h2 class="display">${esc(s.rewards.first)}</h2><p class="lede" style="margin-top:14px">${esc(s.rewards.line)}</p><div class="btn-row" style="margin-top:22px"><a class="btn btn--signal"${linkAttrs('/rewards/')}>${esc(s.rewards.cta)}</a><a class="btn btn--ghost" href="#">Rewards</a></div></div>
<div class="glass glass--dark" style="padding:24px">${specTable(s.delivery.facts.slice(0, 4))}</div>
<div class="faq"><details open><summary>Can I order online for pickup?</summary><div><p>${esc(s.pickup.faq)}</p></div></details><details><summary>Delivery</summary><div><p>${esc(s.deliveryLine)}</p></div></details></div>
</div>
</section>
<section class="band band--paper">
<div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px">
<article class="acard"><span class="acard__media">${gimg('g-guide', { alt: '' })}</span><p class="acard__meta">Education</p><h3 class="acard__title"><a href="#">The Buzzy Guide</a></h3><span class="acard__more">Read more${icon('arrow')}</span></article>
<article class="ecard"><span class="ecard__media">${gimg('g-events', { alt: '' })}<span class="ecard__date">Nov<strong>05</strong></span></span><p class="ecard__cat">Community Events</p><h3 class="ecard__title"><a href="#">Events</a></h3><p class="ecard__meta">${esc(s.address.street)}</p></article>
<div>${demoForm({ fields: ['Email'], button: 'Submit', cls: 'demo-form--inline' }).replace(/btn--sun/g, 'btn--signal')}</div>
</div>
</section>`;
  return [{ path: '/_demo/', html: page({ ctx, path: '/_demo/', title: 'Components | BUZZY', description: 'FOUNDATION component gallery for the BUZZY redesign.', main, crumbs, heroCrumbs: true }) }];
}
