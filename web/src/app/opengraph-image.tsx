import { ImageResponse } from 'next/og';

export const alt = 'React Perf Profiler — Stop Guessing. Start Profiling.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0F1C',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: '20px' }}
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="#00E5FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="#00E5FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="#00E5FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: '24px',
              color: '#00E5FF',
              fontFamily: 'sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            REACT PERF PROFILER
          </span>
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 700,
            color: '#FFFFFF',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: '24px',
          }}
        >
          Stop Guessing.
          <br />
          Start Profiling.
        </div>
        <div
          style={{
            fontSize: '22px',
            color: '#94A3B8',
            fontFamily: 'sans-serif',
            textAlign: 'center',
          }}
        >
          Open-source React performance profiler — wasted renders, memoization
          scoring, AI fixes
        </div>
        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '40px',
          }}
        >
          <div
            style={{
              padding: '12px 32px',
              backgroundColor: '#0A84FF',
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '20px',
              fontFamily: 'sans-serif',
              fontWeight: 600,
            }}
          >
            Install Free
          </div>
          <div
            style={{
              padding: '12px 32px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              borderRadius: '12px',
              fontSize: '20px',
              fontFamily: 'sans-serif',
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            View on GitHub
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
