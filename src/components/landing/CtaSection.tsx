interface Props {
  onLaunch: () => void;
}

export function CtaSection({ onLaunch }: Props) {
  return (
    <section className="landing-section landing-section-muted cta-section">
      <div className="landing-container">
        <div className="cta-inner">
          <h2 className="cta-title">
            Operate your wallet
            <br />
            with intelligence
          </h2>
          <p className="cta-desc">
            Connect your wallet, describe your intent, and let Ledgr handle simulation,
            execution, and audit — with full transparency at every step.
          </p>
          <button type="button" className="btn-primary btn-lg" onClick={onLaunch}>
            Launch Ledgr
          </button>
          <p className="cta-note">Sepolia testnet · No real funds at risk</p>
        </div>
      </div>
    </section>
  );
}
