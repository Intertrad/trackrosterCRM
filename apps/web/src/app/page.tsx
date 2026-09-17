import Image from 'next/image';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f9fd',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Image src="/images/logo.png" alt="TrackRoster" width={90} height={90} priority />

        <h1
          style={{
            marginTop: '20px',
            marginBottom: '8px',
            color: 'var(--navy)',
            fontSize: '2rem',
          }}
        >
          TrackRoster
        </h1>

        <p style={{ color: 'var(--text-secondary)' }}>
          Every prospect, at the right time, by the right team.
        </p>
      </div>
    </main>
  );
}
