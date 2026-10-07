import fs from 'fs';
let p = 'packages/ui/src/BrandAccordion.astro';
let c = fs.readFileSync(p, 'utf8');

const newContent = `
                  <h3 class="bacc-headline">
                    {brand.headline.split('\\n').map((l: string, k: number) => (
                      <>{k > 0 && <br/>}{l}</>
                    ))}
                  </h3>
                  
                  {brand.stats && brand.stats.length > 0 && (
                    <div class="bacc-stats">
                      {brand.stats.map((s: any) => (
                        <div class="bacc-stat">
                          <p class="bacc-stat-value">{s.value}</p>
                          <p class="bacc-stat-label">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {brand.offers && brand.offers.length > 0 && (
                    <ul class="bacc-offers">
                      {brand.offers.map((o: any) => (
                        <li class="bacc-offer">
                          <h4 class="bacc-offer-title">{o.title}</h4>
                          <p class="bacc-offer-desc">{o.desc}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p class="bacc-deck">{brand.deck}</p>
                  
                  {brand.copy && brand.copy.length > 0 && (
                    <div class="bacc-copy">
                      {brand.copy.map((pText: string) => (
                        <p>{pText}</p>
                      ))}
                    </div>
                  )}
`;

c = c.replace(/<h3 class="bacc-headline">[\s\S]*?<p class="bacc-deck">\{brand\.deck\}<\/p>/, newContent);

// Let's add the styles!
c += `
<style>
  .bacc-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.15);
    margin: 1.5rem 0;
  }
  @media (min-width: 640px) {
    .bacc-stats { grid-template-columns: repeat(4, 1fr); }
  }
  .bacc-stat {
    background: #000;
    padding: 1rem;
    text-align: center;
  }
  .bacc-stat-value {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25rem;
    margin: 0 0 0.25rem;
    color: #fff;
  }
  .bacc-stat-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .bacc-offers {
    list-style: none;
    margin: 1.5rem 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  @media (min-width: 640px) {
    .bacc-offers { grid-template-columns: repeat(3, 1fr); }
  }
  .bacc-offer {
    background: #000;
    padding: 1rem;
  }
  .bacc-offer-title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1rem;
    color: #fff;
    margin: 0 0 0.25rem;
  }
  .bacc-offer-desc {
    font-family: var(--font-body);
    font-size: 0.85rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
  }

  .bacc-copy {
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
    margin: 1.25rem 0;
  }
  .bacc-copy p {
    margin: 0 0 1rem;
  }
  .bacc-copy p:last-child {
    margin-bottom: 0;
  }
</style>
`;

fs.writeFileSync(p, c);
