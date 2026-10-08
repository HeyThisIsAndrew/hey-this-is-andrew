import React, { useState, useMemo } from 'react';
import { parseEventDateToLocal, formatEventDateRange } from '../lib/events';
import './DesktopCalendar.css';

export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate?: string;
  brandColor?: string;
  slug?: { current: string } | string;
}

export interface DesktopCalendarProps {
  events: CalendarEvent[];
}

interface CalendarSegment {
  id: string;
  row: number;
  colStart: number;
  colEnd: number;
  span: number;
  color: string;
  slug: string;
  title: string;
  isStart: boolean;
  isEnd: boolean;
  isContinuation: boolean;
  isPast: boolean;
  overlapIndex?: number;
}

const DesktopCalendar: React.FC<DesktopCalendarProps> = ({ events }) => {
  /*
    ─── WHY THE GRID WAITS FOR THE DIALOG TO OPEN ──────────────────────────

    This island is hydrated with client:load, which is not negotiable — the
    calendar exists only after hydration, and every deferred directive has a
    way of never arriving here (see SpanningCalendarModal.astro). But
    client:load used to mean the ENTIRE calendar was built during page load:
    the month grid memo, 31 day cells, the event list and every positioned
    segment, all rendered and laid out inside a dialog nobody had opened.

    On the CI gate's throttled profile that was the single largest cost on
    /events — the page's whole React island doing its most expensive work
    before the user had expressed any interest in it, and it cost the 90%
    performance threshold.

    So hydration stays eager and the WORK is what defers. Until the host
    <dialog> is actually opened this renders the same cheap skeleton it
    server-rendered, and the memo below short-circuits rather than building a
    grid nobody can see. Opening the dialog flips the latch and the real
    calendar renders synchronously — a plain re-render, imperceptible, and by
    then the page has long finished loading.

    `hasOpened` is a latch rather than a mirror of `dialog.open`: once the
    calendar has been built there is nothing to gain by tearing it down on
    close, and keeping it makes reopening instant.
  */
  const [hasOpened, setHasOpened] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  /*
    The server renders the skeleton (no dialog is open during a static build)
    and so does the first client render, because `hasOpened` starts false.
    That byte-identical pair is what keeps hydration silent — it is the same
    guarantee the old `isMounted` flag provided, folded into the flag that now
    also gates the work.

    Reading the date in a lazy useState initializer keeps the grid on the
    USER's clock: on the client that runs during hydration, so the build
    machine's timezone never leaks into the month.
  */
  React.useEffect(() => {
    const dialog = hostRef.current?.closest('dialog');

    // Rendered outside a <dialog> (or the DOM moved): nothing to wait for, so
    // behave like a plain always-on calendar rather than staying a skeleton.
    if (!dialog) {
      setHasOpened(true);
      return;
    }

    if (dialog.open) {
      setHasOpened(true);
      return;
    }

    /*
      <dialog> has no "open" event — `close` exists, `open` does not — so the
      opening has to be observed rather than listened for. showModal() sets the
      `open` attribute, which is an attribute mutation and therefore something
      MutationObserver reports. Watching the attribute (rather than wiring into
      SpanningCalendarModal's script) keeps this component self-contained and
      correct no matter which code path opened the dialog: button, keyboard, or
      a future deep-link that calls showModal() directly.
    */
    const observer = new MutationObserver(() => {
      if (dialog.open) {
        setHasOpened(true);
        observer.disconnect();
      }
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });

    return () => observer.disconnect();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // EVERY hook must stay ABOVE the `if (!hasOpened)` early return below.
  //
  // This useMemo once sat beneath it, so render 1 (skeleton) ran three hooks
  // and render 2 ran four: "Rendered more hooks than during the previous
  // render" — React #310. React threw on the first state update and unmounted
  // the whole tree, so the calendar modal opened to an empty shell with only
  // its close bar, on every device, in production (hotfix 8314698). Adding a
  // hook after the return re-breaks it in exactly the same way.
  //
  // Hence the guard INSIDE the memo rather than around it: the hook still runs
  // on every render, it just declines to do the expensive part on the renders
  // whose result the early return would throw away.
  const { days, calendarSegments, sortedEvents, todayDate } = useMemo(() => {
    if (!hasOpened) {
      // todayDate stays a real Date rather than null so the code below keeps
      // its non-nullable type. It is never read: the only renders that reach
      // here are the ones the early return catches.
      return { days: [], calendarSegments: [], sortedEvents: [], todayDate: new Date() };
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const startingDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDays = lastDay.getDate();

    const _days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      _days.push({ day: 0, empty: true });
    }
    for (let i = 1; i <= totalDays; i++) {
      _days.push({ day: i, empty: false });
    }

    const currentMonthEvents = events.filter((event) => {
      if (!event.startDate) return false;
      const start = parseEventDateToLocal(event.startDate);
      const end = parseEventDateToLocal(event.endDate || event.startDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
      }

      return start <= monthEnd && end >= monthStart;
    });

    const _sortedEvents = [...currentMonthEvents].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );

    const _todayDate = new Date();
    _todayDate.setHours(0, 0, 0, 0);

    const rawSegments = currentMonthEvents.flatMap((event) => {
      const start = parseEventDateToLocal(event.startDate);
      const end = event.endDate ? parseEventDateToLocal(event.endDate) : start;

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return [];
      }

      const isPast = end < _todayDate;
      const startDay = start < monthStart ? 1 : start.getDate();
      const endDay = end > monthEnd ? totalDays : end.getDate();

      const startIndex = startingDayOfWeek + startDay - 1;
      const endIndex = startingDayOfWeek + endDay - 1;

      const startRow = Math.floor(startIndex / 7) + 1;
      const startCol = (startIndex % 7) + 1;
      const endRow = Math.floor(endIndex / 7) + 1;
      const endCol = (endIndex % 7) + 1;

      const color = event.brandColor || 'var(--color-accent, #cc0000)';
      const segments: CalendarSegment[] = [];

      const slug = (typeof event.slug === 'object' && event.slug !== null) 
        ? event.slug.current 
        : (event.slug || '');

      for (let row = startRow; row <= endRow; row++) {
        const colStart = row === startRow ? startCol : 1;
        const colEnd = row === endRow ? endCol : 7;
        const span = colEnd - colStart + 1;
        const isStart = row === startRow;
        const isEnd = row === endRow;

        segments.push({
          id: `${slug}-${row}`,
          row,
          colStart,
          colEnd,
          span,
          color,
          slug,
          title: event.title,
          isStart,
          isEnd,
          isContinuation: !isStart,
          isPast,
        });
      }

      return segments;
    });

    const segmentsPerRow: Record<number, CalendarSegment[]> = {};
    rawSegments.forEach((segment) => {
      if (!segmentsPerRow[segment.row]) segmentsPerRow[segment.row] = [];
      
      let overlapIndex = 0;
      const rowSegments = segmentsPerRow[segment.row];
      
      while (
        rowSegments.some(
          (s) =>
            s.overlapIndex === overlapIndex &&
            !(segment.colEnd < s.colStart || segment.colStart > s.colEnd)
        )
      ) {
        overlapIndex++;
      }
      
      segment.overlapIndex = overlapIndex;
      rowSegments.push(segment);
    });

    return {
      days: _days,
      calendarSegments: rawSegments,
      sortedEvents: _sortedEvents,
      todayDate: _todayDate
    };
  }, [events, year, month, currentDate, hasOpened]);


  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const realToday = new Date();
  const isCurrentOrPastMonth = year < realToday.getFullYear() || (year === realToday.getFullYear() && month <= realToday.getMonth());



  const formatDate = (dateStr: string) => formatEventDateRange(dateStr, undefined, { year: false });

  if (!hasOpened) {
    return (
      <div className="dc-container dc-skeleton" ref={hostRef}>
        <aside className="dc-sidebar">
          <div className="dc-sidebar-header">
            <div className="dc-sidebar-title">
              <h2 className="dc-month">Calendar</h2>
              <span className="dc-year">...</span>
            </div>
          </div>
          <div className="dc-event-list"></div>
        </aside>
        <main className="dc-main">
          <div className="dc-calendar-grid-wrapper">
            <div className="dc-calendar-header-row">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>
            <div className="dc-calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="dc-calendar-cell empty"
                  style={{
                    gridColumn: (i % 7) + 1,
                    gridRow: Math.floor(i / 7) + 1,
                  }}
                ></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Add global style variables via style prop to circumvent styled-jsx/astro scoping for inline styles
  return (
    <div className="dc-container" ref={hostRef}>
      <aside className="dc-sidebar">
        <div className="dc-sidebar-header">
          <div className="dc-sidebar-title">
            <h2 className="dc-month">
              {currentDate.toLocaleString('en-US', { month: 'short' })}
            </h2>
            <span className="dc-year">{currentDate.getFullYear()}</span>
          </div>
          <div className="dc-nav-buttons">
            <button 
              className={`dc-nav-btn ${isCurrentOrPastMonth ? 'disabled' : ''}`} 
              onClick={handlePrevMonth} 
              disabled={isCurrentOrPastMonth}
              aria-label="Previous Month"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="dc-nav-btn" onClick={handleNextMonth} aria-label="Next Month">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="dc-event-list">
          {sortedEvents.map((event) => {
            const eventEnd = parseEventDateToLocal(event.endDate || event.startDate);
            const isPast = eventEnd < todayDate;
            const slugStr = (typeof event.slug === 'object' && event.slug !== null) ? event.slug.current : (event.slug || '');
            
            return (
              /*
                A past event still links to its page.

                `href={isPast ? undefined : ...}` rendered a bare <a> with no
                href for anything already finished. That is not a link as far
                as the platform is concerned: Lighthouse failed /events on
                "Links are not crawlable" (SEO 92), and it also drops out of
                the tab order, so the item looked clickable but keyboard users
                could not reach it.

                Nothing was gained by it — the detail page for a past event is
                still generated and still serves (dist/client/events/sdcc-2026),
                and past coverage is exactly the archive material worth having
                indexed. `is-past` already carries the visual de-emphasis.
              */
              <a
                key={slugStr}
                href={`/events/${slugStr}`}
                className={`dc-event-item ${isPast ? 'is-past' : ''}`}
                data-event-id={slugStr}
                onMouseEnter={() => setHoveredEventId(slugStr)}
                onMouseLeave={() => setHoveredEventId(null)}
              >
                <div
                  className="dc-event-indicator"
                  style={{ backgroundColor: event.brandColor || 'var(--color-accent)' }}
                ></div>
                <div className="dc-event-content">
                  <h3 className="dc-event-title">{event.title}</h3>
                  <p className="dc-event-date">
                    {formatDate(event.startDate)}
                    {event.endDate &&
                      event.endDate !== event.startDate &&
                      ` - ${formatDate(event.endDate)}`}
                  </p>
                </div>
              </a>
            );
          })}
          {sortedEvents.length === 0 && <p className="dc-no-events">No events this month.</p>}
        </div>
      </aside>

      <main className="dc-main">
        <div className="dc-calendar-grid-wrapper">
          <div className="dc-calendar-header-row">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="dc-calendar-grid">
            {days.map((d, i) => (
              <div
                key={`day-${i}`}
                className={`dc-calendar-cell ${d.empty ? 'empty' : ''}`}
                style={{
                  gridColumn: (i % 7) + 1,
                  gridRow: Math.floor(i / 7) + 1,
                }}
              >
                {!d.empty && <span className="dc-day-number">{d.day}</span>}
              </div>
            ))}

            {calendarSegments.map((segment) => {
              const isHovered = hoveredEventId === segment.slug;
              /* Same reasoning as the event list above: a past event keeps its
                 link. This one degraded to a <div>, which is not crawlable or
                 focusable either — `is-past` carries the visual state instead. */
              const Element = 'a';
              return (
                <Element
                  key={segment.id}
                  href={`/events/${segment.slug}`}
                  data-event-id={segment.slug}
                  className={`dc-highlighter-bar ${segment.isStart ? 'is-start' : ''} ${
                    segment.isEnd ? 'is-end' : ''
                  } ${segment.isContinuation ? 'is-continuation' : ''} ${
                    segment.isPast ? 'is-past' : ''
                  } ${isHovered ? 'hover-active' : ''}`}
                  style={{
                    gridRow: segment.row,
                    gridColumn: `${segment.colStart} / span ${segment.span}`,
                    '--bar-color': segment.color,
                    '--overlap-index': segment.overlapIndex,
                  } as React.CSSProperties}
                  onMouseEnter={() => setHoveredEventId(segment.slug)}
                  onMouseLeave={() => setHoveredEventId(null)}
                >
                  {segment.isContinuation && (
                    <span className="dc-bar-cont" aria-hidden="true">
                      ↳{' '}
                    </span>
                  )}
                  <span className="dc-bar-label">{segment.title}</span>
                </Element>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DesktopCalendar;
