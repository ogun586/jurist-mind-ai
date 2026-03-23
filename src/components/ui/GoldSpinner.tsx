export function GoldSpinner({ size = 28 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid rgba(201,168,76,0.15)`,
          borderTop: `3px solid #c9a84c`,
          borderRadius: '50%',
          animation: 'goldSpin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes goldSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
