import { ImageResponse } from 'next/og';
import { fetchEventBySlug } from '@/lib/api';
import { formatWatDateTime } from '@/lib/campus-data';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function EventOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  const title = event?.title ?? 'CampusPulse Event';
  const venue = event?.venueName ?? 'University of Ibadan';
  const organizer = event?.organizer.name ?? 'Verified UI Club';
  const rsvpCount = event?.rsvpCount ?? 0;
  const dateStr = event ? formatWatDateTime(event.startsAt).compactLabel : 'Live on CampusPulse';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px',
        background: '#10002B',
        color: '#FFFFFF',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            padding: '8px 20px',
            borderRadius: '999px',
            background: '#5A189A',
            color: '#E0AAFF',
            fontSize: '24px',
            fontWeight: 700,
          }}
        >
          CampusPulse · University of Ibadan
        </div>
        <div
          style={{
            fontSize: '24px',
            color: '#E0AAFF',
            fontWeight: 600,
          }}
        >
          {rsvpCount} going · Free RSVP
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '26px', color: '#E0AAFF', fontWeight: 600 }}>
          Hosted by {organizer} ✓
        </div>
        <div
          style={{
            fontSize: '60px',
            fontWeight: 800,
            lineHeight: 1.1,
            color: '#FFFFFF',
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '2px solid #2F1A5E',
          paddingTop: '24px',
          fontSize: '26px',
          color: '#F3ECFB',
        }}
      >
        <div>{dateStr} WAT</div>
        <div>{venue}</div>
      </div>
    </div>,
    size,
  );
}
